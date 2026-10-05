#!/usr/bin/env bash
# in-container.sh — upgrade-safety assertions, run inside a clean container.
# brain comes from the registry (@logikas/brain, ADR-0030); VCS_TOKEN only clones the sample consumer.
# Inputs (env): VCS_TOKEN (required), FROM_TAG, TO_TAG (required), CONSUMER_REPO (optional).
# Exits 0 only if every brain/scripts file that differs between FROM's and TO's package is TO's
# content in the consumer's managed copy after the upgrade AND every consumer customization survives.
# Tests PUBLISHED releases only: both FROM and TO must exist on the registry, else it SKIPs (exit 0).
set -u -o pipefail
FAILED=0
ok()   { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; FAILED=1; }
info() { echo "  · $*"; }
line() { echo; echo "═══ $* ═══"; }

[ -z "${VCS_TOKEN:-}" ] && { echo "✗ VCS_TOKEN required"; exit 2; }
FROM="${FROM_TAG:?FROM_TAG required}"
TO="${TO_TAG:?TO_TAG required}"
CONSUMER="${CONSUMER_REPO:-https://github.com/csrinaldi/samples-of-html5.git}"
PKG="@logikas/brain"            # ADR-0030: a scoped registry package, not a git URL
PKG_DIR="node_modules/${PKG}"

# Registry presence (#1325). `npm view` failing with E404 means "not published"; any other failure
# (network, registry 5xx) is an ERROR, not a skip. Limit: the E404 match reads npm's stderr text.
published() {
  local out
  if out=$(npm view "${PKG}@${1#v}" version 2>&1); then [ -n "$out" ] && return 0 || return 1; fi
  if echo "$out" | grep -q "E404"; then return 1; fi
  echo "✗ npm view ${PKG}@${1#v} failed (not a 404 — network or registry error):"; echo "$out" | tail -5; exit 2
}
for V in "$FROM" "$TO"; do
  published "$V" || { echo "⚠ SKIP: ${PKG}@${V#v} is tagged but not published yet — nothing to upgrade ${FROM} → ${TO}"; exit 0; }
done

# The token is only for cloning the sample consumer; brain itself comes from the registry.
git config --global user.email "upgrade-test@example.invalid"
git config --global user.name "upgrade-test"
git config --global credential.helper "!f() { echo username=x-access-token; echo \"password=${VCS_TOKEN}\"; }; f"

line "1. Consumer @ ${FROM} (registry install + brain init + env:init)"
cd /tmp || exit 2
git clone --depth 1 "$CONSUMER" consumer >/dev/null 2>&1 || { echo "✗ clone failed"; exit 2; }
cd consumer || exit 2
npm init -y >/dev/null 2>&1
printf 'node_modules/\n' >> .gitignore
npm i -D "${PKG}@${FROM#v}" >/dev/null 2>&1 || { echo "✗ npm i ${PKG}@${FROM#v} failed"; exit 2; }
npx brain init >/dev/null 2>&1 || { echo "✗ npx brain init failed"; exit 2; }
CI=1 npm run brain:env:init </dev/null >/tmp/env-init.log 2>&1
ENV_INIT_RC=$?
[ "$ENV_INIT_RC" = 0 ] || { echo "✗ brain:env:init exited ${ENV_INIT_RC}:"; cat /tmp/env-init.log; exit 2; }
[ -f brain.config.json ] || { echo "✗ env:init did not create brain.config.json"; exit 2; }
# A team that declared its memory backend (a CI run never declares it for you): without this the memory axis is
# honestly undeclared and cannot resolve, which would make the all-four-axes assertion in step 4b vacuous (#1344).
npm run brain:config -- set memory.backend plainfiles >/dev/null 2>&1 || info "could not declare memory.backend on ${FROM}; step 4b skips the memory resolve"
# Snapshot FROM's shipped brain/scripts BEFORE the upgrade (#1325). After the upgrade, every file
# whose content differs between FROM's and TO's package must be TO's content in the consumer's
# managed copy: that is what proves copyManaged ran, not merely that `npm i` fetched TO.
MANAGED=brain/scripts/brain-upgrade.mjs
[ -f "$MANAGED" ] || { echo "✗ ${MANAGED} missing after init — cannot fingerprint the managed core"; exit 2; }
cp -r "${PKG_DIR}/brain/scripts" /tmp/from-scripts
info "consumer @ $(node -e "console.log(require('./${PKG_DIR}/package.json').version)")"

