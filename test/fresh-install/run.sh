#!/usr/bin/env bash
# run.sh — TOTAL fresh-install integration test (host runner).
# Spins up a clean container and runs the full consumer onboarding from a TAG.
#
# Usage: npm run test:fresh-install -- v0.4.1   (a specific tag)
#        npm run test:fresh-install             (the latest tag)
#
# Requires: docker, and a github token (VCS_TOKEN env or `gh auth token`) with
# read access to the private brain repo. The token is passed to the container
# via env and is never logged.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
IMAGE="${FRESH_INSTALL_IMAGE:-node:22-bookworm}"
CONSUMER_REPO="${CONSUMER_REPO:-https://github.com/csrinaldi/samples-of-html5.git}"

command -v docker >/dev/null 2>&1 || { echo "✗ docker is required to run this test."; exit 2; }

TOKEN="${VCS_TOKEN:-$(gh auth token 2>/dev/null)}"
[ -z "$TOKEN" ] && { echo "✗ no github token — set VCS_TOKEN or run 'gh auth login' (the brain repo is private)."; exit 2; }

TAG="${1:-$(git -C "$ROOT" tag --sort=-v:refname 2>/dev/null | head -1)}"
[ -z "$TAG" ] && { echo "✗ no tag — pass one (npm run test:fresh-install -- v0.4.1) or cut a tag first."; exit 2; }

echo "▶ TOTAL fresh-install | tag=${TAG} | consumer=${CONSUMER_REPO} | image=${IMAGE}"
docker run --rm -i \
  -e VCS_TOKEN="$TOKEN" \
  -e TARGET_TAG="$TAG" \
  -e CONSUMER_REPO="$CONSUMER_REPO" \
  "$IMAGE" bash -s < "$HERE/in-container.sh"
