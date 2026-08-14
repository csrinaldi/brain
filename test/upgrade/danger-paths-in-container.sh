#!/usr/bin/env bash
# danger-paths-in-container.sh — the four M4 danger paths, issue #401.
# Runs INSIDE the container. See danger-paths.sh for why this builds a local
# git remote instead of using published tags.
set -u

FAILED=0
ok()   { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; FAILED=$((FAILED+1)); }
line() { echo; echo "── $* ──"; }
info() { echo "  · $*"; }

SRC=/srv/src
REMOTE=/srv/brain-remote.git
FROM=v9.0.0
TO=v9.0.1

# The directory npm installs the package into is DERIVED from the manifest this
# harness builds its remote from — never spelled here. `@logikas/brain` lands in
# `node_modules/@logikas/brain`; the pre-rename `brain` landed in
# `node_modules/brain`.
#
# A literal here is the #623 class (the installed-package root as a hardcoded
# string), and this harness was its site in shell — out of reach of a refactor
# that swept the .mjs modules. When #655 scoped the name, every seed below copied
# from a path that no longer existed and all four danger paths reported ZERO
# seeded files. Nothing asserted a wrong answer: the seed's own vacuity guard
# refused to let empty trees be compared, which is the only reason this surfaced
# as a red instead of four green comparisons of nothing against nothing.
PKG_NAME=$(node -pe "require('/brain-src/package.json').name")

# ── Build a two-tag git remote from the working tree ─────────────────────────
# FROM and TO are the SAME tree except for a marker: TO adds a managed file and
# changes an already-managed one. That difference is what gives the upgrade
# something real to copy, and gives `brainChanged` something true to report.
build_remote() {
  mkdir -p "$SRC"
  cp -r /brain-src/. "$SRC"/ 2>/dev/null || true
  cd "$SRC"
  rm -rf .git node_modules .brain-source

  # `.brain-source` is removed above on purpose: it marks the brain SOURCE repo
  # and brain:upgrade refuses to run in one. The package a consumer installs
  # never carries it (it is not a managed path), so removing it here reproduces
  # what consumers actually receive.

  node -e "
    const fs=require('fs'); const p=require('./package.json');
    p.repository={type:'git',url:'git+file://${REMOTE}'};
    p.version='${FROM#v}';
    fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
  "
  git init -q . && git config user.email t@t.local && git config user.name tester
  git add -A && git commit -qm "brain ${FROM}" && git tag "$FROM"

  # ── TO: what brain changed between the two releases ──
  mkdir -p brain/core/danger
  echo "# marker shipped by ${TO}" > brain/core/danger/marker.md
  echo "# a line ${TO} added" >> .github/CODEOWNERS
  node -e "
    const fs=require('fs'); const p=require('./package.json');
    p.version='${TO#v}'; fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
  "
  git add -A && git commit -qm "brain ${TO}" && git tag "$TO"

  git clone -q --bare "$SRC" "$REMOTE"
  cd /
}

