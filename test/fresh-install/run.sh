#!/usr/bin/env bash
# run.sh — TOTAL fresh-install integration test (host runner).
# Spins up a clean container and runs the full consumer onboarding from the
# PUBLISHED REGISTRY PACKAGE.
#
# Usage: npm run test:fresh-install                           (latest published)
#        npm run test:fresh-install -- 1.1.0                  (specific version)
#        npm run test:fresh-install -- 1.1.0 npm              (version + fixture)
#        npm run test:fresh-install -- 1.1.0 pnpm|yarn|bun    (other PM)
#
# Fixtures (mock consumers): npm, pnpm, yarn, bun (default: npm)
# Falls back to external repo if fixture not found.
#
# Requires: docker. A github token is OPTIONAL and only widens what is checked —
# see below. Since #435 the package is public on the registry, so the install
# path under test needs no credential at all.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
IMAGE="${FRESH_INSTALL_IMAGE:-node:22-bookworm}"

command -v docker >/dev/null 2>&1 || { echo "✗ docker is required to run this test."; exit 2; }

# NO TOKEN IS REQUIRED, and that is the assertion, not a convenience (#435).
# This runner used to exit 2 without one, with the message "the brain repo is
# private". That has not been true since the repo went public, and the fixture
# demanding the credential was the thing whose absence #435 exists to prove.
#
# A token is still PASSED THROUGH when the caller has one, because two optional
# steps use it — `gh auth login` (informational) and the external-repo clone
# fallback when a fixture is missing. Neither is the install path. An empty
# value is passed deliberately rather than left unset, so the container reads
# "no token" as an answer instead of an unbound variable.
TOKEN="${VCS_TOKEN:-$(gh auth token 2>/dev/null || true)}"
[ -n "$TOKEN" ] && echo "· github token present — the optional gh/clone steps will run" \
                || echo "· no github token — the install path does not need one"

# The version to install from the registry. Empty means `latest`, resolved by
# npm rather than guessed here: a default written into this script would pin a
# version nobody chose. `v1.1.0` is accepted and normalised, because the tag
# habit is old and the error it would otherwise produce is unhelpful.
VERSION="${1:-}"
VERSION="${VERSION#v}"
[ -z "$VERSION" ] && echo "· no version given — installing the registry's \`latest\`"

FIXTURE="${2:-npm}"  # default fixture: npm
CONSUMER_REPO="${CONSUMER_REPO:-https://github.com/csrinaldi/samples-of-html5.git}"

echo "▶ TOTAL fresh-install | version=${VERSION:-latest} | fixture=${FIXTURE} | image=${IMAGE}"
docker run --rm -i -v "$ROOT:/tmp/brain:ro" \
  -e VCS_TOKEN="$TOKEN" \
  -e TARGET_VERSION="$VERSION" \
  -e CONSUMER_FIXTURE="$FIXTURE" \
  -e CONSUMER_REPO="$CONSUMER_REPO" \
  "$IMAGE" bash -s < "$HERE/in-container.sh"
