---
status: draft
issue: 473
artifact_store: hybrid
topic_key: sdd/issue-473-approval-signature-on-diff/design
---

# Design: the approval signature lands on the diff (issue #473)

Source: `sdd/issue-473-approval-signature-on-diff/proposal` (decisions D1-D6 are settled there and
are NOT re-opened here). This document resolves exactly the six items the proposal deferred to
design, plus the test design. Artifact store: engram. Drafts folder (apply phase only):
`openspec/changes/issue-473-approval-signature-on-diff/brain-drafts/`.

Standing constraints (from the proposal, treated as invariants of every decision below):
no APPROVE path created (ADR-0020 Locks 1-3 verbatim), no port-shape change, no new config key,
additional-evidence OR semantics, `lite`-only.

---

## A. Architecture at a glance

Three modules, one new gate seam, one new CLI. Data flows in one direction; nothing new is
written to the repo, and no new API verb exists.

```
 WRITE (human, laptop, TTY)                     READ (CI, actor-check)
 ─────────────────────────                      ──────────────────────
 brain:approve
   whoami (ambient creds)  ──┐                  prCommits ──► commits[] ──► resolveHeadSha
   prView().headRefOid       │                                        │
   renderDecision(block)  ◄──┘                  prReviews ──► reviews[]│
   re-read head, refuse if moved                        │             │
   prReviewComment({body})  ───── GitHub/GitLab ────────┘             │
   re-read reviews, verify landed author                              ▼
                                                  evaluateSignedDecision(parseDecision)
                                                              │ admitted?
                                                       yes ───┴─── no (note)
                                                        │            │
                                                      pass      evaluateDistinctAct (today)
```

Layering: `review/lib/` owns the block PROTOCOL (render+parse). `vcs/actor-check.mjs` owns
ADMISSIBILITY (what the gate accepts). `scripts/approve/` owns the human ACT (identity, TTY,
confirmation, posting). No module owns two of the three.

---

## B. D4 — parser factoring (module boundary, path, drift guard)

### B1. What moves, what does not

New shared module: **`brain/scripts/review/lib/yaml-block.mjs`** — the low-level inverse of ONE
fixed emitter family, exporting:

| export | moved from | why shared |
|---|---|---|
| `FENCE_RE` / `extractFencedBlock(body)` | `parse-verdict.mjs:8` | both protocols ride the same fenced-YAML carrier |
| `scalar(block, key)` | `parse-verdict.mjs:10-13` | both read column-0 scalars |
| `decodeYamlEscapes(inner)` | `parse-verdict.mjs:31-34` | THE one decoder (issue #452: "one emitter must have exactly one inverse; two decoders is the defect") |
| `unyamlScalar(raw)` | `parse-verdict.mjs:66-70` | quoted-scalar inverse of `verdict.mjs:44` `yamlScalar` |
| `parseJsonScalar(raw)` | `parse-verdict.mjs:43-53` | same family; splitting it from `decodeYamlEscapes` is literally how #452 happened |

**Does NOT move** (stays in `parse-verdict.mjs`): `ENTRY_OPEN_RE`, `ENTRY_CONT_RE`,
`TOP_LEVEL_KEYS`, `TOP_LEVEL_KEY_RE`, `parseEntryList`.

Rationale for the boundary: the list machinery's terminator predicate NAMES this protocol's own
column-0 keys (`parse-verdict.mjs:92-96`), and the #478-3/B1 lesson is that a generic `word:`
terminator is a defect. Sharing it would require a factory parameterized by each protocol's key
set — and slice 1's `parseDecision` reads NO list (the `dispositions` field is deferred to its own
ticket, proposal D6). Parameterizing a predicate that has exactly one caller produces a guard
whose red-proof is blind by SITE: there is no second instance to disagree with it. So: extract the
primitives with two real consumers today; leave the list machinery in place with a one-paragraph
comment recording the factory shape (`makeEntryListParser({ topLevelKeys })`) for whoever lands
`dispositions`. The repo rule is "when two copies of a rule exist, delete one"
(`red-proof-blind-along-an-unvaried-axis.md` §7), not "pre-emptively parameterize a rule that has
one copy".

