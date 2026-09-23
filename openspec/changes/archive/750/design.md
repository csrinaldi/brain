---
status: draft
issue: 750
---

# Design — the softening reads the CAUSE, and the vacuous truth that makes it fail open

The ruling decided **what** the softening must read: the cause of the `REVISE`,
not the shape of the finding list (option (b)). This decides **where each line
goes**, and it is dominated by one fact of the language rather than by any
architecture: `[].every(...)` is `true` in JavaScript. A cause gate written
without a length check is not a gate — it is the same fail-open silence #483
came to fix, wearing a new field's name.

## Measure first

Taken on `fix/issue-750-softening-reads-the-cause` (worktree
`/home/gandalf/IA/brain-issue-750`, cut from `origin/feature/issue-682`), read
from the files, not recalled.

| question | answer | evidence |
|---|---|---|
| How many files can produce the `conclusion` `buildVerdict` receives? | **Three.** | `cli.mjs:439-488` — `tranche` \| `checkpoint` \| `ruling` are mutually exclusive branches, each assigning `evalResult` once. |
| Does the judgment half overwrite the conclusion? | **No.** | `cli.mjs:566-575` merges `findings` only: `evalResult = { ...evalResult, findings: [...] }`. The spread carries every other key through untouched. |
| Does `applyCausalAdmission` overwrite it? | **No.** | `cli.mjs:632` destructures into `{ findings, escalate, conditions: baseConditions }` — three **new locals**. `evalResult` is never reassigned. |
| Can the softening see `conditions`? | **No, structurally.** | `verdict.mjs:260`'s five conjuncts name `protocol`, `processed`, `candidateFindings`, `raisedConclusion`, `escalatesWithoutBlocking`. `conditions` is read once, at `:285`, *after* the ladder. |
| How many call sites does `buildVerdict` have in production? | **One.** | `cli.mjs:658`. |
| Is `local-checks` required at every tier? | **Yes.** | `governance-tiers.mjs:126-130` — `required` at `lite`/`standard`/`regulated`. It is also the only member of `BASE_REPRODUCIBLE_GATES` (`base-comparison.mjs:72`). |
| What counts against `diff-size`? | Production only. | `governance.ignoreList` excludes `**/*.test.mjs` and `openspec/changes/**`. |

**Estimated production diff: ~34 lines** (tranche +6, checkpoint +8, ruling +2,
cli +6, verdict +12) plus ~8 doctrine lines. Well inside the budget; no
`size:exception`.

## Decision 1 — inline cause arrays per return path, no `causesOf` helper

The field is `conclusionCauses: Array<'blocker'|'uncomputable'>`, declared at
**every** return path of every evaluator that can produce a `conclusion`.

Two shapes were available and the criterion is the one the ruling set: *prefer
the option a mutation can kill per site.*

**Rejected — a shared `causesOf({ anyBlocker, anyUncomputable })` helper.** It
would create a second, distinct class of mutation that no single test owns:
editing the helper breaks five sites at once, so five tests go red together and
none of them is the *home* of that mutation. A green mutation report proves
nothing when the axis is shared. The helper also shares no logic worth sharing —
each site computes a **different** pair of inputs, so the helper's body would be
two ternaries and every call site would still spell both booleans.

**Adopted — a literal array per return, written at the site.** The mutation
"drop `'uncomputable'` from THIS path" is then a one-token edit with exactly one
test that dies.

### The exact edit, per site

**`evaluators/tranche.mjs`** — three returns.

*Site 1 — the uncomputable rollup, line 160-165.* `findings` is `[]` here by
construction (the branch short-circuits before the gate loop), so the cause is a
literal:

```js
    return {
      conclusion: 'REVISE',
      conclusionCauses: ['uncomputable'],   // ← new, line 162
      gates: { required: [], detection: [] },
      findings: [],
      conditions: [rollupUncomputableCondition(requiredGates)],
    };
```

*Site 2 — the uncomputable budget, line 192-202.* This return **can** carry
blockers: the required-gate loop at `:171-181` has already run and pushed
`gate:<name>` findings into `findings`. Both causes are live, simultaneously —
this is the site that proves the field has to be an array:

