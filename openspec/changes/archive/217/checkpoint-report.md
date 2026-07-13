# Checkpoint Report — CP-C2a

> **Change:** `issue-217-engram-records-migration` · **Slice:** C2a (the `provenance` pair +
> `engram-export` lib) · **Branch:** `feat/issue-217-engram-records-migration` (base
> `feature/v2.0.0` @ `b2d869f`)
> **Issue:** #217 (`status:approved`). **Depends on:** #205 C1a (format lib) + #214 C1b (validator,
> scrub, reindex), both merged.
> **Status: STOPPED at CP-C2a.** Awaiting the external verdict.
> **Verdict requested:** validate the shared-grammar parser/renderer pair (byte-lossless round
> trip), the export transform (loss contract + `@legacy` fallback), and the ruling-3b malformed-
> prose policy.

## 0. Re-split (why this slice is smaller than the approved #217 scope)

#217 was approved as C2 = pair + export + `migrate-v1 --dry-run`. After the adversarial-review
fixes (the BLOCKER-1 state-machine rewrite + the MAJOR-2/3 buckets), the counted diff reached
**476/400**. Per plan §10 (**split, never `size:exception`**) and the human ruling, C2 was
re-split:

- **C2a (this MR, #217)** = `provenance.mjs` + `engram-export.mjs` — **251/400**. Reviewed against
  §4 fixtures → a **contract** verdict.
- **C2-migrate** (new `status:approved` issue, per §0.1 — one approved issue per slice, no
  exception for a split) = `migrate-v1` + the CLI op + the real-data dry-run → an **application**
  verdict against the 278 real observations. Held on `wip/c2-migrate`, NOT in this MR.
- **C2b** (import + scrub re-point + real run + dual-write) — unchanged, follows C2-migrate.

Working-tree hygiene (ruling 2): the migrate machinery does not dangle as untracked files between
slices — it lives on `wip/c2-migrate`; `git status` is clean and this MR's diff is C2a only.

## 1. What was built

- **`lib/provenance.mjs`** — the §4 provenance grammar as ONE shared parser/renderer **pair**.
  `ACTOR_MARKER`/`FUENTE_MARKER`/`SUPERSEDE_MARKER` are the single source of truth: `parseProvenance()`
  compiles its regexes from them (L31-33) and `renderProvenance()` emits from the same constants
  (L128-136) — never a second "equivalent" literal (the `computeRecordId` one-hasher precedent).
  `parseProvenance` is a fixed-order state machine (Actor anchor → optional Fuente → optional
  Supersede → stop at first non-matching line), so a marker-shaped line in the **body** is never
  scraped into a field.
- **`lib/engram-export.mjs`** — `exportObservation()`: the C0 loss contract in code. §4 recovery →
  `@legacy`/`human` fallback with a `provenance unknown — migrated from engram chunk <id>` source;
  R2 title fold; `ts` → UTC seconds (`toUtcSeconds`); `scope:personal` filtered; non-enum `type`
  rejected-not-coerced; every output record gets its `id` from the shared `computeRecordId` and
  passes `validateRecord` (or is itself rejected). Pure lib (no fs / engram / child process).

## 2. Design decisions (design.md)

1. Parser/renderer share ONE grammar (drift guard = the property test). 2. `@legacy`/`human` is a
DECLARED convention, not an authorship claim (uncertainty lives in `source`, never a third enum).
3. Non-enum `type` → reject + report, never coerce. 4-5. Idempotency + the full `share`/`pull`
pipeline pinned for C2b. **6 (ruling 3b, new): malformed/partial §4 prose — the Actor line is an
all-or-nothing ANCHOR** (kind-less or unknown-kind Actor → no block, prose preserved verbatim for
the fallback; optional Fuente/Supersede are best-effort and order-anchored). Anchor-strict, not
lenient, precisely so a malformed anchor never fabricates an `actorKind` the source never carried.

## 3. Budget & baseline

**251 / 400** counted (`provenance.mjs` 140 + `engram-export.mjs` 111; `*.test.mjs` +
`openspec/changes/**` excluded). `npm test` **on this branch** → **982 pass, 0 fail** (strict TDD;
the ~12 `migrate-v1` tests are parked on `wip/c2-migrate` with that code — the pre-split combined
suite was 994). `brain:repo:check` clean · `brain:nav` green. **`brain/core/` NOT touched** → `brain-writes-reviewed` **PASSES** on
this PR (unlike C1b, which edited config-migrations/managed-paths).

## 4. Adversarial review (fresh context) — all findings resolved

The C2 review (before the re-split) returned 5 findings, all fixed + re-verified in a fresh-context
audit:
- **BLOCKER-1 (FIXED)** — round-trip was not byte-lossless: the old greedy scan hoisted body
  marker-lines into fields. Rewritten as the fixed-order state machine (`provenance.mjs:65-103`).
  Verified: `parse(render(record))` is byte-for-byte lossless even when the body contains
  `**Actor:**`/`**Fuente:**`/`**Supersede:**`-shaped text.
- **MAJOR-2 (FIXED)** — null-observation chunks were mislabeled `unparseable`; split into a
  distinct `emptyObservations` bucket (migrate-v1, C2-migrate slice).
- **MAJOR-3 / MINOR-4 (FIXED)** — explicit `unparseableNote`; per-observation try/catch (reject
  one, not the whole chunk). (Both in migrate-v1, C2-migrate slice.)
- **MINOR-5 (FIXED)** — design.md carve-out: C4 must not assert round-trip on an
  `issue`-without-`source` record until `renderProvenance` gains a distinct `issue`-only encoding.

**Residual known-limitation (surfaced by the fix-pass audit, honestly flagged — NOT a regression):**
if `renderProvenance()` were called on an *actor-less* record whose `content` literally starts with
an `**Actor:**`-shaped line, `parseProvenance()` would misdetect a block. **Unreachable from valid
records** — `validateRecord` requires `actor`, so every valid record renders an Actor line and the
ambiguity cannot arise; **0/278 real store records match the shape**. It is a boundary of the §4
fence-less convention (a wire delimiter would close it), recorded in Engram, not a defect in this
slice's code path. Raising it here per the standing instruction that a refuted/known-limitation
finding is reported with the same rigor as a confirmed one.

## 5. Evidence (verbatim test names)

- **Ruling 3a (shared grammar + property round-trip):**
  `the three §4 markers match the consolidation-protocol.md convention`;
  `property: parse(render(record)) recovers exact fields — fixture 0..3`;
  `BLOCKER-1 — marker-shaped lines in the BODY ... round-trip is byte-lossless`.
- **Ruling 3b (malformed/partial prose):**
  `parseProvenance: Actor line without a (kind) is NOT a block — no recovery, content preserved verbatim`;
  `... unknown kind (robot) is NOT a block ...`;
  `... valid Actor + malformed Fuente → actor recovered, the malformed Fuente stays in body ...`;
  `exportObservation: malformed leading §4 prose ... → @legacy fallback, malformed prose preserved verbatim in content`.
- **Export loss contract:** fallback → `@legacy`/`human` + provenance-unknown source; R2 fold;
  UTC-seconds ts; §4 recovery; `scope:personal` skipped; non-enum `type` (`manual`/`preference`)
  rejected-not-coerced; fallback record passes `validateRecord`.

## 6. Substrate

`brain:governance-status` → **RUNG 1** active. The C2a PR merges under it; the 5 REQUIRED contexts
must be green. `brain-writes-reviewed` PASSES (no `brain/core` edit). `actor-check` red = solo-
maintainer self-approval (L5 DETECTION, expected, non-blocking).

## 7. What this completes / next

- C2a = the record-producing lib (engram observation → brain record), contract-tested.
- **Next: C2-migrate** — the `migrate-v1` report + CLI op + the real-data `--dry-run` (held on
  `wip/c2-migrate`); needs its own `status:approved` issue (human, §0.1) before a branch is opened.
- Then **C2b** (import + scrub re-point + real run + dual-write). **R4** (human co-promotion of
  `memory-format.md` + `adr-0017` + `brain/HOME.md`) is independent.

---

**Awaiting the external CP-C2a verdict.** PR-as-review against `feature/v2.0.0`, `Part of #217`,
nothing merged until the verdict.
