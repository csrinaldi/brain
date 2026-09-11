---
status: draft
issue: 738
---

# Explore: provenance at capture (#738)

## The ticket, precisely

#541 (closed) asked for, as its criterion 2: *capture a fresh observation, show the
materialised record carries `actor`, `actorKind`, `issue` — never `@legacy`.* PR #542
(closing #541) shipped only a **counter** (`unprovenanced` in `dualWriteRecords`,
`brain/scripts/memory/backends/engram.mjs:338-360`) — it measures the defect, it does not
fix it. #738 is that criterion, re-filed, plus a second defect #541 never scoped:
`actorKind` **defaults to `'human'`** on the same unknown-provenance fallback
(`lib/engram-export.mjs:17,92-93`), a positive claim made on zero evidence.

Epic line, verbatim (`openspec/changes/issue-864-memory-2-0/tasks.md:31`):
> 2.2 #738 — provenance at capture: a fresh record carries `actor`, `actorKind`, `issue`,
> never `@legacy`; **[rev]** `actor` is a handle, never a branch name (`buildRecord` refuses
> a `/`); `actorKind` is measured, `PLAINFILES_ACTOR_KIND` retired; ruling on `actorKind:
> unknown` lands as an ADR-0017 amendment if adopted; guard at `exportObservation`.
> **[rev #870]** the refusal must cover `main`/`master`/`develop`/`trunk` as well as any `/`.

## Current state — every writer, measured

| Producer | Entry point | `actor` | `actorKind` | `issue` |
|---|---|---|---|---|
| `memory:save` (plainfiles) | `backends/plainfiles.mjs:93-124` `save()` | `getBranch(root)` — the **git branch name** (`backends/plainfiles.mjs:93`, `engram.mjs:1180-1182` `_getGitBranch`) | hardcoded `PLAINFILES_ACTOR_KIND = "agent"` (`plainfiles.mjs:42,94`) — never measured | `--issue` flag only, no default source (`cli.mjs:786-793`) |
| `memory:save` under `MEMORY_BACKEND=engram` | `backends/engram.mjs` `save` | N/A — **`unsupportedOp`** today (`memory-backend-contract.md:106` conformance row: "yes" only for `plainfiles`) | — | — |
| engram MCP `mem_save` / `mem_session_summary` (outside brain) | engram's own store, not brain's CLI | whatever the calling agent composes into the §4 `**Actor:**` prose (`consolidation-protocol.md:150`) or nothing | same | same |
| engram → records export | `lib/engram-export.mjs:56-100` `exportObservation()`, called from `dualWriteRecords()` (`backends/engram.mjs:320-360`, invoked by `memory:share` → `backends/engram.mjs:227` `share()`) | `parseProvenance()` recovery (`lib/provenance.mjs`) if a §4 block exists, else `LEGACY_ACTOR = '@legacy'` (`engram-export.mjs:16,92`) | recovered, else `LEGACY_ACTOR_KIND = 'human'` (`engram-export.mjs:17,93`) | recovered `issue`, else **absent** |
| cold-review poster | `brain/scripts/review/poster.mjs` | `reviewerHandle` — a **configured, token-verified** handle (`identity.mjs:1-16`, `poster.mjs:178-183`) | not a record producer yet (`memory-backend-contract.md:87` — ships after #864 task 3.1a) | n/a yet |

**The `@legacy` sentinel**: defined `lib/engram-export.mjs:16-17`. One writer only —
`exportObservation`'s else-branch (`:91-95`) — fired whenever an observation reaches export
with no recoverable §4 provenance prose. Measured 0/278 in 2026-07 (`provenance.mjs` header),
still 0/278 re-measured by PR #542 (issue #541 body), because **nothing ever emits the §4
block on the path where knowledge enters** (engram's native MCP tools, outside brain). #542
counts this (`unprovenanced`); it does not stop it.

**Baseline, measured today** (`node brain/scripts/memory/cli.mjs audit`, this worktree,
2360 records): `actor` shape all-time — `@legacy` 2177, `branch` 183, **`handle` 0**,
`other` 0. Zero records, ever, carry a genuine handle. Window (last 298): `@legacy` 213,
`branch` 85, `handle` 0. `classifyActor()` (`lib/audit.mjs:62-67`, shipped by #870/PR #871,
already on `main`) already does the measurement the epic line asks for — **the audit exists;
the fix does not.**

## What #541 actually ruled about `actor = getBranch(root)` — and why the epic reopens it

PR #542's body explicitly addresses this and rules it **not a defect**: *"two cli doors, one
convention"* — `plainfiles.save` and `engram.mjs#featureCheckpoint` both derive `actor` from
a `getBranch`-shaped seam, neither accepts a caller override, and that is pinned by
`backends/plainfiles.actorkind-consistency.test.mjs` (obs #578 ruling). The stated rationale:
*"the branch answers where rather than who, and that imprecision is the accepted cost of
spoof-resistance."*

**The epic's [rev] line directly reverses this ruling**: `actor` must become *"a handle,
never a branch name (`buildRecord` refuses a `/`)."* This is not a detail to implement
quietly — it is a decision that overturns a named, tested prior ruling, and
`plainfiles.actorkind-consistency.test.mjs:19-38` will fail once `actor` stops being
branch-derived (its own assertion is `record.actor === 'seam-derived-branch'`). The proposal
phase needs to record this reversal explicitly, with a reason (#870's finding — two bare
`main`/`master` actors, i.e. even the "where" signal degrades to a lie once the branch is a
default branch) — not just patch the test to match new code.

**No `--actor`/`--actor-kind` flag exists anywhere in `cli.mjs`'s parser**
(`cli.mjs:761-763`, Decision 2: *"spoof resistance enforced at the parser, never a
caller-supplied provenance field"*). This constraint is untouched by #738 — the fix derives
a handle, it does not accept one. Candidate derivation sources actually available at capture
time (measured in this worktree): `git config user.name` → `Cristian Rinaldi`, `git config
user.email` → `csrinaldi@gmail.com` (but `EMAIL_ACTOR_RE`, `format.mjs:46,153`, already
refuses an email-shaped `actor`), and an `AI_AGENT` env var (`AI_AGENT=claude-code_2-1-266_agent`
in this session) that could type-distinguish agent vs. human captures without a flag.

**A schema note the epic doesn't mention**: `memory-format.md`'s own example `actor` values
are `@crinaldi` and `claude-sonnet-4-6` (no leading `@` on the agent example) — but
`lib/audit.mjs:15` `HANDLE_RE = /^@[A-Za-z0-9][A-Za-z0-9-]*$/` requires a leading `@` for
anything to classify as `handle`. Under today's classifier, a bare agent model name like
`claude-sonnet-4-6` would land in `other`, not `handle`. This needs resolving before "derive
a handle" has a testable target.

## The `actorKind` fix

`PLAINFILES_ACTOR_KIND = "agent"` (`backends/plainfiles.mjs:42`) is hardcoded for every
plainfiles save regardless of who ran it. `LEGACY_ACTOR_KIND = 'human'`
(`engram-export.mjs:17`) hardcodes the opposite for every unrecoverable observation — the
#738 headline defect (2000/2000 `@legacy` records claim `human` on zero evidence, per the
issue body's count). Both are the same bug class: **a constant standing in for a
measurement**. The epic asks `actorKind` be "measured" and `PLAINFILES_ACTOR_KIND` retired —
same derivation source as the `actor` fix (a git-identity / agent-env seam that also answers
human-vs-agent).

## `actorKind: unknown` — the schema question

`lib/format.mjs:144-145` (`validateRecord`) admits only `'human'|'agent'` for `actorKind`;
`memory-format.md`'s schema table says the same. #738's suggested acceptance item 3 (issue
body) asks whether unknown provenance should get a third value, `unknown`, rather than a
forced two-value guess — explicitly scoped as **a decision, probably an ADR-0017 amendment**
(the epic line: *"lands as an ADR-0017 amendment if adopted"*), not a silent code change.
ADR-0017 already carries two amendments (`brain/project/decisions/adr-0017-memory-format-owned-by-brain.md:3,273,358`);
a third would need the same format (Context/Decision/Consequences) and touches the enum every
validator and every reader checks.

## `exportObservation` guard

#738's suggested acceptance item 5: *"a guard that fails when an observation with no block
reaches `exportObservation`, or this is documentation again."* Today `exportObservation`
(`engram-export.mjs:56-100`) never fails on missing provenance — it falls back silently. A
guard here is in tension with #542's own stated reason for NOT rejecting
(`dualWriteRecords`'s header, `backends/engram.mjs:338-349`: rejecting would refuse the 2070
historical observations and make `share` unusable, "the same trap #529's ruling refused").
Any guard #738 adds must distinguish **new capture** (where derivation should never be able
to fail — it's computed, not asserted) from **historical export** (where `@legacy` may need
to remain the documented, honest fallback for records that predate a producer). This is the
proposal's central design fork, not an implementation detail.

## Scope boundary — record-first (#874) is downstream, not this ticket

`memory-backend-contract.md`'s Producers table (`:80-83`) already writes #738 into its own
row: *`memory:save` … `actor` per #738 (a handle, never a branch)*. Rule 2 of the same
contract (`:64-73`) — *"the backend is never the first home of a capture"* — is **not yet**
true for `engram` (conformance table `:106`: `mem_save` is still the first home; closes only
with #864 task 3.2 = #874). #874's own body is explicit: *"No change to the MCP plugin"* and
lists #738 as a prerequisite. **#738 must land on the record-producing paths brain already
owns — `plainfiles.mjs save()` and `engram-export.mjs exportObservation()` — never on
engram's native `mem_save`/`mem_session_summary` MCP tools**, which stay out of brain's
control and are declared non-durable working memory by design. Fixing #738 before #874 means
the *engram-backed* `memory:save` still can't run (`unsupportedOp`) — the plainfiles path and
the export/import fallback are the only two capture surfaces #738 can actually change today.

## #874 / #247 / #805 — dependency shape

- **#874** (record-first, task 3.2): depends on #738. Do not implement #874's scope here.
- **#247** (task 2.3, retire chunk materialization) and **#805** (`supersedes` writer): run in
  parallel worktrees per the epic sequencing; #738 does not depend on either, but a `/`-refusal
  or `actorKind: unknown` schema change should stay reviewable independent of both.

## Acceptance, as testable statements

1. A fresh `memory:save` (plainfiles) record's `actor` is never branch-shaped: no `/`, and
   not one of `main`/`master`/`develop`/`trunk` (mirrors `lib/audit.mjs:16-18,65`
   `DEFAULT_BRANCHES`).
2. A fresh `memory:save` record's `actorKind` is derived, not the constant `"agent"` — a
   human running the CLI by hand and an agent session produce different, measured values.
3. `exportObservation` on an observation with a genuine §4 block still recovers `actor`/
   `actorKind`/`issue` exactly as today (no regression to the `recovered: true` path).
4. `exportObservation` on an observation with no block either (a) continues to fall back
   to a documented, honest sentinel for the *historical* case, or (b) is refused — whichever
   the ADR-0017 amendment decision (item 3 above) rules — but the fallback's `actorKind` is
   never asserted `human` without evidence.
5. `memory:audit`'s `actor` shape (`lib/audit.mjs` `actorShape`) on a fresh capture shows
   `handle` incrementing from its current all-time **0**.
6. No `--actor`/`--actor-kind` flag is ever added to `cli.mjs`'s parser (Decision 2 stays).

## Approaches, with tradeoffs

**A. Derive `actor` from git identity (`git config user.name`/`user.email`), typed by an
agent-env seam (e.g. `AI_AGENT` presence).**
+ No new flag; fits Decision 2. + Reuses `identity.mjs`'s "configured, not claimed" pattern.
− `user.email` is refused by `EMAIL_ACTOR_RE` — needs a handle-shaping step (e.g.
`@` + local-part), which is itself a policy decision (what happens on a shared/CI machine
where `git config user.name` is unset or generic). − Two doors (plainfiles vs. the future
engram `save`) must derive identically, or `plainfiles.actorkind-consistency.test.mjs`'s
"two cli doors, one convention" ruling breaks again.

**B. Keep branch-derived `actor` for `actorKind: agent` sessions, require a real handle only
where `actorKind` resolves to `human`.** + Smaller diff, doesn't fully reverse #542's ruling.
− Contradicts the epic line's plain reading ("actor is a handle, never a branch name" — no
carve-out stated); − still needs the `/`+default-branch refusal for the human path only,
splitting `buildRecord`'s contract by an input it doesn't otherwise branch on.

**C. Fail closed on unknown actor at capture** (refuse the save if no derivable identity)
**vs. a typed `actorKind: unknown` sentinel** (schema amendment, item 3 above).
Fail-closed matches "derive facts, never opinions" (`plainfiles.mjs:100-110` comment) and
gives capture the same discipline `type`/`issue` already have (`cli.mjs` refuses a missing
`type` by name). A typed `unknown` is gentler on CI/headless captures but reopens the
two-value enum everywhere (`format.mjs:144`, every reader) — and needs an ADR before code.

## Open questions for the proposal

1. Does #738 formally overturn the #542 "branch is the accepted cost" ruling, and if so, is
   that recorded as an ADR-0017 amendment or a narrower `memory-backend-contract.md` update?
2. What identity source counts as a "handle" when `git config user.name` is unset, or on a
   shared CI runner — refuse the save, or fall back to a typed default?
3. Does `actorKind: unknown` get adopted (ADR-0017 Amendment 3), or is the two-value enum
   kept and unknown provenance simply refused at `exportObservation`?
4. `HANDLE_RE` (`@`-prefixed) vs. the doc's own bare-agent-name example
   (`claude-sonnet-4-6`) — which is normative, and does the classifier or the convention
   change?
5. Does the `exportObservation` guard apply only to NEW chunk exports going forward, or does
   it need a way to distinguish "no producer existed yet" (historical, `@legacy` stays
   honest) from "a producer exists and still emitted nothing" (should now fail)?

## Files with tests first (touch order)

1. `lib/format.mjs` (`lib/format.test.mjs`) — `/`-and-default-branch refusal (new W-rule);
   `actorKind: unknown` enum change if D3 is adopted.
2. `backends/plainfiles.mjs` `save()` (`backends/plainfiles.save.test.mjs`,
   `lib/plainfiles-actorkind-doc-tripwire.test.mjs`) — replace `getBranch`/
   `PLAINFILES_ACTOR_KIND` with the derived-identity seam. **Breaks
   `backends/plainfiles.actorkind-consistency.test.mjs:19-38` by design** — its assertions
   must be rewritten to pin the NEW convention, not deleted. The doc-tripwire's
   `DECISION_REFERENCE_RE` cites `sdd/issue-246-c3/constraints`/`obs #578`; once #738
   supersedes that ruling, referencing docs need a fresh anchor.
3. `lib/engram-export.mjs` `exportObservation` (`lib/engram-export.test.mjs`) — `actorKind`
   fallback, and (per Q5) the guard/refusal behavior.
4. `lib/audit.mjs` (`lib/audit.test.mjs`) — `HANDLE_RE` only if Q4 changes the classifier
   (already ships #870's default-branch fix, untouched otherwise).
5. `openspec/changes/issue-864-memory-2-0/tasks.md:31` — check off once shipped.

## Risks

- 2360 existing records (2177 `@legacy`, 183 branch-shaped `actor`) are unaffected by a
  write-time change, but new reader assumptions ("no `/`", "always `@`-prefixed") must
  tolerate the historical corpus — read-path `validateRecord` stays looser than write-path
  `validateWritableRecord`, per the existing W1/W2 split (`lib/format.mjs:170-183`).
- Backfilling the 2000 `@legacy: human` records is explicitly out of scope (#541 criterion 5
  → #368; epic acceptance item 4) — that's #864 task 1.2a, a different ticket.
- `plainfiles.actorkind-consistency.test.mjs` currently PINS branch-derived `actor` as
  correct — a proposal reviewer should read it before approving any design, since passing it
  unchanged means the fix didn't happen.
- Scope creep into #874: engram's `save` is `unsupportedOp` until #874 lands; #738 should not
  un-stub it while fixing plainfiles.

## Split candidates (size)

- **Slice 1** (closes the epic line's core, no ADR): `actor`/`actorKind` derivation in
  `plainfiles.mjs` + `/`/default-branch refusal in `format.mjs` + rewritten consistency test.
  ~3 source files + 2-3 test files, ~80-150 changed lines.
- **Slice 2** (needs a ruling first): `actorKind: unknown` schema amendment (ADR-0017
  Amendment 3) — only if adopted.
- **Slice 3**: the `exportObservation` guard, once Q5 is answered — small in lines, large in
  judgment (historical vs. going-forward distinction).
