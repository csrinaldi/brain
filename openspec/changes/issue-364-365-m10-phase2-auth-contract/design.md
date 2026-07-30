---
status: draft
issue: 364, 365
epic: 335
artifact_store: hybrid
topic_key: sdd/m10-phase2-auth-contract/design
---

# Design: `authLogin` / `authCheck` Contract-Parity Coverage (M10 Phase 2, Ranks 5–6)

Issues #364 (`authLogin`, rank 5) and #365 (`authCheck`, rank 6). Epic #335. Change folder:
`openspec/changes/issue-364-365-m10-phase2-auth-contract/`.

## Corrected premise (read this first)

The task brief this change was scoped from assumed `authLogin: ({ token, ...config }) -> {
username, email, apiBase }` and `authCheck: ({ token, ...config }) -> { username }`. Both are
**wrong**, verified against three independent sources:

1. `brain/core/methodology/vcs-contract.md` rows 24–25: `authCheck: ({ host }) -> boolean`,
   `authLogin: ({ host, token }) -> boolean`.
2. Both provider implementations (`github.mjs:20-28`, `gitlab.mjs:22-29`) call `run(...)` (not
   `runJson`) and return `.ok` — a plain boolean, never a parsed object.
3. `cli.mjs:109-110`: *"Boolean verbs (authCheck/authLogin) map false → non-zero exit so shell
   callers can branch on the exit code"* — the CLI dispatcher itself only special-cases these two
   verbs as booleans.

The brief's second claim — *"Both throw on failure (like mrList/issueList)"* — is also wrong.
`mrList`/`issueList` throw because they call `runJson`, which throws on a non-zero exit
(`exec.mjs:29-32`). `authCheck`/`authLogin` call `run`, which **never throws** — a non-zero exit
normalizes to `{ ok: false, ... }`, i.e. the verb returns `false`. Writing tests against the
brief's assumed shape would require changing `github.mjs`/`gitlab.mjs` to return objects, which is
out of scope (test-only change) and would break `cli.mjs`'s boolean-exit-code convention and every
existing local/interactive caller. This change tests the **real, documented, boolean contract**
instead.

## Technical Approach

Both verbs join the existing parameterized loop in
`brain/scripts/vcs/providers/vcs.contract.test.mjs`, reusing `loadFixture`, `assertProvenance`,
and the `afterEach(() => setSpawn(spawnSync))` reset. Unlike every JSON-returning verb in the
loop, `authCheck`/`authLogin` call the raw `run()` wrapper, not `runJson()` — there is no JSON
body to parse, only an exit status. This needs one new, narrow transport-glue function rather than
the existing `jsonSpawn`/`jsonSpawnCallArgs` (which JSON-serializes fixture `data` as stdout, a
shape these two verbs never consume).

| Provider | Call site | Transport |
|---|---|---|
| `github.authCheck` | `github.mjs:20-23` | `run('gh', host ? [...,'--hostname',host] : [...])` |
| `github.authLogin` | `github.mjs:25-28` | `run('gh', [...,'--hostname', host or 'github.com', '--with-token'], { input: tok })` |
| `gitlab.authCheck` | `gitlab.mjs:22-24` | `run('glab', ['auth','status','--hostname', host])` |
| `gitlab.authLogin` | `gitlab.mjs:26-29` | `run('glab', [...,'--hostname', host, ...,'--stdin'], { input: tok })` |

## Architecture Decisions

### D1 — New `rawStatusCallArgs` glue keyed on `{ status, stdout, stderr }`, not `jsonSpawnCallArgs`

