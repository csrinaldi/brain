#!/usr/bin/env bash
# danger-paths.sh — M4 danger-path e2e suite (host runner), issue #401.
#
# The tag→tag test (run.sh, #51) proves the HAPPY path against real releases.
# This suite proves the four DANGER paths the epic's hard gate names:
#
#   1. mid-upgrade failure  → tree rolls back byte-identical            (#396)
#   2. consumer-edited managed file → refuse, never silently clobber    (#397)
#   3. downgrade attempt    → refused without --allow-downgrade         (#398)
#   4. corrupt consumer JSON → named up front, --skip-merge completes   (#399)
#
# Usage: npm run test:danger-paths
# Requires: docker. NO github token and NO network access to GitHub.
#
# ── Why this builds a LOCAL git remote instead of using tags ─────────────────
#
# The behaviour under test only exists in code NEWER than every published tag —
# v1.0.0 predates all four safety tickets. A tag→tag run therefore cannot
# exercise any of it, and would go green while testing nothing.
#
# Worse, the upgrade's three-way modification detection (#397) reads the
# OUTGOING package before the install. run.sh pre-installs TO and then invokes
# brain:upgrade, so outgoing == incoming there and detection degrades — the
# REFUSE gate could never fire in that harness even with the right code.
#
# So: pack the WORKING TREE into a bare git repo inside the container, tag two
# versions of it, and let brain:upgrade perform its own real `npm i` against
# `git+file:///…`. That keeps the genuine install path (npm cloning a git
# remote, outgoing != incoming) while making the suite track the BRANCH — which
# is what #401's exit criterion requires: red today, green as each ticket lands.
#
# `resolveInstallUrl` passes a `git+file://` URL through unchanged (its
# "unknown form, already prefixed" branch), which is what makes this work.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
IMAGE="${DANGER_PATHS_IMAGE:-node:22-bookworm}"

command -v docker >/dev/null 2>&1 || { echo "✗ docker is required."; exit 2; }

echo "▶ M4 danger paths | source=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo working-tree) | image=${IMAGE}"

# The repo is mounted READ-ONLY. The container copies it out before mutating,
# so a harness bug can never write into the maintainer's working tree.
docker run --rm -i \
  -v "${ROOT}:/brain-src:ro" \
  -e HOME=/root \
  "$IMAGE" bash -s < "$HERE/danger-paths-in-container.sh"