line "2. Consumer customizations (project-specific — must survive)"
mkdir -p brain/project/decisions; echo "# ADR-9001 — a consumer decision" > brain/project/decisions/adr-9001-consumer.md
echo "MY_SECRET=keep-me" >> .env
node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('brain.config.json'));c.project.owner='ACME';fs.writeFileSync('brain.config.json',JSON.stringify(c,null,2))"
mkdir -p openspec/changes/my-feature; echo "my proposal" > openspec/changes/my-feature/proposal.md
info "added consumer ADR, .env MY_SECRET, config owner=ACME, openspec/changes/my-feature"
# Plant a custom brain:day:start BEFORE upgrade to prove consumer-wins on specialMerge.
node -e "const p=require('./package.json');p.scripts['brain:day:start']='consumer-day-start';require('fs').writeFileSync('./package.json',JSON.stringify(p,null,2))"
info "planted brain:day:start='consumer-day-start' (must survive specialMerge)"
git add -A >/dev/null 2>&1; git commit -q -m "consumer @ ${FROM}" >/dev/null 2>&1

line "3. UPGRADE ${FROM} → ${TO} (brain:upgrade installs TO itself — the documented default path, so the outgoing package is the pre-upgrade one, REQ-397-1)"
npm run brain:upgrade -- "${TO}" 2>&1 | tail -3
UPGRADE_RC=${PIPESTATUS[0]}
[ "$UPGRADE_RC" = 0 ] || fail "brain:upgrade exited ${UPGRADE_RC}"

line "4. ASSERT — managed brain/scripts == TO's content + project untouched"
NOW=$(node -e "console.log(require('./${PKG_DIR}/package.json').version)" 2>/dev/null)
[ "$NOW" = "${TO#v}" ] && ok "brain installed @ ${TO}" || fail "version (got '${NOW}')"
MOVED=0; STALE=0
while IFS= read -r f; do
  rel="${f#${PKG_DIR}/}"
  if [ ! -f "/tmp/from-scripts/${f#${PKG_DIR}/brain/scripts/}" ] || ! cmp -s "$f" "/tmp/from-scripts/${f#${PKG_DIR}/brain/scripts/}"; then
    if cmp -s "$f" "$rel"; then MOVED=$((MOVED+1)); else STALE=$((STALE+1)); echo "    stale: $rel"; fi
  fi
done < <(find "${PKG_DIR}/brain/scripts" -type f)
[ "$STALE" = 0 ] && ok "every managed brain/scripts file that differs FROM→TO now matches TO (${MOVED} files moved)" \
  || fail "${STALE} managed brain/scripts file(s) are NOT TO's content after the upgrade"
if [ "$MOVED" = 0 ] && [ "$STALE" = 0 ]; then
  cmp -s "${PKG_DIR}/${MANAGED}" "$MANAGED" && info "FROM and TO ship identical brain/scripts; ${MANAGED} matches TO (change check not applicable)" \
    || fail "${MANAGED} is NOT TO's copy"
fi
[ -f brain/project/decisions/adr-9001-consumer.md ] && ok "brain/project preserved (consumer ADR)" || fail "brain/project LOST the consumer ADR"
grep -q "MY_SECRET=keep-me" .env && ok ".env preserved (MY_SECRET)" || fail ".env LOST"
[ "$(node -e "console.log(require('./brain.config.json').project.owner)" 2>/dev/null)" = "ACME" ] && ok "brain.config.json custom value preserved (owner=ACME)" || fail "brain.config.json custom value LOST"
[ -f openspec/changes/my-feature/proposal.md ] && ok "openspec/changes preserved" || fail "openspec/changes LOST"