```js
    return {
      conclusion: 'REVISE',
      // Both, and at the same time: the gate loop above may already have pushed
      // blockers, and the budget is separately uncomputable. This predicate is
      // evaluated HERE and not reused below because `findings` is still
      // growing — two readings of a mutating list are two measurements, not a
      // duplication.
      conclusionCauses: [
        ...(findings.some(f => f.severity === 'blocker') ? ['blocker'] : []),
        'uncomputable',
      ],
      gates: { required: [...requiredJobs], detection: [...detectionJobs] },
      findings,
      conditions: ['evidence uncomputable: budget diff (base sha unresolvable outside CI)'],
    };
```

*Site 3 — the normal return, line 249-251.* The existing `.some(...)` is named
so the conclusion and its cause are derived from **one** reading:

```js
  const anyBlocker = findings.some(f => f.severity === 'blocker');
  const conclusion = anyBlocker ? 'REVISE' : 'APPROVE';

  return {
    conclusion,
    conclusionCauses: anyBlocker ? ['blocker'] : [],
    gates: { required: [...requiredJobs], detection: [...detectionJobs] },
    findings,
    conditions: [],
  };
```

`APPROVE` declares `[]`, not `['blocker']`. The field explains a `REVISE`; an
`APPROVE` has nothing to explain, and saying `['blocker']` there would be a false
statement in the one place nobody would look. See Decision 4 for why an empty
array on an `APPROVE` cannot come back as a fail-open.

**`evaluators/ruling.mjs`** — two returns, `:126-138` (malformed → `REVISE`,
always carrying the `fork-malformed` blocker) and `:141-157` (valid fork →
`STOP`):

```js
      conclusion: 'REVISE',
      conclusionCauses: ['blocker'],   // ← :128
...
    conclusion: 'STOP',
    conclusionCauses: [],              // ← :143 — a STOP is never softened; it declares nothing
```

Ruling *could* omit the field entirely and rely on the fail-closed default
(Decision 4). It does not, for #683's reason: a declaration that exists on some
paths and not others invites a reader to believe the omission carries meaning.
Honest cost, stated: neither ruling value is reachable by the softening (`STOP`
fails the fourth conjunct; the malformed path's blocker is annotated
`introduced` and therefore never leaves `candidateFindings`), so the ruling pins
are **shape** assertions on the returned object, not verdict-level behaviour.
That is weaker evidence and the test plan labels it as such.

## Decision 2 — checkpoint UNIONS what it inherits with what it observes

`evaluators/checkpoint.mjs:238-242` becomes:

```js
  const anyBlocker = findings.some((f) => f.severity === 'blocker');
  const anyUncomputable = uncomputableReasons.length > 0;
  const conclusion =
    tranche.conclusion === 'REVISE' || anyBlocker || anyUncomputable ? 'REVISE' : 'APPROVE';

  // The union is not decoration. `findings` already contains tranche's findings
  // (line 213), so `anyBlocker` sees them — but tranche's UNCOMPUTABLE causes
  // (an unreadable rollup, an unresolvable budget base) are not findings at all
  // and are invisible here. Inheriting the cause list is the only way this
  // evaluator can state why its own conclusion is REVISE when the reason
  // happened one layer down.
  const conclusionCauses = [...new Set([
    ...tranche.conclusionCauses,
    ...(anyBlocker ? ['blocker'] : []),
    ...(anyUncomputable ? ['uncomputable'] : []),
  ])];

  return { conclusion, conclusionCauses, gates: tranche.gates, findings, conditions };
```

**Set semantics, and why order must not matter.** The array is **deduped**
(`'blocker'` genuinely arrives twice — once inherited, once observed) and
**deliberately not sorted**. Both properties are cosmetic, because the only
consumer is `length > 0 && every(c => c === 'blocker')`, which is insensitive to
order and to duplicates. Dedupe exists so a debug dump reads honestly, nothing
more.

The rule that follows is a **test rule**: no pin may assert `deepEqual(causes,
['blocker', 'uncomputable'])` against the raw array. Pins compare
`[...new Set(causes)].sort()` against a sorted expectation. A pin that asserted
insertion order would be pinning a property the production code does not promise
and cannot observe — the code would then be unable to change something it never
guaranteed, which is a test owning an implementation detail rather than a
behaviour.

## Decision 3 — the field is threaded, not recomputed, and the default lives in one place

**`cli.mjs:658-682`**, one line added immediately under `conclusion:`:

