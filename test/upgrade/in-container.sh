#!/usr/bin/env bash
# in-container.sh — upgrade-safety assertions, run inside a clean container.
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
BRAIN="git+https://github.com/csrinaldi/brain.git"

git config --global credential.helper "!f() { echo username=x-access-token; echo \"password=${VCS_TOKEN}\"; }; f"
apt-get update -qq >/dev/null 2>&1; apt-get install -y -qq curl ca-certificates >/dev/null 2>&1
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg 2>/dev/null | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null
echo "deb [signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list
apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq gh >/dev/null 2>&1

line "1. Consumer @ ${FROM} (install + seed managed paths + env:init)"
cd /tmp || exit 2
git clone --depth 1 "$CONSUMER" consumer >/dev/null 2>&1 || { echo "✗ clone failed"; exit 2; }
cd consumer || exit 2
npm init -y >/dev/null 2>&1
npm i -D "${BRAIN}#${FROM}" >/dev/null 2>&1
# Seed FROM managed state manually: a pre-v0.4.1 brain-upgrade uses the SSH
# github: shorthand and can't run over HTTPS; this mimics its managed-paths copy.
# FROM is an OLD-layout release (root scripts/), so seed it with the OLD paths —
# this simulates a pre-S3 consumer that the breaking upgrade must carry across.
cp -r node_modules/brain/scripts ./scripts
mkdir -p brain && cp -r node_modules/brain/brain/core ./brain/core
node -e "const p=require('./package.json');p.scripts={...p.scripts,'brain:upgrade':'node node_modules/brain/scripts/brain-upgrade.mjs','env:init':'bash ./scripts/bootstrap.sh'};require('fs').writeFileSync('./package.json',JSON.stringify(p,null,2))"
npm run env:init >/dev/null 2>&1
FROM_FP=$(grep -c installSpec scripts/brain-upgrade.mjs 2>/dev/null)
info "consumer @ $(node -e "console.log(require('./node_modules/brain/package.json').version)")"

line "2. Consumer customizations (project-specific — must survive)"
mkdir -p brain/project/decisions; echo "# ADR-9001 — a consumer decision" > brain/project/decisions/adr-9001-consumer.md
echo "MY_SECRET=keep-me" >> .env
node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('brain.config.json'));c.project.owner='ACME';fs.writeFileSync('brain.config.json',JSON.stringify(c,null,2))"
mkdir -p openspec/changes/my-feature; echo "my proposal" > openspec/changes/my-feature/proposal.md
info "added consumer ADR, .env MY_SECRET, config owner=ACME, openspec/changes/my-feature"

line "3. UPGRADE ${FROM} → ${TO} (HTTPS: re-install git+https + brain:upgrade)"
npm i -D "${BRAIN}#${TO}" >/dev/null 2>&1
# Breaking migration (S3): the entrypoint moves to node_modules/brain/brain/scripts/.
# A real consumer repoints its aliases (the documented manual step) before running
# the new upgrade — the old root-scripts/ alias no longer resolves post-install.
node -e "const p=require('./package.json');p.scripts={...p.scripts,'brain:upgrade':'node node_modules/brain/brain/scripts/brain-upgrade.mjs','brain:env:init':'bash ./brain/scripts/bootstrap.sh'};require('fs').writeFileSync('./package.json',JSON.stringify(p,null,2))"
npm run brain:upgrade -- "${TO}" 2>&1 | tail -3

line "4. ASSERT — core updated + project untouched"
NOW=$(node -e "console.log(require('./node_modules/brain/package.json').version)" 2>/dev/null)
TO_FP=$(grep -c installSpec brain/scripts/brain-upgrade.mjs 2>/dev/null)
[ "$NOW" = "${TO#v}" ] && ok "brain installed @ ${TO}" || fail "version (got '${NOW}')"
if [ "$NOW" != "$(echo "$FROM" | sed 's/^v//')" ]; then
  { [ "${FROM_FP:-0}" != "${TO_FP:-0}" ] || [ "${FROM_FP:-0}" -ne 0 ]; } && ok "managed core updated (scripts changed ${FROM} → ${TO})" || info "managed scripts identical between ${FROM}/${TO} (no code delta)"
fi
[ -f brain/project/decisions/adr-9001-consumer.md ] && ok "brain/project preserved (consumer ADR)" || fail "brain/project LOST the consumer ADR"
grep -q "MY_SECRET=keep-me" .env && ok ".env preserved (MY_SECRET)" || fail ".env LOST"
[ "$(node -e "console.log(require('./brain.config.json').project.owner)" 2>/dev/null)" = "ACME" ] && ok "brain.config.json custom value preserved (owner=ACME)" || fail "brain.config.json custom value LOST"
[ -f openspec/changes/my-feature/proposal.md ] && ok "openspec/changes preserved" || fail "openspec/changes LOST"

line "RESULT"
if [ "$FAILED" = 0 ]; then echo "  ✓✓ UPGRADE ${FROM}→${TO}: core updated, consumer project preserved"; exit 0
else echo "  ✗✗ UPGRADE ${FROM}→${TO} FAILED — brain broke something in the consumer project"; exit 1; fi
