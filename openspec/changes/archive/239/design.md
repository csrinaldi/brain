# Design — GitLab Provider Verbs + Provider-Agnostic labelEvents (slice A3)

Close the two seams A2 left standing as documented debt: the `m3` `gh`-hardcoded actor-check fetch and the
`prView`/`mrCreate` GitLab stubs. Do it by adding a provider-agnostic `labelEvents` CONTRACT verb and a
shared contract suite fed by recorded-from-real fixtures — reusing the A2 machinery (`gitlabApiFetch`,
`gitlabApiConfig`, runtime `getVcs({ provider })` dispatch), never rebuilding it. Pure evaluators stay
untouched (ADR-0016 boundary). All artifacts English (ADR-0009).

## Decision 1 — `labelEvents` CONTRACT verb, dispatched on runtime `ctx.provider`

Add `labelEvents` to the contract (`cli.mjs:19-23` `VERBS` + `vcs-contract.md:22-34`). Signature:
`({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ actor: { login },
action: 'add'|'remove', label, at }> | null>`. BOTH providers implement it:

- **GitHub** wraps the Events API (`issues/N/events`): `event === 'labeled'` → `action: 'add'`,
  `event === 'unlabeled'` → `action: 'remove'`; `actor.login` → `actor.login`; `label.name` → `label`;
  `created_at` → `at`.
- **GitLab** wraps `GET /projects/:id/issues/:iid/resource_label_events`: `action` (`'add'|'remove'`) is
  native; `user.username` → `actor.login`; `label.name` → `label`; `created_at` → `at`.

The verb MUST return events chronologically ASCENDING so the pure `evaluateActor`'s "last element = most
recent labeled event wins" invariant (`actor-check.mjs:81`) holds identically on both platforms — the
GitHub Events API and GitLab resource-label-events both return ascending by time, but the verb makes the
guarantee explicit (sort by `at` if a provider ever changes). `null` = uncomputable (fetch threw), never a
fabricated `[]`.

`actor-check.mjs` dispatches on `ctx.provider` via `getVcs({ provider: ctx.provider })` — the EXACT
finding-#14 pattern `run-check.mjs#defaultFetchIssue` already uses (`run-check.mjs:167-177`): a GitLab MR's
referenced issue lives on GitLab even when this repo's own config says `github`. The pure `evaluateActor`
(`:65-109`) is UNCHANGED (REQ-L5-1 both-authors check `:97`, REQ-L5-2 empty→warn `:72`). `filterLabeledEvents`
(`:157-159`) becomes a SHARED post-filter keeping `action === 'add' && label === approvedLabel` over the
normalized events of EITHER provider — ONE filter, two providers, applied AFTER the verb normalizes.

**Alternatives considered:** (a) name the verb `resourceLabelEvents` — REJECTED (R1): that leaks GitLab's
endpoint name into a provider-agnostic contract; the verb is a CONTRACT concept (`labelEvents`), the
endpoint is an implementation detail. (b) keep the fetch inline in `actor-check.mjs` and only branch on
provider there — REJECTED: that duplicates transport logic in a gate wrapper instead of the provider layer
where the contract suite can test it uniformly; the verb belongs next to `issueView`.

## Decision 2 — GitHub `labelEvents` STAYS on the `gh` CLI; only GitLab goes direct-API (RULED)

The A2 `m3` finding is a GitLab-runner-lacks-`gh` problem, NOT a `gh`-is-broken problem. GitHub Actions
ships the `gh` CLI; the Events API call works there. Migrating GitHub's `labelEvents` to a direct API call
would require a `githubApiFetch` transport that DOES NOT EXIST (there is only `gitlabApiFetch`), inventing
new surface to solve a problem GitHub does not have — scope creep that conflates two different risk classes.

**Decision (human-flagged, ruled):** GitHub's inline events fetch (`actor-check.mjs:161-175`) is EXTRACTED
into `github.mjs#labelEvents` behavior-preserving — same `gh api --paginate` call, same filtering — and
`actor-check.mjs` calls the verb. The extraction's proof is that `actor-check.test.mjs` re-runs green with
NO assertion change. The load-bearing `--paginate` (unpaginated drops page-2+ events on a busy issue =
fail-open) is preserved verbatim, and GitHub keeps its parity row in the contract suite.

