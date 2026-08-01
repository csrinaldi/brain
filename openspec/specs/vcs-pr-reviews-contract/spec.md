### [issue-391] vcs-pr-reviews-contract — 2026-07-31

# `prReviews` VCS Contract Specification

## Purpose

Formalizes the `prReviews` verb of the VCS port (`brain/core/methodology/vcs-contract.md` row
34) as a stable, dual-provider contract. `prReviews` is the sole read path that recovers the
reviewer's own history: `cold-boot.mjs`'s `doctrine.priorVerdicts` is `prReviews(...)` mapped
through `parse-verdict.mjs`, and every downstream guarantee — the anti-loop lock
(`poster.mjs`'s `lastVerdict`), the `rev >= 3 -> STOP` bound, the protocol §8 prior-verdict
doctrine load, and board reconciliation (`board.mjs`) — is reconstructed from that one input.
Issue #317 found that both providers' normalizers silently dropped the field the whole chain
depends on (`body`), while every test stayed green on fixtures that injected `body` directly.
PR #383 (commit `f88b3f3`, merged to `main`) fixed both providers; this spec promotes that fix
to a formal, testable contract so it cannot silently regress again — including the specific
regression path already found on a parallel branch (see Non-Goals).

## Non-Goals

- This spec does not change `prReviews`'s behavior. Every requirement below cites code and
  tests already shipped on `main` (PR #383) — this is a specification-only slice.
- This spec does not cover the `brain-review/N` verdict schema itself (`evidence_class`,
  `causal_disposition`, `follow_ups`) — that is `brain/core/methodology/reviewer-protocol.md`
  §6, not this port-verb contract. This spec covers only the shape `prReviews` hands to
  `parse-verdict.mjs`, not what `parse-verdict.mjs` does with it.
- This spec does not adjudicate GitLab's approval-*count* enforcement (Premium
  approval-rules API) — `brainWritesReviewed`'s consumption of `state === 'APPROVED'` entries
  is out of scope; this spec only guarantees the *shape* `prReviews` normalizes to.

## Requirement Index

| Req | Name | Testable |
|---|---|---|
| REQ-PRREV-1 | GitHub shape: exactly `{ state, author, body }` | Unit (`node --test`) |
| REQ-PRREV-2 | `body` never `null`/`undefined` on a successful fetch | Unit (`node --test`) |
| REQ-PRREV-3 | Fetch failure yields `null`, never a fabricated `[]` | Unit (`node --test`) |
| REQ-PRREV-4 | GitLab dual-endpoint read: notes (verdict thread) + approvals (L6 roster) | Unit (`node --test`) |
| REQ-PRREV-5 | Security invariant: MR notes never normalize to `state: 'APPROVED'` | Unit (`node --test`) |
| REQ-PRREV-6 | GitLab all-or-nothing: either endpoint failing (or a malformed response) nulls the whole result | Unit (`node --test`) |
| REQ-PRREV-7 | GitLab system notes are dropped, never treated as reviewer speech | Unit (`node --test`) |
| REQ-PRREV-8 | Ordering: oldest-first on both providers | Unit + design citation |
| REQ-PRREV-9 | Pagination is load-bearing on both providers | Design citation + source assertion |
| REQ-PRREV-10 | Normalizer output is directly consumable by the real `parseVerdict` | Integration (`node --test`) |

---

### Requirement REQ-PRREV-1: GitHub Shape — Exactly `{ state, author, body }`

`github.mjs#prReviews({ project, number })` MUST call `gh api --paginate
repos/${project}/pulls/${number}/reviews` and normalize every entry to exactly the keys
`state`, `author`, `body` — no other key of the raw GitHub Reviews API response may leak
through. `state` MUST pass through the raw review state verbatim (`APPROVED`,
`CHANGES_REQUESTED`, `COMMENTED`, `DISMISSED`, `PENDING`). `author` MUST normalize from
`r.user?.login`, `null` when absent.

[**unit-testable**: `Object.keys(entry).sort()` must equal `['author', 'body', 'state']` for
every entry in the happy fixture (`github-prReviews-happy.json`) — a narrowed shape (e.g.
missing `body`) is the exact #317 defect.]

#### Scenario: Happy fixture normalizes to exactly `{ state, author, body }`

- GIVEN a successful `gh api --paginate .../reviews` call
- WHEN `prReviews({ project, number })` is called
- THEN every returned entry has exactly the keys `state`, `author`, `body`
- AND at least 2 entries are exercised (`github-prReviews-happy.json`)

---

### Requirement REQ-PRREV-2: `body` Never `null`/`undefined` on a Successful Fetch

`body` MUST follow the same uncomputable-vs-empty discipline as `prView.body` (issue #239 A3
task 3.7): `r.body ?? ''` — a review with no comment normalizes to `''`, never `null` or
`undefined`. `null` is reserved exclusively for signalling "the whole `prReviews` call
failed" (REQ-PRREV-3); it MUST NOT appear as a per-entry `body` value.

[**unit-testable**: `typeof entry.body === 'string'` for every entry in the happy fixture —
`parse-verdict.mjs:36` rejects a non-string body outright, so a `null`/`undefined` leak here
would silently empty `priorVerdicts` again, reproducing #317 under a passing type check.]

#### Scenario: A review with no comment still yields a string body

- GIVEN a raw review entry whose `body` field is absent or `null`
- WHEN `prReviews` normalizes it
- THEN the resulting entry's `body` is `''` (empty string), never `null`/`undefined`

---

### Requirement REQ-PRREV-3: Fetch Failure Yields `null`, Never a Fabricated `[]`

On any transport failure (non-zero exit from `gh api`, or a rejected GitLab fetch), `prReviews`
MUST return `null` on both providers — never throw, never return `[]`. Callers (the L6
`brain-writes-reviewed` DETECTION gate, `cold-boot`'s doctrine load) rely on `null` vs. `[]` to
distinguish "couldn't fetch" (fail-closed / uncomputable) from "genuinely zero reviews".

[**unit-testable**: `github-prReviews-failure.json` / `gitlab-prReviews-failure.json` — forced
failure fixtures assert `result === null`.]

#### Scenario: A transport failure returns null, not an empty array

- GIVEN `gh api` exits non-zero, or a GitLab fetch is rejected
- WHEN `prReviews({ project, number, ... })` is called
- THEN the return value is `null`
- AND it is NOT `[]`

---

### Requirement REQ-PRREV-4: GitLab Dual-Endpoint Read — Notes (Verdict Thread) + Approvals (L6 Roster)

`gitlab.mjs#prReviews` MUST read **two** endpoints and merge their results into one array:

1. `GET projects/:id/merge_requests/:iid/notes?order_by=created_at&sort=asc&per_page=100`
   (paginated, REQ-PRREV-9) — the verdict thread. Non-system notes (REQ-PRREV-7) normalize to
   `{ state: 'COMMENTED', author: n.author?.username ?? null, body: n.body ?? '' }`.
2. `GET projects/:id/merge_requests/:iid/approvals` — the L6 approver roster. Each
   `approved_by[]` entry normalizes to `{ state: 'APPROVED', author: a.user?.username ?? null,
   body: '' }`.

The merged result MUST be `[...commented, ...approved]` — approvals appended AFTER the
chronological notes, never interleaved (the approvals endpoint exposes no per-approver
timestamp, so interleaving would fabricate an ordering that does not exist).

GitLab has no per-reviewer review-state history analogous to GitHub's Reviews API
(`APPROVED`/`CHANGES_REQUESTED`/`COMMENTED`); this two-endpoint read is the closest structural
analog, and is required because the verdict thread (notes) and the self-approval gate roster
(approvals) are two semantically distinct things GitHub's single Reviews API happens to
conflate into one endpoint.

[**unit-testable**: `gitlab-prReviews-happy.json`'s `data` is an object keyed `{ notes,
approvals }` — the only fixture in the suite shaped this way, because this is the only verb
reading two endpoints. `gitlab.prReviews (contract): source reads BOTH the notes and approvals
endpoints — neither half may be dropped` asserts the raw request bodies match both path
patterns.]

#### Scenario: Both endpoints' entries appear in the merged result

- GIVEN a notes response with a system note, a plain comment, and a verdict note
- AND an approvals response with one approver
- WHEN `prReviews` is called
- THEN the result contains the plain comment and verdict note as `COMMENTED` entries
- AND the approver as one `APPROVED` entry
- AND the `APPROVED` entry appears after all `COMMENTED` entries in array order

---

### Requirement REQ-PRREV-5: Security Invariant — MR Notes Never Normalize to `APPROVED`

MR notes MUST always normalize to `state: 'COMMENTED'`. No code path may map a note (a plain
comment or a verdict block posted as a comment, per ADR-0020 COMMENT-only reviewer posting)
to `state: 'APPROVED'`. Only the approvals endpoint's `approved_by[]` entries may produce
`state: 'APPROVED'`.

This is a security boundary, not a normalization nicety: the L6 `brain-writes-reviewed` gate
counts only `state === 'APPROVED'` entries as approvers. If a note could normalize to
`APPROVED`, any actor who can post an MR comment could clear the self-approval gate without
ever using GitLab's actual approval mechanism.

[**unit-testable**: `gitlab.prReviews (contract): MR notes normalize to COMMENTED and NEVER to
APPROVED — only the approvals endpoint may produce an approver` — asserts the one `APPROVED`
entry's author matches only the approvals-endpoint approver, and that every note author
(including the reviewer's own verdict note) appears exclusively under `COMMENTED`.]

#### Scenario: A reviewer's own verdict note cannot self-approve

- GIVEN a note thread where the reviewer posts a `brain-review/N` verdict block as a comment
- WHEN `prReviews` normalizes the thread
- THEN the reviewer's entry has `state: 'COMMENTED'`
- AND no entry derived from a note has `state: 'APPROVED'`

---

### Requirement REQ-PRREV-6: GitLab All-or-Nothing — Either Endpoint Failing Nulls the Whole Result

If either the notes fetch or the approvals fetch fails (rejects, or the notes endpoint
returns a non-array body — a malformed-200 case), `prReviews` MUST return `null` for the
**whole** call. It MUST NOT return a partial result (e.g. notes-only when approvals fails, or
vice versa).

Returning notes-only on an approvals failure would hand the L6 gate an empty approver set
indistinguishable from a genuine "nobody approved" — a fail-open on the security gate.
Returning approvals-only on a notes failure would silently empty the verdict thread, the exact
#317 symptom, under a call that "succeeded".

[**unit-testable**: three failure-mode fixtures/tests — `gitlab-prReviews-failure.json`
(one endpoint rejects), `gitlab-prReviews-malformed.json` (notes endpoint returns 200 with a
non-array body), and the paired tests `an approvals failure yields null even when notes
succeed` / `a notes failure yields null even when approvals succeed`.]

#### Scenario: An approvals-endpoint failure nulls the result even when notes succeeded

- GIVEN the notes fetch succeeds
- AND the approvals fetch fails
- WHEN `prReviews` is called
- THEN the result is `null`, not a notes-only array

#### Scenario: A notes-endpoint failure nulls the result even when approvals succeeded

- GIVEN the notes fetch fails or returns a malformed (non-array) body
- AND the approvals fetch succeeds
- WHEN `prReviews` is called
- THEN the result is `null`, not an approvals-only array

---

### Requirement REQ-PRREV-7: GitLab System Notes Are Dropped

Notes with `system === true` (GitLab's own activity records — "changed title from X to Y",
"assigned to @z") MUST be filtered out before normalization. They are never reviewer speech
and can never carry a `brain-review/N` verdict block.

[**unit-testable**: `gitlab-prReviews-happy.json`'s note list includes one `system: true`
entry; the happy-fixture test's author-set assertions only check for the two non-system
authors, and the merged-result cardinality assertions implicitly exclude the system note.]

#### Scenario: A system note never appears in the normalized result

- GIVEN a notes response containing one `system: true` entry and two `system: false` entries
- WHEN `prReviews` normalizes the notes
- THEN only the two non-system entries appear in the result

---

### Requirement REQ-PRREV-8: Ordering — Oldest-First on Both Providers

`prReviews` MUST return entries oldest-first on both providers. This is load-bearing:
`poster.mjs` and `board.mjs` both take the **last** parsed verdict in the array as the
current one; a newest-first order would silently invert which verdict is treated as current.

- **GitHub**: relies on the Reviews API's native response order (submission order,
  oldest-first) — no explicit sort is performed in `github.mjs`.
- **GitLab**: explicit `sort=asc&order_by=created_at` on the notes request, because GitLab's
  notes endpoint defaults to newest-first — the ordering is enforced in the query string, not
  assumed.

Approvals are appended after the chronological notes (REQ-PRREV-4) rather than interleaved by
timestamp, because the approvals endpoint exposes no per-approver `created_at`. This is safe
for "last verdict wins" readers because an approval's `body` is `''`, which `parseVerdict`
rejects outright — an approval entry can never be mistaken for, or displace, the latest real
verdict.

#### Scenario: The reviewer's most recent verdict note is the last entry

- GIVEN a GitLab notes thread with three verdict notes posted in chronological order
- WHEN `prReviews` normalizes the thread
- THEN the three verdict entries appear in the same chronological order in the result
- AND any approval entries appear after all note entries, not interleaved

---

### Requirement REQ-PRREV-9: Pagination Is Load-Bearing on Both Providers

- **GitHub**: `gh api --paginate` MUST be used verbatim. `gh api` does not auto-paginate; a
  long-lived PR with many re-review cycles can exceed one page, and an unpaginated fetch can
  silently drop the one human `APPROVED` review that would flip a self-approval verdict.
- **GitLab**: the notes fetch MUST page through `per_page=100`, incrementing `page` until a
  short page is returned. With `sort=asc`, page 1 holds the *oldest* notes — an unpaginated
  fetch would drop the **latest** verdict, precisely the fail-open the anti-loop lock exists to
  prevent.

[**unit-testable**: the malformed-response and multi-page behavior are covered by the
contract test's spawn/fetch call assertions (`gitlabPrReviewsCallArgs` URL-dispatch glue) —
no live pagination is exercised in the fixture suite (deferred to CP-A3b/SCIT live smoke), but
the request construction is asserted to include the pagination parameters.]

#### Scenario: A long verdict thread's request includes pagination parameters

- GIVEN `prReviews` constructs its notes request
- WHEN inspecting the request path/arguments
- THEN GitHub's call includes `--paginate`
- AND GitLab's call includes `per_page=100` and increments `page` on a full page

---

### Requirement REQ-PRREV-10: Normalizer Output Is Directly Consumable by the Real `parseVerdict`

The array `prReviews` returns MUST be directly mappable through the real
`parse-verdict.mjs#parseVerdict` (not a re-implementation or a hand-constructed stand-in) to
recover at least one non-null `priorVerdicts` entry, exactly as `cold-boot.mjs:116` does:
`reviews.map(r => parseVerdict(r)).filter(Boolean)`. This is the end-to-end assertion that
closes #317: a shape that merely "looks right" but fails to parse would leave
`priorVerdicts` empty in production regardless of how correct the shape assertions above look
in isolation.

[**unit-testable**: `${providerName}.prReviews (contract): the REAL normalizer output parses
into a verdict via the REAL parseVerdict — priorVerdicts is no longer always empty` — feeds
the happy fixture's normalized output through the production `parseVerdict` import and asserts
a non-empty `priorVerdicts`, with the latest entry carrying a defined `author`.]

#### Scenario: The happy fixture's output round-trips through the real parser

- GIVEN the happy-fixture normalized `prReviews` output
- WHEN each entry is passed through the real `parseVerdict`
- THEN at least one entry parses into a non-null verdict
- AND the latest parsed verdict has a defined `author`

---

## Evidence

- PR #383 (`fix(vcs): prReviews carries the verdict body — revives anti-loop, rev-bound,
  doctrine load and board`), commit `f88b3f3a20a55dafd8290af8f190f1bfeb8ef1a2`, merged to
  `main` 2026-07-31.
- `brain/scripts/vcs/providers/github.mjs` — `prReviews` (`main` lines ~266-307).
- `brain/scripts/vcs/providers/gitlab.mjs` — `prReviews` (`main` lines ~242-350).
- `brain/scripts/vcs/providers/vcs.contract.test.mjs` — the `prReviews` contract block
  (lines ~562-651) and the GitLab-specific security/all-or-nothing/source-scan tests
  (lines ~1483-1642).
- `brain/scripts/vcs/fixtures/{github,gitlab}-prReviews-{happy,failure}.json`,
  `gitlab-prReviews-malformed.json`.
- `brain/core/methodology/vcs-contract.md` row 34 — already updated by PR #383 to describe the
  `body`/dual-endpoint shape in prose; this spec formalizes that same shape as a testable
  contract with requirement IDs and scenarios rather than restating it.
- Known drift risk this spec exists to close: `feature/m10-seam-contract-coverage`'s
  `vcs.contract.test.mjs:217-233` (as of the M10 Phase 2 slice that introduced it) locks the
  **pre-#383** shape (`Object.keys(entry).sort()` must equal exactly `['author', 'state']`,
  with a comment stating a `body` key "must fail this lock"). That branch's contract test
  must be corrected to match REQ-PRREV-1 before merging main, or it will reintroduce the #317
  regression under a passing test suite.
