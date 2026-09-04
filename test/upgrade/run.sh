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
# npm's audit call is not part of what these scenarios test, and it is the whole
# of their cost when the registry is slow (#850). Measured in one container run,
# same tree and image: a plain `npm i` of the local `git+file://` remote took
# 175s; with these two variables set it took 4s. The same install with the
# network removed entirely takes 5s — so every second above five was npm
# waiting on a service this test does not use.
#
# Set as ENVIRONMENT rather than as `--no-audit` flags on the install lines, on
# purpose: each scenario runs TWO installs — the harness's own, and the one
# `brain:upgrade` spawns. The second is production code, and making a consumer's
# real upgrade skip its audit to speed up a test would be brain deciding
# something for the consumer that is not brain's to decide. The variables scope
# the decision to the container, where it belongs, and production is untouched.
docker run --rm -i \
  -e npm_config_audit=false -e npm_config_fund=false \
  -e VCS_TOKEN="$TOKEN" \
  -e FROM_TAG="$FROM" -e TO_TAG="$TO" \
  -e CONSUMER_REPO="$CONSUMER_REPO" \
  "$IMAGE" bash -s < "$HERE/in-container.sh"
