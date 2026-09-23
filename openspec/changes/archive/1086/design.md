# Design: Audit PR resolution from the merge commit (#1086)

## Technical Approach

Three layers, bottom-up, each testable without the next.

1. **The provider tells absent from unreadable.** `prView` gains one additive field, and a
   shared predicate decides it from the provider's own words.
2. **A new port verb answers "which pull requests contain this commit"**, with
   `issueRelations`' null-versus-empty discipline (`github.mjs:194-197`).
3. **`fetchPrMeta` (`merge-walk.mjs:298`) owns the dispatch.** A merge resolved by commit sha
   is then read through the SAME `prView` call the subject path uses
   (`merge-walk.mjs:307-310`), so no second evidence shape exists.

The gate is structural: the lookup is reachable only from a definitive absence, so a
transport failure cannot arrive at it by any path.

## Architecture Decisions

| # | Decision | Rejected | Rationale |
|---|---|---|---|
| D1 | **The absent signal.** `prView` returns an additive `absent: boolean\|null` — `false` on success, `true` on a definitive negative, `null` on any other failure. `labels`/`body` stay `null` in BOTH failure cases (`github.mjs:409,426`; `gitlab.mjs:310-312`), so the REQ-CIC-2 sentinel is untouched and any consumer that does not read `absent` behaves exactly as today. | A separate `prExists` verb; throwing on 404 | A second verb doubles the round-trips and the call-site count; throwing breaks `prView`'s never-throws contract (`vcs-contract.md:35`), which six call sites rely on. |
| D2 | **How `absent` is decided.** `uncomputable-cause.mjs` gains `isNotFound(text)` = `classifyUncomputableCause(text) === NOT_FOUND` (`uncomputable-cause.mjs:109-120`). GitHub passes `r.stderr` from the failed `gh pr view` (`github.mjs:408`); GitLab passes `err.message` from `gitlabApiFetch` (`gitlab.mjs:310`). `NOT_FOUND_RE` (`:69`) already matches both `could not resolve to a` and `HTTP 404`. The JSON-parse catch (`github.mjs:425`) yields `absent: null` — a malformed response is not a negative. | A provider-local regex or stderr literal | The module is the single constructor of failure vocabulary (`uncomputable-cause.mjs:3-8`); a provider-local string would be a second classifier, and `classifyUncomputableCause`'s ordering already puts auth words ahead of 404 so a masked-private-repo 404 is NOT read as absent. Its header sentence "import ONLY `uncomputable()`/`isUncomputable()`" gains `isNotFound` in the same commit. Mis-classification stays safe: an unreachable project cannot return a containing-PR list either, so the merge lands on uncomputable anyway. |
| D3 | **The new verb: `commitPrs({ project, sha }) -> Promise<number[]\|null>`**, ascending, never throws. GitHub: `gh api --paginate repos/{project}/commits/{sha}/pulls` → `r.number` (walks every page automatically). GitLab: `GET projects/:enc/repository/commits/:sha/merge_requests?per_page=100` over `gitlabApiFetch` → `r.iid`, read as a single page — deliberately asymmetric, because `gitlabApiFetch` has no pagination loop of its own; a full page (100) is refused (`null`) rather than risked as a possibly-truncated list, mirroring `mrList`'s full-page guard (#930/#936) except by returning `null` instead of throwing, since `commitPrs` never throws. `[]` = definitively none; `null` = unreadable (a full page counts as unreadable, not "exactly one" or "none"). | `prsForCommit`; returning full PR objects; widening `mrList` with a `sha` filter; GitLab pagination loop matching GitHub's `--paginate` | `commitPrs` mirrors `commitStatus({project, sha})` (`vcs-contract.md:40`), the only other commit-keyed verb. Numbers only, because the caller re-enters `prView` and every downstream field stays on one path. Widening `mrList` would keep the drift guard green (D7) but forces the caller to absorb `mrList`'s pinned THROW (`vcs-contract.md:29`) and overloads a state-filtered list verb with a containment query. A GitLab pagination loop was deferred (cold-review remediation, #1086) in favor of the fail-closed `per_page=100` + full-page-refusal shape, matching the existing `mrList` precedent rather than introducing a new multi-page transport pattern for one verb. |
| D4 | **The dispatch lives in `fetchPrMeta`, not `brain-audit.mjs`.** Signature widens to `fetchPrMeta(subject, vcs, config, sha)` — a fourth positional, not an options object. | Putting the fallback in `brain-audit.mjs:321-340` | `merge-walk.mjs` is the EVIDENCE layer both CLIs share (`merge-walk.mjs:17`); a fallback in `brain-audit.mjs` alone would make `brain:metrics` report uncomputable for merges enforcement evaluated — the measurement/enforcement divergence the extraction exists to prevent (`brain-metrics.mjs:474-482`). The positional argument leaves #474's REQ-TS pins (`merge-walk.test.mjs:187-258`) byte-identical, so they keep proving what they proved. |
| D5 | **Two additive return fields, no new enum.** `subjectRef` (what `parsePrNumber` saw) and `prSource` (`'subject'\|'commit-sha'\|null`). On the legacy unreadable path `prNum` stays `subjectRef` exactly as today; on the ambiguous/unresolvable paths `prNum` is `null`. So `prMetaError !== null && prNum !== null` IS the legacy case and needs no third field. | A `prMetaCause` enum | Two fields already make every branch decidable, and `brain-audit.mjs:369`'s `prResolved` expression needs no edit. |
| D6 | **Emission: suffixes, never a new tag.** `[UNCOMPUTABLE]` keeps `— PR #N metadata unreachable: …` byte-identical when `prNum !== null` (`brain-audit.mjs:338`), and prints `— <prMetaError>` when `prNum === null`, the message naming the subject's number and the cause. `[PASS]`/`[FAIL]` gain a bracketed suffix in the style of ` [size:exception]` (`brain-audit.mjs:376`): ` [pr #991 by commit-sha; (#978) is not a pull request]`, or ` [(#978) is not a pull request; no pull request contains this merge — commit body audited]` when `subjectRef !== null && prNum === null && prMetaError === null`. | A new `[RESOLVED-BY-SHA]` tag | The tag vocabulary is parsed by operators and documented at `brain-audit.mjs:24-29`; a suffix adds information without teaching anyone a new line shape. **No i18n keys**: `brain-audit.mjs` imports no catalog (its output is plain English by construction), unlike the lane sweep's `day.memory.*` keys. |
| D7 | **The `vcs-contract.md` row is a BLOCKING Tier 2 dependency.** `verb-contract-drift-guard.test.mjs:120-131` fails when both providers export a function absent from `cli.mjs` `VERBS` (`cli.mjs:47-48`), and `:82-91` fails when a `VERBS` entry has no row in the Required Verbs table. The row is drafted at `brain-drafts/vcs-contract-commitprs-row.md`; the maintainer lands it in `brain/core/methodology/vcs-contract.md` inside this PR. | Adding `commitPrs` to `DOCUMENTED_BUT_NOT_REQUIRED` (`:33`) to keep CI green | That set means "a probe, not part of the base contract"; `commitPrs` is required on both providers. A temporary allowlist entry is precisely the shape `harness-contract.md` calls "a doctrine row that reads as if the problem were solved". |
| D8 | **#996 is corrected by a TASK, not an ADR and not a doctrine edit.** The task drafts a comment for #996 stating that the `(#978)` merges are not an outage, that re-running can never clear them, and that #1086 fixes the evaluator; posting it is a forge write under the session's standing authorization. | An ADR amendment; silently closing #996 | The wrong advice lives on the forge, so the correction must live where a reader of #996 will meet it. No decision is being changed — #996 recorded a misdiagnosis, and `decision-gate` (`workflow-governance.md`) would demand a `brain/HOME.md` entry for an ADR that has no new decision behind it. |

