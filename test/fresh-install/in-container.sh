#!/usr/bin/env bash
# in-container.sh — TOTAL fresh-install assertions, run inside a clean container.
# Inputs (env):
#   VCS_TOKEN       (required)
#   TARGET_TAG      (required)
#   CONSUMER_FIXTURE (optional) — fixture to use: npm (default), pnpm, yarn, bun
#                    Falls back to CONSUMER_REPO if fixture is not found.
#   CONSUMER_REPO   (optional) — git URL of the consumer repo to clone (fallback)
#   CONSUMER_PM     (optional) — package manager: npm (default), pnpm, yarn, bun
#
# Workflow:
#   1. Install brain @ TAG
#   2. Make a consumer change (src/index.js)
#   3. Make a consumer ADR (brain/project/decisions/adr-0001.md)
#   4. Upgrade brain — verify brain/core updated, brain/project/ NOT touched
#
# brain's own repo scripts remain on npm. Only consumer's scripts use CPM.
# Exits 0 only if every CRITICAL assertion passes.
set -u
FAILED=0
ok()   { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; FAILED=1; }
info() { echo "  · $*"; }
line() { echo; echo "═══ $* ═══"; }

[ -z "${VCS_TOKEN:-}" ] && { echo "✗ VCS_TOKEN required"; exit 2; }
TAG="${TARGET_TAG:?TARGET_TAG required}"
BRAIN_HTTPS="git+https://github.com/csrinaldi/brain.git"

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

line "Auth (HTTPS credential helper + gh login)"
git config --global credential.helper "!f() { echo username=x-access-token; echo \"password=${VCS_TOKEN}\"; }; f"
echo "${VCS_TOKEN}" | gh auth login --with-token >/dev/null 2>&1 && info "gh authenticated"

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

line "[1] Install brain @ ${TAG} over HTTPS using ${CPM}"
case "$CPM" in
  pnpm) pnpm add -D "${BRAIN_HTTPS}#${TAG}" >/dev/null 2>&1 ;;
  yarn) yarn add "${BRAIN_HTTPS}#${TAG}" >/dev/null 2>&1 ;;
  bun)  bun add -d "${BRAIN_HTTPS}#${TAG}" >/dev/null 2>&1 ;;
  *)    npm i -D "${BRAIN_HTTPS}#${TAG}" >/dev/null 2>&1 ;;
esac
if [ -d node_modules/brain ]; then
  ok "brain installed (v$(node -e "console.log(require('./node_modules/brain/package.json').version)")) via ${CPM}"
else fail "brain did NOT install from ${TAG} via ${CPM}"; fi

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

line "[2] brain:upgrade -- ${TAG} (FULL, no --no-install)"
node -e "const p=require('./package.json');p.scripts={...p.scripts,'brain:upgrade':'node node_modules/brain/scripts/brain-upgrade.mjs','env:init':'bash ./scripts/bootstrap.sh'};require('fs').writeFileSync('./package.json',JSON.stringify(p,null,2))"
# brain:upgrade is invoked via the consumer's own PM (brain already wired to detect it)
$CPM run brain:upgrade -- "${TAG}" >/dev/null 2>&1
if [ -f scripts/bootstrap.sh ] && [ -d brain/core ]; then ok "managed paths copied (scripts + brain/core)"; else fail "managed paths NOT copied"; fi

line "[3] env:init creates brain.config.json with the derived provider"
$CPM run env:init >/dev/null 2>&1
if [ -f brain.config.json ]; then
  prov=$(node -e "console.log(require('/tmp/consumer/brain.config.json').vcs.provider)" 2>/dev/null)
  host=$(node -e "console.log(require('/tmp/consumer/brain.config.json').project.gitHost)" 2>/dev/null)
  if [ "$prov" = "github" ]; then ok "brain.config.json created (provider=github, gitHost=${host})"
  else fail "wrong provider derivation (got '${prov}', expected 'github')"; fi
else fail "brain.config.json NOT created"; fi

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

line "RESULT"
if [ "$FAILED" = 0 ]; then echo "  ✓✓ TOTAL fresh-install PASSED @ ${TAG}"; exit 0
else echo "  ✗✗ TOTAL fresh-install FAILED @ ${TAG}"; exit 1; fi
