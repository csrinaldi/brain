---
status: draft
issue: 677
---

# Design — #677

## Decision 1 — flat `<yyyy-mm>-<id>.jsonl`, not `<yyyy-mm>/<id>.jsonl`

Both remove the conflict. The month-directory form was built first and measured (2051 files
across three directories); the flat form was chosen because **every reader stays untouched**. The
readers are five copies of the same idiom — `readdirSync(recordsDir).filter(f =>
f.endsWith('.jsonl')).sort()` then parse each line — and a directory-per-month layout makes all
five recursive. A recursive rewrite of five readers is five chances to change read behaviour in a
change whose entire safety argument is that read behaviour does not move.

The flat form also keeps the sort meaningful: lexicographic order over `<yyyy-mm>-<id>` is month
order, then id order, so first-wins remains "earliest month first" exactly as ADR-0017 states it.

Cost of the flat form: 2052 entries in one directory. Measured (`readdirSync` + read + parse over
the real store) at ≈70 ms against ≈133 ms for the three month files — the large-string
`split('\n')` dominates — so the fragmentation objection did not survive being priced.

## Decision 2 — the migration is a verb, not an upgrade step

`.memory/**` is consumer-owned (`managed-paths.mjs`'s `local` array). `store.mjs` already carries
the reason in its read/write note: brain cannot migrate what it does not own, which is why new
READ rules never go in. A layout change that rewrote a consumer's durable log on `brain:upgrade`
would break that rule harder than any read rule could.

So: the read path accepts both layouts (it already did — no code was needed), and a repository
moves when it runs `memory:split-records`. A store that never runs it keeps working and keeps the
conflict. That is the honest trade, and the ADR draft says so in those words rather than implying
the fix is universal.

## Decision 3 — verify, then delete; and prefer the detectable failure

The migration writes every per-record file, reads them back, and only then removes the month
files. On a mismatch it throws with both layouts still on disk.

The asymmetry is deliberate. A store that ends up **duplicated** is detected and reported by
`rebuildIndex` — that machinery exists (#574) and this change gives it a new legitimate source
(a half-migrated store). A store that ends up **short a record** is detected by nothing: a
missing record reads exactly like a record that was never captured. Given a choice between the
two failure modes, the verb must always land on the first.

`_writeFile` exists as a seam for exactly this branch. A verification that only ever runs against
a working writer is a verification nobody has seen fail — the mutation testing in `tasks.md` T9
covers the same ground from the other side.

## Decision 4 — refuse what `rebuildIndex` refuses, report what it reports

The migration reads every physical line, so it faces the same two questions the index gate faces,
and answering them differently would create a second, quieter dedup rule — the #340 drift shape.

- corrupt / does not validate / bytes do not hash to the `id` → **REFUSE the whole run**;
- repeated `id`, agreeing or diverging → **first-wins and REPORT**, exactly as ADR-0017
  Amendment 1 fixed for the index.

Refusal matters more here than in `rebuildIndex`, because this verb *deletes*. A migration that
silently dropped a line it could not read would write `evidence-reader-empty-on-failure` into the
durable log permanently.

## Decision 5 — `merge=union` stays, demoted

Deleting the attribute would be tidier and slightly worse. Where the driver DOES run (every
`git merge` on a developer's machine) it resolves the one residual conflict — a same-`id` pair
with divergent bytes — into a two-line file the reindex deduplicates and reports, instead of a
conflict a human resolves. That is strictly better than a conflict, and it costs nothing.

What it must not do is be cited again as the mechanism. So the `.gitattributes` comment says it
in full, and mutation M8 proves the claim: removing the attribute turns **zero** tests red.

## Decision 6 — the one-time conflict for open PRs is accepted, not hidden

Deleting the month files makes every currently-open memory-capturing PR conflict once, as a
delete/modify. Three properties make that acceptable:

1. it is **loud** — delete/modify cannot be merged past silently, which is the opposite of the
   failure this ticket is about;
2. the resolution is mechanical and stated in `proposal.md`;
3. it happens **once**, where the current behaviour happens on every PR after the first, forever.

The alternative — splitting only closed months and leaving the current one — would leave the
conflict exactly where it occurs, which is to say it would not be a fix.

## What was NOT decided here

`.memory/manifest.json`'s custom `engram-manifest` driver has the same hole and is worse in kind
(a custom driver cannot exist on the forge at all). It is deferred with the reason recorded in
the ADR draft: it indexes the legacy chunk transport, it is derived and regenerable, and its
churn is already treated as discardable. Retiring it belongs with the chunks decommission
(C4/D1, #247).
