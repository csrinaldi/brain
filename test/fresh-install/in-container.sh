#!/usr/bin/env bash
# in-container.sh — TOTAL fresh-install assertions, run inside a clean container.
# Inputs (env):
#   TARGET_VERSION   (optional) — registry version to install; empty = `latest`
#   VCS_TOKEN        (optional) — github token. NOT needed to install (#435).
#                    Only widens two side steps: `gh auth login` (informational)
#                    and the external-repo clone fallback when a fixture is
#                    missing. The install path under test never reads it.
#   CONSUMER_FIXTURE (optional) — fixture to use: npm (default), pnpm, yarn, bun
#                    Falls back to CONSUMER_REPO if fixture is not found.
#   CONSUMER_REPO    (optional) — git URL of the consumer repo to clone (fallback)
#   CONSUMER_PM      (optional) — package manager: npm (default), pnpm, yarn, bun
#
# Workflow:
#   1. Install @logikas/brain from the REGISTRY, with no credential
#   2. Make a consumer change (src/index.js)
#   3. Make a consumer ADR (brain/project/decisions/adr-0001.md)
#   4. Upgrade brain — verify brain/core updated, brain/project/ NOT touched
#
# WHY THIS IS NO LONGER TAG-DRIVEN (#435). Distribution moved from git tags to a
# published scoped package (ADR-0030), and this harness was the last thing still
# installing `git+https://…#<tag>` behind a `VCS_TOKEN` it refused to run
# without — printing "the brain repo is private" at a repo that is public. It
# was asserting the old mechanism while claiming to prove the new one, and the
# credential it demanded is precisely the friction #435's exit criteria call for
# proving GONE. A fixture that requires the friction cannot be the evidence it
# was removed.
#
# brain's own repo scripts remain on npm. Only consumer's scripts use CPM.
# Exits 0 only if every CRITICAL assertion passes.
set -u
FAILED=0
ok()   { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; FAILED=1; }
info() { echo "  · $*"; }
line() { echo; echo "═══ $* ═══"; }

# No credential gate. See the header: needing one was the defect, not the setup.
TOKEN="${VCS_TOKEN:-}"
VERSION="${TARGET_VERSION:-}"
PKG="@logikas/brain"
# Empty version means the registry's `latest`, resolved by npm. Never defaulted
# to a literal here — a version this script picks is a version nobody chose.
if [ -n "$VERSION" ]; then SPEC="${PKG}@${VERSION}"; else SPEC="${PKG}"; fi

# Consumer fixture: npm, pnpm, yarn, bun (default: npm)
FIXTURE="${CONSUMER_FIXTURE:-npm}"
# Fallback: external repo
CONSUMER="${CONSUMER_REPO:-https://github.com/csrinaldi/samples-of-html5.git}"
# Package manager (may differ from fixture)
CPM="${CONSUMER_PM:-$FIXTURE}"

line "Install tooling (informational — best-effort)"
apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq curl ca-certificates >/dev/null 2>&1
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg 2>/dev/null \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  > /etc/apt/sources.list.d/github-cli.list
apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq gh >/dev/null 2>&1
curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh 2>/dev/null | bash >/dev/null 2>&1
npm install -g @anthropic-ai/claude-code >/dev/null 2>&1
info "gh=$(command -v gh>/dev/null&&echo y||echo n) gentle-ai=$(command -v gentle-ai>/dev/null&&echo y||echo n) claude=$(command -v claude>/dev/null&&echo y||echo n)"

line "Auth (OPTIONAL — the install path below uses none)"
if [ -n "$TOKEN" ]; then
  git config --global credential.helper "!f() { echo username=x-access-token; echo \"password=${TOKEN}\"; }; f"
  echo "${TOKEN}" | gh auth login --with-token >/dev/null 2>&1 && info "gh authenticated"
else
  info "no github token supplied — skipping gh login; the registry install needs none"
fi

line "Consumer repo + package.json (fixture=${FIXTURE}, PM=${CPM})"
cd /tmp || exit 2

# Use fixture if available; fallback to external repo
if [ -d "/tmp/brain/test/fixtures/$FIXTURE" ]; then
  cp -r "/tmp/brain/test/fixtures/$FIXTURE" consumer >/dev/null 2>&1 && \
    ok "Consumer fixture loaded: $FIXTURE" || { echo "✗ fixture copy failed"; exit 2; }
