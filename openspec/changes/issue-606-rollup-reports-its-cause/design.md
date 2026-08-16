---
status: draft
issue: 606
---

# Design — the rollup reports its cause

Architecture for `proposal.md`'s five rulings and `spec.md`'s seven requirements. The
constraint that bounds every decision below: **the verdict does not move.**
`evaluateTranche` fails closed today and fails closed after. This ticket buys a legible
refusal, not a different one.

## 0. What is copied, and from where

This design does not invent a classifier pattern. It copies
`brain/scripts/review/identity.mjs`'s `evaluateNegativeControl` (lines 43-92) and its
corpus test (`identity.test.mjs:290-321`), point by point:

| Copied from `identity.mjs` | Here |
|---|---|
| Module-level `const` regexes, one per cause, each with a comment saying **why it exists** — `AUTH_REJECTION:50`, `PROVIDER_LOCKOUT:71` | `RATE_LIMITED_RE`, `UNAUTHENTICATED_RE`, `NOT_FOUND_RE`, `NETWORK_RE`, `BINARY_MISSING_RE` in `uncomputable-cause.mjs` |
| A pure classifier taking a plain input and returning a small closed vocabulary — `evaluateNegativeControl({resolved, error}) -> {control}` | `classifyUncomputableCause(text) -> reason` |
| **Ordered** tests, with the ordering argued in prose at the function (`identity.mjs:83-84`: "`lockout` is tested BEFORE `rejected` so a message carrying both a status code and throttling text can never be read as a plain auth rejection") | §2.3, and the ordering argument is `rate-limited` before `unauthenticated` for the same reason, on the same provider text |
| A terminal default arm that **refuses** rather than clears — `unusable`, never `rejected` (`identity.mjs:45-49`: "a reader that on failure returns something indistinguishable from 'nothing to report'") | `unclassified`, and §2.4 proves no `reason` reads as clean |
| **The original message survives every branch**, including the default — `{control:'unusable', reason: error}` at `:87`, `:91` | `detail` is assigned outside the classifier entirely (§3) |
| A corpus test that pins REAL observed spellings and asserts *"the provider's own words must survive to the operator"* (`identity.test.mjs:296-304`) | §6's corpus table, same assertion, per row |
| A test that pins the ORDER against a message matching two rules (`identity.test.mjs:316-321`) | M4 in §7 |

What is **not** copied: `evaluateNegativeControl`'s multi-key return
(`{control, reason, ambientAs}`). Ruling 1 fixed this shape as
`{uncomputable, reason, detail}`, and it is a port shape rather than a private evaluator
answer, so it stays exactly three keys.

## 1. The shape, and the single place it is constructed

### 1.1 The module

**`brain/scripts/vcs/lib/uncomputable-cause.mjs`** — new. Zero imports. Pure.
`vcs/lib/` is the correct floor: `normalize.mjs` is already a shared module that both
providers *import* and neither *re-exports*, which is the precedent this module follows
verbatim (§4.1 explains why re-exporting would be a bug).

Exports, and nothing else:

```js
export const UNCOMPUTABLE_REASONS = Object.freeze({
  RATE_LIMITED: 'rate-limited',
  UNAUTHENTICATED: 'unauthenticated',
  NOT_FOUND: 'not-found',
  NETWORK: 'network',
  BINARY_MISSING: 'binary-missing',
  MALFORMED_RESPONSE: 'malformed-response',
  UNCLASSIFIED: 'unclassified',
});

export function classifyUncomputableCause(text) { /* §2 */ }
export function uncomputable({ detail, reason = null }) { /* §1.3 */ }
export function isUncomputable(value) { /* §1.4 */ }
```

### 1.2 `reason` is an enum of string literals, declared once

**Answer to design question 1:** yes, an enum of string literals, and it is declared in
exactly one frozen object in `uncomputable-cause.mjs`. Neither provider ever writes a
reason literal; neither provider ever writes the object.

The wire values are the *strings*, not the enum keys — they land in a verdict comment a
human reads, and `'rate-limited'` is what the operator should see. The frozen object
exists so a rename is one edit and so a test can assert the classifier's codomain is a
subset of it.

Two of the seven are never produced by text matching, and that is deliberate:

- `MALFORMED_RESPONSE` — "the fetch succeeded and the rollup field is not an array"
  (the fifth fused cause the proposal measured). No provider *text* says this; it is a
  structural fact known at the call site, so the provider passes it explicitly.
- `UNCLASSIFIED` — the classifier's default arm.

So: `classifyUncomputableCause` maps into `{rate-limited, unauthenticated, not-found,
network, binary-missing, unclassified}`; the enum is that set plus `malformed-response`.
A test pins both directions.

**Coarseness is a decision, not an oversight.** A GitLab `500` and a DNS `ENOTFOUND`
both land on `network`, because the operator's remedy is identical (wait, retry; it is
not your credentials) and a label the reader cannot act on differently is a distinction
without a remedy. The precision lives in `detail`, which carries the actual words. If a
split ever earns a distinct remedy, it is one enum line plus one corpus row — which is
the whole point of declaring the vocabulary in one frozen place.

### 1.3 The factory — the only constructor

```js
export function uncomputable({ detail, reason = null } = {}) {
  const text = (detail ?? '') === '' ? NO_TEXT_REPORTED : String(detail);
  return Object.freeze({
    uncomputable: true,
    reason: reason ?? classifyUncomputableCause(text),
    detail: text,
  });
}
```

