---
status: proposed
issue: 247
epic: 864
---

# Proposal — #247 the chunk read-back gets its guard and its ledger, not its removal

Parent: #864 (memory 2.0), task 2.3. **PR #258 already closed the reader half** of this ticket
(`brain-audit.mjs:53,226` and `brain-check.mjs:28,237` call `readRecordObservations`;
`chunk-reader.mjs` and its test are deleted; `readChunkObservations` has **zero importers**,
measured). What stayed open is the transport half — and two ratified documents describe that half
two incompatible ways. **D0 rules on that first, because it decides everything else.**

## What is wrong today

| the ticket says | the ruling says |
|---|---|
| #247 body item 2: "retire chunk materialization in `memory:share`"; epic task 2.3: "`share` reads no chunk file" (`issue-864-memory-2-0/tasks.md:32`) | #863 **D3** (`issue-863-backend-contract/proposal.md:91-99`, ratified 2026-09-08 per `tasks.md:25`): 2.3 is **"chunk read-back"**; "manifest, chunks and symlink exist only because `share` calls `engram sync --export`. Once `share` no longer exports the backend, all three lose their only writer **at once**" — at **3.2**. Order: **2.3 → 3.2 → 2.4**. Restated in `design.md:32` |

The measured fact that breaks the tie: `engram.mjs`'s `save()` is `unsupportedOp` (`:1108-1110`), so
`share` → `engram sync --export` (`_defaultShareExport`, `:473-480`) → `dualWriteRecords` reads
`.memory/chunks/*.jsonl.gz` (`_defaultReadObservations`, `:260-261`) → `records/` **is engram's only
producer path today**. `memory-backend-contract.md:102` states it as a "not yet" against rule 2.

## Decisions

### D0 — The ruling outranks the ticket's wording. This slice is the read side and its guard

| option | what it means | cost |
|---|---|---|
| (A) follow the ticket body — stop calling `engram sync --export` now | matches the title and epic 2.3 literally | engram is left with **no producer path** until #874 lands: captures stop reaching `records/` at all. Contract rule 2 regresses in the wrong direction; it is the #803-churn mistake D3 warns about, one layer up |
| **(B) follow D3 — #247 = the read-back boundary, its guard, and the ledger; the export retires at 3.2** | the ratified sequence is honoured; the working capture path is untouched; #874 inherits an explicit deletion list instead of rediscovering it | the ticket's own acceptance line ("`share` no longer writes `.memory/chunks/`") is **not** met by this PR and must be re-scoped in public — the maintainer act below |

**Recommendation: (B).** A ratified ruling wins over a ticket's wording; the ticket predates the
ruling (2026-09-08) and #874's body reproduces the same stale phrasing ("share reads no chunk"). The
reconciliation is not silent — it is posted on #247 and amended into epic task 2.3 in this PR
(**For the maintainer**, below).

### D1 — What "chunk read-back retired" means concretely *before* #874

| option | what it means | cost |
|---|---|---|
| (a) repoint `dualWriteRecords` at engram's plain `export` JSON instead of the gz chunks | the read-back really ends this slice | **parity is unmeasured** (project scoping, schema, completeness vs `sync --export`), and it swaps the only capture path's input **before** its replacement exists. Drags the ~1069-line `engram.share.test.mjs` scrub subsystem with it, and the #469 fail-closed guarantee must be re-proved over a stream nobody has read yet |
| **(b) keep the chunk read as engram's private transport until #874; add the guard tests + the ledger** | the boundary becomes *enforced* rather than *asserted in comments* (`run-check.test.mjs:32`, `store.mjs:281` say it in prose today), and 3.2 gets a written deletion list | the ticket's headline stays open until #874; near-zero counted diff may read as "did nothing" without D0's note |
| (c) both | — | (a)'s risk with none of its urgency |

**Recommendation: (b).** `memory-format.md:334` already calls the gz chunks "engram's private
transport", which rule 3 explicitly permits an adapter to own. (a) becomes correct the moment
#874 gives engram a record-first `save` — at which point the substitute is a record, not another
export format. **(a) would only be preferable if `engram export`'s parity could be proven inside this
slice's tests; it cannot be, without running the backend.**

### D2 — `.memory/legacy/*.jsonl.gz` (48 tracked files): not this slice