else
  git clone --depth 1 "$CONSUMER" consumer >/dev/null 2>&1 || { echo "✗ clone failed: $CONSUMER"; exit 2; }
  [ -f consumer/package.json ] || (cd consumer && npm init -y >/dev/null 2>&1)
  info "Fallback to external repo: $CONSUMER"
fi

cd consumer || exit 2

# Ensure a git origin so env:init can derive the provider/slug (fixtures, unlike
# the cloned fallback repo, have no origin — issue #80).
git rev-parse --git-dir >/dev/null 2>&1 || git init -q
git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/test-org/test-consumer.git

# Install the consumer's chosen PM if it is not npm.
case "$CPM" in
  pnpm) npm install -g pnpm >/dev/null 2>&1; info "pnpm installed globally" ;;
  yarn) npm install -g yarn >/dev/null 2>&1; info "yarn installed globally" ;;
  bun)  curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1 && export PATH="$HOME/.bun/bin:$PATH"; info "bun installed" ;;
  npm)  : ;; # already available
  *)    echo "✗ Unsupported CONSUMER_PM: ${CPM}"; exit 2 ;;
esac

line "[1] Install ${SPEC} from the REGISTRY using ${CPM}, with no credential"
# The credential-free claim is ENFORCED, not narrated. Every package manager
# below is pointed at an empty user config, so an auth token cannot reach the
# registry read even if the ambient environment holds one. Without this the step
# would pass on a machine that happens to be logged in, and prove nothing about
# the consumer who is not.
: > /tmp/empty.npmrc
export npm_config_userconfig=/tmp/empty.npmrc
export NPM_CONFIG_USERCONFIG=/tmp/empty.npmrc
info "user npmrc pinned to an empty file — no credential is in scope for the install"

case "$CPM" in
  pnpm) pnpm add -D "${SPEC}" >/dev/null 2>&1 ;;
  yarn) yarn add "${SPEC}" >/dev/null 2>&1 ;;
  bun)  bun add -d "${SPEC}" >/dev/null 2>&1 ;;
  *)    npm i -D "${SPEC}" --no-audit --no-fund >/dev/null 2>&1 ;;
esac

# The CANONICAL scoped path. npm splits `@scope/name` into two directory
# segments, so `node_modules/brain` is a DIFFERENT location — the pre-rename one
# (`LEGACY_PACKAGE_DIR`). Asserting the legacy path here would go green on an
# install that never happened and red on the one that did.
PKG_DIR="node_modules/@logikas/brain"
if [ -d "$PKG_DIR" ]; then
  INSTALLED_VERSION=$(node -e "console.log(require('./${PKG_DIR}/package.json').version)" 2>/dev/null)
  ok "brain installed (v${INSTALLED_VERSION}) from the registry via ${CPM}, no token"
else
  INSTALLED_VERSION=""
  fail "brain did NOT install ${SPEC} via ${CPM} — ${PKG_DIR} is absent"
  if [ -d node_modules/brain ]; then
    fail "  …but node_modules/brain EXISTS — that is the pre-rename layout, so something installed the unscoped package"
  fi
fi

# A version was requested and a different one landed is its own failure, and it
# is silent otherwise: every later step would pass against the wrong tree.
if [ -n "$VERSION" ] && [ -n "$INSTALLED_VERSION" ] && [ "$VERSION" != "$INSTALLED_VERSION" ]; then
  fail "asked for ${VERSION}, got ${INSTALLED_VERSION}"
fi

line "[1.5] Consumer makes a change (ADR + code modification)"
# Consumer creates their own ADR (READ-ONLY during upgrade)
mkdir -p brain/project/decisions
cat > brain/project/decisions/adr-0001-consumer.md <<'ADR'
# ADR-0001: Consumer Architecture Decision

Date: 2026-06-27
Status: Accepted

This is a CONSUMER decision record, not managed by brain core.
It should NOT be modified during brain upgrades.
ADR
ok "Consumer ADR created (brain/project/decisions/adr-0001-consumer.md)"

# Store original content for verification. SRC is captured AFTER the consumer's
# own modification below, so the [4] check verifies the UPGRADE preserves it
# (capturing before the modification compared the upgrade against the pre-edit
# file and always false-failed — issue #80).
ORIGINAL_ADR=$(md5sum brain/project/decisions/adr-0001-consumer.md 2>/dev/null | awk '{print $1}')