## Data Flow

```
subject ──parsePrNumber──► subjectRef
   │                          │ null → today's no-PR path (commit body)
   └──► prView(subjectRef) ───┤
            │                 ├─ ok ──────────────► audit it        (prSource='subject')
            ├─ absent:null/false (labels+body null) ► UNCOMPUTABLE  (lookup NOT reached)
            └─ absent:true ──► commitPrs({project, sha})
                                  ├─ null / verb missing ► UNCOMPUTABLE
                                  ├─ []      ► commit body           (prSource=null)
                                  ├─ [n]     ► prView(n) ─► audit    (prSource='commit-sha')
                                  └─ [n,m,…] ► UNCOMPUTABLE (never a guess)
```

`prView(n)` is a one-level re-read through a local `readPr(number)` helper, never recursion:
if it comes back null/null the merge is uncomputable, with no third attempt.

## File Changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/vcs/lib/uncomputable-cause.mjs` | Modify | Export `isNotFound`; header sentence updated |
| `brain/scripts/vcs/providers/github.mjs` | Modify | `prView` `absent` (`:407-428`); `commitPrs` |
| `brain/scripts/vcs/providers/gitlab.mjs` | Modify | Same (`prView` `:292-313`) |
| `brain/scripts/vcs/cli.mjs` | Modify | `VERBS` gains `commitPrs` (`:47-48`) |
| `brain/scripts/lib/merge-walk.mjs` | Modify | `fetchPrMeta` dispatch + doc comment (`:256-370`) |
| `brain/scripts/brain-audit.mjs` | Modify | Pass `sha`; emission branches (`:321-340`, `:375-390`) |
| `brain/scripts/brain-metrics.mjs` | Modify | Pass `sha` (`:472`); correct the `:135` comment |
| `brain/scripts/vcs/fixtures/{github,gitlab}-commitPrs-{happy,empty,failure}.json` | Create | `derived` provenance where unrecordable |
| `brain/scripts/vcs/fixtures/{github,gitlab}-prView-notfound.json` | Create | The definitive-negative case |
| `brain/scripts/vcs/fixtures/record-fixtures.mjs` | Modify | A recorder for `commitPrs` |
| `openspec/changes/issue-1086-.../brain-drafts/vcs-contract-commitprs-row.md` | Create | Tier 2 draft (D7) |
| `brain/core/methodology/vcs-contract.md` | Modify (human) | The `commitPrs` row + `prView`'s `absent` sentence |

