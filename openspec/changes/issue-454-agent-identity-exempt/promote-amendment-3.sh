#!/usr/bin/env bash
#
# promote-amendment-3.sh — applies ADR-0026 Amendment 3 (issue #454).
#
# WHAT THIS IS NOT: a promotion tool. `brain:promote` promotes NEW adr-NNNN-*.md
# files and refuses in-place edits by design (brain-promote.mjs:335); automating
# the amendment shape is #509, unbuilt. This script is the manual §1c/§1d cascade
# written down so it is deterministic and reviewable instead of hand-typed.
#
# It performs the three acts + the HOME.md edit, then STOPS. It never commits,
# never pushes, and never touches git config. The commit is the signature and it
# is yours (ADR-0028's whole point).
#
# Every anchor is verified before anything is written: an anchor that does not
# match exactly once aborts with a non-zero exit and no partial edit. A script
# that half-applies an amendment is worse than one that refuses.
#
# Usage:  bash openspec/changes/issue-454-agent-identity-exempt/promote-amendment-3.sh
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

ADR="brain/project/decisions/adr-0026-governance-doctrine-tiers.md"
HOME_MD="brain/HOME.md"
TODAY="$(date +%d/%m/%Y)"

for f in "$ADR" "$HOME_MD"; do
  [ -f "$f" ] || { echo "✗ not found: $f" >&2; exit 1; }
done

if ! git diff --quiet -- "$ADR" "$HOME_MD"; then
  echo "✗ $ADR or $HOME_MD already has uncommitted changes — refusing to edit on top of them." >&2
  exit 1
fi

python3 - "$ADR" "$HOME_MD" "$TODAY" <<'PY'
import sys, re

adr_path, home_path, today = sys.argv[1], sys.argv[2], sys.argv[3]

def must_replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        sys.exit(f"✗ {label}: anchor matched {n} times, expected exactly 1 — refusing.\n  anchor: {old[:90]!r}")
    return text.replace(old, new)

adr = open(adr_path, encoding='utf-8').read()

# ── ACT 1 — the Status line ────────────────────────────────────────────────
adr = must_replace_once(
    adr,
    "**Status**: Accepted · **amended 08/08/2026** (Amendments 1-2 — see below)",
    f"**Status**: Accepted · **amended {today}** (Amendments 1-3 — see below)",
    "ACT 1 (Status line)",
)

# ── ACT 2 — annotate the superseded rule IN PLACE ──────────────────────────
# Appended immediately after Amendment 2's existing annotation, inside the same
# GATE_MATRIX cell, so a reader who never scrolls is not left with the old rule.
AM2_TAIL = "OR'd with the distinct-act check above; see Amendment 2.]**"
AM3_NOTE = (
    " **[Amended by Amendment 3 (#454) — the exempt set also includes identities "
    "registered in `governance.agentActors`: an agent acting inside the approved loop "
    "under the approver's instruction does not re-arm the approval; see Amendment 3.]**"
)
adr = must_replace_once(adr, AM2_TAIL, AM2_TAIL + AM3_NOTE, "ACT 2 (in-place annotation)")

if "Amendment 3" in adr.split("## Amendment 3")[0].replace(AM3_NOTE, "", 1) and "## Amendment 3" in adr:
    sys.exit("✗ the file already carries an Amendment 3 section — refusing to append a second.")

# ── ACT 3 — the signed section ─────────────────────────────────────────────
section = open(
    "openspec/changes/issue-454-agent-identity-exempt/brain-drafts/adr-0026-amendment-3.draft.md",
    encoding='utf-8',
).read()
m = re.search(r"^```markdown\n(## Amendment 3 .*?)\n```\s*$", section, re.S | re.M)
if not m:
    sys.exit("✗ could not extract the ACT 3 body from the draft — the fenced block moved.")
body = m.group(1).replace("DD/MM/2026", today)

adr = adr.rstrip("\n") + "\n\n" + body.rstrip("\n") + "\n"
open(adr_path, "w", encoding='utf-8').write(adr)

# ── §1d act 2 — the brain/HOME.md index entry ──────────────────────────────
# NOT a new entry: ADR-0026 is already indexed. The amendment markers live inline
# on that line, and the third is appended to them.
home = open(home_path, encoding='utf-8').read()
AM2_MARK = ("**Amendment 2, 08/08/2026** — a signed `brain-decision/1` block is additional "
            "sufficient `lite` evidence for `actor-check`, #473)")
AM3_MARK = (f"**Amendment 2, 08/08/2026** — a signed `brain-decision/1` block is additional "
            f"sufficient `lite` evidence for `actor-check`, #473; "
            f"**Amendment 3, {today}** — `governance.agentActors` identities do not re-arm the "
            f"approval at `lite`, #454)")
home = must_replace_once(home, AM2_MARK, AM3_MARK, "HOME.md index entry")
open(home_path, "w", encoding='utf-8').write(home)

print("✓ ACT 1 · ACT 2 · ACT 3 applied to", adr_path)
print("✓ index entry updated in", home_path)
PY

echo
echo "── §1d act 3: regenerating AGENTS.md ─────────────────────────────────"
echo "   brain/HOME.md is one of the five SOURCE_DOCS, so this is required."
echo "   antigravity.drift.test.mjs asserts byte-equality and runs under npm test."
AGENT_PLATFORM=antigravity npm run --silent brain:env:init

echo
echo "── review, then commit. The commit is the signature. ─────────────────"
git --no-pager diff --stat -- "$ADR" "$HOME_MD" AGENTS.md
