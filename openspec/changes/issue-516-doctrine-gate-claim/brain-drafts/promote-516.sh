#!/usr/bin/env bash
# promote-516.sh — apply the #516 correction to the five doctrine sites.
#
# YOU run this, on your machine, on this PR's branch. `brain/**` is Tier 2: the agent
# drafts, the human signs, and the signature is your commit — not a step the agent can
# perform for you.
#
#   git fetch origin fix/issue-516-doctrine-gate-claim
#   git checkout fix/issue-516-doctrine-gate-claim
#   bash openspec/changes/issue-516-doctrine-gate-claim/brain-drafts/promote-516.sh
#   git diff                     # read what you are signing
#   git commit -am "docs(governance): decision-gate is added-only and label-blind — ADR-0026 Amendment 4 (#516)"
#   git push
#
# `brain:promote` cannot do this one: it handles a NEW ADR and refuses the amendment
# path by design (brain-promote.mjs:335), which is #509. So this script performs §1c's
# acts by hand — and it regenerates AGENTS.md itself, because the checklist for #529
# described a two-file edit for a three-file cascade and CI caught it on the human's
# signing commit. Written from the VERB's behaviour, not from the doctrine text.
#
# Deterministic and idempotent: it anchors on exact strings and REFUSES if it cannot
# find them, rather than editing something adjacent. Running it twice is a no-op.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

CONS="brain/core/methodology/consolidation-protocol.md"
WFG="brain/core/methodology/workflow-governance.md"
ADR="brain/project/decisions/adr-0026-governance-doctrine-tiers.md"
HOME_MD="brain/HOME.md"

if grep -qF "Amendment 4, 11/08/2026" "$HOME_MD"; then
  echo "✓ already promoted — nothing to do."
  exit 0
fi

python3 - "$CONS" "$WFG" "$ADR" "$HOME_MD" <<'PY'
import sys
cons, wfg, adr, home = sys.argv[1:5]

def edit(path, pairs):
    s = open(path, encoding='utf-8').read()
    for old, new in pairs:
        if s.count(old) != 1:
            sys.exit(f"✗ {path}: anchor found {s.count(old)} times, expected exactly 1 —\n"
                     f"  the file moved under the draft. Promote by hand from the brain-drafts/\n"
                     f"  files and tell the agent the anchor drifted.\n  ---\n{old}\n  ---")
        s = s.replace(old, new, 1)
    open(path, 'w', encoding='utf-8').write(s)
    print(f"✓ {path}")

# ── Site 1 — §1c, the load-bearing sentence ────────────────────────────────────
edit(cons, [(
"""The `brain/HOME.md` entry for that ADR is updated in the same commit to carry the amendment
marker — `decision-gate` requires an ADR change and a `brain/HOME.md` change to co-occur, so
omitting it fails the gate as well as leaving the index wrong.""",
"""The `brain/HOME.md` entry for that ADR is updated in the same commit to carry the amendment
marker. **Nothing enforces this. You are the enforcement.**

`decision-gate` requires an ADR and a `brain/HOME.md` change to co-occur only when the ADR is
**added**. An amendment MODIFIES an existing ADR, and since #510 a modified ADR without a
`HOME.md` change PASSES — deliberately, because the previous behaviour blocked every PR that
corrected a line in an old ADR (PR #507). The other two nets do not close it either:
`brain:nav` passes because `HOME.md` already links the ADR — it is the *marker* that goes
missing, not the link — and `phase-order` is detection-only at `lite`.

So an amendment can land with the index still describing the previous version, and no gate
will say so. Until `brain:promote` gains the amendment path (#509), the three acts above and
this fourth one are convention held by whoever runs them."""),

# ── Site 2 — §1d act 2 ────────────────────────────────────────────────────────
("""2. the `brain/HOME.md` entry (§1b) — required for `brain:nav` reachability _and_ by
   `decision-gate`'s ADR ⇔ `HOME.md` co-occurrence rule;""",
"""2. the `brain/HOME.md` entry (§1b) — always required for `brain:nav` reachability, and
   enforced by `decision-gate` only when the ADR is **added**: `decision-gate` fails an added
   ADR with no `HOME.md` change, and fails a `HOME.md` change that touches no ADR at all, but
   passes a MODIFIED ADR alone (#510). On an amendment (§1c) this step therefore has no gate
   behind it;"""),
])

