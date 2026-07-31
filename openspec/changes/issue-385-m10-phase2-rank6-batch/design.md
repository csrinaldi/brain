---
status: draft
issue: 385
epic: 335
artifact_store: hybrid
topic_key: sdd/issue-385-m10-phase2-rank6-batch/design
---

# Design: whoami / commitStatus / repoCloneUrl / patSetupUrl / projectResolve Contract-Parity Coverage

Issue #385. Epic #335. Reads: `proposal.md` (same folder).

Test-only, additive. **Zero production files modified.** Every latent defect this suite reaches is
LOCKED as current behavior and filed, never fixed here.

## Verified before designing

Every claim below was read from source, not assumed.

| Fact | Source |
|---|---|
| `github.whoami()` takes **no parameters**, spawns `runJson('gh', ['api','/user'])`, returns `{ username: resp.login }` | `github.mjs:30-33` |
| `gitlab.whoami()` — identical shape, `runJson('glab', ['api','/user'])`, `{ username: resp.username }` | `gitlab.mjs:31-34` |
| `github.commitStatus` reads `resp.check_runs?.[0]`, returns `null` if absent, else `normalizeCommitStatus('github', cr.status === 'completed' ? cr.conclusion : cr.status)` | `github.mjs:219-227` |
| `gitlab.commitStatus` requests `...?per_page=1` and returns `normalizeCommitStatus('gitlab', arr[0]?.status)` — **no local empty guard** | `gitlab.mjs:370-374` |
| `normalizeCommitStatus` opens with `if (raw == null) return null` — GitLab's missing guard is safe by delegation | `normalize.mjs:34-35` |
| `GITHUB_STATUS_MAP` maps `neutral` and `skipped` to **`null`** — a *completed* check collapses into the same `null` as "no checks ran" | `normalize.mjs:24-25` |
| `runJson` **throws** on non-zero exit AND on invalid JSON; neither transport verb catches it | `exec.mjs:29-33` |
| `github.repoCloneUrl` → `https://x-access-token:${token}@${host \|\| 'github.com'}/${project}.git` | `github.mjs:480-482` |
| `gitlab.repoCloneUrl` → `https://oauth2:${token}@${host}/${project}.git` — **no host fallback** | `gitlab.mjs:530-532` |
| `github.patSetupUrl` **ignores `host` entirely**, hardcodes `github.com`, param key `description` | `github.mjs:484-486` |
| `gitlab.patSetupUrl` is host-driven, param key `name` | `gitlab.mjs:534-536` |
| `projectResolve` is `return project` on both providers | `github.mjs:36-38`, `gitlab.mjs:38-40` |

Consequence that sets the whole scenario table: because `runJson` throws, `commitStatus`'s `null`
(empty result, a **successful** call) and its rejection (transport failure) are **two distinct
outcomes**, not one. They need separate scenarios. This is the same divergence `mrList`/`issueList`
are pinned on (`vcs.contract.test.mjs:383-392`, `:478-487`) and the OPPOSITE of
`authCheck`/`authLogin`'s never-throws boolean (`:505-517`).

---

## D1 — Fixture vs no-fixture split

**Decision.** Split on one criterion, and only one: **does the verb have a transport seam?**

| Verb | Transport | Treatment |
|---|---|---|
| `whoami` | `runJson` (spawn) on both | Fixture-driven, existing `jsonSpawnCallArgs` glue, `PROVIDERS` key |
| `commitStatus` | `runJson` (spawn) on both | Fixture-driven, existing `jsonSpawnCallArgs` glue, `PROVIDERS` key |
| `projectResolve` | none | No fixture, no `PROVIDERS` key, direct input→output in the loop |
| `repoCloneUrl` | none | Same |
| `patSetupUrl` | none | Same |

### Transport half — no new glue

Both transport verbs spawn a CLI and parse JSON. That is exactly `jsonSpawnCallArgs`
(`vcs.contract.test.mjs:84-87`). They register in `PROVIDERS` as the **same function object on both
providers**, the encoding this file already uses for `mrList`/`issueList` and states explicitly in
its own comments (`:151-159`): *"That is the honest encoding of 'both providers share one transport
for this verb', not a copy-paste error."* `whoami`/`commitStatus` are the fourth and fifth verbs to
qualify. Writing a `whoamiCallArgs` wrapper that delegates to the same `setSpawn` would fabricate a
distinction that does not exist.