## Blast Radius

**`prView` consumers**, all additive-safe — none reads `absent`, and none of their fields
change: `merge-walk.mjs:307`, `ci-context.mjs:63,70`, `review/cold-boot.mjs:29,158`,
`review/queue.mjs:55`, `governance/relabel-retrigger.mjs:88`, `status/cli.mjs:157`. The one
test that pins the whole failure shape by `deepEqual` is `vcs.contract.test.mjs:265` and must
gain the field. `actor-check.test.mjs:2178` asserts `actor-check.mjs` never calls `prView` —
untouched.

**`brain:metrics`.** Sharing the fix is the point (D4), but the `Uncomputable` column changes
retroactively: merges like the four `(#978)` ones move out of it into real verdicts, so a
report over a window containing them is not comparable to one produced before this change.
`brain-metrics.mjs`'s failure policy (count visibly, exit 0) is unchanged.

**`writes-governed`.** The no-containing-PR branch yields `prNum === null`, so
`brain-audit.mjs:369`'s `prResolved` is `false` and the check abstains
(`writes-governed.mjs:59-62`) — the same answer a subject with no PR reference gets today,
never a fabricated "reviewed by nobody".

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit | `isNotFound` over the `uncomputable-cause.test.mjs` corpus, including that auth text beats a 404 | Extend the existing corpus table |
| Unit | Every dispatch row of the spec table, from a fake port | `merge-walk.test.mjs`, alongside the untouched #474 pins |
| Unit | **Fail-closed proof**: `prView` returns `{labels:null, body:null, absent:null}` and a `commitPrs` spy asserts call count `0`, while `prMetaError` is set | `merge-walk.test.mjs` — the test binding decision 4 demands |
| Unit | **Regression pin on the real shape**: subject `feat(setup): add conditional Codex readiness and routing (#978)`, `prView(978)` absent, `commitPrs('d4cb7f8…') → [991]`, `prView(991)` carrying `Closes #978` → a real verdict, `prSource === 'commit-sha'` | `merge-walk.test.mjs` + `brain-audit.test.mjs` emission assertion |
| Unit | Emission: the legacy unreadable line is byte-identical; the ambiguous line names both PRs; the two suffixes render | `brain-audit.test.mjs`, capturing stdout from the pure emission path — no entrypoint spawn, no real `.git` |
| Contract | `commitPrs` happy/empty/failure on both providers; `prView` reports `absent:true` on the not-found fixture and `absent:null` on the generic failure fixture | `vcs.contract.test.mjs` fixture glue (`:75-90`), provenance asserted (`:57-66`) |
| Drift guard | `commitPrs` present in `VERBS`, in the Required Verbs table, and exported by both providers | `verb-contract-drift-guard.test.mjs` — red until D7's row lands, and that is the signal, not a defect |

Strict TDD: RED first on the regression pin, which must fail with today's `[UNCOMPUTABLE]`
before any provider code exists.

## Review Workload Forecast

Excludes `**/*.test.mjs`, `.memory/**`, `openspec/**`, `AGENTS.md`. Estimates:
`uncomputable-cause.mjs` ~12, `github.mjs` ~45, `gitlab.mjs` ~45, `cli.mjs` ~1,
`merge-walk.mjs` ~90, `brain-audit.mjs` ~35, `brain-metrics.mjs` ~5, fixtures ~80,
`record-fixtures.mjs` ~25, `vcs-contract.md` ~3. **Total ≈ 340 lines.**

- Size: within the tier-lite budget of 1000; no `size:exception` needed.
- 400-line budget risk: Medium — the fixtures are the volatile term.
- Chained PRs recommended: No. An optional split is slice 1 = D1–D3 plus fixtures (~210) and
  slice 2 = D4–D6 (~130).
- Decision needed before apply: No.

## Migration / Rollout

No migration. The first `brain:audit` run after merge re-evaluates the whole window; the
`v1.6.0` release job is re-run by hand once the PR lands. `governance.auditBaseline` stays at
`v1.0.0` (ADR-0025).

## Invariants

- No write under `brain/core/**` or `brain/project/**` by an agent; D7's row is human-landed
  from `brain-drafts/`.
- The exit-code ladder, `parsePrNumber`'s grammar and every governance check's semantics are
  untouched.
- No test reads or writes the real repository's `.git`, and none spawns an entrypoint.

## Open Questions

- The exact stderr/error text GitHub and GitLab emit for a not-a-pull-request number is
  classified through `NOT_FOUND_RE`, which already covers both observed spellings; the
  apply phase must confirm the live text once and pin it in a `derived` fixture rather than
  trusting this design's reading.
- Whether `[LANE]` lines should also carry D6's suffix. Proposed: no — a lane merge's verdict
  does not depend on the pull request — to be confirmed at apply.