Task **2.4** owns them, and 2.4 is sequenced **after** 3.2 (D3). Restated here so it is not
re-litigated: the reader story ("zero readers outside `migrate-v1.mjs --rollback`; historical value
only") is stated **by 2.4, when it deletes them** — not by #247. This PR touches no legacy file, no
manifest, no `.gitattributes`, no merge driver, no `.engram` symlink.

### D3 — The chunk-secret-scrub subsystem: untouched

`scrubMaterializedChunks` / `_defaultChangedChunkFiles` (`engram.mjs:565-596`),
`assertExportDestinationIsRead`, and their ~15 tests in `engram.share.test.mjs` (1069 lines) are the
#469 hardening that guarantees **nothing reaches `records/` unscanned**. Under (b) they keep guarding
a live path and are not touched — the largest line-count risk in the slice is simply not taken.
Under (a) they would need a new input and a re-proof; that re-proof is now **3.2's** obligation and
is written into the ledger.

### D4 — The guard tests (and one correction to the brief)

**Measured:** `collectChunkObservations` has three importers, not one — `migrate-v1.mjs:42` (its
home), `engram.mjs:48`, and `cli.mjs:615` (the `memory migrate-v1` dry-run). A guard phrased "zero
importers outside `backends/engram.mjs`" would be **red on arrival**. The guard must be an
allowlist.

| # | guard | shape |
|---|---|---|
| 1 | `readChunkObservations` has zero importers repo-wide | source-level grep over `brain/**`, comments excluded; exact today (module deleted by #258) |
| 2 | `collectChunkObservations` is imported **only** by `engram.mjs`, `cli.mjs`'s `migrate-v1` path, and its own test | allowlist constant in the test, each entry annotated with the ticket that retires it (3.2 for `engram.mjs`, 2.4 for the `migrate-v1` pair) |
| 3 | `share` under `MEMORY_BACKEND=plainfiles` writes no chunk | **already true by construction** — `plainfiles.mjs` mentions chunks only in a comment (`:145`); pinned behaviourally so it stays true |
| 4 | `brain-audit` / `brain-check` still read `records/` only | pins PR #258 against silent regression |

Placement: beside `governance/run-check.test.mjs`, whose `:32` comment is the prose this test
replaces.

### D5 — Docs

| surface | change |
|---|---|
| `memory-backend-contract.md:102` (engram, rule 3) | **none.** It already reads "**not yet** — manifest, chunks, symlink, driver; closes with #864 tasks 2.3/2.4" — still true after this slice, and Tier 2 |
| `issue-864-memory-2-0/tasks.md:32` (epic task 2.3) | **one line rewritten**, riding this PR. `openspec/**` is Tier 1 and maintainer-visible; leaving stale wording next to a ruling that contradicts it is the defect this slice is closing |
| ADR-0002/0004 Amendment 1, ADR-0017 | **none.** They already place the chunk directory under the adapter |

### D6 — Scope, TDD, forecast, delivery

**STRICT TDD, files first:**

| # | file | what it pins |
|---|---|---|
| 1 | `governance/chunk-boundary.test.mjs` (new) | D4 guards 1, 2, 4 — red first by asserting against a temporary fixture importer |
| 2 | `memory/backends/plainfiles.share.test.mjs` (extend or new) | D4 guard 3 |
| 3 | `memory/lib/migrate-v1.test.mjs` (extend) | `collectChunkObservations` keeps its `--rollback` / `migrate-v1` role — the allowlist is a contract, not an accident |

**Forecast** (counted diff excludes `**/*.test.mjs` and `openspec/changes/**`):

| file | counted |
|---|---|
| `brain/scripts/memory/backends/engram.mjs` — a header note pointing the chunk seams at the ledger | ~12 |
| `brain/scripts/governance/run-check.test.mjs:32` prose → cross-reference | 0 (test) |
| new + extended tests | 0 (test), ~180 reviewer-visible |
| `openspec/**` (this proposal, spec, design, tasks, the epic line) | 0 (excluded), ~250 reviewer-visible |
| **total counted** | **~12** |

**One PR.** ~12 counted against the 400 budget; ~430 reviewer-visible, of which the majority is
this reconciliation. `Chained PRs recommended: No`. Option (a) would forecast ~200+ counted and is
deferred, not split.

**Non-goals** — this slice does not: retire `engram sync --export`; change `share()`,
`dualWriteRecords` or `_defaultShareExport` behaviour; touch the scrub subsystem; delete or untrack
any legacy file, the manifest, the merge driver or the symlink; do any part of #874.

### Ledger for #874 (task 3.2) — what dies when `share` stops exporting

| # | surface | disposition at 3.2 | notes |
|---|---|---|---|
| 1 | `engram.mjs#_defaultShareExport` (`:473-480`) | delete | the `engram sync --export` call itself |
| 2 | `engram.mjs#_defaultReadObservations` (`:260-261`) + the import at `:48` | delete | the read-back |
| 3 | `dualWriteRecords`'s `_readObservations` seam (`:186`, `:323`) | delete or repoint at the record | the transform becomes "the record is already here" |
| 4 | `scrubMaterializedChunks` / `_defaultChangedChunkFiles` (`:565-596`), `assertExportDestinationIsRead` | delete **only after** the #469 fail-closed guarantee is re-established over record-first `save` | the one item 3.2 must not drop silently |
| 5 | `engram.share.test.mjs` (~1069 lines, ~15 chunk-scrub tests) | delete or repoint with (4) | largest line count in 3.2 |
| 6 | `.engram → .memory` symlink ensure (`:208`) | **2.4**, not 3.2 | D3's sequence |
| 7 | `secret-scrub.mjs`'s `gunzipSync` / `scrubChunkFile`; `collectChunkObservations` in `migrate-v1.mjs` + `cli.mjs:615` | **2.4**, not 3.2 | still serve `migrate-v1` / `--rollback` over `.memory/legacy/*` |

## Capabilities (contract with `sdd-spec`)

**New: none. Modified: none.** `openspec/specs/**` is empty in this repo by convention; the
normative surfaces are `memory-backend-contract.md` rule 3 and #863 D3, neither of which is amended.

## Affected areas

| path | impact | what changes |
|---|---|---|
| `brain/scripts/governance/chunk-boundary.test.mjs` | New | the four D4 guards |
| `brain/scripts/memory/backends/engram.mjs` | Modified | a header note naming the chunk seams and the ledger row that retires each |
| `brain/scripts/memory/lib/migrate-v1.test.mjs`, `plainfiles` share test | Modified | the allowlist and the plainfiles negative |
| `openspec/changes/issue-864-memory-2-0/tasks.md:32` | Modified | one line — D0's reconciliation |
| `share()`, `dualWriteRecords`, the scrub subsystem, `.memory/**` | **Untouched** | by decision (D1b, D2, D3) |

## Risks

| risk | likelihood | mitigation |
|---|---|---|
| A reviewer reads a near-zero-diff PR as "#247 did nothing" | **High** | D0 is stated in the PR body, on the issue, and in the epic line; the deliverable is an enforced boundary + a ledger, both absent today |
| The guard as briefed ("zero importers outside `engram.mjs`") lands red | High if unchecked | measured and corrected in D4 — three importers exist; the guard is an annotated allowlist |
| #874 ignores the ledger and rediscovers item 4 (the #469 scrub) late | Med | the ledger is a table in this proposal and is restated in `tasks.md`; #874's explore reads both |
| The ticket stays open past its epic wave, looking stalled | Med | the maintainer comment states the remaining acceptance line and its new owner (#874) explicitly |
| `engram export` parity turns out trivial and (b) looks over-cautious | Low | (a) stays available; nothing in (b) blocks it, and (b)'s guards would still be needed |

## Rollback

Revert the PR. No runtime behaviour changes, so nothing to un-migrate: the guards disappear and the
prose comments they replaced are restored by the same revert. The epic line reverts to its stale
wording, which is why D0 is *also* posted on #247 — the reconciliation survives a code revert.

## Success criteria

- [ ] `npm test` green; the new guard test is **red first** against a fixture importer.
- [ ] `readChunkObservations` has zero importers, enforced by a test rather than a comment.
- [ ] `collectChunkObservations`'s three importers are an allowlist, each annotated with the ticket
      (3.2 / 2.4) that retires it.
- [ ] `share` under `MEMORY_BACKEND=plainfiles` writes no chunk, pinned behaviourally.
- [ ] `share`/`dualWriteRecords`/the scrub subsystem are byte-unchanged; engram's capture path still
      works.
- [ ] Epic task 2.3 reads the ruling's boundary; the #247 comment is posted.
- [ ] The ledger's seven rows are carried into #874's inputs.

## For the maintainer

**The reconciliation, in one sentence:** #247's title and epic 2.3's wording describe approach (A);
#863 D3 — ratified 2026-09-08, `issue-863-backend-contract/proposal.md:91-99` and `design.md:32` —
describes approach (B) and sequences 2.3 → 3.2 → 2.4; **the ruling wins**, because the measured state
(`engram.mjs:1108-1110`, `save()` is `unsupportedOp`) makes (A) a removal of engram's only capture
path before its replacement exists. Two acts make that public: the epic line (in this PR) and the
comment below.

**Epic task 2.3 — the amendment (one line, `openspec/changes/issue-864-memory-2-0/tasks.md:32`):**

> - [ ] 2.3 #247 — **[rev 2026-09-10, per #863 D3]** the **read-back boundary only**: `chunk-reader.mjs`'s verdict is *deleted* (PR #258) and `readChunkObservations` has zero importers; a guard test pins that plus `collectChunkObservations`'s annotated allowlist (`migrate-v1.mjs`, `engram.mjs`, `cli.mjs`'s `migrate-v1`); the ledger of what 3.2 deletes is written. **`share` keeps calling `engram sync --export`** — retiring it here would leave engram with no producer path (`save` is `unsupportedOp`), so "`share` reads no chunk file" moves to **3.2 (#874)**.

**Draft comment for #247:**

> **Re-scoped to match #863 D3 — the read-back, not the export.**
>
> PR #258 already did half of this ticket: `brain-audit.mjs` and `brain-check.mjs` read
> `readRecordObservations`, and `chunk-reader.mjs` was deleted along with its test.
> `readChunkObservations` has zero importers today.
>
> The other half — item 2, "retire chunk materialization in `memory:share`" — is blocked by a
> ruling this ticket has to follow. #863 **D3** (ratified 2026-09-08) labels task 2.3 "chunk
> read-back" and orders **2.3 → 3.2 → 2.4**, on the grounds that "manifest, chunks and symlink
> exist only because `share` calls `engram sync --export`; once `share` no longer exports the
> backend, all three lose their only writer at once" — at **3.2**, not here.
>
> The measured reason it must be that way: `engram.mjs`'s `save()` is `unsupportedOp` today, so
> `share` → `engram sync --export` → `dualWriteRecords` reads the chunks → `.memory/records/` is
> engram's **only** producer path. Removing the export before #874 (record-first capture) ships
> would stop captures reaching `records/` altogether — the backend contract's rule 2 moving
> backwards.
>
> So this ticket delivers the boundary and its enforcement, and hands #874 the deletion list:
>
> 1. A guard test: zero importers of `readChunkObservations`; `collectChunkObservations` restricted
>    to an annotated allowlist (`migrate-v1.mjs`, `engram.mjs`, `cli.mjs`'s `migrate-v1`), each entry
>    naming the ticket that retires it. Today this is only a prose comment.
> 2. `share` under `MEMORY_BACKEND=plainfiles` writes no chunk — true by construction, now pinned.
> 3. A seven-row ledger of everything #874 must delete when `share` stops exporting, including the
>    one item that must **not** be dropped silently: the #469 fail-closed secret scrub has to be
>    re-established over record-first `save` before the chunk scrub is deleted.
>
> **Remaining acceptance line moved:** "`memory:share` no longer writes `.memory/chunks/`" is
> **#874's** (epic task 3.2). Epic task 2.3's wording is amended in the same PR. `.memory/legacy/*`
> (48 files), the manifest, the merge driver and the `.engram` symlink stay with task **2.4**, after
> 3.2, per the same ruling.
>
> If you would rather this ticket carry the export retirement anyway, say so and it becomes a
> blocked-on-#874 slice instead — but it cannot land before #874 without breaking capture.

## Proposal question round

Each has a working recommendation above; none blocks `sdd-spec` / `sdd-design`.

1. **D0 lets a ruling override an issue title.** Is "ratified ruling > ticket wording" the standing
   precedence you want recorded, or should #247 instead be closed and a fresh ticket opened for the
   read-back guard so the title never lies?
2. **D1 keeps the chunk round-trip alive** rather than repointing `dualWriteRecords` at
   `engram export`'s plain JSON. That parity is unmeasured and cannot be measured inside this
   slice's tests. Accept (b), or is spending a measurement spike on `engram export` worth it now?
3. **D4's guard is an allowlist, not "zero importers"** — because `collectChunkObservations` has
   three live importers. Should `cli.mjs`'s `migrate-v1` command itself be on the retirement docket
   (it would move to 2.4), or is it a permanent migration tool?
4. **The ledger lives in this proposal** and is restated in `tasks.md`. Would you rather it were a
   comment on #874 so it survives independently of this change folder's archival?
5. **The slice is ~12 counted lines.** Is a PR whose value is a guard, a ledger and a public
   reconciliation acceptable on its own, or should it ride along with the next memory-2.0 slice?