# ── Site 5 — workflow-governance.md (row, section, boundary table, paragraph) ──
edit(wfg, [(
"| 4 | ADR exists for labeled decisions | `decision-gate` _(S4)_ | label-conditional (see below) | Mixed |",
"| 4 | An ADDED ADR co-occurs with a `brain/HOME.md` entry | `decision-gate` _(S4)_ | _(none — the gate reads no labels)_ | Hard, in one direction — see below |"),

("""### Invariant 4 — two-step `decision-gate` (S4)

- **Step 1 (hard)**: if the PR carries the `decision` label, require an `adr-NNNN-*.md` AND
  a `brain/HOME.md` change in the diff. Fails the PR if either is missing.
- **Step 2 (heuristic)**: scan known architectural surfaces (`scripts/.*/providers/`,
  `brain/core/`, `config-migrations.mjs`, `package.json`) for changes without the `decision`
  label → emit `::warning::`, always `exit 0`. **Never a hard block** — the heuristic can be
  wrong; it raises attention, not a veto.""",
"""### Invariant 4 scope — what `decision-gate` does and does not check

**It reads no labels, and it runs on every PR.** `adrPresence` takes the changed-file list and
the added-file list; no call site passes labels and the workflow job carries no condition. The
`decision` label changes nothing about the verdict.

**It fails in exactly two cases** (measured 2026-08-11, issue #516):

| condition | verdict |
|---|---|
| an ADR is **added** and `brain/HOME.md` is not in the diff | fail |
| `brain/HOME.md` is in the diff and **no** ADR path is touched | fail |
| anything else, including a **modified** ADR alone | pass |

The two are keyed differently on purpose: the first reads the ADDED list, the second the
TOUCHED list. That asymmetry is #510's content — a PR correcting one line of an old ADR must
not be forced to re-index it (the previous behaviour blocked PR #507 for months) — and its
consequence is that **an amendment's `brain/HOME.md` marker has no gate behind it**
(`consolidation-protocol.md` §1c now says so; the net belongs in the amendment verb, #509).

**There is no step-2 heuristic.** This file described one — a scan of
`scripts/.*/providers/`, `brain/core/`, `config-migrations.mjs` and `package.json` emitting a
`::warning::` for changes without the `decision` label. Nothing scans those surfaces and
nothing emits that warning; the description was aspirational and read as shipped. An
architectural change carrying no ADR simply passes, in silence.

Both facts are pinned by test (`run-check.test.mjs`, #516), each proven a real detector by a
mutation that IMPLEMENTS the claim. If either is ever built, those tests fail and name this
section, so the doctrine cannot silently fall behind the code again."""),

("| ADR exists when `decision` label is set | Whether the PR actually made a new decision |",
 "| An added ADR is indexed in `brain/HOME.md` | Whether the PR actually made a new decision |"),

("""This boundary is **not a gap to close** — it is the line between what a machine can verify
and what requires a human mind. The heuristic in step 2 of `decision-gate` warns and
`exit 0`s precisely because "is this a decision?" is judgment. Only the label-conditional
step is hard.""",
"""This boundary is **not a gap to close** — it is the line between what a machine can verify
and what requires a human mind. *"Is this a decision?"* is judgment, and `decision-gate` does
not attempt it: it verifies a cascade (an added ADR is indexed) and says nothing about whether
an ADR was owed. Applying the `decision` label is a human act with no gate reading it."""),
])

# ── Sites 3 and 4 + §1c acts 1 and 3 — ADR-0026 Amendment 4 ───────────────────
AMENDMENT = """

---

## Amendment 4 — `decision-gate` is added-only and label-blind; the doctrine said otherwise (issue #516)

**Signed**: 11/08/2026 — Cristian Rinaldi

### What changed

Nothing in the gate. This amendment changes only what the doctrine CLAIMS about it, and the
claims were wrong in two independent ways.

**One: direction.** #510 (PR #515) made `adrPresence` distinguish an ADDED ADR from a MODIFIED
one, because the previous behaviour forced a `brain/HOME.md` re-index for correcting a line in
an ADR from months ago — it blocked PR #507 for months. Correct fix, and four doctrine
statements kept describing the old check. One of them, `consolidation-protocol.md` §1c, told a
human amending a signed ADR that *"omitting it fails the gate"*. It does not.

**Two: labels.** `workflow-governance.md` described a two-step gate — step 1 hard *"if the PR
carries the `decision` label"*, step 2 a heuristic scanning architectural surfaces and warning.
**Neither has ever existed.** `adrPresence` takes two file lists, no call site passes labels,
and the workflow job carries no condition. That claim also reached `AGENTS.md`, which is
compiled from that file, so it was in the agent's own instructions.

### The measurement

Driven on `main` at `eb8810d` (2026-08-11):

| condition | verdict |
|---|---|
| an ADR is **added**, no `brain/HOME.md` | **fail** |
| an ADR is added **+** `HOME.md` | pass |
| a **modified** ADR, no `HOME.md` | **pass** &larr; the case §1c claimed was caught |
| a modified ADR + `HOME.md` | pass |
| `HOME.md` alone, no ADR touched | **fail** |

All three enforcement surfaces (`run-check.mjs`, `brain-check.mjs`, `merge-walk.mjs`) pass the
added-file list, so there is no surface on which the old behaviour survives.

### Why option (1) and not a restored gate

Re-imposing co-occurrence on modified ADRs re-creates the defect #510 removed and re-blocks
PR #507's whole class. A protection whose first act is to block routine correction teaches that
gates are obstacles — the argument #529's ruling turned on.

The content-keyed guard #516 sketches — *"the Status line's amendment count increased &rArr; that
ADR's `HOME.md` line changed"* — is the right net and belongs in the amendment-promotion verb
(#509), not in a check that catches the omission afterwards. **A tool that performs the cascade
cannot forget it.**

### The accepted loss

Until #509 ships, the amendment marker in `brain/HOME.md` is convention with nothing mechanical
behind it. `brain:nav` does not catch it (the link is already there; the *marker* goes missing)
and `phase-order` is detection-only at `lite`. **This amendment is itself an instance**: it was
executed by hand, and nothing but the human would have caught the marker being omitted.

What is bought is that no one reads a guarantee that is not there. An apparent protection is
worse than a stated absence — that is #499's class, and it is why this was worth a ticket.

### What is still open

The label divergence. The `standard` row's *"+ the `decision`-label step hard"* still describes
behaviour that has never shipped. Both facts — label-blindness and the absent heuristic — are
now pinned by test (`run-check.test.mjs`, #516), each proven a real detector by a mutation that
IMPLEMENTS the claim, and those tests name this ADR and `workflow-governance.md` in their
failure messages. The doctrine cannot silently fall behind the code again; it can still be
ahead of it, which is exactly what that row is.
"""