### Pure half — no fixture, and why that is not a shortcut

`projectResolve`, `repoCloneUrl`, `patSetupUrl` call no `run`, no `runJson`, no `fetchImpl`. There
is nothing to inject. A fixture file for them would carry a `_provenance.endpoint` naming an
endpoint that is **never requested** — a documented lie, and `assertProvenance` would happily pass
it. The fixture template exists to make transport reproducible; applying it where there is no
transport degrades provenance from evidence into decoration.

They still run **inside** the `for (const providerName of Object.keys(PROVIDERS))` loop, because
the loop is what structurally enforces parity — dropping them out of it would let the two providers
drift. They use only the loop's `module: vcs` binding and take **no `...Args(fixture)` spread**:

```js
// inside the existing loop — no loadFixture, no assertProvenance, no ...Args() spread
test(`${providerName}.projectResolve (contract): ...`, async () => {
  assert.equal(await vcs.projectResolve({ project: 'x/y' }), 'x/y');
});
```

Precedent in this same file for fixture-free assertions: the `prView.headRefOid` inline-payload
tests (`:249-265`), `prStatusRollup` (`:857-908`), `WRITE_VERB_PROVIDERS` (`:916-990`), `labelList`
(`:999-1032`), `branchProtect` (`:1073-1110`) — none of which use fixture files, each with a stated
reason. This is that same discipline, with the strongest reason yet: **no seam at all.**

### `PROVIDERS` additions — exact

```js
const PROVIDERS = {
  github: {
    module: github,
    /* …existing keys unchanged… */
    // whoami/commitStatus (issue #385) spawn `gh api` via runJson — the same
    // JSON-over-spawn seam mrList/issueList use.
    whoami: jsonSpawnCallArgs,
    commitStatus: jsonSpawnCallArgs,
  },
  gitlab: {
    module: gitlab,
    /* …existing keys unchanged… */
    // gitlab.whoami/commitStatus spawn `glab` via runJson for the same reason
    // gitlab.mrList/issueList do (design D1) — SAME shared function object.
    whoami: jsonSpawnCallArgs,
    commitStatus: jsonSpawnCallArgs,
  },
};
```

Loop destructuring gains exactly two bindings:

```js
    whoami: whoamiArgs,
    commitStatus: commitStatusArgs,
```

**Gotcha for apply — do not skip.** `whoami()` is declared with **no parameter list**
(`github.mjs:30`, `gitlab.mjs:31`). `whoamiArgs(fixture)` is therefore called for its **`setSpawn`
side effect**; its `{}` return value is vestigial for this verb. Write it as
`await vcs.whoami({ ...whoamiArgs(fixture) })` anyway — uniform with every other verb in the loop,
and the ignored argument is harmless. Do **not** "clean it up" to a bare `vcs.whoami()` with a
detached glue call above it: that separates the mock setup from the call it serves.

---

## D2 — `commitStatus` scenario mechanics

**Three scenarios per provider, six fixtures, all in the loop.**

| Scenario | Input | Expected | Proves |
|---|---|---|---|
| happy | first check/status is terminal-success | `'success'` | the canonical enum, and GH's `completed ⇒ conclusion` read |
| empty | no checks/statuses returned | `null` | successful call, nothing to report — GH via `if (!cr) return null`, GL via the normalizer's `raw == null` guard |
| failure | `runJson` throws | **rejects** | uncomputable ≠ empty |

**Empty gets its own fixture file, not an inline payload.** The question was whether
`check_runs: []` is small enough to inline. It is not about size — it is about which half of the
file it lives in. Every test *inside the parity loop* in this file is fixture-driven; every
fixture-free test lives *outside* it or in a provider-specific block, each with a written
justification. `commitStatus`'s empty case is a genuine transport response (the API really does
return an empty set), so it has a real endpoint and a real provenance story. Inlining it would be
the first fixture-free test inside the fixture-driven loop, and the next contributor would
reasonably read that as permission to inline anything. Two files, ~11 lines each. Pay it.

**Failure asserts rejection, not a null-shape.** The precedent is exact and must be cited in the
test message, matching how `mrList` and `issueList` cite theirs:

- `vcs.contract.test.mjs:383-392` — `mrList` transport failure REJECTS, pinned as out-of-scope.
- `vcs.contract.test.mjs:478-487` — `issueList` transport failure REJECTS, pinned because **both
  call sites already absorb it**.

