#!/usr/bin/env bash
# promote-529.sh — apply the #529 ruling to brain/core/methodology/workflow-governance.md.
#
# YOU run this, on your machine, on this PR's branch. `brain/**` is Tier 2: the agent
# drafts, the human signs, and the signature is your commit — not a step the agent can
# perform for you.
#
# It is deterministic and idempotent: it anchors on exact strings and refuses if it
# cannot find them, rather than editing something adjacent. Running it twice is a no-op.
#
#   git fetch origin decision/issue-529-memory-gate-ruling
#   git checkout decision/issue-529-memory-gate-ruling
#   bash openspec/changes/issue-529-memory-gate-ruling/brain-drafts/promote-529.sh
#   git diff                     # read what you are signing
#   git commit -am "docs(governance): invariant 3 is repo-scoped — the ruling #519 asked for"
#   git push
#
# Then merge the PR. #529 closes with the doctrine already changed, instead of closing
# on a promise to change it.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
DOC="brain/core/methodology/workflow-governance.md"

OLD_ROW='| 3 | Memory dumped before closing (proxy) | `memory-gate` _(S4)_ | `skip:memory-gate` | Hard with override |'
NEW_ROW='| 3 | `.memory/` has EVER held a session summary (repo-scoped) | `memory-gate` _(S4)_ | _(none — `skip:memory-gate` is named but unimplemented)_ | Soft — see below |'
ANCHOR='Check context format: `governance / <job-name>` (GitHub prefixes the workflow `name:` field).'

if grep -qF "$NEW_ROW" "$DOC"; then
  echo "✓ already promoted — nothing to do."
  exit 0
fi

grep -qF "$OLD_ROW" "$DOC" || { echo "✗ invariant-3 row not found verbatim in $DOC — the file moved under the draft. Promote by hand from workflow-governance-invariant-3.md and tell the agent the anchor drifted."; exit 1; }
grep -qF "$ANCHOR" "$DOC" || { echo "✗ the 'Check context format' anchor is gone — same story."; exit 1; }

python3 - "$DOC" "$OLD_ROW" "$NEW_ROW" "$ANCHOR" <<'PY'
import sys
doc, old_row, new_row, anchor = sys.argv[1:5]
s = open(doc, encoding='utf-8').read()

section = """### Invariant 3 scope — what `memory-gate` does and does not check

**It is repo-scoped and it is permanently satisfied.** `memoryPresence` asks whether ANY
`session_summary` observation exists in `.memory/records/`. There are 205. The gate therefore
passes on every PR regardless of whether that PR captured anything, and it will keep passing if
nothing is ever captured again.

**Nothing enforces per-change capture.** The PR template's "Memory materialized before closing"
is a promise the checklist makes and no gate keeps. Read invariant 3 as *"this repository has a
memory layer"*, never as *"this change was remembered"*.

Measured 2026-08-11 (issue #529): `.memory/records/` went **seven days** without a new record
while **34 merges** landed. `memory-gate` was green on all of them — correctly, by the definition
above. That is the gap this scope note exists to stop hiding.

**`skip:memory-gate` does not exist in code.** No path checks for it. It is listed here and in
`AGENTS.md` as documentation of an intent, and `brain:metrics` counts its usage raw without ever
subtracting it. Applying the label changes nothing.

**This is a ruling, not a resting place** (issue #529). The sequence is: #530 makes capture a
mechanism rather than a habit → `skip:memory-gate` becomes real → invariant 3 tightens to
recency. Tightening it before the writer is reliable would block every PR with no override,
which is how a gate teaches people that gates are obstacles.

"""

s = s.replace(old_row, new_row, 1)
s = s.replace(anchor, section + anchor, 1)
open(doc, 'w', encoding='utf-8').write(s)
PY

echo "✓ $DOC updated. Read \`git diff\` before committing — you are signing the ORDER"
echo "  (#530 → skip:memory-gate implemented → recency), not just the wording."