```js
  const verdict = buildVerdict({
    headSha: boot.headSha,
    conclusion: evalResult.conclusion,
    // #750 — the CAUSE travels with the conclusion. Threaded, never recomputed
    // here: `cli.mjs` cannot see the blocking set (that is `buildVerdict`'s job)
    // and cannot see the uncomputable reasons (they are gathered inside the
    // evaluator), so any derivation at this layer would be a guess.
    conclusionCauses: evalResult.conclusionCauses,
    protocol,
    ...
```

Plain pass-through — **not** `evalResult.conclusionCauses ?? []`. A `??` here
would be a second declaration of the same fail-closed default, and two homes for
one default means one of them is untested. `undefined` triggers the destructuring
default in `buildVerdict` and nowhere else.

**Confirmed by reading, not assumed:** nothing between the evaluator and the call
rewrites the field.

- `cli.mjs:566-575` (the inferential merge) spreads `evalResult` and replaces
  `findings` only. `conclusionCauses` survives byte-identical.
- `cli.mjs:632` (`applyCausalAdmission`) destructures into three **new** locals
  (`findings`, `escalate`, `baseConditions`). `evalResult` is not reassigned.
- The judgment half can only ADD findings after the declaration. That cannot
  falsify the cause: an added blocker makes `candidateFindings` non-empty, which
  kills the third conjunct before the sixth is ever reached.

## Decision 4 — the guard, and the vacuous-truth trap it exists to close

**`verdict.mjs:146-160`** — the destructuring gains one line, directly under
`conclusion` so the pair reads as a pair:

```js
export function buildVerdict({
  headSha,
  conclusion,
  // #750 — FAIL-CLOSED BY DEFAULT. A caller that declares no cause does not get
  // its REVISE softened. `['blocker']` would have been the convenient default
  // and it is exactly wrong: it would soften on a claim nobody made.
  conclusionCauses = [],
  protocol = 'brain-review/1',
```

**Between `:251` and `:253`**, above the ladder, so the mutation *"delete the
length check"* has exactly one home:

```js
  // #750 — THE SOFTENING READS THE CAUSE, and `length > 0` is HALF THE RULE, not
  // padding. `[].every(...)` is VACUOUSLY TRUE in JavaScript: without the length
  // check, an evaluator that declared no cause at all would satisfy "every cause
  // is a blocker" and soften — fail-OPEN, on a fact nobody asserted, which is the
  // same silence #483 came to fix wearing a new field's name.
  //
  // The maintainer's ruling on #750 is option (b): the softening reads WHY the
  // conclusion was REVISE, never merely the shape of the finding list. §10 says
  // never APPROVE on uncomputable evidence, and the routing of a finding says
  // nothing whatever about evidence that was never gathered.
  const causeIsBlockerOnly =
    conclusionCauses.length > 0 && conclusionCauses.every((c) => c === 'blocker');
```

**`verdict.mjs:260`** — the sixth conjunct is appended **last**, and the first
five stay byte-for-byte identical:

```js
  } else if (protocol === 'brain-review/2' && processed.length > 0 && candidateFindings.length === 0 && raisedConclusion === 'REVISE' && !escalatesWithoutBlocking && causeIsBlockerOnly) {
```

Last, for two reasons: the diff shows one added token group rather than a
rewritten line, and a reader meets the shape checks before the cause check — the
order the doctrine paragraph (Decision 6) states them in.

**NOT widening `candidateFindings.length === 0`.** That widening is #682 round
1's own reverted regression and `verdict.mjs:268-274` records why in the file
itself. The shape check answers *"was every blocker routed out"*; the new
conjunct answers *"was the REVISE blocker-driven"*. Two questions, two
conjuncts.

**Why an `APPROVE` evaluator declaring `[]` cannot fail open.** `buildVerdict`
raises `APPROVE` → `REVISE` at `:214-217` when `blockerRemains`, which is
computed **from `candidateFindings`**. So every raise implies a non-empty
blocking set, which fails the third conjunct before the sixth is consulted. The
fail-closed default costs nothing on any reachable path; it only refuses.

## Decision 5 — the e2e goes through the real verb, and it is a DIFFERENTIAL

`cli.test.mjs:298` already established the pattern: drive the shipped
`main()` in-process with DI seams substituted, `--dry-run`, and read the
**rendered** block. Everything #750 needs is reachable through seams that already
exist and already have callers — **no new test seam is required**, and the design
would refuse one if it were: a seam that exists only for a test is production code
nobody runs.