# Modify consumer code
echo "// Consumer modification - should survive brain upgrade" >> src/index.js
ok "Consumer code modified (src/index.js)"
ORIGINAL_SRC=$(md5sum src/index.js 2>/dev/null | awk '{print $1}')

line "[2] npx brain init (issue #400 — no hand-edited package.json)"
# Plant a custom brain:day:start BEFORE init to prove consumer-wins on specialMerge.
node -e "const p=require('./package.json');p.scripts={...p.scripts,'brain:day:start':'consumer-custom-day-start'};require('fs').writeFileSync('./package.json',JSON.stringify(p,null,2))"
info "planted brain:day:start='consumer-custom-day-start' (must survive specialMerge)"
# THE point of #400: no alias is hand-written here. `npx brain init` is reachable with
# an empty scripts block because it is a `bin` entry, and it writes the one alias the
# upgrade cannot inject into a consumer (brain:upgrade) before delegating to it.
# NO version argument, deliberately. `init` falls back to `resolveInstalledTag`,
# reading the version out of the package the consumer just installed. That is
# the real consumer flow under a registry — nobody retypes a version they
# already pinned in package.json — and passing one here would skip the
# resolution entirely and leave it untested.
npx brain init >/dev/null 2>&1
INIT_STATUS=$?
if [ "$INIT_STATUS" -eq 0 ]; then ok "npx brain init exited 0 (version derived from the installed package)"; else fail "npx brain init exited ${INIT_STATUS}"; fi
BOOTSTRAP_ALIAS=$(node -e "const p=require('./package.json');console.log(p.scripts['brain:upgrade']||'')" 2>/dev/null)
if [ -n "$BOOTSTRAP_ALIAS" ]; then ok "init wrote the brain:upgrade alias"; else fail "brain:upgrade alias NOT written by init"; fi
if [ -d brain/scripts ] && [ -d brain/core ]; then ok "managed paths copied (brain/scripts + brain/core)"; else fail "managed paths NOT copied"; fi
# Idempotence (REQ-400-2): a second init must not fail and must not churn the file.
PKG_BEFORE=$(md5sum package.json | awk '{print $1}')
npx brain init >/dev/null 2>&1
PKG_AFTER=$(md5sum package.json | awk '{print $1}')
if [ "$PKG_BEFORE" = "$PKG_AFTER" ]; then ok "re-running init is a no-op on package.json"; else fail "init is not idempotent"; fi

line "[3] env:init creates brain.config.json with the derived provider"
$CPM run brain:env:init >/dev/null 2>&1
if [ -f brain.config.json ]; then
  prov=$(node -e "console.log(require('/tmp/consumer/brain.config.json').vcs.provider)" 2>/dev/null)
  host=$(node -e "console.log(require('/tmp/consumer/brain.config.json').project.gitHost)" 2>/dev/null)
  if [ "$prov" = "github" ]; then ok "brain.config.json created (provider=github, gitHost=${host})"
  else fail "wrong provider derivation (got '${prov}', expected 'github')"; fi
else fail "brain.config.json NOT created"; fi

line "[3.5] env:init scaffolds brain/HOME.md (install-home-scaffold)"
if [ -f brain/HOME.md ]; then
  ok "brain/HOME.md scaffolded by env:init"
else
  fail "brain/HOME.md NOT created by env:init"
fi
# Register the ADR planted in [1.5] under the empty "Architecture decisions"
# heading the scaffold leaves for exactly this purpose. Without this the test
# contradicts itself: [1.5] plants an unlinked brain/project/**.md, and
# check-brain-nav.mjs (correctly) rejects orphans — every brain/**/*.md must be
# reachable from brain/HOME.md. Linking it is what a real consumer does, and
# what the check's own error message instructs. Asserting nav integrity over a
# scaffold the test itself orphaned would assert a contradiction.
node -e "
const fs = require('fs');
const home = 'brain/HOME.md';
const heading = '### Architecture decisions';
const link = '- [ADR-0001 Consumer](project/decisions/adr-0001-consumer.md) — planted by the fresh-install test';
let src = fs.readFileSync(home, 'utf8');
if (!src.includes('adr-0001-consumer.md')) {
  if (!src.includes(heading)) { console.error('scaffold is missing: ' + heading); process.exit(1); }
  src = src.replace(heading, heading + '\n\n' + link);
  fs.writeFileSync(home, src);
}
" || fail "could not register the consumer ADR in the scaffolded HOME.md"
# brain:nav is not one of the injected MANAGED_SCRIPT_KEYS, so invoke the
# managed script directly rather than via a package.json verb that may not exist.
if node brain/scripts/check-brain-nav.mjs >/dev/null 2>&1; then
  ok "check-brain-nav.mjs exits 0 on the scaffolded HOME.md"