- **`detail` is computed first and independently.** `reason` is derived *from* `text`;
  `text` is never derived from `reason`. There is no expression in this function in
  which the classifier's answer can influence `detail`. That is the structural half of
  ruling 3; §3 supplies the test half.
- **`NO_TEXT_REPORTED`** is a module constant —
  `'(the provider reported no error text)'` — for the one path with genuinely no words
  (spec's "detail present even when reason cannot be computed"). It guarantees
  `detail` is never `''`/`undefined`. It is a *fallback*, never a *replacement*: a
  mutation that swaps real provider text for it goes red in three places (M3, §7).
  In practice no adoption site can reach it — both providers pass a non-empty sentence
  (§4.2, §4.3) — and that is the intent: the constant is a floor under the invariant,
  not a code path anyone plans to use.
- **`Object.freeze` is shallow and that is sufficient** — all three values are
  primitives.

**Rejected: a shape each provider builds independently.** The question names it exactly
— it is a divergence waiting to happen. A hand-written literal in `github.mjs` and
another in `gitlab.mjs` would drift on the first hurried edit (a missing `Object.freeze`,
a `cause` key instead of `reason`), and the drift would be invisible because the
`Array.isArray` consumers never read the keys. Enforced by a source guard, not a
convention: **no provider source may contain the literal `uncomputable: true`** (§6, M7).

**Rejected: a `status` parameter on the classifier.** Ruling 3 says `status`
(`exec.mjs:32`, including `null` = binary missing, #604) is checked before text. Read
literally that means a second classifier argument — but **no adoption site can populate
it**. `github.mjs` reaches the failure through `runJson`, which *throws*; the catch site
has an `Error`, not a result object. `gitlab.mjs` reaches it through `gitlabApiFetch`,
which also throws, and has no exit status at all. A parameter no caller can fill is
decoration, and decoration is the thing this ticket exists to delete.

The ruling's *intent* is honoured instead, and it costs nothing: `exec.mjs:30` already
turns `status: null` into TEXT (`` `${cmd}: ${r.error.message}` `` → `gh: spawn gh
ENOENT`), which is precisely why #604 put it there. So the binary-missing signal *is*
present, as words, and its rule is ordered **first**, before every other test — the same
position a status check would have occupied. If a future ticket gives `prStatusRollup` a
`run()`-shaped error path, adding `classifyUncomputableCause(text, { status })` is
additive and the ordering is already correct for it.

### 1.4 `isUncomputable`

```js
export function isUncomputable(value) {
  return Boolean(value) && typeof value === 'object' && value.uncomputable === true;
}
```

`isUncomputable(null) === false` is load-bearing: `null` is a **third** state — "a
reader that discarded its cause and did not adopt this shape" — and the 13 filed
siblings still return it. Collapsing it into "uncomputable with no cause" would let a
consumer believe every reader had been migrated. `tranche.mjs` keeps a distinct branch
for it (§5.2).

### 1.5 Q4b — no collision with GitLab's `conclusion: null`

`gitlab.mjs:359` normalizes every *entry* to `conclusion: null` because GitLab's
commit-status model has no field distinct from the terminal `status`. The new shape
cannot collide with it, on three counts:

1. **Different position.** `conclusion: null` is a key on an element *inside* the
   success array. The uncomputable object *replaces* the array. A caller holds one or
   the other, never both.
2. **Disjoint key sets.** `{uncomputable, reason, detail}` ∩ `{name, status,
   conclusion}` = ∅. No entry can accidentally satisfy `isUncomputable` (`.uncomputable`
   is `undefined` on every gate entry).
3. **Different null semantics, both preserved.** `conclusion: null` means "this provider
   has no such field" (successfully read, genuinely absent). The `null` this ticket
   removes meant "could not read at all". They were never the same `null` and they still
   are not.

Pinned by test: for a GitLab success rollup, every entry has `conclusion === null` AND
`isUncomputable(entry) === false`.

## 2. The classifier

**Answer to design question 2: a pure function in its own module** —
`vcs/lib/uncomputable-cause.mjs`, `classifyUncomputableCause(text) -> reason`. Not
inline in a provider (it would then be one provider's private knowledge and could not
serve the other), not in `tranche.mjs` (ruling 2 keeps the evaluator provider-agnostic
— it must not know what `gh` says).

It is unit-testable without spawning `gh` because it takes a **string** and returns a
**string**. Its own test file imports nothing but the module. No `setSpawn`, no
`fetchImpl`, no fixtures.

### 2.1 The HTTP-status hazard, and why the rules do not read bare numbers

The obvious rule set — `/\b429\b/` → rate-limited, `/\b404\b/` → not-found — is wrong
here, and measurably so. `runJson` builds its message as:

```
`${cmd} ${args.join(' ')} failed (status ${r.status}): ${r.stderr}`
```

so the failing message for PR **429** is literally
`gh pr view 429 --json statusCheckRollup failed (status 1): <stderr>`. A bare `\b429\b`
classifies that PR number as a rate limit. Same for a PR numbered 404, 401, 500. This is
"apparent protection": a classifier that is confidently wrong on an input the repo's own
fixtures already produce.

So numeric matching is gated behind a marker:

```js
// A three-digit code counts ONLY where the provider marked it as a status:
//   gh   — "... (HTTP 403)"  /  runJson's "failed (status 1)"
//   glab — gitlab-api.mjs:65 "GitLab API failed: 429 (path)"
// A bare number in free text is a PR NUMBER as often as it is a status code —
// `gh pr view 429 ... failed` is the message runJson builds for PR 429.
const HTTP_STATUS_RE = /(?:\bHTTP\b|\bstatus\b|API failed:)\s*\(?(\d{3})\)?/i;
function httpStatusOf(text) { const m = text.match(HTTP_STATUS_RE); return m ? Number(m[1]) : null; }
```

Every numeric rule consumes `httpStatusOf(text)`, never the raw text. Pinned by a
negative corpus row (M9, §7).

### 2.2 The ordered rule list

```js
export function classifyUncomputableCause(text) {
  const s = String(text ?? '');
  const code = httpStatusOf(s);

  // 1. Could not RUN. exec.mjs:30 turns spawn's `status: null` into these words
  //    (#604). FIRST because "gh: command not found" also contains "not found",
  //    and rule 4 would otherwise report a missing binary as a missing PR —
  //    two different remedies, one of them wasted.
  if (BINARY_MISSING_RE.test(s)) return UNCOMPUTABLE_REASONS.BINARY_MISSING;

  // 2. Throttled. BEFORE rule 3, and this ordering is the load-bearing one:
  //    GitHub answers a rate limit with HTTP **403** ("API rate limit exceeded
  //    (HTTP 403)"), so an auth rule that ran first would label every GitHub
  //    rate limit "unauthenticated" and send the operator to rotate a token
  //    that was never the problem — the exact mis-diagnosis identity.mjs:52-70
  //    records as having cost three token rotations. Same repo, same defect,
  //    one rule earlier.
  if (RATE_LIMITED_RE.test(s) || code === 429) return UNCOMPUTABLE_REASONS.RATE_LIMITED;

  // 3. Refused the credential. Auth WORDS beat a 404: GitHub masks a repo the
  //    token cannot see as 404, so a message that says both is an auth problem.
  if (UNAUTHENTICATED_RE.test(s) || code === 401 || code === 403) return UNCOMPUTABLE_REASONS.UNAUTHENTICATED;

  // 4. The thing is not there (and no auth language said otherwise).
  if (NOT_FOUND_RE.test(s) || code === 404) return UNCOMPUTABLE_REASONS.NOT_FOUND;

  // 5. Could not reach it, or it answered with its own failure. Deliberately
  //    coarse (see §1.2): the remedy is the same and `detail` carries which.
  if (NETWORK_RE.test(s) || (code !== null && code >= 500)) return UNCOMPUTABLE_REASONS.NETWORK;

  // Default arm. NEVER anything readable as clean (ruling 3) — the operator
  // gets the label "unclassified" and, from the caller, the provider's words.
  return UNCOMPUTABLE_REASONS.UNCLASSIFIED;
}
```

The regexes, each pinned by the corpus in §6:

```js
const BINARY_MISSING_RE  = /\bENOENT\b|command not found|no such file or directory/i;
const RATE_LIMITED_RE    = /rate limit|maximum number of login attempts|abuse detection|too many requests|retry-after/i;
const UNAUTHENTICATED_RE = /bad credentials|unauthorized|requires authentication|authentication (?:required|failed)|must be logged in|auth login|insufficient_scope|invalid[_ ]token/i;
const NOT_FOUND_RE       = /\bnot found\b|could not resolve to a|no such (?:pull request|merge request|repository|project)/i;
const NETWORK_RE         = /\bENOTFOUND\b|\bECONNREFUSED\b|\bECONNRESET\b|\bETIMEDOUT\b|\bEAI_AGAIN\b|fetch failed|socket hang up|network is unreachable|dial tcp|tls handshake/i;
```

### 2.3 Why an ordered list and not a table

`identity.mjs` orders by hand and argues each position in prose. A data-driven
`[[re, reason], ...]` table would carry the same order but lose the argument, and the
argument is the part that survives an upgrade of `gh`. Same shape as the precedent, same
reason.

### 2.4 No `reason` can read as clean

Every value in `UNCOMPUTABLE_REASONS` is a *failure* word, and every one of them arrives
attached to `uncomputable: true` — which is the field the guards read. The classifier
cannot return anything else: its default arm is a `return` of a constant, not a
fall-through to `undefined`. A test asserts `Object.values(UNCOMPUTABLE_REASONS)`
contains no value matching `/ok|success|clean|none|empty/i`, and that
`classifyUncomputableCause` over a fuzz set of 200 random strings never leaves the enum.

## 3. Design question 3 — a rotted regex degrades to `unclassified` WITH the text

### 3.1 The structural argument (necessary, not sufficient)

In `uncomputable()` (§1.3), `text` is computed on line 1 and assigned to `detail` on the
last line. `classifyUncomputableCause` receives `text` by value, is pure, and returns a
string that is assigned to a *different* key. There is no branch, no early return, no
path on which a classifier failure can reach `detail`.

Therefore total regex rot has exactly one blast radius: `reason` becomes
`'unclassified'` for inputs that used to match. `detail` is untouched. The degradation
is `rate-limited: <text>` → `unclassified: <text>`. Silence is not reachable, because
nothing in the failure path is conditional on `reason`.

### 3.2 The tests that drive the default arm

A design that says "the default arm handles it" without a test that drives it has not
answered the question. Three tests drive it, at three layers.

**(a) The classifier's default arm, directly** — `uncomputable-cause.test.mjs`:

```js
test('an invented message no rule matches degrades to unclassified WITH the words verbatim (#606 ruling 3)', () => {
  const invented = 'gh: the flurb subsystem declined to enumerate the rollup (HTTP 418)';
  const u = uncomputable({ detail: invented });
  assert.equal(u.reason, 'unclassified', 'an unrecognised message must never borrow another label');
  assert.equal(u.detail, invented, "the provider's own words must survive to the operator");
});
```

**(b) Total rot, driven THROUGH the evaluator** — `tranche.test.mjs`. This is the test
the question asks for: it simulates a classifier that recognises **nothing**, feeds the
result to the real `evaluateTranche`, and asserts the operator still ends up holding the
provider's sentence.

```js
test('a classifier that recognises NOTHING still leaves the operator the provider\'s words (#606 ruling 3)', () => {
  // A rotted classifier's output IS `reason: 'unclassified'` — that is the whole
  // of its blast radius (design §3.1). So this drives every REAL observed
  // spelling through the default arm and asserts the words survive anyway.
  for (const message of ROTTABLE_CORPUS) {           // §6's messages, reason ignored
    const rotted = Object.freeze({ uncomputable: true, reason: 'unclassified', detail: message });
    const result = evaluateTranche({ requiredGates: rotted });
    assert.equal(result.conclusion, 'REVISE', 'a rotted classifier must not move the verdict');
    assert.ok(
      result.conditions.some(c => c.includes(message)),
      `the provider's words must reach conditions verbatim: ${message}`,
    );
  }
});
```

**Why no injection seam.** The obvious alternative is to make `uncomputable()` accept a
`classify` dependency so a test can inject a stub that always throws or always returns
garbage. Rejected: the seam would exist only for the test, and §3.1 establishes that the
*entire* observable consequence of rot is `reason === 'unclassified'` — which test (b)
produces directly, with real corpus messages. A seam would add a production parameter to
buy a state the tests can already construct. (This is also why the mutation plan mutates
the *source*, §7: mutation is how this design tests the classifier's own wiring, not
dependency injection.)

**(c) Through both real providers** — `vcs.contract.test.mjs`. The existing
`ROLLUP_PROVIDERS.github.fail` fixture produces exactly
`gh pr view 1 --json statusCheckRollup failed (status 1): fixture: simulated failure` —
an invented message no rule matches. So the revised failure-path test at :1231 *is* a
default-arm test, on the real provider, for free:

```js
test(`${providerName}.prStatusRollup (contract): a fetch failure yields {uncomputable, reason, detail}, never null and never []`, async () => {
  const result = await vcs.prStatusRollup({ project: 'x/y', number: 1, ...fail() });
  assert.equal(Array.isArray(result), false, 'a failure must never be a fabricated []');
  assert.notEqual(result, null, 'the cause must not be discarded (#606)');
  assert.equal(result.uncomputable, true);
  assert.ok(Object.isFrozen(result), 'the cause object is frozen');
  assert.ok(UNCOMPUTABLE_REASON_VALUES.includes(result.reason), `reason must be in the enum, got ${result.reason}`);
  assert.ok(result.detail.length > 0, 'detail must never be empty');
  assert.ok(result.detail.includes(FAILURE_TEXT[providerName]),
    "the provider's own words must survive verbatim into detail");
});
```

Note the assertion is on the **shape and the words**, not on a specific `reason`: the two
fixtures legitimately classify differently (github's invented text → `unclassified`;
gitlab's `{ok:false, status:500}` → `GitLab API failed: 500 (…)` → `network`). Asserting a
shared `reason` here would force a fixture to lie. Reason-per-message is the classifier
unit test's job (§6); shape-and-words parity is the contract test's job.

### 3.3 The mutation that must go red

Named because the question demands it: **`tranche.mjs`'s condition template with
`` — ${rollup.detail} `` deleted.** That mutation leaves the classifier perfect and
still robs the operator of the words. It is M3b in §7, and test (b) is what catches it.
If a design's only detail-test is at the factory, this mutation survives — which is
exactly the "requirement 2 is decoration" failure the mutation plan is written to
prevent.

## 4. Both providers — design question 4

### 4.1 What `verb-contract-drift-guard.test.mjs` requires of this change

Read exactly, the guard runs three checks; the third is the one that touches this change:

> `sharedFunctionExports(github, gitlab)` = every **function-typed export name present in
> BOTH provider modules**. Each such name must appear in `cli.mjs`'s `VERBS` **or** in
> `SHARED_NON_VERB_EXPORTS` (empty today, and every entry must carry an inline reason).

Three consequences, all binding:

1. **`prStatusRollup` is already a shared function export, therefore already a contract
   verb.** It is in `VERBS:45` and in `vcs-contract.md:35`. The guard does not need a new
   entry — but it *does* mean **both providers must move together**. A one-provider
   adoption would not trip the guard (the name is still in `VERBS`), and that is the
   worse case the spec names: it passes green while the two implementations of one
   contract verb answer differently. The guard cannot catch semantic divergence; the
   table-driven contract test (§3.2c, run for both keys) is what does, and mutation M6
   proves it is a real detector.
2. **`uncomputable`, `classifyUncomputableCause` and `isUncomputable` must NEVER be
   exported from a provider.** If a future author re-exports one "for convenience" from
   both `github.mjs` and `gitlab.mjs`, the third check fails and its message will tell
   them to *add a verb to `VERBS` and `vcs-contract.md`* — which would be wrong: these
   are helpers, not port verbs, and adding them would make `vcs cli.mjs uncomputable` a
   dispatchable command. They are imported, exactly as `normalizeCommitStatus` already is
   (`github.mjs:9` / `gitlab.mjs:10`), which is why `normalize.mjs`'s functions are
   invisible to the guard today. A comment at the export site of
   `uncomputable-cause.mjs` says this, naming the guard file.
3. **No `SHARED_NON_VERB_EXPORTS` entry is needed**, and adding one would be the wrong
   fix for a problem this design does not create.

The doc-table checks are also unaffected: `requiredVerbsFromDoc` parses only the
backtick-quoted name in column 1 (`/^\|\s*`([a-zA-Z]+)`\s*\|/`), so rewriting the
`prStatusRollup` row's *prose* (§8) cannot break it.

### 4.2 Does the same classifier serve both? Yes — and here is why it can

The question is right that GitLab's failure modes are HTTP-shaped, not CLI-stderr-shaped.
But **both providers hand the classifier a string**, because both transports already
normalise their failures into thrown `Error`s with a message:

| Provider | Transport | Failure text the catch site holds |
|---|---|---|
| `github.mjs` | `ghJson` → `runJson` → `run` | `` `gh pr view 12 --json statusCheckRollup failed (status 1): ${stderr}` `` — and `stderr` already carries a launch failure (`gh: spawn gh ENOENT`) via `exec.mjs:30-31`, the #604 fix |
| `gitlab.mjs` | `gitlabApiFetch` | `` `GitLab API failed: ${res.status} (${path})` `` (`gitlab-api.mjs:65`), or the raw transport error (`TypeError: fetch failed`, `ENOTFOUND …`) when `fetchImpl` itself rejects |

GitLab's HTTP status is therefore *present, and marked* — `API failed:` is one of
`HTTP_STATUS_RE`'s three markers (§2.1), which is why `httpStatusOf` reads GitLab's 429
and 401 without a GitLab-specific rule. This is not a lucky coincidence to lean on
silently: it is pinned by GitLab rows in the corpus (§6), so a change to
`gitlab-api.mjs:65`'s message format breaks a test rather than a diagnosis.

So: **one classifier, one factory, one enum, both providers.** Not "each provider
classifies into a shared enum" — that is the divergence design question 1 warns about,
one layer down. The providers do not classify at all; they hand over their words.

### 4.3 The two adoption sites, concretely

`github.mjs:470-484` becomes:

```js
export async function prStatusRollup({ project, number } = {}) {
  let data;
  try {
    data = ghJson(['pr', 'view', String(number), '--json', 'statusCheckRollup']);
  } catch (err) {                                   // ← the error is BOUND (#606)
    return uncomputable({ detail: err.message });
  }
  const rollup = data.statusCheckRollup;
  if (!Array.isArray(rollup)) {
    // The fifth fused cause: the fetch SUCCEEDED and the field is not a rollup.
    // No provider text describes this, so the reason is passed explicitly and the
    // detail is this file's own sentence — still the words of whoever knows.
    return uncomputable({
      reason: UNCOMPUTABLE_REASONS.MALFORMED_RESPONSE,
      detail: `gh pr view --json statusCheckRollup returned ${typeof rollup} for PR ${number}, not an array`,
    });
  }
  return rollup.map(/* unchanged */);
}
```

`gitlab.mjs:337-363` becomes the same three edits — bind the `catch`, and name the two
structural refusals:

```js
} catch (err) {
  return uncomputable({ detail: err.message });
}
```
```js
if (!sha) {
  return uncomputable({
    reason: UNCOMPUTABLE_REASONS.MALFORMED_RESPONSE,
    detail: `the MR ${number} payload carried neither \`sha\` nor \`diff_refs.head_sha\``,
  });
}
```
```js
if (!Array.isArray(statuses)) {
  return uncomputable({
    reason: UNCOMPUTABLE_REASONS.MALFORMED_RESPONSE,
    detail: `GET projects/:id/repository/commits/${sha}/statuses returned ${typeof statuses}, not an array`,
  });
}
```

**The success arm of both providers is untouched, byte for byte.** That is ruling 1's
whole economy: the failure arm widens, the success arm does not move, and neither
`Array.isArray` consumer changes.

## 5. `tranche.mjs` — design question 5

### 5.1 Before and after, verbatim

**Before** (`tranche.mjs:133-143`):

```js
  if (!Array.isArray(requiredGates)) {
    // Uncomputable evidence (`gh` down, or the rollup fetch failed) — never
    // APPROVE on it (protocol §10, REQ-H1-8 scenario "uncomputable evidence
    // never approves").
    return {
      conclusion: 'REVISE',
      gates: { required: [], detection: [] },
      findings: [],
      conditions: ['evidence uncomputable'],
    };
  }
