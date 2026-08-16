# Design: `scalar()` must not read a trailing space as a value (#612)

## Technical Approach

One line changes: `^${key}:[ \t]*(.+)$` → `^${key}:[ \t]*(\S.*)$`, keeping `.trim()`.
Every other file in this change is a test or a comment. No consumer is edited.

## D-A — The exact regex, boundary by boundary

`new RegExp(`^${key}:[ \\t]*(\\S.*)$`, 'm')`, result still `.trim()`ed.

| line after the colon | today `(.+)` | after `(\S.*)` | why |
|---|---|---|---|
| `key: v` | `'v'` | `'v'` | `[ \t]*` eats the space, capture starts at `v` |
| `key:v` | `'v'` | `'v'` | prefix class matches empty |
| `key:` | `null` | `null` | `.` needs ≥1 char; `\S` needs ≥1 char |
| `key: ` (one space) | **`''`** (prefix backtracks to empty, `(.+)` captures the space, trim empties it) | **`null`** | `[ \t]*` can only give back space/tab, and every start position it can offer is `\s` |
| `key:\t` | `''` | `null` | same |
| `key:   \t  ` | `''` | `null` | same |
| `key: <NBSP>v` | `'v'` (JS `trim()` strips U+00A0) | **`null`** | `\S` excludes U+00A0; `[ \t]*` cannot consume it, so no start position exists |
| `key: v  ` | `'v'` | `'v'` | `.trim()` still earns its keep |
| CRLF `key:\r` | `null` | `null` | `\r` is a line terminator; `$` matches before it |

Confirmed: the NBSP row refuses, exactly as D1 chose.

**Correction to D4's framing** (does not change its conclusion): the repair changes **two**
input classes, not one — whitespace-only (`''` → `null`) *and* exotic-whitespace-led values
(`'v'` → `null`). The second class is monotone toward refusal at every gate:
`protocol: <NBSP>brain-decision/1` goes from parsed to `null`, i.e. refused. The load-bearing
half of D4 survives intact: **no block becomes admissible that was not.** The weaker half
("none stops being admissible") holds only for the whitespace-only class.

## D-B — Is `[ \t]*` still needed? Yes. Do not use `\s*`.

| candidate | verdict |
|---|---|
| `^key:(\S.*)$` (drop the class) | **Broken.** `key: v` has a space at the capture's only possible start position; `\S` fails. Every normal read returns `null`. |
| `^key:\s*(\S.*)$` | **The trap.** `\s` includes `\n`, and under `m` there is nothing to stop it: on `findings:\n  - id: F-1` it eats the newline and captures `- id: F-1` inline, so the block branch never runs — a *worse* rebuild of the bug being fixed. It also re-admits NBSP through the prefix, contradicting D1. |
| `^key:[ \t]*(\S.*)$` | **Chosen.** Horizontal-only prefix; the capture cannot start on any whitespace. |

## D-C — Where the governance-invariance test lives

**`brain/scripts/vcs/actor-check.test.mjs`** — with the consumer, not with the change.

The invariant is a property of *actor-check's gates* (`!== PROTOCOL`, `!== 'APPROVE'`,
truthiness on `head_sha`/`actor`, `=== null` in `sniffDecisionProtocol`). The durable risk
is not "someone edits `scalar`" — the full suite catches that — it is "someone edits a gate
into a form that distinguishes `''` from `null`" (`at ?? ''`, a `typeof === 'string'` check).
A guard placed in `yaml-block`'s tests never runs in that editor's field of view. Colocation
with the consumer is what makes it red for the right reason.

The scalar-side boundary table lives in a **new `brain/scripts/review/lib/yaml-block.test.mjs`**
(none exists today; only the drift file).

## D-D — The rewritten `#452/#478-F2` pin

`parse-verdict.test.mjs:331`. Before:

```js
test('#452/#478-F2: a trailing space on the key line routes to the INLINE branch — a known boundary, pinned not claimed', () => {
  // ... `(.+)` captures the trailing space, `inline` becomes '' (non-null), the block
  // branch is never reached ... Pre-existing on main and NOT fixed here ...
  const withSpace = parseVerdict({ body: blockWith(['findings: ', '  - id: "F-1"']) });
  assert.equal('findings' in withSpace, false, 'documents the boundary — see #477');
  const clean = parseVerdict({ body: blockWith(['findings:', '  - id: "F-1"']) });
  assert.deepEqual(clean.findings, [{ id: 'F-1' }], 'the control: ...');
});
```

After — same name, same ids, comment **updated** to record the flip and its date:

```js
test('#452/#478-F2: a trailing space on the key line no longer routes to the INLINE branch (#612)', () => {
  // WAS a pinned defect: `scalar()`'s `^key:[ \t]*(.+)$` backtracked so `(.+)` captured
  // the trailing space, `inline` became '' (non-null), the block branch never ran, and
  // `findings: ` with real entries came back as malformed — two readable findings read
  // as none. #477 deferred the repair on scope; #612 landed it as `(\S.*)`, so the
  // whitespace-only key line is now the ABSENT state and the block branch runs.
  // This assertion is INVERTED from its original form on purpose. The direction of the
  // change is the record; do not delete the id.
  const withSpace = parseVerdict({ body: blockWith(['findings: ', '  - id: "F-1"']) });
  assert.deepEqual(withSpace.findings, [{ id: 'F-1' }], 'the trailing space is now insignificant');
  assert.equal('malformed' in withSpace, false, 'and it is not reported unreadable either');
  const clean = parseVerdict({ body: blockWith(['findings:', '  - id: "F-1"']) });
  assert.deepEqual(clean.findings, [{ id: 'F-1' }], 'the control: the two forms now agree byte for byte');
});
```

## D-E — The drift guard: **do not touch its assertions**