`parse-verdict.mjs` after the move: unchanged behavior, imports its primitives, keeps
`parseVerdict()`'s two-protocol allowlist (`parse-verdict.mjs:214`) EXACTLY as it is. The verdict
parser never learns `decision`/`actor`/`head_sha`-as-a-signature — that was the proposal's
preferred direction and is confirmed here.

### B2. The decision protocol module

New: **`brain/scripts/review/lib/decision-block.mjs`** — `renderDecision()` AND `parseDecision()`
in ONE module.

Considered and rejected: mirroring the verdict family's split (`review/verdict.mjs` renders,
`review/lib/parse-verdict.mjs` parses, a drift test keeps them honest). That split is a historical
accident that has already cost this repo two drift bugs (#381, #452) and needs a drift test to
survive. Emitter and inverse in one file is the stronger form of the same rule: two copies drift,
one *module* cannot be edited half-way in a different file. The cost is a naming asymmetry with
`parse-verdict.mjs`, which is cheaper than the defect class it removes.

Considered and rejected: hoisting the protocol family to `brain/scripts/lib/protocols/`. It would
move `parse-verdict.mjs` too, inflating a slice whose whole claim is that the verdict parser's
behavior is byte-for-byte unchanged.

`actor-check.mjs` (under `vcs/`) importing from `review/lib/` is a new cross-tree edge, but not an
unprecedented one: `vcs/providers/vcs.contract.test.mjs:628` already imports `parseVerdict`.

### B3. Drift-guard test design (the cost, priced)

Three guards, none of them a source scan (a scan is blind by SPELLING — the doctrine's own
worked example, `red-proof-...md` §Cause):

1. **Cross-parser equivalence table** — `brain/scripts/review/lib/yaml-block.drift.test.mjs`.
   One table of pathological carriers, each rendered into BOTH a `brain-review/1` body and a
   `brain-decision/1` body, asserting the two parsers read the shared fields (`protocol`,
   `head_sha`) identically — both a value or both `null`. Rows: no fence; fence without the `yaml`
   tag; two fences (first wins on both); CRLF body; tab-indented key; trailing space after the key
   (`parse-verdict.mjs:132-138`'s pinned defect must be pinned identically on both); quoted value
   with `\\`, `\"`, `\n`, ` `; a value containing a `#`; an empty block. If someone re-inlines
   a divergent copy of `scalar`/`FENCE_RE` into either parser, a row goes red. ~10 rows, ~70 lines.
2. **Emitter/inverse round-trip** — in `decision-block.test.mjs`: `parseDecision(renderDecision(x))`
   returns every field of `x`, and every column-0 key `renderDecision` emits is a key
   `parseDecision` reads. This is the same shape as the existing terminator drift guard
   (`parse-verdict.test.mjs:446-465`), which is the precedent to copy. ~25 lines.
3. **The existing `parse-verdict.test.mjs` suite, edited by ZERO lines.** A green run of an
   untouched suite is the evidence that the extraction was a pure move. If a case has to change,
   the move was not pure and the slice is wrong.

Total new drift-guard cost: ~95 lines of test across two files. Priced and accepted.

---

## C. The admissibility seam (the (b)-swap boundary)

**Decision: a PEER evidence source in `evaluateActor`, not a branch inside `evaluateDistinctAct`.**

### C1. Why peer

`evaluateDistinctAct` (`actor-check.mjs:109-185`) has one contract: *compare the label timestamp
against the latest foreign commit*. Its four fail-closed branches (116, 127, 156, 167) all speak
that vocabulary. Putting a `head_sha` signature check inside it makes the function mean two
things, and destination (b) — #454 gives the agent an identity, so a real approving review becomes
readable — would then have to be surgery inside a function about label timing. As a peer, (b) is:
write one new pure function, append it to a list. That is the "swap of the evidence source, not a
rewrite" the proposal requires.

### C2. Exact seam

```js
// actor-check.mjs — new pure function, sibling of evaluateDistinctAct
export function evaluateSignedDecision({ decisions, headSha, denyActors = [] })
  // → { admitted: true,  reason }   an admissible brain-decision/1 APPROVE exists
  // → { admitted: false, note }     block(s) present but none admissible (annotates, never blocks)
  // → null                          no decision block at all — silence, no note

// the pluggable list; (b) appends `evaluateApprovingReview` here and touches nothing else
export const LITE_SIGNED_EVIDENCE_SOURCES = Object.freeze([evaluateSignedDecision]);
```

`evaluateActor`'s `lite` branch (today `actor-check.mjs:379-381`) becomes:

```js
if (tier === 'lite') {
  for (const source of signedEvidenceSources) {          // defaults to LITE_SIGNED_EVIDENCE_SOURCES
    const signed = source({ decisions, headSha, denyActors });
    if (signed?.admitted) return withRefusalNote({ level: 'pass', reason: signed.reason });
    if (signed?.note) notes.push(signed.note);
  }
  const base = evaluateDistinctAct({ actor, labelCreatedAt, commits, reviewActors: denyActors });
  return withRefusalNote(notes.length ? { ...base, reason: `${base.reason} ${notes.join(' ')}` } : base);
}
```

`signedEvidenceSources` is a defaulted field on `evaluateActor`'s input object, so a test can
drive a fake source and prove the composite honors the LIST (order, first-admitted-wins) rather
than a hardcoded call. Six lines of seam; it is the whole reason (b) is a swap.

### C3. Return-shape choice (deliberate)

The source returns `{ admitted }`, **not** `{ level, reason }`. A verdict-shaped return is exactly
what a careless caller passes straight through, and a `{ level: 'fail' }` escaping from a
NON-admissible block would break D1's monotonicity guarantee (see C4). A shape with no `level` key
cannot be returned as a verdict by accident.

### C4. Monotonicity: refusal annotates, it never blocks

Under D1 (additive OR), a stale or malformed block must NOT fail a PR that passes today. So every
non-admissible case yields `admitted: false` and the run falls through to `evaluateDistinctAct`'s
existing verdict. "Fail closed" here means *the block never grants a pass on unreadable evidence* —
not *the run hard-fails*. The `note` is what keeps this from becoming a silent abstention (an
`evidence-reader-empty-on-failure`-shaped defect): the human who ran `brain:approve` and still saw
a red gate reads WHY their signature did not count, in the gate's own reason string.

### C5. Two properties that fall out of the existing control flow — stated, and tested, not assumed

- **The label is still required.** `evaluateActor:319-326` returns warn+pass when there are zero
  labeled events, ABOVE the tier dispatch. A signed block alone therefore never reaches the
  evidence list. Authorization (`status:approved`, #124, on the issue) stays the precondition;
  the block supplies per-diff verification. That is the category split #473 asks for, and it
  costs zero new code.
- **The deny-set still runs first.** `evaluateActor:358-365` denies a `reviewActors` label actor
  before the tier branch. The block source performs the SAME deny check against the review's
  author (C6 rule 12) — deny-before-admit, same shape, same key, no new config (proposal D2).
- **Self-approval is still not checked at `lite`**, for the block exactly as for the label
  (`actor-check.mjs:248-249`). The new evidence is neither stronger nor weaker on that axis. Said
  out loud so no future reader reads it as an omission.

---

## D. Input threading

Mirrors `defaultFetchLabeledEvents` (`actor-check.mjs:474-481`) and `defaultFetchCommits`
(`541-547`) exactly.

```js
function defaultFetchDecisions(repo, provider, { getVcs: getVcsFn = getVcs } = {}) {
  return async prNumber => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    return vcs.prReviews({ project: repo, number: prNumber, apiBase, token, proxyUrl });
  };
}

function needsDecisionEvidence(tier) { return tier === 'lite'; }   // sibling of needsCommitEvidence:525

export function resolveHeadSha(commits) {                          // pure, exported for unit test
  return Array.isArray(commits) && commits.length > 0 ? (commits[commits.length - 1].sha ?? null) : null;
}
```

In `gatherActorCheckInputs` (`actor-check.mjs:650-680`), alongside the existing dep resolution:

```js
const fetchDecisions = deps.fetchDecisions ?? defaultFetchDecisions(repo, provider, deps);
const decisions = needsDecisionEvidence(tier) && prNumber != null ? await fetchDecisions(prNumber) : null;
const headSha  = resolveHeadSha(commits);
```
and both are added to BOTH return statements (the `issueNumber == null` early return at 670 and
the normal one at 679) — that early return is the SITE a mutation would miss.

Four deliberate choices:

1. **No post-filter wrapper.** `filterLabeledEvents` (`452-455`) exists because label events need
   provider-shape post-normalization; reviews need none. All parsing/admissibility lives in the
   pure evaluator, so every refusal class is unit-testable with zero I/O.
2. **`null` is preserved, not flattened to `[]`.** `prReviews` returns `null` on API failure
   (`github.mjs:311`, `gitlab.mjs:334/346`). `filterLabeledEvents` maps null→[] on purpose (it
   feeds REQ-L5-2's warn branch); here null must stay null so the source can emit
   "the PR review list is unreadable — a signature could not be verified" as a NOTE.
   `null` = uncomputable, `[]` = genuinely no reviews (`evidence-reader-empty-on-failure`).
3. **Tier-gated fetch.** `standard`/`regulated` make ZERO new API calls — the same
   REQ-TIER-10 no-op-migration guarantee `needsCommitEvidence` protects (`517-527`).
4. **`headSha` is derived from `commits`, not fetched.** The PR head SHA is already in hand
   (`prCommits()` ascending, `actor-check.mjs:294`); adding a `prView` round-trip would introduce a
   second source of truth for "the head" that can disagree with the commit list the peer evidence
   source reads. Residual, recorded: GitHub's `/pulls/N/commits` caps at 250 commits, so on a
   >250-commit PR the resolved head is wrong and the block is REFUSED — the fail-closed
   direction (a mismatched head never grants a pass).

---

## E. `brain-decision/1` — exact fields and fail-closed matrix

### E1. Fields

```yaml
protocol: brain-decision/1     # required, exact literal
decision: APPROVE              # required, exact uppercase literal (only value in slice 1)
head_sha: <40-hex>             # required, full SHA the signature binds to
actor: <login>                 # required, whoami-resolved login at write time
at: <ISO-8601>                 # required to WRITE, unread by any check — audit trail
in_reply_to: <url|id>          # optional, unread by any check — audit trail (proposal D3)
```

Deliberately absent: `rev`, `verdict`, `gates`, `findings`, `conditions`, `dispositions`
(separate ticket, D6). The block answers one question — *which diff did a human sign, and who* —
and carries no state the gate must reconcile.

`at` and `in_reply_to` are written and never read. That is intentional, not an oversight: the
proposal's thesis is auditability ("protocol, actor, SHA, timestamp in a durable comment"), and
`in_reply_to` cannot be verified without extending `prReviews()` on both providers (D3). A future
reader who "fixes" this by making them load-bearing is changing the contract, not tidying it.

### E2. Read-side fail-closed matrix

Vocabulary: **admit** = `{admitted:true}`, gate passes on this evidence. **refuse** =
`{admitted:false, note}` — evidence not admitted, note appended to the fallback verdict, never a
pass, never a hard fail (C4). **silent** = `null`, nothing to say.

| # | condition | outcome |
|---|---|---|
| 1 | `decisions === null` (review list uncomputable) | refuse — "the PR review list is unreadable" |
| 2 | `decisions === []`, or no review body carries a `brain-decision/` fence | silent |
| 3 | fence carries `protocol: brain-review/N` or no `protocol` | silent (not addressed to this reader) |
| 4 | `protocol` starts `brain-decision/` but is not `brain-decision/1` | refuse — "unsupported protocol version" (it IS addressed to us) |
| 5 | `decision` absent | refuse |
| 6 | `decision` present but not exactly `APPROVE` (`approve`, `APPROVED`, `REJECT`, `""`) | refuse, naming the expected literal |
| 7 | `head_sha` absent or empty/whitespace | refuse |
| 8 | `head_sha` malformed (not 40 hex chars) | refuse |
| 9 | `head_sha` is a valid PREFIX of the PR head (e.g. 7-char) | refuse — a prefix match would admit a block that names an ancestor |
| 10 | `head_sha` ≠ PR head (case-folded, full length) | refuse — "the signature names X, the PR head is Y; re-sign the current head" |
| 11 | PR head unresolvable (`commits` null/empty → `headSha === null`) | refuse — "cannot resolve the PR head" |
| 12 | `actor` absent | refuse |
| 13 | review author is `null` (provider could not resolve) | refuse — an unresolvable identity is not an identity (same rule as `isForeignCommit`, `actor-check.mjs:73-77`) |
| 14 | `actor` ≠ review author (case-folded) | refuse — "the block claims to be signed by X but was posted by Y" |
| 15 | review author ∈ `denyActors` (`governance.reviewActors`) | refuse — "a review identity may never sign an approval" (reviewer-protocol.md §9; mirrors `358-365`) |
| 16 | several reviews carry blocks | evaluate ALL in the order returned; admit if ANY is admissible; collect the others' notes |
| 17 | one body carries several fences | only the FIRST fence is read — same `FENCE_RE` primitive as `parseVerdict`. A stale block quoted above a fresh one refuses (fail-closed direction). Scanning all fences would admit a block the human QUOTED rather than SIGNED |
| 18 | `at` absent or malformed | admit — audit-only, unread |
| 19 | `in_reply_to` absent or garbage | admit — audit-only, unread |
| 20 | unknown extra fields present | admit — the reader names the fields it reads and ignores the rest |

Comparisons: `head_sha` case-folded (hex case is not identity); logins case-folded (both providers
are case-insensitive — `evaluateVerifiedIdentity`, `identity.mjs:40-45`); `decision` and `protocol`
case-SENSITIVE (the writer is our own renderer; tolerating spellings widens the admitted set for
hand-edited blocks with no benefit).

**Review `state` is deliberately NOT constrained.** Two reasons, both load-bearing:
(i) GitLab normalizes notes to `state: 'COMMENTED'` (`gitlab.mjs:354`) while GitHub yields
`'COMMENTED'`/`'APPROVED'`/etc. — a `state === 'COMMENT'` requirement would be a cross-provider
false negative on day one; (ii) gating on state would encode a claim about HOW the human posted,
which is not evidence about the diff, and would couple L5's vocabulary to L6's `state==='APPROVED'`
filter — the exact collapse the two-key split forbids. ADR-0020's locks constrain what the CODE may
emit, not what a human may click.

### E3. Write-side refusal matrix (`brain:approve`)

| condition | outcome |
|---|---|
| stdin is not a TTY | refuse BEFORE any read or write (lock 1, `brain-promote.mjs:313-314`) |
| any option-shaped argv token | hard abort, never a silent no-op (lock 2, `brain-promote.mjs:87-97`) |
| `whoami` throws / returns no login | refuse — never proceed on an unverified identity (`identity.mjs:91-96`) |
| resolved login ∈ `governance.reviewActors` | refuse — write-side twin of read rule 15 |
| PR head unresolvable | refuse |
| confirmation word not typed exactly | refuse |
| head moved between compose and post | refuse, post NOTHING |
| `prReviewComment` returns `{url:null}` | exit non-zero; never report a signature that did not land |
| landed review's author ≠ block `actor` | exit non-zero with instructions — the signature will not be admitted (see F3) |

---

## F. `brain:approve` CLI

Path: `brain/scripts/approve/cli.mjs`, wired as `"brain:approve": "node ./brain/scripts/approve/cli.mjs"`
in `package.json` (next to `brain:promote:59` / `brain:review:60`). Block rendering lives in
`review/lib/decision-block.mjs` (B2), not here.

### F1. Flow

1. `parseArgs(argv)` — exactly one positional (the PR number, or none → resolve from the current
   branch); every option-shaped token aborts (lock 2 shape, `brain-promote.mjs:87-97`).
2. TTY gate — refuse on non-TTY before anything else (`brain-promote.mjs:313`). **This is the
   critical lock**: without it, an agent could run `brain:approve` inside a workflow and sign for
   the human, which would make the whole change worse than the label it replaces.
3. Identity: `whoami()` on the AMBIENT credentials (F3).
4. Deny check: resolved login ∈ `governance.reviewActors` → refuse (`actor-check.mjs:358-365` shape).
5. Head: `prView({project, number}).headRefOid`.
6. Compose: `renderDecision({ protocol, decision: 'APPROVE', head_sha, actor, at, in_reply_to? })`.
7. Show the human the rendered block + the PR title + the head SHA, and require the typed
   confirmation word (F4).
8. **Re-read the head** (`prView` again) and refuse if it moved — the proposal's own race design.
   Same seam as `postVerdict`'s anti-stale check (`poster.mjs:120-129`, `deps.reResolveHead`), but
   `brain:approve` applies NO label: `reviewed:stale` belongs to the reviewer protocol, and this
   verb writes zero labels (stated as a lock, tested).
9. Post via `vcs.prReviewComment({ project, number, body })` — no `event`, no `comments`. Existing
   verb, `event:'COMMENT'` hardcoded provider-side (`github.mjs:463`).
10. **Post-then-verify**: re-read `prReviews()` and confirm the landed review's author equals the
    block's `actor`; otherwise exit non-zero with instructions (F3).
11. Print the PR URL. There is no "done" claim before step 10 passes.

### F2. Reuse vs. new

- Reused: `identity.mjs`'s `evaluateVerifiedIdentity` (case-folding pure core, `identity.mjs:40-45`)
  and its `defaultWhoami` provider shape (`identity.mjs:57-64`) for the GitLab apiBase/proxy wiring.
- Reused pattern (not code): `brain-promote.mjs`'s read-confirm-act locks and its
  `stripComments`-based lock drift guard.
- NOT reused: `postVerdict` itself. It carries anti-loop, `reviewed:stale` and `needs-decision`
  label writes that are reviewer-protocol semantics; importing it would drag three label writes into
  a verb whose lock is "writes no labels".

### F3. Identity resolution — the one departure from the ticket's wording

The issue names a new `BRAIN_HUMAN_TOKEN`. **Rejected**, because `prReviewComment` takes no token
(`github.mjs:447-449` runs `gh` on ambient auth) and giving it one is a port-shape change, which is
out of scope. A token that the identity check reads but the post verb cannot use guarantees the
claimed `actor` and the posting account may diverge — producing a block that looks correct locally
and is refused forever by read rule 14. That is the worst available failure mode.

So: `brain:approve` resolves `actor` with `whoami()` on the SAME ambient credentials the post will
use (GitHub: `gh` auth; GitLab: `gitlabApiConfig()`'s token, the same one `prReviews`/write path
use). No new env var, no new config key, no port change. The residual — ambient auth changing
between the whoami and the post — is closed behaviourally by step 10's post-then-verify, which
converts a silently-unadmissible signature into an immediate non-zero exit with instructions.

### F4. Confirmation word

`SIGN`, one exact literal, typed in full (lock 4 shape, `brain-promote.mjs:43`).
NOT `APPROVE`: the repo's own lock guards and reviews scan for that literal around review-posting
code (`vcs.contract.test.mjs:1670-1710`), and a CLI that posts reviews and contains the string
`APPROVE` as a control token invites exactly the false-positive/false-negative confusion that
doctrine warns about. `SIGN` also names the act correctly: the human signs a diff; the block
carries the decision.

---

## G. ADR surface

### G1. ADR-0026 Amendment 2 — draft plan and promotion mechanics

**Verified constraint that shapes this**: `brain:promote` REFUSES to write over an existing
decision file (`brain-promote.mjs:348-352`, "refusing to overwrite a signed artifact"). ADR-0026
already exists at `brain/project/decisions/adr-0026-governance-doctrine-tiers.md` and Amendment 1
was applied as an in-file section (`:201`) plus a status-line note (`:3`) plus an inline
`[Amended by Amendment 1 (#418) …]` marker in the evidence table (`:181`). Therefore **Amendment 2
is not promotable by `brain:promote`** — it is a human-authored edit of an existing signed file,
gated by L6 `brain-writes-reviewed` + CODEOWNERS as usual.

Consequence for the draft's FILENAME: name it
`openspec/changes/issue-473-approval-signature-on-diff/brain-drafts/adr-0026-amendment-2.draft.md`.
The `.draft.md` suffix is deliberate: `DRAFT_BASENAME_RE` (`brain-promote.mjs:53`) would match
`adr-0026-amendment-2.md` and cheerfully promote it into a SECOND ADR-0026 file; the extra dot
makes `destinationFor()` return `null` so the verb refuses with a clear message instead.

Draft contents (mirroring Amendment 1's own shape):
1. `## Amendment 2 — a signed decision block is admissible `lite` evidence for `actor-check` (issue #473)`
2. **Context**: what Amendment 1 left unfixed — a label event carries a timestamp and nothing else,
   so it cannot name which diff was approved; the "unattributed authors" residual ADR-0026 already
   records is the symptom, the category error (authorization asked to double as verification) is
   the cause.
3. **Decision**: one new admissible evidence FORM at `lite` for `actor-check` only — a
   `brain-decision/1 APPROVE` block on a PR review, anchored on the PR head SHA, whose declared
   actor equals the posting author and is not a `reviewActors` identity. OR'd with the existing
   distinct-act evidence; the `status:approved` label remains the precondition (C5).
   `brain-writes-reviewed`'s row is untouched. `standard`/`regulated` are untouched.
4. **The monotonicity claim, stated outright**: no PR passes on LESS evidence than today; a
   non-admissible block annotates the verdict and grants nothing.
5. **Honest residuals**: this does not reduce the number of human signatures per push (a push moves
   the head, the block goes stale, the gate re-arms — correctly); a COMMENT-state block would not
   satisfy a future #94 `required_approving_review_count`; head resolution is capped by
   `prCommits` pagination; only the first fence in a body is read; `at`/`in_reply_to` are written
   and unread; `dispositions` is a separate ticket.
6. **Table edit**: an inline `[Amended by Amendment 2 (#473) — …]` marker next to the `lite`
   evidence row, and the status line updated to `**amended DD/MM/2026** (Amendments 1-2)`.
7. **References**: issue #473, #418 (Amendment 1), #454 (destination (b)), #124, ADR-0020.

### G2. ADR-0020 — no amendment, no footnote

**Decision: leave ADR-0020 untouched.** Nothing in its decision changed: no verb is added
(`cli.mjs:32-39` `VERBS` unchanged), no verb signature changes, `event:'COMMENT'` stays hardcoded
provider-side, `reviewActors` continues to be read at L5 as a DENY set (which #375 already
established, `actor-check.mjs:358-365`) and never as `approvalActors`. An amendment records a
decision that MOVED; a footnote saying "still true" ages into a claim nobody re-verifies.

The assertion belongs in a test, not a document: the apply phase adds a lock case proving
`brain:approve` never passes `event`, never adds a label, and that `VERBS` gained nothing —
alongside the existing `vcs.contract.test.mjs:1670` hostile-`event` guard. ADR-0026 Amendment 2
cites ADR-0020's locks and points at that test as the proof.

---

## H. Test design

Runner: `npm test` (`node --test "brain/scripts/**/*.test.mjs" …`, package.json:39).

### H1. Suites

| suite | status | what it owns |
|---|---|---|
| `review/lib/decision-block.test.mjs` | NEW | E1 fields; parse-level classes of E2 rules 3-9, 12, 17-20; render/parse round-trip |
| `review/lib/yaml-block.drift.test.mjs` | NEW | B3 guard 1 — cross-parser equivalence table |
| `review/lib/parse-verdict.test.mjs` | UNCHANGED (zero edits) | the extraction was a pure move |
| `vcs/actor-check.test.mjs` | EXTENDED | E2 admissibility end-to-end, C2 composite, C5 properties, D fetch gating |
| `approve/cli.test.mjs` | NEW | F1 flow, E3 write-side matrix |
| `approve/locks.test.mjs` | NEW | TTY lock, no-option lock, zero-label lock, no-`event` lock (mirrors `brain-promote.locks.test.mjs`) |
| `vcs/providers/vcs.contract.test.mjs` | UNCHANGED | proof of no port-shape change |
| `vcs/brain-writes-reviewed.test.mjs` | UNCHANGED | proof L6 is untouched |

### H2. Mutation axes (per `red-proof-blind-along-an-unvaried-axis.md`)

Every guard below names the axis it varies. A green that varied no axis proves nothing.

- **PATH** — drive all three `decisions` shapes separately: `null` (uncomputable), `[]` (no
  reviews), and a non-decision review. Deleting the `null` branch must go red, which it cannot if
  the fixture only ever supplies `[]`.
- **BRANCH** — mutate the composite's two branches SEPARATELY and then together: (i) admitted-path
  removed, (ii) fallthrough-path removed. A both-branch mutation cannot detect a one-branch gap.
- **VALUE CLASS** — every class the predicate names, driven on every branch:
  `head_sha`: exact, case-different (must ADMIT), 7-char prefix, 39-hex, 41-hex, non-hex, `''`,
  whitespace-only, absent, `null`;
  `decision`: `APPROVE`, `approve`, `APPROVED`, `REJECT`, `''`, absent;
  `protocol`: `brain-decision/1`, `brain-decision/2`, `brain-review/1`, absent.
- **SPELLING** — the deny check mutated four ways: removed; made case-sensitive; pointed at
  `approvalActors` instead of `reviewActors`; applied to the block's `actor` instead of the review
  AUTHOR (the partial re-inline — the shape most tests miss, because it still refuses the values
  the tests drive).
- **FIELD** — assert the fallback verdict's reason string NAMES the refused block and the reason
  it was refused (a payload field a scan would skip); and assert an unknown extra field in the
  block does not change the outcome (rule 20).
- **SITE** — enumerate from the CODE, not from the sentence: `gatherActorCheckInputs` has TWO
  return statements (`actor-check.mjs:670` and `:679`) and the early one is the site a mutation
  hides in. The locks test asserts the expected substitution-site count and refuses to run when it
  differs. Same discipline for `brain:approve`'s two `prView` calls (compose + re-read).
- **Negative fixtures fail for ONE reason** — e.g. the "block author is a reviewActors identity"
  case must carry a MATCHING `head_sha` and a matching `actor`, so the deny rule is the criterion
  that fires; otherwise it pins whichever check happens to run first.

### H3. Strict TDD ordering (failing test first, every step)

Slice 1 — parser:
1. RED: first case in `decision-block.test.mjs` (module does not exist).
2. GREEN: minimal `decision-block.mjs` with an inline copy of the primitives.
3. RED: `yaml-block.drift.test.mjs` equivalence table (two copies disagree on at least one row).
4. GREEN: extract `yaml-block.mjs`, both parsers import it. `parse-verdict.test.mjs` green with
   zero edits at every step of 3-4.
5. RED→GREEN per E2 parse-level class, one case at a time.

Slice 2 — actor-check reader:
1. RED: "a `brain-decision/1 APPROVE` at the current head passes `lite` even though the label
   predates a later foreign commit" — the success criterion, and the only case that can fail for
   the right reason before any code exists.
2. GREEN: `evaluateSignedDecision` + the composite seam.
3. RED→GREEN per E2 rule 1, 4-17, each its own case with its own note assertion.
4. RED: `standard` and `regulated` never call `fetchDecisions` (injected spy, call count 0).
5. RED: the composite honors an INJECTED source list (order + first-admitted-wins).
6. RED: no labeled event → warn+pass even with an admissible block (C5, property 1).

Slice 3 — CLI + ADR draft:
1. RED per lock (TTY, options, confirmation word, deny-set, head-moved, post-failure,
   landed-author mismatch), each before its implementation.
2. The ADR draft lands in the same slice as the behavior it documents.

### H4. Slice ordering property worth stating

Reader (slice 2) before writer (slice 3) is intentional: until `brain:approve` exists no
`brain-decision/1` block exists anywhere, so slice 2 is a provable production no-op — the evidence
source is silent on every real PR, and `evaluateDistinctAct` answers exactly as it does today.
Slice 1 is a pure move with an untouched regression suite. Every slice is independently revertible;
reverting slice 2 alone restores today's behavior exactly (proposal's rollback claim).

---

## I. Open risks and assumptions carried into tasks

| # | risk / assumption | how it is handled |
|---|---|---|
| R1 | GitLab `prReviews` returns ALL non-system notes (`gitlab.mjs:352-354`), so any comment quoting a block is a candidate | Read rules 14 (actor === author) and 10 (head match) make a quoted block admissible only when quoting is equivalent to signing. Recorded as a residual in Amendment 2. |
| R2 | On GitHub, a block pasted into a normal PR CONVERSATION comment is invisible (`/pulls/N/reviews` only) | The CLI is the sanctioned path; documented in the ADR residuals. Not fixed by widening the port (out of scope). |
| R3 | Head resolution capped by `prCommits` pagination (>250 commits on GitHub) | Refuse — fail-closed direction. Recorded. |
| R4 | Ambient-credential divergence between `whoami` and the post | Closed behaviourally by post-then-verify (F3). |
| R5 | `evaluateActor` gains two input fields (`decisions`, `headSha`) — any caller constructing inputs by hand breaks silently | Both defaults are `null`/silent; a test drives `evaluateActor` with the pre-change input object and asserts today's verdict, unchanged. |
| R6 | Slice budget: three PRs of roughly parser / reader / CLI+ADR | Forecast is `sdd-tasks`' call; the boundaries are named in H4. |
| R7 | Naming asymmetry: `decision-block.mjs` (render+parse) vs `parse-verdict.mjs` (parse only) | Accepted with rationale (B2); a comment at the top of each names the other. |