The seams, all pre-existing:

| what must be true | seam | why it exists in production |
|---|---|---|
| the base is genuinely unresolvable | `deps.loadCiContext → { baseSha: null }` + `fetchPr → { baseRefOid: null }` | `cli.mjs:422` — the ADR-0022 resolution chain |
| ⇒ the TDD-RED reversion is uncomputable | *(consequence)* `checkpoint.mjs:228-229` pushes `TDD-RED reversion (base sha unresolvable)` | §10.4 fail-closed |
| ⇒ the budget is uncomputable | *(consequence)* `tranche.mjs:192-202` | §10 fail-closed |
| one real blocker exists | `trancheDeps.fetchRollup` → `local-checks` `conclusion: 'FAILURE'` | the rollup read |
| that blocker routes OUT to `follow_ups[]` | `deps.probeBase → { failed: ['local-checks'], unreproducible: [], command }` | `cli.mjs:602`, already exercised by `cli.test.mjs:180` |

`needsBaseProbe` fires because `gate:local-checks` is a blocker and `local-checks`
is the sole member of `BASE_REPRODUCIBLE_GATES`; `classifyAgainstBase:257-270`
rewrites it to `pre-existing`; `buildVerdict`'s routing loop puts it in
`follow_ups[]` and leaves `candidateFindings` empty. That is the whole bug,
assembled from shipped code.

**It is written as ONE test with two arms**, because a single-armed version
proves less than it appears to. The two runs are identical in every input except
**one axis: whether the base resolves.** Same mode, same rollup, same probe, same
routed-out blocker.

```
arm A — baseSha resolves      → causes ['blocker']                 → verdict: APPROVE
arm B — baseSha is null       → causes ['blocker','uncomputable']  → verdict: REVISE
                                                                     + conditions carry
                                                                       'evidence uncomputable'
```

Arm B is **red today** (it renders `APPROVE` over a verdict that declares it could
not compute its evidence — §10 exactly inverted). Arm A is **green today and must
stay green**, and it is what makes arm B mean anything: without it, a guard
hardcoded to refuse every softening would pass.

Assertions, on the rendered block a human reads — never on the builder's return
object:

```js
// arm A
assert.match(outA, /verdict: APPROVE/);
assert.match(outA, /follow_ups:/);            // the blocker WAS routed out — the softening's premise held
// arm B
assert.match(outB, /verdict: REVISE/);
assert.match(outB, /evidence uncomputable/);
assert.doesNotMatch(outB, /verdict: APPROVE/,
  '§10: a verdict that could not compute its evidence may not approve, however its findings routed');
```

The checkpoint mode is chosen over tranche deliberately: at `baseSha: null` it
makes **both** the tranche budget and the checkpoint reversion uncomputable, so
arm B also exercises Decision 2's union (`tranche.conclusionCauses` inherited,
checkpoint's own `uncomputableReasons` added) rather than just one producer.

**The spawned e2e stays untouched.** `test/review-regulated/regulated-review.e2e.test.mjs:516-538`
asserts `APPROVE` through the real process, against a real git history, via the
real `#483` softening. It is green today and it is the strongest existing proof
that the threading works: remove `conclusionCauses:` from `cli.mjs:658` and that
test goes red. `fixture.mjs` surgery to force "unresolvable base **and**
base-reproducible red gate" in the spawned harness is explicitly out of scope —
larger risk, separate ticket, and the in-process differential already drives the
shipped `main()` end to end.

## Decision 6 — the doctrine paragraph, replacing `reviewer-protocol.md:330-333`