# ── A consumer repo at a given tag, with the managed paths already seeded ────
# Seeded by copying, NOT by running brain:upgrade — the setup must not depend on
# the command under test, or a broken upgrade would produce a broken baseline
# and the assertions would compare two wrongs.
new_consumer() {
  local dir="$1" tag="$2"
  rm -rf "$dir"; mkdir -p "$dir"; cd "$dir"
  npm init -y >/dev/null 2>&1
  node -e "
    const fs=require('fs'); const p=require('./package.json');
    p.name='my-consumer';
    // A real consumer runs THEIR OWN copied script, not the package's. That
    // matters: the script resolves ../core/managed-paths.mjs relative to
    // itself, so running the package's copy would read the INCOMING manifest.
    p.scripts={...p.scripts,'brain:upgrade':'node ./brain/scripts/brain-upgrade.mjs'};
    fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
  "
  npm i -D "git+file://${REMOTE}#${tag}" >/dev/null 2>&1 || { fail "install ${tag}"; return 1; }

  local pkg="node_modules/${PKG_NAME}"
  mkdir -p .github/workflows .claude .gemini brain
  cp -r "$pkg/brain/core" brain/core
  cp -r "$pkg/brain/scripts" brain/scripts
  cp "$pkg/.gitattributes" . 2>/dev/null || true
  cp "$pkg/.github/CODEOWNERS" .github/ 2>/dev/null || true
  cp "$pkg/.github/PULL_REQUEST_TEMPLATE.md" .github/ 2>/dev/null || true
  cp "$pkg"/.github/workflows/*.yml .github/workflows/ 2>/dev/null || true
  cp "$pkg/.claude/settings.json" .claude/ 2>/dev/null || true
  cp "$pkg/.gemini/settings.json" .gemini/ 2>/dev/null || true
  cp "$pkg/brain/HOME.md" brain/ 2>/dev/null || true
  cp "$pkg/brain.config.json" . 2>/dev/null || true
  cp "$pkg/AGENTS.md" . 2>/dev/null || true

  # Every cp above is `|| true` so an optional path missing from an older
  # package does not abort the seed. That tolerance is also how a BROKEN seed
  # used to reach the assertions as a silently-empty tree — `new_consumer`
  # returned the status of its last guarded cp, i.e. always success.
  #
  # So the seed now has to prove it produced something. This is the reachability
  # half of the same defect `assert_has_evidence` catches at the other end: fix
  # the cause, and keep the detector for the causes not yet imagined.
  #
  # Counted over the SAME path set the fingerprint covers. An earlier form counted
  # only brain/core + brain/scripts — which are copied with `cp -r`, the two seeds
  # least likely to fail — while the scenarios key on `.github/CODEOWNERS` and
  # `.claude/settings.json`, which are exactly the `|| true`-guarded single-file
  # cps this guard exists to catch. Measured: with the CODEOWNERS cp made to fail,
  # the whole suite stayed green at 24/24, INCLUDING the negative control that
  # claims an untouched CODEOWNERS upgrades without prompting. It upgraded without
  # prompting because the file was not there at all — copyManaged skips the
  # three-way check when the dest does not exist, so nothing is consumerModified,
  # so the REFUSE gate cannot fire, so the run exits 0 for the wrong reason.
  local seeded
  seeded=$(find brain/core brain/scripts .github .claude .gemini .gitattributes -type f 2>/dev/null | wc -l)
  if [ "$seeded" -eq 0 ]; then
    fail "seed produced ZERO managed files in ${dir} — every assertion below would compare two empty trees"
    return 1
  fi

  # A count is necessary but not sufficient: the scenarios do not depend on "some
  # files", they depend on THESE files. Naming them means a seed that silently
  # drops one turns the run red here rather than green somewhere downstream.
  local required missing=""
  for required in .github/CODEOWNERS .claude/settings.json brain/core brain/scripts; do
    [ -e "$required" ] || missing="${missing} ${required}"
  done
  if [ -n "$missing" ]; then
    fail "seed in ${dir} is missing paths the scenarios assert on:${missing}"
    return 1
  fi
  return 0
}

# Byte-level fingerprint of every managed path, for the byte-identity assertions.
#
# Emits `<count>:<hash>`, and the count is not decoration. A bare hash of an
# EMPTY file list is the constant d41d8cd98f00b204e9800998ecf8427e, so an earlier
# form of this function returned the same value for "nothing changed" and
# "nothing could be read" — and every `BEFORE == AFTER` assertion then passed by
# comparing two empty sets. Demonstrated, not theorised: deleting every managed
# path before the fingerprint left the byte-identity assertion green.
#
# That is `brain/core/anti-patterns/evidence-reader-empty-on-failure.md` exactly
# — "the reader conflates two states that gates must distinguish… the reader's
# error becomes the gate's approval" — reached inside the harness built to
# prevent that class. Carrying the count makes the two states different values,
# and `assert_has_evidence` below refuses the empty one.
#
# The count is derived from the SAME read as the hash, deliberately. Deriving it
# from `find` while the bytes come from `xargs md5sum` means two independent
# readers, and only one of them is guarded: if the md5sum half failed wholesale
# the count would survive, the hash would collapse to empty, and `2:` would sail
# through assert_has_evidence while the comparison measured zero bytes. That is
# the same conflation one layer down.
#
# Counting the md5sum LINES also closes the partial case `find | wc -l` cannot
# see: `xargs` word-splits, so a managed path containing whitespace silently
# drops out of the hash. It would still be counted by find; it is not counted
# here, so the count moves and the assertion notices.
managed_fingerprint() {
  local files lines count hash
  files=$(find brain/core brain/scripts .github .claude .gemini .gitattributes -type f 2>/dev/null | LC_ALL=C sort)
  lines=$(printf '%s\n' "$files" | xargs md5sum 2>/dev/null || true)
  count=$(printf '%s' "$lines" | grep -c . || true)
  hash=$(printf '%s\n' "$lines" | md5sum | cut -d' ' -f1)
  printf '%s:%s' "$count" "$hash"
}

# Refuses a fingerprint that covers zero files. Call this on the BEFORE value:
# an equality check between two nothings is not evidence of stability, it is
# evidence that the measurement failed.
assert_has_evidence() {
  local fp="$1" label="$2" count="${1%%:*}" hash="${1#*:}"
  case "$count" in
    ''|*[!0-9]*) fail "${label}: fingerprint is unreadable ('${fp}')"; return 1 ;;
  esac
  if [ "$count" -le 0 ]; then
    fail "${label}: the fingerprint covers ZERO managed files — the comparison would pass on no evidence at all"
    return 1
  fi
  # The bytes half has to be checked on its own terms. A positive count with an
  # empty or truncated hash is the state this guard exists for.
  case "$hash" in
    ????????????????????????????????) return 0 ;;
  esac
  fail "${label}: the fingerprint carries no usable hash ('${fp}') — the bytes could not be read"
  return 1
}

echo "▶ building local brain remote (${FROM} → ${TO}) …"
build_remote
echo "  remote ready: ${REMOTE}"

# ═══════════════════════════════════════════════════════════════════════════
line "DANGER PATH 1 — mid-upgrade failure rolls the tree back byte-identical (#396)"
# ═══════════════════════════════════════════════════════════════════════════
# The epic names "mid-upgrade kill". A real SIGKILL lands at a nondeterministic
# point inside a synchronous write batch, so it cannot be aimed reproducibly.
# What IS deterministic — and exercises the same restore-point machinery — is a
# write that FAILS partway: TO ships `brain/core/danger/marker.md`, and the
# consumer has a FILE where that directory must go, so mkdirSync throws ENOTDIR
# inside the write loop, after earlier paths have already been written.
new_consumer /srv/c1 "$FROM" && {
  rm -rf brain/core/danger
  echo "i am a file, not a directory" > brain/core/danger
  BEFORE=$(managed_fingerprint)
  HAVE_EVIDENCE=0; assert_has_evidence "$BEFORE" "path 1" && HAVE_EVIDENCE=1

  OUT=$(npm run brain:upgrade -- "$TO" 2>&1); RC=$?
  AFTER=$(managed_fingerprint)

  [ "$RC" -ne 0 ] && ok "upgrade failed (exit ${RC}) instead of reporting success" \
                  || fail "a failed write must not exit 0"
  # These two assertions replace a single `grep -qiE "rolled back|restore"`, which
  # was measured to pass when NO rollback happened at all: a mutation that threw
  # BEFORE `createRestorePoint` left all three of this block's assertions green.
  # A loose grep matches text from anywhere in the output, including lines that
  # say nothing about the claim — the same untrustworthy-assertion class this
  # suite argues against elsewhere, committed here.
  #
  # `brain-upgrade.mjs` uses two DISTINCT wordings, and the difference is the
  # whole discriminator:
  #   reached the write loop → "Upgrade failed while writing managed paths"
  #   refused before it      → "Upgrade refused before any managed path was written"
  # So assert the first is present AND the second is absent. Either alone can be
  # satisfied by the wrong path.
  echo "$OUT" | grep -q "while writing managed paths" \
    && ok "the failure happened INSIDE the write loop — the restore point was reached" \
    || fail "no write-phase failure reported: the run never got past pre-flight, so nothing was rolled back"
  echo "$OUT" | grep -q "before any managed path was written" \
    && fail "the run refused BEFORE writing — this scenario must exercise the rollback, not a pre-flight refusal" \
    || ok "and it was not a pre-flight refusal masquerading as one"
  # Finally: that it was OUR induced failure, not an unrelated one that happens
  # to land in the same phase.
  echo "$OUT" | grep -qiE "ENOTDIR|brain/core/danger" \
    && ok "the reported cause is the induced ENOTDIR on brain/core/danger" \
    || fail "the write failed for some OTHER reason — this scenario is no longer testing what it claims"
  # Guarded: with no evidence there is nothing to compare, and printing a green
  # equality line over two empty sets is precisely the failure this whole block
  # was hardened against. Skip it rather than emit a tick nobody can trust.
  if [ "$HAVE_EVIDENCE" -eq 1 ]; then
    [ "$BEFORE" = "$AFTER" ] \
      && ok "every managed path is byte-identical to before the attempt" \
      || fail "the tree changed across a failed upgrade (rollback incomplete)"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
line "DANGER PATH 2 — a consumer-edited managed file is never silently clobbered (#397)"
# ═══════════════════════════════════════════════════════════════════════════
new_consumer /srv/c2 "$FROM" && {
  echo "* @my-team" > .github/CODEOWNERS      # the consumer's own ownership policy
  BEFORE_CO=$(md5sum .github/CODEOWNERS | cut -d' ' -f1)

  OUT=$(npm run brain:upgrade -- "$TO" 2>&1); RC=$?

  [ "$RC" -ne 0 ] && ok "upgrade refused (exit ${RC})" || fail "a consumer-edited REFUSE path must abort"
  echo "$OUT" | grep -q "CODEOWNERS" && ok "the refusal names the file" || fail "the refusal must name the path"
  [ "$(md5sum .github/CODEOWNERS | cut -d' ' -f1)" = "$BEFORE_CO" ] \
    && ok "the consumer's CODEOWNERS survived untouched" \
    || fail "THE CLOBBER #397 EXISTS TO PREVENT JUST HAPPENED"
  # Whole-run abort: the refusal is not "skip this one and copy the rest".
  [ ! -f brain/core/danger/marker.md ] \
    && ok "nothing else was written either — the run aborted as a whole" \
    || fail "other managed paths were written despite the refusal"

  # …and the documented way through, per path.
  OUT=$(npm run brain:upgrade -- "$TO" --force-managed .github/CODEOWNERS 2>&1); RC=$?
  [ "$RC" -eq 0 ] && ok "--force-managed <path> completes the upgrade" || fail "--force-managed did not proceed (exit ${RC})"
  # Asserted against the MARKER this harness put in TO, not against brain's real
  # CODEOWNERS text. An earlier version of this check grepped for a string taken
  # from the design doc's illustrative table — which brain's actual file never
  # contained — so it failed while the product was correct. A test must assert
  # what the run produces, not what a document says it looks like.
  ! grep -q "@my-team" .github/CODEOWNERS \
    && ok "the consumer's version is gone — a FORCED path is overwritten, which is what asking by name means" \
    || fail "--force-managed did not overwrite the named path"
  grep -q "a line ${TO} added" .github/CODEOWNERS \
    && ok "…and what replaced it is what ${TO} actually ships" \
    || fail "the forced path does not carry the incoming content"
}

# The negative control. A REFUSE classification is not "always ask": untouched,
# these paths copy like anything else. Without this, a gate that fired for
# everyone would pass every assertion above.
new_consumer /srv/c2b "$FROM" && {
  OUT=$(npm run brain:upgrade -- "$TO" 2>&1); RC=$?
  [ "$RC" -eq 0 ] && ok "negative control: an UNTOUCHED CODEOWNERS upgrades without prompting" \
                  || fail "negative control failed — the gate fires for consumers with nothing to lose (exit ${RC})"
  [ -f brain/core/danger/marker.md ] && ok "negative control: the managed copy actually happened" \
                                     || fail "negative control: nothing was copied"
}

# ═══════════════════════════════════════════════════════════════════════════
line "DANGER PATH 3 — a downgrade is refused without --allow-downgrade (#398)"
# ═══════════════════════════════════════════════════════════════════════════
new_consumer /srv/c3 "$TO" && {
  BEFORE=$(managed_fingerprint)
  HAVE_EVIDENCE=0; assert_has_evidence "$BEFORE" "path 3" && HAVE_EVIDENCE=1
  OUT=$(npm run brain:upgrade -- "$FROM" 2>&1); RC=$?

  [ "$RC" -ne 0 ] && ok "downgrade refused (exit ${RC})" || fail "installing an OLDER tag must be refused"
  echo "$OUT" | grep -qiE "older" && ok "the refusal explains it is older" || fail "the refusal must say why"
  [ "$HAVE_EVIDENCE" -eq 1 ] && { [ "$BEFORE" = "$(managed_fingerprint)" ] && ok "nothing was written" || fail "a refused downgrade wrote to the tree"; }

  OUT=$(npm run brain:upgrade -- "$FROM" --allow-downgrade 2>&1); RC=$?
  [ "$RC" -eq 0 ] && ok "--allow-downgrade proceeds when the operator means it" \
                  || fail "--allow-downgrade did not proceed (exit ${RC})"
}

# ═══════════════════════════════════════════════════════════════════════════
line "DANGER PATH 4 — corrupt consumer JSON is named up front, --skip-merge completes (#399)"
# ═══════════════════════════════════════════════════════════════════════════
new_consumer /srv/c4 "$FROM" && {
  echo '{ this is not valid json' > .claude/settings.json
  BEFORE=$(managed_fingerprint)
  HAVE_EVIDENCE=0; assert_has_evidence "$BEFORE" "path 4" && HAVE_EVIDENCE=1

  OUT=$(npm run brain:upgrade -- "$TO" 2>&1); RC=$?
  [ "$RC" -ne 0 ] && ok "corrupt merge target refused (exit ${RC})" || fail "a corrupt merge target must stop the run"
  echo "$OUT" | grep -q "settings.json" && ok "the refusal names the broken file" || fail "the refusal must name the file"
  [ "$HAVE_EVIDENCE" -eq 1 ] && { [ "$BEFORE" = "$(managed_fingerprint)" ] && ok "nothing was written" || fail "the run wrote despite refusing"; }

  OUT=$(npm run brain:upgrade -- "$TO" --skip-merge .claude/settings.json 2>&1); RC=$?
  [ "$RC" -eq 0 ] && ok "--skip-merge completes the managed upgrade" || fail "--skip-merge did not complete (exit ${RC})"
  [ -f brain/core/danger/marker.md ] && ok "the managed core was updated" || fail "the managed core was NOT updated"
  # #399's lesson: a skipped path joins `local` (left alone), never the plain-copy set.
  grep -q "this is not valid json" .claude/settings.json \
    && ok "the skipped file was LEFT ALONE, not clobbered" \
    || fail "--skip-merge clobbered the file it was asked to leave alone"
}

# ═══════════════════════════════════════════════════════════════════════════
echo
if [ "$FAILED" -eq 0 ]; then
  echo "✓ all four M4 danger paths hold."
  exit 0
fi
echo "✗ ${FAILED} assertion(s) failed across the M4 danger paths."
exit 1
