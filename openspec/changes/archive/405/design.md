---
status: design
issue: 405
epic: 313
artifact_store: openspec
topic_key: sdd/issue-405-inline-review-comments/design
---

# Design — inline per-line review comments (issue #405)

The ticket names five decisions. Each is settled here against a measurement, not a
preference. **D6 is a sixth the measurements surfaced, and it belongs to the human.**

## D1 — widen `prReviewComment`, do not add a fifth verb

`comments` becomes an optional parameter:

```
prReviewComment({ project, number, body, comments? })
  -> { url } | { url, inlineDropped } | { url: null, error }
```

`inlineDropped` was missing from this shape until round 2 of the cold review (E-6) —
added in the same change that introduced it, and left out of the design's own signature.

Measured basis: GitHub's `/reviews` endpoint takes `body`, `event` and `comments[]` in
**one** payload, so widening costs zero additional calls **on GitHub** and keeps its review
atomic — either the whole review posts or none of it does. On GitLab it costs one
`diff_refs` read plus one call per anchor, which is the floor that API allows (see D3). A fifth verb would mean two calls on
GitHub, which introduces a state where the summary posted and the inline did not, on the
provider where that split is otherwise impossible.

ADR-0020's "four write verbs, all incapable of approving" survives verbatim: the count
is unchanged and `event: 'COMMENT'` stays hardcoded with no parameter reaching it.

**Cost, stated:** GitLab pays for the symmetry. Its implementation must branch — notes
when `comments` is absent, discussions when present — so one contract verb maps to two
endpoints. That asymmetry is already precedent in this port (`prCommits` returns
`login: null` for every GitLab entry), and the contract suite is what keeps it honest.

## D2 — explicit `file` / `line` on the finding, never string-mining `evidence`

Findings carry free-form `evidence` (`src/a.mjs:42`). Deriving an anchor from it means
parsing prose, and `evidence` is deliberately a quoted command **and its output** —
protocol §10 — so it contains colons, paths, line numbers and arbitrary text that is not
an anchor. A regex over it would silently mis-anchor.

Explicit fields, both optional, and **a finding without them simply gets no inline
comment**. That default is what makes the feature additive: every existing evaluator
keeps working, unchanged, and gains inline coverage only when it starts emitting
anchors.

Interaction with PR #478, which must land first: `file`/`line` are new scalar fields on
a finding entry, so they flow through `yamlScalar`/`unyamlScalar` and are read by
`ENTRY_CONT_RE` like any other. They inherit that pair's escaping guarantees for free —
and inherit its constraint that the value must not contain a raw line break, which for a
path and an integer is not a constraint at all.

## D3 — the verdict is never lost to an inline failure

The failure mode that matters. GitHub 422s when a comment targets a line outside the
diff; GitLab rejects a stale `position`. The rule:

1. **Attempt the review with `comments[]`.**
2. **On ANY failure of an anchored attempt, retry once with the summary body alone.**
3. **Report the count** — the verdict says how many anchors were dropped and why.

Rule 2 said *"on an inline-specific rejection"*, and rule 2 said the retry *"folds the
un-anchorable findings back into the block"*. Both were corrected in round 6; neither
described the implementation.

**The trigger is not inline-specific, deliberately.** `github.mjs` retries on any non-zero
first exit, because gating on a 422-shaped stderr would make a transient 5xx lose the
VERDICT — and REQ-405-4 ranks the verdict above the annotation. The cost is an over-count:
a network blip is reported as dropped anchors. That trade is named in `github.mjs`'s own
comment, and the design said the opposite of it. Measured — a generic 502 on the first
attempt still retries:

```
attempts: 2 | retried after a NON-inline failure: true
result: { url: 'https://x/1', inlineDropped: 1 }
```

**And nothing is "folded back".** The retry re-sends the body BYTE-IDENTICAL; the findings
were already in it, because the summary block is built before any anchor is derived. The
e2e asserts exactly that identity. There is no fold operation and there never was.