```

**After**:

```js
  if (!Array.isArray(requiredGates)) {
    // Uncomputable evidence — never APPROVE on it (protocol §10, REQ-H1-8
    // scenario "uncomputable evidence never approves"). The GUARD is unchanged
    // and stays `Array.isArray`: #606's cause object is TRUTHY, so a `!requiredGates`
    // check would fall through into `requiredGates.map` and throw.
    return {
      conclusion: 'REVISE',
      gates: { required: [], detection: [] },
      findings: [],
      conditions: [rollupUncomputableCondition(requiredGates)],
    };
  }
```

and, above `evaluateTranche`:

```js
// #606: the rollup now reports WHY it could not be read. This renders that cause;
// it never decides anything. The evaluator stays provider-agnostic — it knows the
// SHAPE (vcs/lib/uncomputable-cause.mjs) and not one word of `gh`'s or `glab`'s
// vocabulary, which is ruling 2's layering: the port carries, the classifier labels,
// this renders.
//
// `detail` is interpolated WHOLE and last. Truncating it here would rebuild, in the
// renderer, the silence the port just stopped producing — and `verdict.mjs`'s
// `yamlScalar` already escapes newlines (#481), so a multi-line stderr cannot break
// the block.
//
// A rollup that is neither an Array nor an Uncomputable (a bare `null` from one of
// the 13 readers still discarding its cause) keeps the ORIGINAL string exactly:
// there is no cause to report, and inventing a parenthetical would claim otherwise.
function rollupUncomputableCondition(rollup) {
  if (!isUncomputable(rollup)) return 'evidence uncomputable';
  return `evidence uncomputable: required gate rollup (${rollup.reason}) — ${rollup.detail}`;
}
```

Import added: `import { isUncomputable } from '../../vcs/lib/uncomputable-cause.mjs';`
— the evaluator imports the *predicate*, never the classifier.

### 5.2 Three input states, one fail-closed answer

| `requiredGates` | Condition emitted | Verdict |
|---|---|---|
| `Array` | *(none — the branch is not entered)* | unchanged |
| `{uncomputable:true, reason, detail}` | `evidence uncomputable: required gate rollup (<reason>) — <detail>` | `REVISE` |
| anything else (incl. `null`) | `evidence uncomputable` — **the original string, unchanged** | `REVISE` |

The third row is why `tranche.test.mjs:53-58`
(`assert.ok(result.conditions.includes('evidence uncomputable'))`) stays green **without
being edited**. That untouched assertion is the cheapest available evidence that the
verdict did not move.

### 5.3 The condition grammar — checked, not invented

`reviewer-protocol.md` specifies only `conditions: [ ... ]` (line 264) and the fail-closed
rule at line 419 (`conditions: [evidence uncomputable]`). There is no formal grammar in
the protocol doc, so the binding grammar is the de-facto one the four existing producers
share:

| Producer | String |
|---|---|
| `tranche.mjs:177` | `evidence uncomputable: budget diff (base sha unresolvable outside CI)` |
| `base-comparison.mjs:249-250` | `evidence uncomputable: base comparison (worktree at base unavailable) — gate findings stay blocking rather than being deferred unverified` |
| `base-comparison.mjs:277` | `evidence uncomputable: <gate> could not be re-run at base (command absent, or it never produced an exit status)` |
| `checkpoint.mjs:233` | `evidence uncomputable: <reason>` |

Grammar: `evidence uncomputable: <subject> (<why>)`, with an optional ` — <continuation>`.
The new string is cast in exactly that mould, including the em-dash continuation, whose
precedent is `base-comparison.mjs:249`. No new format is invented.

### 5.4 Rendering and parsing — verified against the real chain

- **Rendered** by `verdict.mjs:335`:
  `` lines.push(`conditions: [${(v.conditions ?? []).map(yamlScalar).join(', ')}]`) ``.
- `YAML_SCALAR_SAFE_RE = /^[A-Za-z0-9._\-/:]+$/` (`verdict.mjs:12`). Today's
  `'evidence uncomputable'` already contains a space and is therefore **already quoted**.
  The new string is longer and quoted for the same reason — the quoting behaviour does
  not change.
- `yamlScalar` escapes `\`, `"`, `\n`, `\r`, ` `, ` ` (#481). A multi-line `gh`
  stderr therefore cannot put a continuation line at column 0 and cannot terminate the
  preceding `findings:` list. This is the failure #481 was written for, and this ticket
  is the first thing to route *arbitrary provider stderr* into `conditions`, so it gets a
  regression test rather than an assumption (§6, test 5).