`yaml-block.drift.test.mjs` does **not** pin regex source text. Its header says so explicitly
("deliberately NOT a source scan… behavioral equivalence through the public API"). I checked
all 8 rows: `raw`, `empty`, bare fence, `` ```yaml `` + trailing space (that space is the
**fence**, handled by `FENCE_RE`, not `scalar`), CRLF, tab-indented key (column-0 anchor,
null both sides), uppercase key, two-fences. **The repair changes no row.** It does not trip.

Should a trailing-space row be added? **No — and this is the rubber-stamp trap.** The table
observes only `protocol` and `head_sha`, and both gates refuse `''` and `null` identically
(that *is* D4). A `head_sha: ` row is `null`/`null` before the repair and `null`/`null` after:
it would pass unchanged, prove nothing, and read to a future maintainer as if the repair were
covered here. It would also violate the file's own stated charter — rows "vary only the
surrounding carrier syntax… never the value's own content".

**What it should assert after the repair: exactly what it asserts today, unchanged.** The only
edit is one line appended to its header comment pointing at `yaml-block.test.mjs` as the home
of the value-side contract, so the omission is deliberate on the record rather than a gap.

## D-F — Mutation plan (axes, and where each mutant dies)

| # | Axis | Mutant | Must go red in |
|---|---|---|---|
| 1 | trailing space vs none | `(\S.*)` → `(.+)` (full revert) | `parse-verdict.test.mjs` F2 pin **and** `yaml-block.test.mjs` boundary rows **and** `checkpoint-block.test.mjs` **and** `epic-map.test.mjs` — 4 files, or coverage is thinner than it looks |
| 2 | leading exotic whitespace | `(\S.*)` → `(.*)` | **7 rows in `yaml-block.test.mjs`** — bare-key, single trailing space, tab, mixed whitespace, NBSP, CRLF and the `/m`-leak row |

> **Corrected after implementation, by the verify pass.** This row originally read
> *"only the NBSP row … without that row `(.*)`+trim is a surviving mutant"*. That was
> measured wrong: six other rows kill this mutant independently, so it was never a
> surviving mutant and the NBSP row is not the sole detector. The coverage is better than
> the design credited, but the CAUSAL STORY was false — and a design that explains why a
> suite is safe with a wrong reason teaches the next editor to protect the wrong row. Kept
> visible rather than silently rewritten, because the correction is the useful part.
| 3 | prefix class crosses lines | `[ \t]*` → `\s*` | the F2 pin and the `findings:` + entries control (inline branch would swallow `- id:`) |
| 4 | prefix class exists | drop `[ \t]*` | virtually every existing test (`key: value`) — the cheap kill, keep it as the sanity axis |
| 5 | trailing trim | remove `.trim()` | a `head_sha: <sha>  ` row (`HEAD_SHA_RE` fails) — **new row required**, otherwise a live mutant |
| 6 | list-follows vs nothing-follows | a "fix" inside `parseEntryList`'s block branch instead of in `scalar` | `findings: ` + entries → entries **and** `findings: ` alone → `[]`; a block-branch-only fix passes the first, fails the second |
| 7 | consumer: decision-block | — | `actor: ` / `head_sha: ` / `decision: ` whitespace-only → still refused (`decision-block.test.mjs`) |
| 8 | consumer: actor-check | — | six-key invariance table + `sniffDecisionProtocol('protocol: ')` → `null` → silent, never `addressed` (`actor-check.test.mjs`) |
| 9 | consumer: epic-graph | — | `track: ` moves from its own `''` group to `'?'`/UNCLASSIFIED (`epic-map.test.mjs`), `blocks: ` → `[]` |
| 10 | consumer: checkpoint-block | — | `counted_lines: ` error text flips from "must be a non-negative integer, got ''" to "missing the required `counted_lines:` key" (`checkpoint-block.test.mjs`) |
| 11 | **invariant** (negative axis) | — | `sequencing: `, `controls: `, `controls_not_applied: ` stay `malformed` **before and after** — their `KEY_RE` probe + `raw !== null` shape already absorbs both states. Pin it, so a future "simplification" that drops the probe is caught. |

Axis 2 and axis 5 are the two that are invisible without new rows. Axis 11 is the one that
proves the repair did *not* reach where it had no business reaching.

## File Changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/review/lib/yaml-block.mjs` | Modify | the regex; JSDoc stating the three-state contract |
| `brain/scripts/review/lib/yaml-block.test.mjs` | Create | the boundary table (D-A), incl. NBSP and trailing-trim rows |
| `brain/scripts/review/lib/parse-verdict.mjs` | Modify | comment only — drop the "still not repaired" claim at 127-136 |
| `brain/scripts/review/lib/parse-verdict.test.mjs` | Modify | F2 pin rewritten; add the nothing-follows and axis-11 rows |
| `brain/scripts/vcs/actor-check.test.mjs` | Modify | six-key governance invariance table (D-C) |
| `brain/scripts/review/lib/decision-block.test.mjs` | Modify | whitespace-only refusal rows |
| `brain/scripts/status/epic-map.test.mjs` | Modify | `track: ` → UNCLASSIFIED |
| `brain/scripts/review/lib/checkpoint-block.test.mjs` | Modify | new "missing key" error text |
| `brain/scripts/review/lib/yaml-block.drift.test.mjs` | Modify | header comment only — **zero assertion changes** (D-E) |

## Collision with PR #695 — **rebase, do not merge**

#695 changes where a `brain-graph/1` block is **located** (near `extractFencedBlock`, lines
51-54); #612 changes how a value is **read** (line 57). Orthogonal semantics, adjacent bytes.
Rebase, because #612's whole reviewable surface is one line and a merge commit hides the
conflict resolution somewhere a reviewer cannot diff it. Whoever lands second rebases onto
`main` and re-runs `parse-verdict.test.mjs`, `yaml-block.drift.test.mjs` and
`epic-map.test.mjs`. **Flag for apply: `gh pr diff 695` BEFORE the first edit**, and re-measure
the suite before and after — a second failure is stop-and-report, not fix-forward.

## Open Questions

None blocking.