The CLI-free doctrine (deliverable 3) targets CLIs that BREAK in their CI — `glab` is absent from the
node:22 GitLab image (A2 finding #12), so the CI-consumed GitLab verbs go direct-API. `gh`-in-Actions is
explicitly documented as ACCEPTABLE: it is present and working in the platform that hosts it. The two verbs
are asymmetric by design, and that asymmetry is honest, not an oversight.

**Alternatives considered:** migrate GitHub to a new `githubApiFetch` for symmetry — REJECTED: symmetry for
its own sake invents an unused transport and enlarges the diff to solve a non-problem; the risk classes
(`gh`-works-in-Actions vs `glab`-absent-in-CI) are genuinely different and the code should say so.

## Decision 3 — DETECTION-class honesty: the actor-check now EVALUATES on GitLab, still never blocks (R3)

Pre-A3, the GitLab actor-check degraded to a permanent `warn` (no `gh` → throw → catch → warn). That was
SAFE but not DETECTION: it could never find a self-approval. A3 makes it EVALUATE — compute the correct
verdict from real GitLab label history. A GitLab self-approval (issue author adds `status::approved` to
their own referenced issue) now returns `fail`, the SAME verdict GitHub produces for the same shape
(REQ-L5-1 checks BOTH the PR author and the issue author, `:97`).

**The gate CLASS is unchanged:** actor-check stays DETECTION / `allow_failure: true` on both platforms
(A2 Decision 3). "EVALUATES" means it computes and REPORTS the verdict (visible red on `fail`); it does NOT
mean it blocks. A `fail` is surfaced, never merge-blocking. This distinction is load-bearing in the wording:
no artifact, comment, or reason string may say the actor-check "blocks" — it DETECTS and REPORTS. Missing
evidence (`labelEvents` → `null` or empty add-filtered list) still yields `warn`, never a fail-closed
(REQ-L5-2), preserving the A2 degrade contract for the genuinely-uncomputable case.

## Decision 4 — Fixture provenance: a committed recording script, recorded-vs-DERIVED always visible (R2, D4)

A COMMITTED recording script hits the real APIs ONCE — GitLab against the live mirror, GitHub against this
repo — and writes each raw JSON response into a fixtures directory, STAMPED with its source `endpoint + date`.
The contract suite's injected `fetchImpl` reads these files, so `npm test` never touches the live network
(the A2 no-live-network discipline, design Decision 2 there). Cases that CANNOT be recorded from a real API
— a fabricated self-approval that does not exist on any real issue, a forced-failure response — are marked
`DERIVED` (synthetic). Recorded-vs-derived is ALWAYS visible in the fixture set: a reader can tell at a
glance which bytes came from a real server on a real date and which were authored to exercise an edge case
(lesson #12 — provenance is never ambiguous; a fixture that silently blends real and synthetic is a trap).

**Alternatives considered:** (a) hand-write all fixtures — REJECTED: hand-written "GitLab" JSON drifts from
the real API shape (a wrong field name passes a green test and fails in production); recording locks the
shape to reality. (b) record but do not mark synthetic cases — REJECTED: an unmarked synthetic fixture reads
as authoritative and misleads the next author about what the real API returns.

## Decision 5 — One shared parameterized contract suite; parity = same assertions (D3)

A single shared, parameterized spec asserts the SAME contract over BOTH providers for `labelEvents`,
`prView`, `mrCreate`: normalized shapes, `null`-on-uncomputable, ascending ordering, never-throws. Parity is
IDENTICAL assertions parameterized over `['github', 'gitlab']` — not two divergent files that drift. The
existing `providers.test.mjs` is provider-specific (per-provider behavior); the NEW suite is contract-level
(cross-provider parity) and lives alongside it. `mrCreate`/`prView` for GitLab are exercised here over
`gitlabApiFetch` with the recorded fixtures.

**Alternatives considered:** extend `providers.test.mjs` per provider — REJECTED: that re-encodes the same
assertions twice and lets them diverge; the whole point of a CONTRACT is one assertion set proving parity.

## Decision 6 — Unify the contract in all THREE places (in-scope, not optional)

Adding `labelEvents` requires unifying the three sources that currently disagree (they were already stale
before A3): (1) `vcs-contract.md:22-34` (the table — also missing `prView`/`issueView` rows the Phase-3
status block `:65-73` half-tracks), (2) `cli.mjs:19-23` `VERBS`, (3) the actual provider exports. A3 adds
`labelEvents` to all three AND reconciles the stale `prView`/`issueView`/`mrCreate` rows so the contract doc
finally matches the exports. This is IN SCOPE — leaving the doc stale while adding a verb compounds the
drift.

**`brain/core/` L6 boundary:** `vcs-contract.md` lives under `brain/core/methodology/`, so editing it
engages the L6 `brain-writes-reviewed` gate (human review of the merge, distinct from author). This is the
FIFTH slice to touch a `brain/core/` file under that gate (after #215 C1b, #223 C2b-1, #229 C4, #231 A2) —
expected PASS+warn, the established path, no new ceremony. Called out in tasks.md.

## Data flow

    actor-check (GitLab runner, no gh)  ─▶  getVcs({ provider: ctx.provider })  ─▶  gitlab.labelEvents
                                                                                        │
                                            gitlabApiConfig() ─▶ { apiBase, token, proxyUrl }  (sole env reader)
                                                                                        ▼
                                            gitlabApiFetch  ─▶  GET .../issues/:iid/resource_label_events
                                                                                        │  normalize
                                                                                        ▼
                                    filterLabeledEvents (shared, action==='add' && label===approvedLabel)
                                                                                        │
                                                                                        ▼
                                            evaluateActor (UNCHANGED)  ─▶  pass | warn | fail
                                                                                        │
                                            DETECTION / allow_failure:true  ─▶  REPORTS (visible), never blocks

## File changes

| File | Action | Description |
|------|--------|-------------|
| `brain/scripts/vcs/providers/github.mjs` | Modify | Add `labelEvents` verb — the EXTRACTED inline Events-API fetch (`gh api --paginate issues/N/events`), normalized to the shared shape; behavior-preserving |
| `brain/scripts/vcs/providers/gitlab.mjs` | Modify | Add `labelEvents` over `gitlabApiFetch` (`resource_label_events`); un-stub `prView` (`:79-82`) and `mrCreate` (`:221-224`) as real direct-API verbs, config threaded via params |
| `brain/scripts/vcs/actor-check.mjs` | Modify | DELETE `defaultFetchLabeledEvents` (`:161-175`); dispatch `labelEvents` via `getVcs({ provider })` + `gitlabApiConfig()`; make `filterLabeledEvents` a shared post-filter over normalized `action`; `evaluateActor` UNCHANGED |
| `brain/scripts/vcs/cli.mjs` | Modify | Add `labelEvents` to `VERBS` (`:19-23`) |
| `brain/core/methodology/vcs-contract.md` | Modify | Add `labelEvents` row; reconcile stale `prView`/`issueView`/`mrCreate` rows (Decision 6). **L6 gate** |
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Create | ONE shared parameterized contract suite over both providers (`labelEvents`/`prView`/`mrCreate`), injected fixture transport |
| `brain/scripts/vcs/fixtures/record-fixtures.mjs` | Create | Committed recording script hitting the real APIs once, writing JSON stamped `endpoint + date` |
| `brain/scripts/vcs/fixtures/*.json` | Create | Recorded (+ `DERIVED`-marked synthetic) fixtures |
| `brain/scripts/vcs/actor-check.test.mjs` | Modify (light) | Re-point the injected `fetchLabeledEvents` dep to the verb; assertions UNCHANGED (behavior-preservation proof) |

## Testing strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `labelEvents` normalization (GitHub events → shape; GitLab resource-label-events → shape; ordering; `null` on throw) | NEW pure-normalization tests per provider, injected transport |
| Unit | `filterLabeledEvents` shared post-filter over normalized `action` | Fixture arrays, both providers' normalized output |
| Unit | `actor-check` dispatch + behavior preservation | `actor-check.test.mjs` re-run green, assertions unchanged; GitLab self-approval → `fail` |
| Unit | `prView`/`mrCreate` GitLab over `gitlabApiFetch` | Injected `fetchImpl` fixtures; normalized shapes; `null`/`{url:null,error}` on failure; never throws |
| Contract (fixture) | Shared parameterized suite, parity over both providers | Recorded fixtures, injected transport, no live network |
| E2E (DEFERRED to CP-A3b / SCIT) | Live round-trip on the real GitLab mirror | Deferred until SCIT restores live access |

## Migration / rollout

Additive: a new verb + new tests + un-stubbed implementations. No config migration. The contract-doc edit is
additive/reconciling (no removed verbs). CP-A3a is the acceptance gate (fixture-tested, hard stop,
PR-as-review); CP-A3b (live smoke) is deferred to the SCIT phase.

## Open questions

- [ ] **CP-A3b live smoke endpoint.** Deferred to the SCIT phase — blocked on the human exercising the live
      GitLab mirror; not decidable in this slice (same posture as CP-A2b).
- [ ] **Fixtures directory location + naming convention.** Proposed `brain/scripts/vcs/fixtures/` with
      `<provider>-<verb>-<case>.json` and an in-file `_provenance: { endpoint, date, recorded|derived }`
      stamp — confirm during Phase 3 (fixture infra) before the recording script is committed.
