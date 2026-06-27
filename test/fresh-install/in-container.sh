#!/usr/bin/env bash
# in-container.sh — TOTAL fresh-install assertions, run inside a clean container.
# Inputs (env):
#   VCS_TOKEN    (required)
#   TARGET_TAG   (required)
#   CONSUMER_REPO (optional) — git URL of the consumer repo to clone
#   CONSUMER_PM  (optional) — package manager to use in the consumer: npm (default), pnpm, yarn, bun
#
# brain's own repo scripts (npm run test, npm run repo:check, etc.) remain on npm —
# only the consumer's install + brain-script invocations use $CONSUMER_PM.
# Exits 0 only if every CRITICAL assertion passes. Headless-only steps are informational.
set -u
FAILED=0
ok()   { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; FAILED=1; }
info() { echo "  · $*"; }
line() { echo; echo "═══ $* ═══"; }

[ -z "${VCS_TOKEN:-}" ] && { echo "✗ VCS_TOKEN required"; exit 2; }
TAG="${TARGET_TAG:?TARGET_TAG required}"
CONSUMER="${CONSUMER_REPO:-https://github.com/csrinaldi/samples-of-html5.git}"
BRAIN_HTTPS="git+https://github.com/csrinaldi/brain.git"
# Consumer package manager. Default: npm (brain repo itself stays on npm).
CPM="${CONSUMER_PM:-npm}"

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

line "Consumer repo + package.json (CONSUMER_PM=${CPM})"
cd /tmp || exit 2
git clone --depth 1 "$CONSUMER" consumer >/dev/null 2>&1 || { echo "✗ clone failed: $CONSUMER"; exit 2; }
cd consumer || exit 2
[ -f package.json ] || npm init -y >/dev/null 2>&1

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

line "[4] env:init emits no-project-ADRs notice (brain/project/decisions/ absent)"
INIT_OUT=$($CPM run env:init 2>&1)
if echo "$INIT_OUT" | grep -q "No project ADRs"; then
  ok "no-project-ADRs notice present in env:init output"
else fail "no-project-ADRs notice NOT found in env:init output"; fi

line "RESULT"
if [ "$FAILED" = 0 ]; then echo "  ✓✓ TOTAL fresh-install PASSED @ ${TAG}"; exit 0
else echo "  ✗✗ TOTAL fresh-install FAILED @ ${TAG}"; exit 1; fi