`commitStatus` is the `mrList` flavor, not the `issueList` flavor: the throw is pinned because
fixing it is out of scope, not because a caller depends on it. State that distinction in the
assertion message — this file's convention is that a pinned divergence must say **why** it is
pinned, or the next reader cannot tell a deliberate lock from an accident.

```js
await assert.rejects(
  () => vcs.commitStatus({ project: 'x/y', sha: 'cafef00d', ...commitStatusArgs(fixture) }),
  'commitStatus must REJECT on a transport failure — runJson throws (exec.mjs:31-32) and neither provider wraps it; PINNED as out-of-scope (the mrList rationale, design D3 there), NOT because a caller depends on the throw',
);
```

**The empty assertion must distinguish itself from the failure one in the message**, because
`null` and "rejected" are the two outcomes this verb's whole design turns on:

```js
assert.equal(result, null, 'an empty check set is a SUCCESSFUL call with nothing to report — null, not a rejection; the failure case above is what rejects');
```

### GitHub-only mechanics — standalone, fixture-free, below the loop

Three divergences that no fixture-driven parity test can see. They follow the
`github.issueList` pull_request-filter precedent (`:765-784`) and the `authCheck`/`authLogin`
divergence block (`:699-736`): standalone, no loop, inline `setSpawn(jsonSpawn(...))` payloads.

1. **Two-field read.** An `in_progress` check (`conclusion: null`) must normalize to `'running'`,
   proving `status` is read while unfinished. A fixture cannot express this without a fourth
   scenario file; inline is correct here because the *payload shape* is the assertion.
2. **`neutral`/`skipped` ⇒ `null` collapse.** The undocumented third `null` producer. A **completed**
   check with `conclusion: 'neutral'` returns `null` — indistinguishable, at the contract boundary,
   from "no checks ran". This is the one finding in this slice that is not in `vcs-contract.md` at
   all. Lock it, and add it to the doc (see below).
3. **Selection asymmetry.** GitHub fetches every check run and takes `[0]` **client-side**; GitLab
   pushes `per_page=1` **server-side**. Assert both halves: GitHub with two check runs returns the
   FIRST one's mapped status, and GitLab's spawn argv contains `per_page=1`. The argv half follows
   the `github.labelList --paginate` precedent (`:1034-1042`) — capture `args` in the `setSpawn`
   fake, assert on them.

---

## D3 — `whoami` scenario mechanics

**Two scenarios per provider: happy and failure. Four fixtures.**

### Happy — the assertion is exact-shape, not field-presence

```js
assert.deepEqual(result, { username: '<the fixture's own login/username>' });
```

`deepEqual` against the whole object — not `assert.ok('username' in result)` — because the contract
promise is *"the caller never sees provider-specific fields"* (`vcs-contract.md:18-20`). A
presence-only check stays green if a future normalizer spreads the raw payload and adds `username`
on top, which is precisely the leak this test exists to catch. `deepEqual` on the full object is
the only assertion that fails on a widened shape.

Expected values are **hardcoded**, never re-derived from `fixture.data.login`. Re-deriving through
the same mapping the normalizer performs lets a mirrored bug pass — the rule this file already
states for `mrList` (`:354-360`) and `issueList` (`:442-447`).

### Failure — yes, it is warranted

`whoami` is not decorative: `assigneeParams(provider, 'me', currentUser)` (`normalize.mjs:62-72`)
consumes it, and `issueList`'s own test block documents (`:405-419`) what happens when `whoami`
returns the wrong thing under a uniform stub — a green test for the wrong reason. Locking that
`whoami` **rejects** rather than resolving to `{ username: undefined }` is the assertion that keeps
that failure mode loud. Two lines of test, one small fixture per provider. Cheap and load-bearing.

### Failure fixtures are per-verb, NOT a shared generic one

Rejected: one `transport-failure.json` reused across verbs. `_provenance.endpoint` is a **real
field with a real contract** — every existing failure fixture names the exact endpoint whose failure
it simulates (`github-mrList-failure.json` names `GET repos/:project/pulls?...`). A shared fixture
would have to carry a generic or absent endpoint, and `assertProvenance` only checks that the field
is truthy — it cannot catch a vague one. The convention costs ~10 duplicated lines per verb and buys
provenance that stays honest. Follow it.

### Recording provenance

`github-whoami-happy.json` is the **one recorded fixture** in this slice. `gh api /user` is
non-mutating, and `.login` is stable across recordings, so a recorded payload cannot drift out from
under a hardcoded expectation.