else
  fail "check-brain-nav.mjs did NOT exit 0 on the scaffolded HOME.md"
fi

line "[4] Verify READ-ONLY: brain/project/* NOT touched by upgrade"
# Check that consumer ADR is untouched
if [ -f brain/project/decisions/adr-0001-consumer.md ]; then
  CURRENT_ADR=$(md5sum brain/project/decisions/adr-0001-consumer.md 2>/dev/null | awk '{print $1}')
  if [ "$ORIGINAL_ADR" = "$CURRENT_ADR" ]; then
    ok "Consumer ADR preserved (brain/project/decisions/ is READ-ONLY)"
  else
    fail "Consumer ADR was MODIFIED during upgrade (should be READ-ONLY)"
  fi
else
  fail "Consumer ADR was DELETED during upgrade"
fi

# Check that consumer code is untouched
if [ -f src/index.js ]; then
  CURRENT_SRC=$(md5sum src/index.js 2>/dev/null | awk '{print $1}')
  if [ "$ORIGINAL_SRC" = "$CURRENT_SRC" ]; then
    ok "Consumer code preserved (src/index.js is untouched)"
  else
    fail "Consumer code was MODIFIED during upgrade"
  fi
else
  fail "Consumer code file was DELETED during upgrade"
fi

line "[5] Verify MANAGED: brain/core/* updated by upgrade"
if [ -d brain/core ] && [ -f .gitattributes ]; then
  ok "brain/core updated (managed paths synced; .gitattributes at root)"
else
  fail "brain/core NOT updated or missing .gitattributes"
fi

line "[6] Verify package.json brain:* verb injection (specialMerge)"
# Assert that brain:* verbs were injected into the consumer package.json.
BRAIN_REPO_CHECK=$(node -e "const p=require('./package.json');console.log(p.scripts['brain:repo:check']||'')" 2>/dev/null)
if [ -n "$BRAIN_REPO_CHECK" ]; then ok "brain:repo:check injected into consumer package.json"
else fail "brain:repo:check NOT injected into consumer package.json"; fi

BRAIN_CHANGE_VERIFY=$(node -e "const p=require('./package.json');console.log(p.scripts['brain:change:verify']||'')" 2>/dev/null)
if [ -n "$BRAIN_CHANGE_VERIFY" ]; then ok "brain:change:verify injected into consumer package.json"
else fail "brain:change:verify NOT injected into consumer package.json"; fi

# Assert that the pre-existing custom value was NOT clobbered (consumer-wins).
CUSTOM_DAY=$(node -e "const p=require('./package.json');console.log(p.scripts['brain:day:start']||'')" 2>/dev/null)
if [ "$CUSTOM_DAY" = "consumer-custom-day-start" ]; then
  ok "brain:day:start custom value preserved after upgrade (consumer-wins, not clobbered)"
else
  fail "brain:day:start was CLOBBERED by upgrade (got '${CUSTOM_DAY}', expected 'consumer-custom-day-start')"
fi

# Assert idempotency: re-upgrade must not change package.json.
PKG_HASH_BEFORE=$(md5sum package.json 2>/dev/null | awk '{print $1}')
$CPM run brain:upgrade -- "${INSTALLED_VERSION}" --no-install >/dev/null 2>&1
PKG_HASH_AFTER=$(md5sum package.json 2>/dev/null | awk '{print $1}')
if [ "$PKG_HASH_BEFORE" = "$PKG_HASH_AFTER" ]; then
  ok "package.json unchanged after re-upgrade (specialMerge is idempotent)"
else
  fail "package.json CHANGED on re-upgrade (specialMerge is NOT idempotent)"
fi

line "RESULT"
if [ "$FAILED" = 0 ]; then echo "  ✓✓ TOTAL fresh-install PASSED @ ${PKG}@${INSTALLED_VERSION:-unresolved}"; exit 0
else echo "  ✗✗ TOTAL fresh-install FAILED @ ${PKG}@${INSTALLED_VERSION:-unresolved}"; exit 1; fi