line "4b. ASSERT — the config migration LANDED: every axis has the ADR-0038 shape and all four resolve with no .env (#1344)"
# Why this exists: `brain:upgrade` runs the OLD (FROM) upgrader, which imports TO's migrations but calls its own
# migrateConfig. Under 1.11.0 that handed migration 1.11.1 no context, nothing was shaped, and schemaVersion was still stamped.
# Every other assertion here stayed green. Applies only when TO's package carries migration 1.11.1 (the ADR-0038 shape, >= 1.12.0).
HAS_SHAPE_MIGRATION=$(node --input-type=module -e "
const { migrations } = await import('./${PKG_DIR}/brain/core/config-migrations.mjs');
console.log(migrations.some((m) => m.version === '1.11.1') ? 'yes' : 'no');" 2>/dev/null)
if [ "$HAS_SHAPE_MIGRATION" = "yes" ]; then
  for AXIS in vcs memory platform sdd; do
    SHAPED=$(node -e "const a=require('./brain.config.json')['${AXIS}'];console.log(a&&typeof a==='object'&&'default' in a&&'providers' in a?'yes':'no')" 2>/dev/null)
    [ "$SHAPED" = "yes" ] && ok "brain.config.json ${AXIS} has { default, providers }" || fail "brain.config.json ${AXIS} lacks the ADR-0038 shape — the migration did not land"
  done
  mv .env .env.aside
  for AXIS in vcs memory platform sdd; do
    out=$(node "${PKG_DIR}/brain/scripts/config/cli.mjs" resolve "$AXIS" 2>&1); rc=$?
    if [ "$rc" = 0 ]; then ok "resolve ${AXIS} (no .env) -> ${out%% *}"
    elif [ "$AXIS" = memory ] && [ "$rc" = 3 ]; then info "resolve memory (no .env) rc=3: the FROM consumer could not declare it"
    else fail "resolve ${AXIS} with no .env exited ${rc}: ${out}"; fi
  done
  mv .env.aside .env
else
  info "TO's package has no migration 1.11.1 (< 1.12.0): axis-shape assertions not applicable"
fi

line "5. ASSERT — package.json brain:* verb injection (specialMerge)"
# Assert brain:* verbs were injected into the consumer package.json.
BRAIN_REPO_CHECK=$(node -e "const p=require('./package.json');console.log(p.scripts['brain:repo:check']||'')" 2>/dev/null)
[ -n "$BRAIN_REPO_CHECK" ] && ok "brain:repo:check injected into consumer package.json" \
  || fail "brain:repo:check NOT injected"

BRAIN_CHANGE_VERIFY=$(node -e "const p=require('./package.json');console.log(p.scripts['brain:change:verify']||'')" 2>/dev/null)
[ -n "$BRAIN_CHANGE_VERIFY" ] && ok "brain:change:verify injected into consumer package.json" \
  || fail "brain:change:verify NOT injected"

# Assert that the pre-planted custom value was NOT clobbered (consumer-wins).
CUSTOM_DAY=$(node -e "const p=require('./package.json');console.log(p.scripts['brain:day:start']||'')" 2>/dev/null)
if [ "$CUSTOM_DAY" = "consumer-day-start" ]; then
  ok "brain:day:start custom value preserved after upgrade (consumer-wins, not clobbered)"
else
  fail "brain:day:start was CLOBBERED by upgrade (got '${CUSTOM_DAY}', expected 'consumer-day-start')"
fi

line "RESULT"
if [ "$FAILED" = 0 ]; then echo "  ✓✓ UPGRADE ${FROM}→${TO}: managed brain/scripts matches TO, consumer project preserved"; exit 0
else echo "  ✗✗ UPGRADE ${FROM}→${TO} FAILED — brain broke something in the consumer project"; exit 1; fi