```
# exact recording command, to be run by sdd-apply and pasted into _provenance.note
gh api /user
```

Record the response **verbatim** under `data`, keeping the full public user shape (`login`, `id`,
`node_id`, `avatar_url`, `html_url`, `type`, …) — the extra fields are the point: they prove the
normalizer drops all of them. If the response carries a non-null `email` or any non-public field,
redact that value and say so explicitly in `_provenance.note`; the fixture stays `recorded: true`
(redaction-with-disclosure is not derivation, and `login` is public either way).

**Everything else in this slice is `derived: true`**, including both `commitStatus` happy fixtures.
That is a deliberate call, not laziness: `commitStatus`'s assertions pin *specific enum values* that
depend on *specific* `status`/`conclusion` field combinations. A live check-runs payload is
non-deterministic across re-recordings, so a recorded fixture would either force a re-derived
(vacuous) assertion or break the next time anyone re-records. When the exact field values ARE the
test input, `derived` is the honest provenance — the same reason `github-mrCreate-happy.json` and
every `*-failure.json` in this directory are derived. No live GitLab mirror is reachable, so all
`gitlab-*` fixtures are derived under the standing deferral (`vcs.contract.test.mjs:12-21`).

---

## D4 — `repoCloneUrl`: credential position + host divergence

### Parity half (in the loop) — parse the URL, do not grep it