- **Parsed**: `parseVerdict` **does not read `conditions` at all**.
  `parse-verdict.mjs:40-45` lists it in `TOP_LEVEL_KEYS` *only* as a boundary marker for
  the list-terminator regex; there is no `readList('conditions')`. So there is no
  round-trip risk and no `malformed` entry to worry about — but the boundary role is
  real: `conditions:` must stay one line at column 0, which is exactly what the escaping
  above guarantees.

### 5.5 No truncation, deliberately

The port carries verbatim (ruling 2), and so does this renderer. A cap here is a place
where words get dropped, which is the defect. The accepted risk: a pathological
multi-kilobyte stderr makes one verdict comment long. Measured expectation: `gh`/`glab`
stderr for these five causes is one to five lines. **If a real overflow is ever
observed, the fix is a cap with an explicit `… (truncated, N chars dropped)` marker** —
named here so the next author does not invent a silent one.

## 6. The test surface

New file `brain/scripts/vcs/lib/uncomputable-cause.test.mjs`. Imports only the module
under test — no `gh`, no `setSpawn`, no fixtures.

1. **The pinned corpus** (the `identity.test.mjs:296-304` pattern). A table of REAL
   observed spellings; each row asserts the reason AND `detail === input`:

   | Message | Expected `reason` |
   |---|---|
   | `gh: API rate limit exceeded (HTTP 403)` | `rate-limited` |
   | `gh api ... failed (status 403): You have exceeded a secondary rate limit` | `rate-limited` |
   | `GitLab API failed: 429 (projects/x%2Fy/merge_requests/1)` | `rate-limited` |
   | `gh: Bad credentials (HTTP 401)` | `unauthenticated` |
   | `gh: To get started with GitHub CLI, please run: gh auth login` | `unauthenticated` |
   | `GitLab API failed: 401 (projects/x%2Fy/merge_requests/1)` | `unauthenticated` |
   | `gh: Could not resolve to a PullRequest with the number of 9999.` | `not-found` |
   | `GitLab API failed: 404 (projects/x%2Fy/repository/commits/abc/statuses)` | `not-found` |
   | `gh pr view 1 ... failed (status null): gh: spawn gh ENOENT` | `binary-missing` |
   | `glab: command not found` | `binary-missing` |
   | `TypeError: fetch failed` | `network` |
   | `gh: dial tcp: lookup api.github.com: ENOTFOUND` | `network` |
   | `GitLab API failed: 503 (projects/x%2Fy/merge_requests/1)` | `network` |
   | `gh pr view 1 --json statusCheckRollup failed (status 1): fixture: simulated failure` | `unclassified` |
   | `gh: the flurb subsystem declined to enumerate the rollup (HTTP 418)` | `unclassified` |

   The corpus is **observed spellings, never a complete detector** — the same disclaimer
   `tranche.mjs:56` already writes for `AI_ATTRIBUTION_RE`, and for the same reason.

