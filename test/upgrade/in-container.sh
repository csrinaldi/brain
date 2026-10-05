#!/usr/bin/env bash
# in-container.sh — upgrade-safety assertions, run inside a clean container.
# brain comes from the registry (@logikas/brain, ADR-0030); VCS_TOKEN only clones the sample consumer.
# Inputs (env): VCS_TOKEN (required), FROM_TAG, TO_TAG (required), CONSUMER_REPO (optional).
# Exits 0 only if the managed core updates AND every consumer customization survives.
set -u
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
CI=1 npm run brain:env:init </dev/null >/dev/null 2>&1
[ -f brain.config.json ] || { echo "✗ env:init did not create brain.config.json"; exit 2; }
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

line "3. UPGRADE ${FROM} → ${TO} (npm i registry + brain:upgrade, default install path)"
npm i -D "${PKG}@${TO#v}" >/dev/null 2>&1 || { echo "✗ npm i ${PKG}@${TO#v} failed"; exit 2; }
npm run brain:upgrade -- "${TO}" 2>&1 | tail -3

line "4. ASSERT — core updated + project untouched"
NOW=$(node -e "console.log(require('./${PKG_DIR}/package.json').version)" 2>/dev/null)
[ "$NOW" = "${TO#v}" ] && ok "brain installed @ ${TO}" || fail "version (got '${NOW}')"
[ -f brain/project/decisions/adr-9001-consumer.md ] && ok "brain/project preserved (consumer ADR)" || fail "brain/project LOST the consumer ADR"
grep -q "MY_SECRET=keep-me" .env && ok ".env preserved (MY_SECRET)" || fail ".env LOST"
[ "$(node -e "console.log(require('./brain.config.json').project.owner)" 2>/dev/null)" = "ACME" ] && ok "brain.config.json custom value preserved (owner=ACME)" || fail "brain.config.json custom value LOST"
[ -f openspec/changes/my-feature/proposal.md ] && ok "openspec/changes preserved" || fail "openspec/changes LOST"

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
if [ "$FAILED" = 0 ]; then echo "  ✓✓ UPGRADE ${FROM}→${TO}: core updated, consumer project preserved"; exit 0
else echo "  ✗✗ UPGRADE ${FROM}→${TO} FAILED — brain broke something in the consumer project"; exit 1; fi