```js
const PLACEHOLDER_CREDENTIAL = 'placeholder-not-a-real-token';

test(`${providerName}.repoCloneUrl (contract): the credential sits in the userinfo segment, and the provider's user literal is not a caller concern`, async () => {
  const url = await vcs.repoCloneUrl({ host: 'vcs.example.test', project: 'x/y', token: PLACEHOLDER_CREDENTIAL });
  const parsed = new URL(url);

  assert.equal(parsed.protocol, 'https:', 'the clone URL must be https — a git-protocol or http URL would carry the credential in clear');
  assert.equal(parsed.password, PLACEHOLDER_CREDENTIAL, 'the credential must sit in the userinfo PASSWORD position — the only place git consumes it');
  assert.equal(parsed.host, 'vcs.example.test', 'the supplied host must be honored verbatim when present');
  assert.equal(parsed.pathname, '/x/y.git', 'the project slug must reach the path unencoded and .git-suffixed');
  assert.equal(parsed.search, '', 'the credential must NEVER ride in the query string — proxies and servers log query strings, they do not log userinfo');
  assert.ok(parsed.username.length > 0, 'a user literal must be present; WHICH literal is provider-specific (x-access-token vs oauth2) and is never compared across providers here');
});
```

**Why `new URL()` and not `assert.match(url, /.../)`.** A regex proves the token *appears
somewhere in the string*. The contract promise is that it appears in a **specific structural
position**. `URL.password` is that position, decided by the parser rather than by the test author's
regex. A substring assertion would stay green if the token migrated into the path or the query —
exactly the leak worth catching. This is the string-construction analogue of the `authLogin`
stdin-vs-argv guard (`:738-752`): same question ("is the credential where it belongs, and nowhere
else"), different transport.

**Secret-safety.** `PLACEHOLDER_CREDENTIAL = 'placeholder-not-a-real-token'` — lowercase, hyphenated,
no `ghp_`/`glpat-`/`gho_` prefix, no base62 entropy run, nothing a scanner's format heuristics can
match. It reads as prose. The existing precedent (`:739`) uses `'sample-cred-9x7'`; this stays in
that register. **Never** use a realistic-looking token shape, not even an invalid one.

`parsed.username` is asserted **present-only**, never compared across providers — the same rule
`branchProtect` states for `reason`/`remedy` (`:1100`): provider-specific vocabulary belongs in
`providers.test.mjs`, not in the parity suite. The exact literals ARE locked, but in the divergence
test below, where being provider-specific is the declared subject.

### Divergence half (standalone, below the loop) — following `:717-736`

```js
test('repoCloneUrl (contract): host-default divergence — GitHub falls back to github.com, GitLab emits a literal "undefined" host', async () => {
  const gh = new URL(await github.repoCloneUrl({ project: 'x/y', token: PLACEHOLDER_CREDENTIAL }));
  assert.equal(gh.host, 'github.com', "github.mjs:481 substitutes the literal default (host || 'github.com') when host is omitted");
  assert.equal(gh.username, 'x-access-token', 'the GitHub user literal is x-access-token');

  const gl = new URL(await gitlab.repoCloneUrl({ project: 'x/y', token: PLACEHOLDER_CREDENTIAL }));
  assert.equal(gl.host, 'undefined', 'LATENT DEFECT, PINNED NOT FIXED (follow-up filed): gitlab.mjs:531 interpolates ${host} with no fallback, so an omitted host produces the literally broken https://oauth2:***@undefined/x/y.git. Locked as current behavior — fixing it is a production change, out of scope for this test-only slice');
  assert.equal(gl.username, 'oauth2', 'the GitLab user literal is oauth2');
});
```

One test, both halves of the divergence, mirroring the shape of the existing `authLogin`
host-default divergence test exactly. `new URL('https://oauth2:x@undefined/x/y.git')` parses
cleanly — `undefined` is a syntactically valid hostname label — so `.host === 'undefined'` is a
stable assertion, not a parser accident.

**The defect is locked, not fixed, and the lock says so in the message.** A reader who lands on a
failing version of this test must be able to tell "someone fixed the bug, update the lock" from
"someone broke it". The message carries that.

---

## D5 — `patSetupUrl`: divergence, with a thin parity floor

This verb is **mostly not parity**. Different path, different query key (`description` vs `name`),
and GitHub ignores `host` outright. Forcing a symmetric assertion would either be vacuous or false.

### Parity floor (in the loop) — three things genuinely common

```js
test(`${providerName}.patSetupUrl (contract): returns an absolute https URL carrying the requested name and comma-joined scopes`, async () => {
  const parsed = new URL(await vcs.patSetupUrl({ host: 'vcs.example.test', name: 'brain', scopes: ['api', 'read_user'] }));
  assert.equal(parsed.protocol, 'https:');
  assert.equal(parsed.searchParams.get('scopes'), 'api,read_user', 'scopes must be comma-joined on both providers');
  assert.ok([...parsed.searchParams.values()].includes('brain'), 'the requested token name must reach the URL — the query KEY differs per provider (GH description=, GL name=), so only the VALUE is compared in the parity loop');
});
```

Comparing values rather than keys is the honest parity statement: *"the name reaches the URL"* is
the contract; *"under which key"* is the divergence, locked below.

### Divergence locks (standalone, provider-specific)

```js
test('github.patSetupUrl (contract): the host parameter is IGNORED — the URL is hardcoded to github.com', async () => {
  const parsed = new URL(await github.patSetupUrl({ host: 'ghes.example.test', name: 'brain', scopes: ['repo'] }));
  assert.equal(parsed.host, 'github.com', 'LATENT DEFECT, PINNED NOT FIXED (follow-up filed): github.mjs:485 hardcodes github.com and never reads `host`, so a GitHub Enterprise Server operator is silently sent to the public github.com PAT page');
  assert.equal(parsed.pathname, '/settings/tokens/new');
  assert.equal(parsed.searchParams.get('description'), 'brain', 'GitHub keys the token name as `description`');
});