2. **Ordering** (`identity.test.mjs:316-321`'s pattern). `gh: API rate limit exceeded
   (HTTP 403)` → `rate-limited`, **not** `unauthenticated`, with the failure message
   naming the three-token-rotation incident. And `gh: command not found` →
   `binary-missing`, not `not-found`.

3. **The HTTP-number negative** (§2.1).
   `gh pr view 429 --json statusCheckRollup failed (status 1): fixture: simulated failure`
   → `unclassified`. A bare-`\b429\b` classifier fails this.

4. **Shape invariants.** `Object.isFrozen`; three keys exactly; empty/`undefined`/`null`
   detail → `NO_TEXT_REPORTED`, never `''`; `isUncomputable(null) === false`;
   `isUncomputable({name:'x',status:null,conclusion:null}) === false`; classifier codomain
   ⊆ `UNCOMPUTABLE_REASONS`; no enum value matches `/ok|success|clean|none|empty/i`.

5. **The render chain** (`verdict.test.mjs`). Build a verdict whose condition carries a
   two-line stderr, render it, assert exactly one `^conditions:` line and that
   `parseVerdict` still returns `findings` with no `malformed` entry. This is #481's
   regression, re-run on this ticket's new payload class.

6. **Source guard** (in `uncomputable-cause.test.mjs`, the `vcs.contract.test.mjs:1236` /
   `identity.drift.test.mjs` pattern). Neither provider's source contains the literal
   `uncomputable: true` — the shape has one constructor.

7. **`detectionConclusion` no-regression** (`brain-metrics.test.mjs`).
   `detectionConclusion(uncomputable({detail:'x'}), 'memory-gate') === null`, identical to
   its answer for `null` before this change.

Modified: `vcs.contract.test.mjs:1231-1234` (the one assertion ruling 1 revises, §3.2c),
`tranche.test.mjs` (three added tests; **`:53-58` untouched**, §5.2).

## 7. Mutation plan

Every row: the axis, the exact source mutation, and the test that must go red. A row
whose test does not go red means the requirement above it is decoration.

| # | Axis | Mutation | Must go red |
|---|---|---|---|
| M1 | recognised cause | delete the `RATE_LIMITED_RE` arm from `classifyUncomputableCause` | corpus rows 1-3 (`rate-limited` → `unclassified`) |
| M2 | unrecognised cause / the default arm | change the default `return` from `UNCLASSIFIED` to `RATE_LIMITED` | corpus rows 14-15, and §3.2(a) |
| M3 | **provider text present vs dropped — at the factory** | in `uncomputable()`, `detail: text` → `detail: ''` (or → `NO_TEXT_REPORTED`) | §3.2(a) verbatim assertion; §6 test 4; §3.2(c) `detail.includes(...)` — **three layers; if only one is red the requirement is under-tested** |
| M3b | **provider text dropped — at the renderer** (the mutation design question 3 names) | in `tranche.mjs`, drop `` — ${rollup.detail} `` from the condition template, keeping `(${rollup.reason})` | §3.2(b) only. This mutation leaves the classifier perfect. A design tested only at the factory survives it. |
| M4 | rule ORDER | move the `UNAUTHENTICATED` arm above `RATE_LIMITED` | §6 test 2 (`… rate limit exceeded (HTTP 403)` must not read as `unauthenticated`) |
| M5a | **`Array.isArray` guard vs truthy check** | `tranche.mjs:133` `!Array.isArray(requiredGates)` → `!requiredGates` | the object is truthy → falls through to `requiredGates.map` → TypeError. `tranche.test.mjs`'s uncomputable-rollup tests go red. An explicit test asserts REVISE **and no throw**. |
| M5b | same axis, second consumer | `brain-metrics.mjs:179` `!Array.isArray(rollup)` → `!rollup` | §6 test 7 (`.find` on a non-array throws) |
| M6 | **the two providers** | in `gitlab.mjs` ONLY, revert `catch { return uncomputable(...) }` to `catch { return null }` | the `ROLLUP_PROVIDERS` failure test — red for `gitlab`, green for `github`. Proves the table-driven loop is a real detector, not a GitHub test wearing a GitLab label. |
| M6b | mirror of M6 | in `github.mjs` ONLY, same revert | same test, red for `github` only |
| M7 | one constructor | add a hand-rolled `{ uncomputable: true, reason: 'network', detail: e.message }` literal in `github.mjs` | §6 test 6 (source guard) |
| M8 | frozen | drop `Object.freeze` in `uncomputable()` | §6 test 4, and §3.2(c)'s `Object.isFrozen` |
| M9 | HTTP-number false positive | replace `httpStatusOf(text)`-gated matching with bare `/\b429\b/` etc. | §6 test 3 (PR **429**) |
| M10 | **the constraint — the verdict must not move** | `tranche.mjs`'s uncomputable arm returns `conclusion: 'APPROVE'` | `tranche.test.mjs:53-58` (untouched), §3.2(b), and the spec's "never APPROVE" scenarios |
| M11 | `[]` stays distinct from failure | in `github.mjs`, `if (!Array.isArray(rollup))` → `if (!rollup)` on the success path, returning `[]` for a non-array | contract test's "genuinely empty vs failure" pair; §3.2(c)'s `Array.isArray(result) === false` |

## 8. Doc and contract changes

`brain/core/methodology/vcs-contract.md:35` — the `prStatusRollup` row. Signature
becomes:

```
({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? })
  -> Promise<Array<{ name, status, conclusion }> | { uncomputable: true, reason, detail }>
```

and the row's closing sentence changes from *"`null` = uncomputable (fetch failed), never
a fabricated `[]`"* to a sentence stating: the failure arm is a **frozen**
`{uncomputable, reason, detail}` built by `vcs/lib/uncomputable-cause.mjs`; `reason` is
one of the seven enum values and is **advisory** — `detail` carries the provider's own
words on every path, matched or not; `[]` remains reserved for a successfully-fetched
empty rollup; consumers guard with `Array.isArray`, never truthiness. The row also states
that this is **the declared destination for the filed 13**, so the next author reads it as
a convention rather than a one-off (risk 3's mitigation).

Column 1 stays `` `prStatusRollup` ``, so the drift guard's table parser is unaffected
(§4.1).

## 9. Decision record

| # | Decision | Rejected alternative | Why |
|---|---|---|---|
| D1 | `reason` is a frozen string-literal enum in `vcs/lib/uncomputable-cause.mjs`; providers never write a reason literal | free-form strings per provider | free-form is the divergence design question 1 names; the enum makes the codomain testable and a rename one edit |
| D2 | **One factory `uncomputable()` is the only constructor**, enforced by a source guard | each provider builds its own literal | two literals drift silently, because the `Array.isArray` consumers never read the keys |
| D3 | The classifier is a pure `string -> string` in its own module | inline in each provider; or in `tranche.mjs` | inline makes it one provider's private knowledge and unusable by the other; in the evaluator it would give `tranche.mjs` `gh` vocabulary, breaking ruling 2's layering |
| D4 | Classifier takes **text only**; the binary-missing rule is ordered first | a `status` parameter, per a literal reading of ruling 3 | no adoption site can populate `status` (both transports throw); `exec.mjs:30` already renders `status: null` as ENOENT **text**, so the signal is present and its rule holds the first position a status check would have held |
| D5 | Numeric rules read `httpStatusOf(text)` (marker-gated), never bare `\b4xx\b` | bare word-boundary digit matching | `runJson` puts the PR NUMBER in the message: PR 429 would classify as rate-limited. Pinned by M9 |
| D6 | Coarse enum — 5xx and DNS both `network` | separate `provider-unavailable` | identical remedy; `detail` carries the precision; a split is one enum line when it earns a distinct remedy |
| D7 | `evaluateTranche` keeps a distinct branch for bare `null` with the ORIGINAL string | treat `null` as an uncomputable with an empty cause | `null` still means "a reader that discarded its cause"; collapsing it would claim the 13 siblings had been migrated. Keeps `tranche.test.mjs:53-58` untouched as evidence the verdict did not move |
| D8 | No injection seam for the classifier; rot is tested by constructing `reason:'unclassified'` and by source mutation | a `classify` dep parameter on `uncomputable()` | §3.1 proves rot's entire blast radius is `reason === 'unclassified'`, which the tests construct directly. A production parameter that exists only for a test is the decoration this ticket removes |
| D9 | `detail` is never truncated, in the port or the renderer | cap at N chars | a cap is a place where words get dropped. If overflow is ever measured, the fix is a cap with an explicit `(truncated, N dropped)` marker — named here so nobody invents a silent one |
| D10 | The helpers are imported by providers, never re-exported | re-export for convenience | `verb-contract-drift-guard.test.mjs`'s third check would flag them as undeclared contract verbs and its message would push the next author toward the wrong fix |

## 10. Risks carried into tasks

| Risk | Mitigation in this design |
|---|---|
| A truthiness check elsewhere now sees a truthy object | M5a/M5b mutate both known consumers; `isUncomputable` is exported for new callers; an explicit audit task greps for `if (!rollup)` / `rollup === null` / `!requiredGates` at every `prStatusRollup` call site |
| The classifier rots and stops classifying | Structurally cannot lose the cause (§3.1); §3.2(b) drives the fully-rotted state through the real evaluator; corpus pins only what is claimed |
| The corpus spellings are invented rather than observed | The tasks phase must source each row from real `gh`/`glab` output or an existing pinned message in this repo (`identity.test.mjs:296-304` already supplies three). **A row nobody has seen is a claim, and this design does not license one** |
| `gitlab-api.mjs:65`'s message format changes and `httpStatusOf` stops reading GitLab statuses | Three GitLab rows in the corpus break loudly rather than degrading to `unclassified` in silence |
| A long stderr bloats a verdict comment | Accepted, D9; the escape path (§5.4) is already proven by `yamlScalar` |
