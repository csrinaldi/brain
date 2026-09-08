#!/usr/bin/env bash
# run.sh — upgrade-safety integration test (host runner).
# Installs brain @ a FROM tag with consumer customizations, upgrades to a TO tag,
# and asserts the managed core updates while the consumer project is untouched.
#
# Usage: npm run test:upgrade -- v0.4.0 v0.4.1   (explicit FROM TO)
#        npm run test:upgrade                     (second-latest → latest tag)
#
# Requires: docker, and a github token (VCS_TOKEN or `gh auth token`).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
IMAGE="${FRESH_INSTALL_IMAGE:-node:22-bookworm}"
CONSUMER_REPO="${CONSUMER_REPO:-https://github.com/csrinaldi/samples-of-html5.git}"

command -v docker >/dev/null 2>&1 || { echo "✗ docker is required."; exit 2; }
TOKEN="${VCS_TOKEN:-$(gh auth token 2>/dev/null)}"
[ -z "$TOKEN" ] && { echo "✗ no github token — set VCS_TOKEN or run 'gh auth login'."; exit 2; }

TO="${2:-$(git -C "$ROOT" tag --sort=-v:refname 2>/dev/null | sed -n '1p')}"
FROM="${1:-$(git -C "$ROOT" tag --sort=-v:refname 2>/dev/null | sed -n '2p')}"
{ [ -z "$FROM" ] || [ -z "$TO" ]; } && { echo "✗ need two tags — npm run test:upgrade -- <from> <to> (or cut ≥2 tags)."; exit 2; }

echo "▶ upgrade test | ${FROM} → ${TO} | consumer=${CONSUMER_REPO} | image=${IMAGE}"
# The two npm_config_* variables below: see the block above the `docker run` in
# danger-paths.sh, which carries the measurement and the reasoning. ONE copy of
# that explanation on purpose — this comment was a verbatim 14-line duplicate,
# and two copies of a rationale drift the same way two copies of a rule do.
# Short version: brain ships zero dependencies, so npm's audit finds nothing and
# costs whatever the registry costs that minute (#850).
docker run --rm -i \
  -e npm_config_audit=false -e npm_config_fund=false \
  -e VCS_TOKEN="$TOKEN" \
  -e FROM_TAG="$FROM" -e TO_TAG="$TO" \
  -e CONSUMER_REPO="$CONSUMER_REPO" \
  "$IMAGE" bash -s < "$HERE/in-container.sh"