§6.2's current bullet documents the shape-only rule and is now wrong. §10's row
at `:419` already states the general rule correctly (*"never APPROVE on
uncomputable evidence"*) and **stays unchanged** — the defect was never that §10
was silent, it was that §6.2 described a mechanism that could not honour it.

Replacement text:

> - **REVISE-to-APPROVE softening — the shape AND the cause.** If every finding
>   that exists was routed out of the blocking set (all `pre-existing`/`base-only`),
>   the evaluator's conclusion was `REVISE`, **and the evaluator declared that
>   `REVISE`'s cause to be blocker-driven and nothing else**, the verdict becomes
>   `APPROVE` (`buildVerdict`) — findings existed, but nothing causal to this
>   change blocks it. A `REVISE` that **any** uncomputable evidence contributed to
>   is never softened: §10 forbids approving on evidence the reviewer could not
>   compute, and how a finding was *routed* says nothing about evidence that was
>   never *gathered*. An evaluator that declares **no** cause is not softened
>   either — the softening requires a positive, blocker-only declaration, so
>   silence fails closed by construction rather than by luck.

`brain/core/**` is **Tier 2**: no ADR is minted, no separate ratification step
exists, and **the maintainer's merge of this PR is the signature.**

Two consequences of touching that path, flagged so nobody reads them as new
defects:

- `tranche.mjs:219-227` raises a `tier2-frontier` **correction** on this PR.
  Expected, non-blocking.
- `checkpoint.mjs:165-178` raises a `decision-surface` **blocker** whenever
  `^brain/core/` is touched without the `decision` label. If this PR is reviewed
  in checkpoint mode, either it carries the label or that blocker fires.

## Work units — strict TDD, and the one split that is NOT allowed

`strict_tdd: true`. Every commit leaves the suite green **except** the
deliberately red test-first commits, which name the failing assertion in the
commit body.

| # | commit | state | contents |
|---|---|---|---|
| 1 | `test(review): pin the cause each evaluator declares (#750)` | **RED** | evaluator shape pins — tranche ×3 paths, checkpoint ×3 shapes (inherit / observe / union), ruling ×2 |
| 2 | `feat(review): evaluators declare conclusionCauses (#750)` | GREEN | Decisions 1 + 2 |
| 3 | `test(review): pin the cause-gated softening (#750)` | **RED** | verdict.test.mjs pins (i)-(iv), the `:864` replacement, the **required** `:923` fixture update, and the cli.test.mjs differential (arm B red, arm A green) |
| 4 | `fix(review): the softening reads the cause, not the finding-list shape (#750)` | GREEN | Decisions 3 **and** 4, together |
| 5 | `docs(brain): §6.2 states the cause-gated softening (#750)` | GREEN | Decision 6 |

**Unit 4 may not be split into "thread" then "guard", in either order,** and this
is a design constraint rather than a preference:

- *guard first, threading second* → for one commit every CLI-produced verdict
  carries `causes: []`, the softening never fires through the real verb, and
  `regulated-review.e2e.test.mjs:536` (which asserts `APPROVE`) goes **red**. A
  broken intermediate commit.
- *threading first, guard second* → the threading alone changes nothing
  observable, so its "red" test could only be a spy on the call arguments — a
  test coupled to a call site rather than to a behaviour.

They are one behaviour change and they ship as one commit. The red tests for it
were already written, in unit 3.

**The `:923` fixture update lands in the RED commit (3), not the green one.** At
commit 3 the sixth conjunct does not exist yet, so the extra
`conclusionCauses: ['blocker']` argument is ignored and the test stays green; at
commit 4 it is what keeps it green. Landing it in commit 4 would mean a
green-turning-red-turning-green fixture inside the implementation commit, which
is where a forced edit gets mistaken for a convenience edit.

## Test plan — one mutation, one home

Every pin below names the mutation it is the **unique** home for. A pin that
shares a home with another pin is doing no work.

| # | pin | file | mutation it kills |
|---|---|---|---|
| i | closure pin — `conclusionCauses: ['uncomputable']`, routed-out blocker, uncomputable condition → `REVISE` | replaces `verdict.test.mjs:864` | delete the sixth conjunct (`&& causeIsBlockerOnly`) |
| ii | `conclusionCauses: []` explicitly, otherwise softenable → `REVISE` | verdict.test.mjs | delete `conclusionCauses.length > 0` (vacuous `every`) |
| iii | `conclusionCauses: ['blocker','uncomputable']` → `REVISE` | verdict.test.mjs | `every` → `some` |
| iv | field **omitted** (legacy caller), otherwise softenable → `REVISE` | verdict.test.mjs | destructuring default `= []` → `= ['blocker']` |
| v | evaluator shape pins, per return path | tranche/checkpoint/ruling `.test.mjs` | drop `'uncomputable'` from **that** path; drop the union in checkpoint |
| vi | the differential through `main()` — arm A `APPROVE`, arm B `REVISE` | cli.test.mjs (after `:320`) | remove `conclusionCauses:` from the `buildVerdict` call (kills arm A); ship the guard without the threading (kills arm A); ship the threading without the guard (kills arm B) |
| vii | `:923` fixture now passes `conclusionCauses: ['blocker']` | `verdict.test.mjs:923` | — (see below) |

**(vii) is a REQUIRED, deliberate change to an existing verbatim pin, and (iv) is
its justification.** Without the update, `:923` flips `APPROVE` → `REVISE` and
would read as a regression. The honest move is not to edit it quietly: pin (iv)
re-adds the *un-updated* fixture under a new name and pins its new behaviour as
`REVISE`. So both statements are on the record — *"an evaluator that says
'blocker' still gets #483's softening"* (`:923`, updated) and *"an evaluator that
says nothing does not"* (iv, new). The edit is forced by the behaviour change and
the evidence for that is a test, not a sentence.

**Pins that must stay green, unchanged** (read, verified against the new guard,
none requires an edit):

- `verdict.test.mjs:657` — schema-invalid → `STOP` via `unknownCausality`, above
  the ladder.
- `verdict.test.mjs:715` — all findings inadmissible → `processed.length > 0`
  fails (second conjunct).
- `verdict.test.mjs:842` — a surviving `introduced` finding → `candidateFindings`
  non-empty (third conjunct). Green today for that reason and green after for two.
- `verdict.test.mjs:827`, `:891`, `:910`, `:936`, `:963` — untouched paths.
- `tranche.test.mjs:54`, `:125`, `checkpoint.test.mjs:323` — additive field only.
- `regulated-review.e2e.test.mjs:516-538` — the threading's strongest witness.

## Risks and the stop rule

1. **`convergence.maxRounds: 2`.** If the cold review blocks this change twice,
   **STOP and escalate to the maintainer** rather than opening a third fix. #682
   spent four rounds of fixes-on-fixes and produced two regressions in this exact
   branch; a third round here is the same shape starting again.
2. **A future evaluator forgets the field.** Consequence: its `REVISE` is never
   softened — a false block, never a false approve. That is the direction the
   ruling chose and the cost is stated rather than mitigated. Not defended by a
   registry or a runtime check: an invented enforcement mechanism for a
   two-caller field is more surface than the field.
3. **`decision-surface` blocker on this PR** (Decision 6). Carry the `decision`
   label or expect the finding.
4. **The base branch moves.** `feature/issue-682` is live; rebase before the
   final review round rather than after.
5. **Unassessed:** whether any consumer repo calls `buildVerdict` directly. The
   fail-closed default means such a caller loses the softening silently. Judged
   acceptable — `buildVerdict` is not an exported public API surface of a
   published package, and the failure direction is a false block.

## What this design explicitly leaves out, and why

- **A third `'gate'` cause bucket.** The maintainer's ruling text used
  "blocker/gate/uncomputable" as example labels; the audit found every gate
  failure already materialises as a `severity: 'blocker'` finding
  (`tranche.mjs:174-180`, `id: 'gate:${name}'`). A third bucket would be a label
  with no distinct behaviour behind it.
- **Widening `candidateFindings.length === 0`.** #682 round 1's reverted
  regression; the file already records why.
- **Restructuring `conditions` into tagged objects.** They are plain strings,
  rendered by `yamlScalar` and never parsed back (`parse-verdict.mjs` has no
  `conditions` reader). Tagging them would touch five producers plus the
  render/parse surface for the same fix.
- **String-matching `/uncomputable/` over `conditions` in the guard.** Control
  flow depending on prose, and `base-comparison.mjs:277` emits that exact string
  on a route that is **not** broken.
- **Rendering `conclusionCauses`, or reading it back in `parse-verdict.mjs`.** It
  has one consumer, at build time, in the same process that produced it. A field
  on the wire is a field someone will parse.
- **Causes for the base-comparison and judgment-half conditions.** Verified they
  cannot reach the softening: when the probe fails or a gate is unreproducible,
  `classifyAgainstBase` leaves the finding `introduced` and therefore **blocking**,
  so `candidateFindings` is non-empty and the third conjunct already refuses. The
  field explains the **evaluator's conclusion**, not every condition on the
  verdict — and the boundary is stated here so the next reader does not widen it
  by reflex.
- **`inferential.mjs` declaring causes.** It returns `conclusion: null` and never
  sources the conclusion (`cli.mjs:566-575` merges findings only).
- **A new ADR.** Tier-2 amendment; the merge is the signature.
- **Spawned-fixture surgery** (`fixture.mjs`) to reproduce arm B out-of-process.