edit(adr, [
    ("**Status**: Accepted · **amended 09/08/2026** (Amendments 1-3 — see below)",
     "**Status**: Accepted · **amended 11/08/2026** (Amendments 1-4 — see below)"),

    ("| `decision-gate` | ADR ⇔ `brain/HOME.md` co-occurrence | + the `decision`-label step hard | + the ADR carries a recorded human signature |",
     "| `decision-gate` | ADR ⇔ `brain/HOME.md` co-occurrence **[Amended by Amendment 4 (#516) — only in the ADDED direction: an added ADR requires a `HOME.md` change, and a `HOME.md` change requires some ADR to be touched, but a MODIFIED ADR alone passes (#510). See Amendment 4.]** | + the `decision`-label step hard — **not implemented; the gate reads no labels at any tier (Amendment 4)** | + the ADR carries a recorded human signature |"),

    ("""- **Negative (pre-existing, now load-bearing)**: `decision-gate`'s shipped check
  (unconditional ADR ⇔ `brain/HOME.md` co-occurrence) does not match its documentation
  (label-conditional with a heuristic second step). The `standard` evidence row above
  describes the documented behaviour. This divergence must be resolved before that row
  means anything.""",
     """- **Negative (pre-existing, PARTLY resolved by Amendment 4, #516)**: `decision-gate`'s shipped
  check does not match its documentation. Two halves, and they are in different states.
  **Resolved**: the check was described as an *unconditional* ADR ⇔ `brain/HOME.md`
  co-occurrence. Since #510 it is added-only in one direction and touched-keyed in the other;
  the documentation (this row, `workflow-governance.md` invariant 4, `consolidation-protocol.md`
  §1c/§1d) was corrected to match, and the code half is pinned by test.
  **Still open**: the check is LABEL-BLIND at every tier, while the doctrine described a
  label-conditional step 1 and a heuristic step 2 — neither of which exists in any code path.
  The `standard` evidence row above (*"+ the `decision`-label step hard"*) therefore still
  describes behaviour that has never shipped, and still means nothing until it does."""),
])

# Act 3 — append the signed section.
s = open(adr, encoding='utf-8').read()
if '## Amendment 4' not in s:
    open(adr, 'a', encoding='utf-8').write(AMENDMENT)
    print(f"✓ {adr} — Amendment 4 appended")

# §1c act 4 — the brain/HOME.md marker.
h = open(home, encoding='utf-8').read()
marker = "; **Amendment 4, 11/08/2026** — `decision-gate` is added-only (#510) and label-blind; the doctrine describing it was corrected, #516"
anchor = "**Amendment 3, 09/08/2026** — `governance.agentActors` identities do not re-arm the approval at `lite`, #454)"
if h.count(anchor) != 1:
    sys.exit(f"✗ {home}: the ADR-0026 index line moved — add the Amendment 4 marker by hand.")
open(home, 'w', encoding='utf-8').write(h.replace(anchor, anchor[:-1] + marker + ")", 1))
print(f"✓ {home} — Amendment 4 marker added")
PY

# AGENTS.md is COMPILED from five SOURCE_DOCS — workflow-governance.md and HOME.md
# among them — and a drift guard fails CI when the committed copy is not byte-equal
# to the compile. Not a signature, a build step, so the script does it.
#
# Through the backend's own init, NOT `brain:env:init`: that verb prompts for a PAT,
# upgrades tooling and reprojects memory, all to rewrite one file.
node -e "import('./brain/scripts/harness/backends/antigravity.mjs').then(m => m.init())"
echo "✓ AGENTS.md regenerated from the SOURCE_DOCS."

echo
echo "✓ five sites corrected across four files, plus AGENTS.md."
echo "  Read \`git diff\` before committing. You are signing ADR-0026 Amendment 4, and"
echo "  what it accepts: until #509, the amendment marker is convention with no gate."
