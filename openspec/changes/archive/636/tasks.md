---
status: draft
issue: 636
---

# Tasks — #636

- [x] **T1** Re-measure on `main@1c21976` rather than trusting the ticket's numbers: 2046 unique,
      49 duplicated ids, 139 excess, 0 divergent, 89 in `2026-07` + 50 in `2026-06`, no group
      spanning two files, histogram `{2:15, 3:16, 4:2, 5:8, 6:1, 8:7}`. Identical to the ticket
      except the record total (2039 → 2046, seven records landed since). **The excess is
      unchanged at 139** — no new duplicate arrived, so this is still the pre-#221 residue.
- [x] **T2** Check the ticket's own precondition — *"must not run while another branch carries
      unmerged records"* — instead of waiting it out. Three branches are in flight (#663, #664,
      #667); each touches `2026-08.jsonl` only (`1 added / 0 deleted`), and every removed line is
      in `2026-06`/`2026-07`. Union cannot resurrect a line no incoming side contains, so the
      risk is structurally absent rather than merely small.
- [x] **T3** Probe raw-byte identity BEFORE writing the script: 139 repeats, **139 raw
      byte-identical, 0 differing**. The strictest available rule was already satisfiable.
- [x] **T4** Write the one-shot script: first-wins, raw-byte equality required, refuses the whole
      run on any divergence, arithmetic self-check, corrupt lines preserved, report-only unless
      `--apply`.
- [x] **T5** Dry run, then apply. `2026-06` 135 → 85, `2026-07` 2000 → 1911, `2026-08` untouched.
      2185 → 2046 physical lines.
- [x] **T6** Prove losslessness two independent ways:
      - `index.jsonl` sha256 identical before/after (`4c29a1c5…488d`);
      - `git diff --numstat .memory/` shows `0/50` and `0/89` and **does not list `index.jsonl`
        at all** — git itself says the projection did not move.
      Records diff is `0 added, 139 removed`: pure deletion, nothing rewritten in place.
- [x] **T7** Confirm the standing alarm is gone: `memory:reindex` now prints one clean line where
      it used to print a twelve-line warning on every store-reading verb.
- [x] **T8** Record the append-only exception — what, why safe here, why not a precedent — and
      rule explicitly that it is **not** amended into ADR-0017, since a carve-out in the ADR is
      how a one-off becomes standing permission.
- [x] **T9** Rule on the script's fate: kept in the change folder, never under `brain/scripts/`,
      never an `npm run` verb. Reasoning and the two rejected options recorded.
- [x] **T10** Land the reconciliation as its own commit — pure deletions, before/after numbers in
      the message — separate from the rule and the reasoning that authorised it.

## Cross-check that came free

`npm run memory:share` on this branch still exits 1 (`engram binary not found`) because the branch
is cut from `main`, which does not yet carry #641. On the agnostic backend it exits 0 **and now
prints nothing at all** — where before this change it printed the 139-line warning. The two
tickets confirm each other: #641 makes the verb reachable, #636 makes its output meaningful.