| Option | Tradeoff | Decision |
|---|---|---|
| Reuse `jsonSpawnCallArgs` (`{ data } \| { throws, error }`) | `JSON.stringify(fixture.data)` on a boolean verb fabricates a JSON body neither provider parses — `run()` never calls `JSON.parse` on the output. Passes today but documents a fictitious contract | Rejected |
| Reuse `githubRawCallArgs` (`{ throws, error } \| { stdout }`, always `status: 0` on the non-throw branch) | Already closer — it drives `run()` via `rawSpawn(stdout)` — but its only failure path is `failSpawn`, which the mocked verb would report via a JS *rejection* it does not have. `authCheck`/`authLogin` need `status: 1` to surface as a returned `false`, not a throw | Rejected |
| New `rawStatusCallArgs(fixture)`: `setSpawn(() => ({ status: fixture.status, stdout: fixture.stdout ?? '', stderr: fixture.stderr ?? '' }))` | One glue function, shared by both verbs and both providers (same shared-object precedent as `mrList`/`issueList`'s `jsonSpawnCallArgs`), and the fixture's `status` field drives `run()`'s `ok` computation directly — the exact mechanism under test | **Chosen** |

`rawStatusCallArgs` is registered under **both** provider entries for **both** verbs — four
identical registrations pointing at the same function object, matching the "shared transport, one
function" precedent `mrList`/`issueList` already established for `jsonSpawnCallArgs`.

### D2 — Two fixture scenarios per provider per verb, not three; "empty" does not exist for a boolean

| Option | Tradeoff | Decision |
|---|---|---|
| Force a third `*-empty.json` fixture per provider/verb (8 total, matching the `happy/empty/failure` template every prior rank used) | A boolean has exactly two inhabitants. There is no third state to fixture — inventing one (e.g. "an ambiguous exit code") would test a case `run()` cannot produce (`ok: r.status === 0` is total over all integers) | Rejected |
| Two fixture scenarios (`happy` = `status: 0` → `true`, `failure` = `status: 1` → `false`) per provider per verb (8 fixtures total across both verbs) | Matches what the boolean contract actually has; the "third scenario" budget the brief allocated to `empty` is spent instead on the argument-building divergence tests (D3), which is where the real per-provider risk lives for these two verbs | **Chosen** |

This is a deliberate, documented deviation from the brief's "6 fixtures (3 per provider)"
per-verb estimate: **4 fixtures per verb (2 GitHub, 2 GitLab), 8 total**, plus divergence tests
that assert on captured call arguments rather than fixture content.

### D3 — Fixture provenance: `authCheck` GitHub-happy is recorded; `authLogin` is derived on both providers

| Verb | GitHub happy | GitHub failure | GitLab (both) |
|---|---|---|---|
| `authCheck` | **recorded** — `gh auth status` is a pure read; ran live in this sandbox, exit 0, real stdout captured verbatim (`gh` v2.46.0 writes the human-readable auth summary to **stdout**, not stderr, contrary to older `gh` versions' documented stderr-only behavior — worth noting since it means a stdout-only mock is sufficient) | derived — forcing a real "not logged in" failure would require logging out of the live session used to record the happy fixture, an unacceptable side effect for fixture maintenance | derived — no live `glab` session reachable from this environment (standing constraint, `record-fixtures.mjs:29-36`) |
| `authLogin` | **derived**, both scenarios | — | derived, both scenarios |

`authLogin` is a **mutating** verb (`gh auth login --with-token` / `glab auth login --stdin`
overwrite the local CLI's stored credentials) — recording it live would require actually replacing
this sandbox's real `gh`/`glab` session as a side effect of fixture maintenance. This is the exact
precedent `record-fixtures.mjs:24-30` already sets for `github-mrCreate-happy.json`: mutating
writes are hand-authored (derived) from the documented CLI contract (exit code semantics), never
recorded. `record-fixtures.mjs` gains no `authLogin` case for the same reason it has none for
`mrCreate`.

`authCheck`'s recorded fixture is intentionally **content-thin** by the contract's own design: the
verb's return value is `r.status === 0`, full stop — the CLI's stdout/stderr text is never parsed,
so recording it captures real evidence of what a live invocation returns without pretending any of
that text is contract-relevant. The fixture still carries the real text (not `''`) so a future
reader can see what an authenticated session's exit actually looks like, matching the "recorded
means recorded" discipline even though the test only asserts on `status`.

### D4 — Divergence tests via captured spawn args, not fixtures

Both verbs have a real, code-level per-provider divergence in how the CLI args are built, and both
are worth locking because a future edit to either provider could silently break parity without any
fixture-driven test noticing (fixtures only vary `status`, never args):

- **`authCheck` host handling.** `github.mjs:21`: `const args = host ? ['auth','status','--hostname',host] : ['auth','status']` — GitHub **omits** `--hostname` entirely when `host` is falsy. `gitlab.mjs:23`: `run('glab', ['auth','status','--hostname',host])` — GitLab **always** includes `--hostname`, even passing the literal value `undefined` through when `host` is omitted by the caller. This is asserted by capturing the args array the mocked `_spawn` receives and checking whether `'--hostname'` is present, per provider, when `host` is omitted.
- **`authLogin` host defaulting.** `github.mjs:27`: `host || 'github.com'` — GitHub substitutes a literal default. `gitlab.mjs:28`: `host` passed through as-is, no default — asserted the same way.
- **`authLogin` token delivery (parity, not divergence).** Both providers pass the token via `opts.input` (stdin), never as a CLI argument — asserted on **both** providers as a security-relevant parity guarantee: `capturedOpts.input === token` and `!capturedArgs.includes(token)`.

None of these three need a fixture file — they assert on the mocked `_spawn`'s received
arguments, the same "inline mock, no fixture" pattern already established for the COMMENT-only
write verbs (`vcs.contract.test.mjs:633-637`, `WRITE_VERB_PROVIDERS`).

## File Changes

| File | Change |
|---|---|
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Add `rawStatusCallArgs` glue; register `authCheck`/`authLogin` under both `PROVIDERS` entries; add 2 fixture-driven tests × 2 verbs × 2 providers (8) inside the loop; add 3 divergence/parity tests (host-omitted × 2 verbs, token-via-stdin × 1) driven by inline capturing mocks, run once each across both providers (6 provider-scoped assertions) |
| `brain/scripts/vcs/fixtures/github-authCheck-{happy,failure}.json` | New |
| `brain/scripts/vcs/fixtures/gitlab-authCheck-{happy,failure}.json` | New |
| `brain/scripts/vcs/fixtures/github-authLogin-{happy,failure}.json` | New |
| `brain/scripts/vcs/fixtures/gitlab-authLogin-{happy,failure}.json` | New |
| `brain/core/methodology/vcs-contract.md` | Amend rows 24–25 with the never-throws-boolean semantics already there, made explicit re: false-vs-throw, plus the host-arg-building divergence |

Production files touched: **zero**. `github.mjs`/`gitlab.mjs` are read-only inputs.

Estimated diff: ~110–140 lines of test code, 8 small fixtures (~10 lines each), 2 doc-row
amendments. Inside the 400-line review budget.

## Testing Strategy

Eleven new test blocks: four fixture-driven per verb (happy × 2 providers, failure × 2 providers)
= 8, plus 3 divergence/parity blocks (each exercised against both providers within the block body,
not looped) = 11. Comfortably inside the "+8-12 tests" estimate.

1. **`authCheck` happy** (both providers) — load fixture, `assertProvenance`, call
   `vcs.authCheck({ host: 'github.com', ...rawStatusCallArgs(fixture) })`, assert
   `result === true` exactly (`assert.equal`, not truthy).
2. **`authCheck` failure** (both providers) — `status: 1` fixture, assert `result === false`
   exactly, and assert the call **resolves** (never rejects) — the opposite of `mrList`/
   `issueList`'s pinned-throw divergence.
3. **`authLogin` happy / failure** — same shape, calling `vcs.authLogin({ host, token: 'tok',
   ...rawStatusCallArgs(fixture) })`.
4. **`authCheck` host-omission divergence** — capture `_spawn` args with `host` omitted; assert
   GitHub's args array does not contain `'--hostname'`; assert GitLab's does.
5. **`authLogin` host-default divergence** — capture args with `host` omitted; assert GitHub's
   array contains `'github.com'`; assert GitLab's array contains the literal `undefined` value at
   the position after `'--hostname'` (documenting, not endorsing, that GitLab passes it through
   unguarded).
6. **`authLogin` token-via-stdin parity** — both providers: assert the token appears in
   `opts.input`, and assert `JSON.stringify(capturedArgs)` (or an `includes` scan) never contains
   the literal token string — a real security-relevant contract, not decoration.

Verification is `npm test` on the full suite: 11 new tests green, zero regressions across the
existing 2043 (current `main` HEAD, post-issueList/#363).

## Migration / Rollout

Branched from `main` at the `issueList` merge (`1b484a7`, #363) — the latest merged rank. No other
rank is in flight against this file at branch time; `PROVIDERS` table and destructuring block are
edited additively (four new keys), no rename.

Rollback is a single revert. No production code path is touched.

## Open Questions

- **`authCheck`/`authLogin` are local/interactive-only** (per the epic's own framing) — no CI
  caller depends on either verb today, so this closes an audit gap (#336) rather than an active
  production bug, unlike `prReviews` (#317). Grep-verified callers: `tracker-board.mjs:30`,
  `day-start.mjs:94,109`, `project-status.mjs:105` — all three human-invoked CLIs, none CI-run.
  All three wrap the call in `try { … } catch { … = false }`, which is defensive-but-dead code
  given `run()` never throws (D1's corrected premise) — the same "caller absorbs a throw the verb
  doesn't actually produce" shape `issueList`'s design flagged for `whoami()`, worth a one-line
  note in the divergence test but not a fix (out of scope, no production change).
- **`vcs-contract.md` rows 24–25 already say `-> boolean`** — this change does not need a
  `MODIFIED Requirements` correction of the shape, only an *amendment* adding the divergence detail
  the audit found missing (host-arg-building asymmetry), a narrower edit than every prior rank's
  doc amendment.