**CORRECTED during implementation — this rule was GitHub's, written as everyone's.**
It read: *"Never the reverse order (summary first, inline second): that is two calls, and
the window between them is exactly the second-postable-artifact the anti-loop lock is
built to prevent (D5)."* The shipped GitLab verb uses exactly that order, because it has
no other: discussions are one-per-position, so N anchors are N+1 calls whichever way they
go, and there is no atomic option to prefer.

The reasoning was wrong twice over. The anti-loop lock counts **parseable verdicts**, not
posts — an inline annotation carries finding text and no `brain-review/N` block, so
`cold-boot.mjs`'s `reviews.map(parseVerdict).filter(Boolean)` never sees it — and a
"window between two calls" is not a second postable artifact.

The rule that survives, and that both providers follow: **when the calls cannot be atomic,
the verdict goes in the one that is already safe if everything after it fails.** GitHub is
atomic, so it attempts anchored and retries bare. GitLab is not, so the summary goes first.
Opposite sequences, one rule.

D5 and REQ-405-5 were corrected when the implementation falsified them; this paragraph was
missed and shipped for two more commits — caught by round 2 of the cold review (C-1). Same
class as the signed-ADR finding one round earlier: the correction was made everywhere it
was noticed and nowhere it was not.

The discipline this repo already has a name for: an inline post that failed is
`uncomputable`, not `no findings`. The count is reported precisely so the reader can
tell "there were no anchors" from "the anchors would not attach" —
`evidence-reader-empty-on-failure` applied to a poster instead of a reader. Anything
else trades a working reviewer for a cosmetic one.

## D4 — GitLab fetches `diff_refs` inside the verb, not through a widened `prView`

`prView`'s contract row is provider-agnostic and consumed by cold-boot, tranche,
checkpoint and the poster's anti-stale check. Adding a GitLab-only `diff_refs` field
would put a provider-shaped value into the port's most-consumed normalized shape, for
one caller.

The verb fetches what its own transport needs. Cost: one extra GitLab request per posted
review with inline comments, and none on GitHub. Contract-visible either way, so the
contract row records that `comments` support on GitLab implies an additional read.

## D5 — the anti-loop lock is untouched — corrected: it counts VERDICTS, not calls

> **Corrected during implementation (T7).** D5 originally rested on "one call", which is
> a GitHub property. GitLab's discussions are one-per-position, so N anchors are N+1
> calls and no ordering makes them atomic. The argument below still holds, but on the
> right invariant: the lock counts **parseable verdicts**. An inline annotation carries
> finding text and no `brain-review/N` block, so `parseVerdict` returns null on it and
> `cold-boot.mjs`'s `.filter(Boolean)` drops it. At most one payload the provider ACCEPTS may carry the
> verdict body — that is the contract, and it is satisfiable on both providers.
>
> GitLab therefore posts the **summary first**: when calls cannot be atomic, the verdict
> is the one that must already be safe if anything after it fails. GitHub attempts
> anchored and retries bare, which is the same rule from the other side.

### The original argument (D1 is why) — the anti-loop lock is untouched, and D1 is why

`poster.mjs` locks on `lastVerdict.author === reviewerHandle && lastVerdict.head_sha ===
headSha`, computed from `priorVerdicts` before any vcs call. Inline comments are
anchored to the same `headSha` and posted **in the same call** as the block that
`parse-verdict` reads. So they produce no second parseable verdict and no second
postable artifact — the lock sees exactly what it sees today.

This is the concrete reason D1 is not merely tidier: a fifth verb would post inline
comments in a separate call, creating an artifact the lock does not count and cannot
deduplicate. The anti-loop guarantee would then depend on ordering rather than on
structure.

## D6 — HUMAN DECISION: is `validateSchemaV2` wired, or is the deliverable restated?

The ticket's deliverable 3 reads *"`/2` schema: `file`/`line` on findings (+ validator
coverage in `schema-v2.mjs`)"*. Measured:

```
$ grep -rn "schema-v2\|validateFinding\|validateSchemaV2" --include=*.mjs brain/scripts \
    | grep -v "\.test\.mjs" | grep -v "^brain/scripts/review/lib/schema-v2.mjs"
brain/scripts/review/lib/causal-admission.mjs:3:// ... (a comment)
```

**The validator is exported and called nowhere in production.** Adding `file`/`line`
coverage to it satisfies the deliverable's letter and changes nothing that runs — the
exact "green in test, inert in production" class M10 exists to close, which makes
shipping it quietly the wrong answer.

Two honest options, and the choice is a scope decision:

- **(a) Wire it.** `buildVerdict` validates each finding and refuses (or downgrades) an
  invalid one. Real behaviour change, needs its own failure semantics — what does a
  verdict do when a finding is malformed? — and its own red-first evidence.
- **(b) Restate the deliverable.** `file`/`line` get renderer/parser round-trip coverage
  and the poster's own anchor validation; `schema-v2.mjs` stays as-is and its
  inertness is ticketed separately.

**Recommendation: (b) here, (a) as its own ticket.** Wiring a validator into the verdict
builder is a change to what brain refuses to post — that deserves a ticket where it is
the subject, not a line item inside a feature.

> **RULED (b) by the maintainer, 2026-08-06.** The deliverable is restated: `file`/`line`
> get renderer/parser round-trip coverage and the poster's own anchor validation
> (REQ-405-2/-3/-4); `schema-v2.mjs` is untouched by this change and its inertness is
> ticketed separately — **#483**, filed under this ruling rather than on agent authority
> (#473's addendum).

## D7 — red-proof plan

1. **Contract parity, both providers**: a finding with `file`/`line` produces an inline
   comment; the same finding without them produces none. Forced by
   `vcs.contract.test.mjs` so a provider cannot silently no-op.
2. **The fallback, per D3**: a comment targeting a line outside the diff must leave the
   summary posted — body re-sent BYTE-IDENTICAL, the findings already in it — with the
   count reported. Round 6 corrected "folded back into" in D3 and in the signed ADR and
   left this copy standing 110 lines further down in the same file (round 8, E2). There is
   no fold operation: the summary block is built before any anchor is derived. Proven by making
   the stub reject the inline payload — the failure path is the deliverable, not an edge
   case.
3. **Lock 2 stays structural**: mutating `comments` into the payload must not create a
   path where `event` is anything but `COMMENT`. Grep-level and test-level, **on every
   payload the verb sends**.
   Written correctly and satisfied incompletely twice, both blockers. The verb builds
   THREE `event`-carrying payloads — the ternary's two branches and the retry — where
   `main` built one. Round 8 found the retry uncovered (its fixture always succeeded);
   round 9 found the ternary's bare branch uncovered, which is the ONLY site a production
   run reaches, since no evaluator anchors. Neither level saw either: the grep finds no
   literal because a mutated `event` is a variable, and the behavioural case only exercised
   the paths its fixtures produced. The case now drives both call shapes — anchored (with
   the anchor refused, so the retry fires) and bare — and asserts across every payload.
4. **The anti-loop lock**: a run that posts inline comments must still skip on the
   second invocation at the same head.
5. **E2E on #409's harness** (`test/review-regulated/`), whose README already names this
   change: assert the captured `POST …/reviews` payload's `comments` array — the stub
   captures the full body verbatim. **The 'no harness change is needed' half was
   wrong** — REQ-405-8 records the falsification: no evaluator anchors, so a CLI run
   cannot produce the payload this line assumed, and the harness gained an
   inline-refusing mode (`GH_STUB_REJECT_INLINE`) to exercise the fallback against the
   real binary. Corrected here in round 2 of the cold review (E-6); the spec had
   carried the correction for two commits while the design still asserted the claim.

Every mutation's diff is printed before its run. Four substitutions silently failed to
match during PR #478 and produced meaningless greens; the discipline is load-bearing.