test('gitlab.patSetupUrl (contract): the URL is host-driven — the supplied host appears verbatim', async () => {
  const parsed = new URL(await gitlab.patSetupUrl({ host: 'gitlab.example.test', name: 'brain', scopes: ['api'] }));
  assert.equal(parsed.host, 'gitlab.example.test', 'gitlab.mjs:535 interpolates the supplied host — the divergence from GitHub above, and the reason self-hosted GitLab works while GHES does not');
  assert.equal(parsed.pathname, '/-/user_settings/personal_access_tokens');
  assert.equal(parsed.searchParams.get('name'), 'brain', 'GitLab keys the token name as `name`');
});
```

### One shared latent-defect lock — no URL encoding

```js
test('patSetupUrl (contract): neither provider URL-encodes the token name — a name containing & injects a spurious query parameter', async () => {
  for (const [label, url] of [
    ['github', await github.patSetupUrl({ host: 'h.example.test', name: 'brain & co', scopes: ['repo'] })],
    ['gitlab', await gitlab.patSetupUrl({ host: 'h.example.test', name: 'brain & co', scopes: ['api'] })],
  ]) {
    const parsed = new URL(url);
    assert.ok(parsed.searchParams.has(' co'), `${label}: LATENT DEFECT, PINNED NOT FIXED (follow-up filed) — the raw & splits the name into a second, spurious query parameter; neither provider calls encodeURIComponent on name/scopes`);
  }
});
```

Asserting the **spurious parameter exists** is sharper than asserting the name is wrong: it names
the mechanism, so the test explains the bug rather than merely detecting it.

---

## D6 — `projectResolve`: one scenario, deliberately

**One parameterized test in the loop. Not a happy/empty/failure trio.**

Both implementations are `return project` (`github.mjs:36-38`, `gitlab.mjs:38-40`). There is no
transport, no failure mode, and no empty case — a "failure scenario" for a function with no seam
would be testing that JavaScript returns its argument, which is a test of the language runtime, not
of this contract. Manufacturing three scenarios here would add ceremony that a reader must decode
before concluding it means nothing.

What the single test DOES buy: `vcs-contract.md:61-63` names `projectResolve` an **extension point**
for a future host that needs a different id. This test is the tripwire on that extension point — the
day someone makes it non-identity on one provider, parity breaks loudly.

```js
test(`${providerName}.projectResolve (contract): returns the slug unchanged — identity on both providers, the documented extension point`, async () => {
  assert.equal(await vcs.projectResolve({ project: 'x/y' }), 'x/y');
  // Nested GitLab group path: proves projectResolve does NOT url-encode — each
  // verb encodes locally at its own call site (gitlab.mjs:371), so encoding here
  // would double-encode every downstream request.
  assert.equal(await vcs.projectResolve({ project: 'group/sub/repo' }), 'group/sub/repo');
});
```

Two assertions, one test. The nested-path assertion is not padding — it locks the encoding
*boundary*, which is a real design decision with a real failure mode.

---

## Fixture manifest — exactly 10 new files

All under `brain/scripts/vcs/fixtures/`. `date` is set at apply time to the actual authoring or
recording date (**2026-07-31** if applied today). Every file carries exactly one of
`recorded`/`derived` plus `endpoint` + `date` + `note`, per `assertProvenance`
(`vcs.contract.test.mjs:52-61`).

| # | File | Provenance | `_provenance.endpoint` | Payload key / shape |
|---|---|---|---|---|
| 1 | `github-whoami-happy.json` | **recorded** | `GET /user` (via `gh api /user`) | `data`: full verbatim `/user` payload, `login` preserved |
| 2 | `github-whoami-failure.json` | derived | `GET /user` (via `gh api /user`) | `throws: true`, `error: "HTTP 401: Bad credentials (https://api.github.com/user)"` |
| 3 | `gitlab-whoami-happy.json` | derived | `GET /user` (via `glab api /user`) | `data`: `{ id, username, name, state, avatar_url, web_url }` |
| 4 | `gitlab-whoami-failure.json` | derived | `GET /user` (via `glab api /user`) | `throws: true`, `error: "401 Unauthorized"` |
| 5 | `github-commitStatus-happy.json` | derived | `GET repos/:project/commits/:sha/check-runs` | `data`: `{ total_count: 1, check_runs: [{ name, status: "completed", conclusion: "success" }] }` |
| 6 | `github-commitStatus-empty.json` | derived | same | `data`: `{ total_count: 0, check_runs: [] }` |
| 7 | `github-commitStatus-failure.json` | derived | same | `throws: true`, `error: "HTTP 404: Not Found"` |
| 8 | `gitlab-commitStatus-happy.json` | derived | `GET projects/:enc/commits/:sha/statuses?per_page=1` | `data`: `[{ id, name, status: "success", sha }]` |
| 9 | `gitlab-commitStatus-empty.json` | derived | same | `data`: `[]` |
| 10 | `gitlab-commitStatus-failure.json` | derived | same | `throws: true`, `error: "404 Project Not Found"` |

Required `_provenance.note` content per class:

- **#1 (recorded):** the exact command (`gh api /user`), the `gh` version, and any redaction
  performed with the reason.
- **#5/#6/#8/#9 (derived happy/empty):** *why* derived rather than recorded — the assertions pin
  specific enum values that a re-recording would non-deterministically break (see D3).
- **#3/#4 (all gitlab):** the standing "no reachable GitLab mirror" deferral, same wording as the
  existing `gitlab-*` fixtures.
- **#2/#7/#10 (failure):** a forced non-zero exit cannot be recorded from a successful call; name
  `exec.mjs:31-32` as the throw site being exercised, and state that this verb REJECTS (pinned,
  not fixed).

**Fixtures NOT created, deliberately:** none for `projectResolve`, `repoCloneUrl`, `patSetupUrl`
(D1 — no transport seam), and none for the GitHub-only `commitStatus` mechanics in D2 (inline
payloads, standalone tests outside the loop, matching the file's own precedent for provider-specific
divergence).

---

## `vcs-contract.md` amendments

Five rows, inline in the **Normalized return** column, matching the style the `authCheck` (row 24)
and `authLogin` (row 25) rows already established.

**Naming collision — resolve before writing.** Row 24 already cites *"(issue #365, M10 Phase 2
rank-6)"* and row 25 cites *"rank-5"*. The change folder is named `rank6-batch`, but **rank-6 is
taken**. Cite this slice as **"(issue #385, M10 Phase 2 — final Gap-A batch)"**, never "rank-6".
The folder name stays as-is (it is already committed to); the document must not carry an ambiguous
rank label.

| Row | Line | Amendment |
|---|---|---|
| `whoami` | 26 | Append: transport is `runJson` on both providers, so a transport failure **REJECTS** (`exec.mjs:31-32`), same discipline as `mrList`/`issueList` and opposite `authCheck`. Return shape is exactly `{ username }` — no provider field (`login`, `id`, `avatar_url`) survives normalization. |
| `commitStatus` | 35 | Append: `null` has **three** distinct producers — no checks ran; a value outside the canonical enum; and (undocumented until now) a **completed** GitHub check whose conclusion is `neutral` or `skipped`, which `GITHUB_STATUS_MAP` maps to `null` (`normalize.mjs:24-25`). `null` (successful call, nothing to report) is distinct from a transport failure, which **REJECTS**. Selection asymmetry: GH fetches all check runs and takes `[0]` client-side; GL pushes `per_page=1` server-side. |
| `repoCloneUrl` | 36 | Append: the credential occupies the **userinfo password** position, never the path or query. Host-default divergence: GH falls back to `github.com` when `host` is falsy; GL has **no fallback**, so an omitted host yields a literal `undefined` hostname (latent defect, locked not fixed). User literal: `x-access-token` (GH) / `oauth2` (GL) — hidden from the caller. |
| `patSetupUrl` | 37 | Append: **not a parity verb.** GH ignores `host` entirely and hardcodes `github.com` (breaks GHES — latent defect, locked not fixed); GL is host-driven. Query key diverges: GH `description=`, GL `name=`. `scopes` is comma-joined on both. Neither provider URL-encodes `name`/`scopes`, so a name containing `&` or a space produces a malformed URL (latent defect, locked not fixed). |
| `projectResolve` | 38 | Append: identity is now **contract-locked on both providers**; it does not URL-encode — each verb encodes at its own call site, so encoding here would double-encode. |

Also extend the **Normalized `commitStatus` enum** section (lines 46-53) with one sentence naming
the `neutral`/`skipped ⇒ null` collapse — it is currently absent from the document entirely and is
the one genuinely new finding this slice surfaces.

Each amendment cites the file+line it was read from. Every claim above was verified against source
(see "Verified before designing").

---

## Component map

```
brain/scripts/vcs/providers/vcs.contract.test.mjs      (MODIFIED — the only test file touched)
├── PROVIDERS.github   += whoami, commitStatus  ────┐
├── PROVIDERS.gitlab   += whoami, commitStatus  ────┼─→ SAME jsonSpawnCallArgs function object
├── loop destructuring += whoamiArgs, commitStatusArgs
├── loop body (parity, fixture-driven)
│     ├── whoami        : happy | failure                       → fixtures 1-4
│     └── commitStatus  : happy | empty | failure               → fixtures 5-10
├── loop body (parity, fixture-free — D1)
│     ├── projectResolve: identity                              (no fixture, no PROVIDERS key)
│     ├── repoCloneUrl  : credential-position guard             (no fixture, no PROVIDERS key)
│     └── patSetupUrl   : https + name + comma-joined scopes    (no fixture, no PROVIDERS key)
└── standalone divergence tests (below the loop, precedent :699-736 / :765-784)
      ├── commitStatus  : GH two-field read (in_progress ⇒ running)
      ├── commitStatus  : GH neutral/skipped ⇒ null collapse
      ├── commitStatus  : selection asymmetry (GH client-side [0] vs GL per_page=1 argv)
      ├── repoCloneUrl  : host-default + user-literal divergence
      ├── patSetupUrl   : GH host ignored / GL host-driven
      └── patSetupUrl   : no URL-encoding (shared)

