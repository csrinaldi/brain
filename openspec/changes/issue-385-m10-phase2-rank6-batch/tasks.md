---
status: draft
issue: 385
epic: 335
artifact_store: hybrid
topic_key: sdd/issue-385-m10-phase2-rank6-batch/tasks
---

# Tasks — whoami / commitStatus / repoCloneUrl / patSetupUrl / projectResolve Contract-Parity Coverage (M10 Phase 2, final Gap-A batch, Issue #385)

> **STRICT TDD MODE IS ACTIVE**: RED → GREEN pairs using `node:test` + `assert/strict` (per `sdd-init/brain`, `strict_tdd: true`, `npm test` → `node --test "brain/scripts/**/*.test.mjs"`).
> **Delivery decision (already made — do not re-litigate)**: SINGLE PR, one branch, work-unit commits (one commit per phase below, not one giant commit). The design agent's own recommendation to split into PR1 (transport verbs) / PR2 (pure verbs) is explicitly NOT taken: ~360 lines is inside the 400-line review budget, and fragmenting 5 small verbs across 2 PRs would cost more reviewable-context continuity than it buys.
> **Naming decision (already made — do not re-litigate)**: this batch is NOT "rank-6". `authCheck`/#365 already holds that label in `vcs-contract.md` row 24 ("issue #365, M10 Phase 2 rank-6"), confirmed by direct read. Cite this batch everywhere (doc rows, PR title/description, commit messages, filed issues) as **"issue #385, M10 Phase 2 — final Gap-A batch"**. The change FOLDER name (`issue-385-m10-phase2-rank6-batch`) stays as-is — do not rename it, that would be unrelated churn.
> Test-only, additive. Zero production files modified — `github.mjs`, `gitlab.mjs`, `normalize.mjs`, `exec.mjs` are all UNCHANGED. Only `vcs.contract.test.mjs`, `vcs-contract.md`, and 10 new fixture files change.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~360 (design.md Size forecast: ~240 test file + ~110 fixtures + ~10 doc) |
| 400-line budget risk | Medium — inside budget but not comfortably |
| Chained PRs recommended | No — orchestrator decision: single PR, work-unit commits |
| Suggested split | Single PR (design's PR1/PR2 split considered and explicitly declined) |
| Delivery strategy | single-pr (orchestrator-resolved, not re-asked here) |
| Chain strategy | pending — not applicable, no chaining used |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units (commits within the single PR)

| Unit | Goal | Commit (example) | Phase |
|------|------|-------------------|-------|
| 1 | 10 fixtures authored/recorded, provenance-verified | `test(vcs): add whoami/commitStatus fixtures for #385` | 1 |
| 2 | PROVIDERS registration + destructuring | `test(vcs): register whoami/commitStatus transport glue` | 2 |
| 3 | Per-verb parity tests (5 verbs) | `test(vcs): add whoami/commitStatus/projectResolve/repoCloneUrl/patSetupUrl contract tests` | 3 |
| 4 | Divergence-lock tests | `test(vcs): lock repoCloneUrl/patSetupUrl/commitStatus latent divergences` | 4 |
| 5 | Doc update | `docs(vcs): cross-reference #385 in vcs-contract.md` | 5 |
| 6 | Follow-up issue filings | (no code commit — `gh issue create` × 3) | 6 |
| 7 | Full suite verification + PR open | (no code commit, or squash-fixup if needed) | 7 |

## Phase 1 — Fixture Evidence (`brain/scripts/vcs/fixtures/`)
- [x] 1.1 Record `github-whoami-happy.json` from a real `gh api /user` call in this environment; capture the full verbatim payload under `data` (redact `email`/non-public fields with a note if present), stamp `_provenance.recorded: true`, note the exact command run.
- [x] 1.2 Hand-author `github-whoami-failure.json` (`_provenance.derived`): `{ throws: true, error: "HTTP 401: Bad credentials (https://api.github.com/user)" }`.
- [x] 1.3 Hand-author `gitlab-whoami-happy.json` (derived: `{ id, username, name, state, avatar_url, web_url }`) and `gitlab-whoami-failure.json` (derived: `{ throws: true, error: "401 Unauthorized" }`) — no reachable live `glab` session (standing deferral, same as every other `gitlab-*` fixture in this suite).
- [x] 1.4 Hand-author `github-commitStatus-happy.json` (derived: `check_runs:[{status:'completed',conclusion:'success'}]`), `github-commitStatus-empty.json` (derived: `check_runs: []`), `github-commitStatus-failure.json` (derived: `{throws:true, error:"HTTP 404: Not Found"}`).
- [x] 1.5 Hand-author `gitlab-commitStatus-happy.json` (derived: `[{status:'success'}]`), `gitlab-commitStatus-empty.json` (derived: `[]`), `gitlab-commitStatus-failure.json` (derived: `{throws:true, error:"404 Project Not Found"}`).
- [x] 1.6 **GATE** — Confirm all 10 fixtures pass `assertProvenance` (exactly one of `recorded`/`derived`, plus `endpoint` + `date` + `note`, per design manifest) before wiring them into the suite.

## Phase 2 — Transport Glue Registration (`vcs.contract.test.mjs`)
- [x] 2.1 Add `whoami: jsonSpawnCallArgs` and `commitStatus: jsonSpawnCallArgs` under both `PROVIDERS.github` and `PROVIDERS.gitlab` — the SAME shared function object used for `mrList`/`issueList` (design D1), with a comment citing that precedent so the shared reference doesn't read as a copy-paste error.
- [x] 2.2 Add `whoami: whoamiArgs` and `commitStatus: commitStatusArgs` to the loop's destructuring block alongside the existing entries.
- [x] 2.3 **GATE** — Confirm no existing registration (`mrList`, `issueList`, `prView`, `labelEvents`, `prStatusRollup`, `issueView`, `authCheck`, `authLogin`) broke.

## Phase 3 — Per-Verb Contract Tests, in the loop (`vcs.contract.test.mjs`) — RED → GREEN
- [x] 3.1 RED→GREEN — `whoami` happy: `assert.deepEqual(result, {username:'<fixture value>'})` on both providers, hardcoded expected value, never re-derived from `fixture.data.login`/`.username` (design D3).
- [x] 3.2 RED→GREEN — `whoami` failure: `assert.rejects(...)` on both providers — no null-shape fallback exists for this verb.
- [x] 3.3 RED→GREEN — `commitStatus` happy: assert result equals the canonical enum value on both providers, proving GitHub's two-field read (`status` while running, `conclusion` once completed) (design D2).
- [x] 3.4 RED→GREEN — `commitStatus` empty: `assert.equal(result, null)` on both providers, message distinguishing "empty = successful call, nothing to report" from the failure case below.
- [x] 3.5 RED→GREEN — `commitStatus` failure: `assert.rejects(...)` on both providers, message citing the `mrList` rejection precedent (`:383-392`) — pinned as out-of-scope, not caller-load-bearing (the opposite framing from `issueList`'s).
- [x] 3.6 RED→GREEN — `projectResolve`: one parameterized test per provider, two assertions — a plain slug and a nested `group/sub/repo` path, proving no URL-encoding occurs here (design D6). No fixture, no `PROVIDERS` key.
- [x] 3.7 RED→GREEN — `repoCloneUrl` parity: `new URL(...)` parse asserting `protocol`, `password` (placeholder credential `placeholder-not-a-real-token`), `host` (when supplied), `pathname`, `search === ''`, and `username.length > 0` (present-only, never cross-provider-compared here) (design D4). No fixture, no `PROVIDERS` key.
- [x] 3.8 RED→GREEN — `patSetupUrl` parity floor: `new URL(...)` parse asserting `protocol`, comma-joined `scopes` value, and that the requested `name` value reaches SOME query param value (key divergence locked in Phase 4) (design D5). No fixture, no `PROVIDERS` key.
- [x] 3.9 **GATE** — All Phase 3 tests green; confirm no regression in the previously-registered verbs (`mrList`, `issueList`, `authCheck`, `authLogin`, etc.).

## Phase 4 — Divergence-Lock Tests, standalone below the loop (`vcs.contract.test.mjs`)
- [x] 4.1 `commitStatus` GitHub two-field read: an `in_progress` check (`conclusion: null`) normalizes to `'running'`, proving `status` is read while unfinished (design D2.1).
- [x] 4.2 `commitStatus` GitHub `neutral`/`skipped` ⇒ `null` collapse: a **completed** check with `conclusion: 'neutral'` (and separately `'skipped'`) returns `null` — the previously-undocumented finding (design D2.2).
- [x] 4.3 `commitStatus` selection asymmetry: GitHub with two check runs returns the FIRST one's status (client-side `[0]`); GitLab's captured spawn argv contains `per_page=1` (server-side) (design D2.3).
- [x] 4.4 `repoCloneUrl` host-default divergence lock: GitHub falls back to `github.com` on a falsy `host`; GitLab produces a broken literal-`undefined`-host URL. Message states **PINNED NOT FIXED — follow-up filed** (design D4; filed in Phase 6.1). Latent defect #1 (GitLab URL corruption), locked not fixed here.
- [x] 4.5 `patSetupUrl` host-ignored-on-GitHub lock: GitHub hardcodes `github.com` regardless of a supplied GHES `host`; GitLab correctly interpolates `host`. Message states **PINNED NOT FIXED — follow-up filed** (design D5; filed in Phase 6.2). Latent defect #2 (GHES breakage), locked not fixed here.
- [x] 4.6 `patSetupUrl` shared no-URL-encoding lock: a `name` of `'brain & co'` produces a spurious second query parameter on BOTH providers. Message states **PINNED NOT FIXED — follow-up filed** (design D5; filed in Phase 6.3). Latent defect #3 (encoding gap, both providers), locked not fixed here.
- [x] 4.7 **GATE** — All 6 divergence-lock tests green; each assertion message names the source line (e.g. `github.mjs:481`, `gitlab.mjs:531`, `github.mjs:485`) and says PINNED NOT FIXED where applicable.

## Phase 5 — Documentation (`brain/core/methodology/vcs-contract.md`)
- [x] 5.1 Amend row 26 (`whoami`): append transport-rejects-on-failure discipline (matching `mrList`/`issueList`, opposite `authCheck`), exact `{username}` shape with no provider field leaking through.
- [x] 5.2 Amend row 35 (`commitStatus`): append the three `null` producers (no checks / non-enum value / `neutral`/`skipped` collapse), the reject-on-failure discipline, and the GH-client-side-`[0]` vs GL-server-side-`per_page=1` selection asymmetry.
- [x] 5.3 Amend row 36 (`repoCloneUrl`): append userinfo-password credential position, the host-default divergence (GH defaults, GL does not — locked, not fixed), and the hidden user-literal detail.
- [x] 5.4 Amend row 37 (`patSetupUrl`): append the host-ignored-on-GitHub divergence (breaks GHES — locked, not fixed), the `description`-vs-`name` query-key mismatch, and the shared no-URL-encoding gap (locked, not fixed).
- [x] 5.5 Amend row 38 (`projectResolve`): append "identity now contract-locked on both providers" and the no-double-encoding rationale (each verb encodes at its own call site).
- [x] 5.6 Extend the "Normalized `commitStatus` enum" section (lines 46-53) with one sentence naming the `neutral`/`skipped` ⇒ `null` collapse — currently absent from the doc entirely.
- [x] 5.7 Verify every amended row's cross-reference reads **"issue #385, M10 Phase 2 — final Gap-A batch"** — confirm NONE read "rank-6" or "rank-7" or any other rank number.

## Phase 6 — Follow-Up Issue Filings (3 independent issues via `gh issue create`)
- [x] 6.1 File issue: **`repoCloneUrl` has no GitLab host fallback** (`gitlab.mjs:531` — a falsy `host` produces a broken `.../undefined/...` clone URL; GitHub defaults to `github.com`, GitLab does not). Label `type:bug` minimum. Reference this change's PR once opened. Link from epic #335.
- [x] 6.2 File issue: **`patSetupUrl` ignores `host` on GitHub** (`github.mjs:485` — hardcodes `github.com`, breaking GitHub Enterprise Server operators who pass a GHES `host`). Label `type:bug` minimum. Reference this change's PR once opened. Link from epic #335.
- [x] 6.3 File issue: **`patSetupUrl`/`repoCloneUrl` do not URL-encode `name`/`scopes`/`project`** (neither provider calls `encodeURIComponent`; a name or scope containing `&` or a space produces a malformed URL). Label `type:bug` minimum. Reference this change's PR once opened. Link from epic #335.
- [x] 6.4 Confirm these are filed as **3 separate issues**, not one combined issue — different blast radii (GHES breakage vs GitLab URL corruption vs encoding gap affecting both providers), independently triageable/closeable, matching the `branchProtect` rank-2 precedent of explicitly documented deferred filings (do not let the green divergence-lock tests stand as tacit approval without a tracked path to fixing them).

## Phase 7 — Full Suite Verification
- [x] 7.1 Run `npm test` (`node --test "brain/scripts/**/*.test.mjs"`) before starting any change, to capture the pre-change baseline test count.
- [x] 7.2 **GATE** — Run `npm test` again after all phases: confirm zero regressions on the pre-change baseline, plus exactly ~23 new tests green (4 whoami + 6 commitStatus in-loop + 2 projectResolve + 2 repoCloneUrl-parity + 2 patSetupUrl-parity + 3 commitStatus-divergence + 1 repoCloneUrl-divergence + 3 patSetupUrl-divergence).
- [x] 7.3 Confirm the actual diff lands near the ~360-line estimate; if it materially exceeds 400, STOP and flag back to the orchestrator before opening the PR — the single-PR decision was made at ~360, not at an open-ended size.
- [ ] 7.4 Open the single PR referencing issue #385 / epic #335, using "final Gap-A batch" phrasing throughout (title, description, commit trailers) — no "rank-6" anywhere.