brain/scripts/vcs/fixtures/*.json                      (10 NEW files, manifest above)
brain/core/methodology/vcs-contract.md                 (MODIFIED — 5 rows + enum section)

brain/scripts/vcs/providers/github.mjs                 (UNCHANGED)
brain/scripts/vcs/providers/gitlab.mjs                 (UNCHANGED)
brain/scripts/vcs/lib/normalize.mjs                    (UNCHANGED)
brain/scripts/vcs/lib/exec.mjs                         (UNCHANGED)
```

**Integration points: exactly two, both pre-existing.** `setSpawn` (`exec.mjs:11`) for every
transport scenario, and the module import for the pure verbs. No new seam, no new glue function, no
production edit. That is the whole point of batching these five together.

---

## Size forecast and delivery

| Component | Lines |
|---|---|
| `vcs.contract.test.mjs` — in-loop tests (whoami 22, commitStatus 35, projectResolve 8, repoCloneUrl 14, patSetupUrl 12) | ~91 |
| `vcs.contract.test.mjs` — standalone divergence tests (6) | ~86 |
| `vcs.contract.test.mjs` — `PROVIDERS` keys + destructuring | ~8 |
| `vcs.contract.test.mjs` — block header comments (this file's documented house style) | ~55 |
| **Test file subtotal** | **~240** |
| 10 fixtures × ~11 lines | ~110 |
| `vcs-contract.md` — 5 rows + enum sentence | ~10 |
| **Total** | **~360** |

That is inside the proposal's 150-400 band, but **not comfortably** — and the proposal already said
so. The measurement here is slightly kinder than the proposal's 380-400 because two planned
`whoami` scenarios collapsed into a leaner shape, not because anything was cut.

**Recommendation: take the split.** The seam is already named in the proposal's Scope and falls out
of D1 for free:

- **PR1 — transport verbs** (`whoami`, `commitStatus`): all 10 fixtures, `PROVIDERS` additions, the
  in-loop transport tests, the three GitHub-only `commitStatus` divergence tests, and the `whoami`
  + `commitStatus` doc rows. ≈ **250 lines**.
- **PR2 — pure derivations** (`projectResolve`, `repoCloneUrl`, `patSetupUrl`): no fixtures, the
  three in-loop tests, the three standalone divergence tests, and the three remaining doc rows.
  ≈ **110 lines**.

Each half is independently green (they share nothing but the loop they sit in), independently
reviewable, and independently revertable. ~360 lines in one PR is a reviewer asked to hold ten
fixtures and six divergence locks in their head at once — the review quality cost is real even
though the number technically fits. Prefer the split over a `size:exception`.

Final call belongs to `sdd-tasks` under the Review Workload Guard; this design supports either
path without rework, because the split boundary is the D1 boundary.

---

## Risks and unresolved items

| Risk | Impact | Mitigation |
|---|---|---|
| `gh api /user` unavailable/unauthenticated at apply time, so fixture #1 cannot be recorded | Low | Fall back to `derived: true` with the reason in `_provenance.note`. Do NOT mark a hand-authored payload `recorded`. The suite is green either way. |
| Three latent defects locked here are read as "approved behavior" | Med | Every lock's assertion message says **PINNED NOT FIXED** and names the follow-up. `sdd-tasks` must include filing the follow-up issues as deliverables — the locks are only honest if the issues exist. |
| Doc rank-label collision (`rank-6` already used by #365) | Low | Resolved above: cite "final Gap-A batch", never "rank-6". |
| `new URL()` parsing of `https://oauth2:x@undefined/...` behaves differently on a future Node | Low | Verified against WHATWG URL semantics — `undefined` is a valid hostname label. If Node ever rejects it, the test fails loudly rather than silently passing, which is the correct failure mode for a defect lock. |
| Placeholder credential still trips an over-eager scanner | Low | `placeholder-not-a-real-token` has no token-format prefix and no entropy run; it reads as prose. Existing precedent `sample-cred-9x7` (`:739`) has never tripped anything. |

**Unresolved, deferred by design:** whether the three latent defects get fixed. Out of scope here
by the proposal's explicit statement. This slice makes them visible and testable — a prerequisite
for fixing them safely, since a fix now would have no failing test to prove it worked.
