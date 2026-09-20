---
status: tasked
issue: 888
---

# Explore: #888 — the lane ships (push + PR through the port, credential off the capturing session)

Parent #864 task 3.1b, ADR-0034 L5. Depends on #887 (landed, `2ec28558`) as enablement, not a
filing blocker. Ruling: `openspec/changes/archive/862/{design,spec}.md`, `adr-0034-memory-travels-on-its-own-lane.md`.
`mrAutoMerge` (#886) landed and archived.

## Current state, measured

**#887's collector stops at a LOCAL ref.** `collectLane({root})` (`brain/scripts/memory/lane/collect.mjs:199`)
enumerates worktrees, plans (`lane/plan.mjs`), hashes winners, and does `git update-ref
refs/heads/memory/<host>-<date> <commit> <old>` (`collect.mjs:320`) — **no push, no PR**.
`memory/cli.mjs:294` says it explicitly: *"neither this op nor `lane/collect.mjs` ever pushes a
ref, opens a PR, or is called from a hook (D7)"*. Return shape: `{ref, commit, collected, skipped,
duplicates, baseFetched}` — `commit: null` when nothing new. `defaultGit(argv,{cwd,input,env})`
(`collect.mjs:44`) is **exported** — the exact seam #888 should reuse for the push, not a new one.

**The port.** `mrCreate({project,title,body,head,base='main',labels=[]}) -> {url}|{url:null,error}`
(`github.mjs:572`, `gitlab.mjs:1113`), never throws. `mrAutoMerge({project,number,requiredReviews=1,...})
-> {enabled:true,url:null|web_url}|{enabled:false,reason,error?}` (`github.mjs:620`, ADR-0034 L2),
`reason ∈ {'requires-human-approval','unsupported','transport'}`, refusal is the FIRST statement —
no seam touched when `requiredReviews !== 0`. `mrList({project,state}) -> [{number,title,headBranch}]`
(`github.mjs:457`, `gitlab.mjs:612`) **exists on both providers** — the PR-exists-by-head-branch
lookup #888 needs is already there, no new verb required. `getVcs({config,env,provider,identity})`
(`vcs/cli.mjs:128`) resolves the provider and, if `identity` is given, `bindIdentity` wraps every
function export in `runAsIdentity` (`cli.mjs:166`) — that is the credential-binding seam. Without
an explicit `identity`, `getVcs` falls back to `_token(name)` = `vcsToken(provider)` = the single
generic **`VCS_TOKEN`** env var (`vcs/lib/token.mjs:11,49` — ADR-0007). **`BRAIN_MEMORY_TOKEN` is
not a name `getVcs` knows about** — it can only reach the port via an explicit `identity:` argument,
never the default fallback. `brain.config.json`: `vcs.provider: "github"`, `governance.tier: "lite"`.
`governance-tiers.mjs:265,277,292` — `tierParams('lite').requiredReviews === 0`, `standard`/`regulated`
`=== 1`.

**Credential.** `credential-env.mjs`'s `withoutCredentials(env,names)` (`:158`) and
`credentialEnvNames({extra})` (`:135`) strip `REVIEWER_TOKEN_ENV`, `VCS_TOKEN`, and
`FORGE_TOKEN_ENV` (`GH_TOKEN`, `GITHUB_TOKEN`, …) from a spawned child's env. **`BRAIN_MEMORY_TOKEN`
is not in that list today** — any future spawn that must NOT see it needs `extra:
['BRAIN_MEMORY_TOKEN']`. ADR-0033's precedent for "separate process, explicit credential, never
ambient": the cold-review producer is spawned via the harness with a scrubbed `env`
(`credential-env.mjs` header). No existing brain script reads a `BRAIN_*_TOKEN` the way #888 needs
to — `token.mjs` is single-name by design (ADR-0007) — so `ship.mjs` reads `BRAIN_MEMORY_TOKEN`
itself (a new, literal read, same shape as `REVIEWER_TOKEN_ENV`), never through `vcsToken()`.

**`pre-push` (`brain/scripts/hooks/pre-push`)** runs `memory/cli.mjs share` and `feature-checkpoint`
on every push, any branch — this is exactly what ADR-0034 says a lane push must not trigger, and
the collector's own `--no-verify` push is *why* it doesn't (no worktree is ever checked out onto
`memory/<host>-<date>`, so no local hook fires for that push in the first place — L9's own words).
**The lane's own push (#888, not the collector) also needs `--no-verify`** for the same reason:
pushing a *computed* ref, never a checked-out branch. `.claude/settings.json` has `PreToolUse`
(blocks `--no-verify` **inside a Bash tool call**, via `tool_input.command` regex) and
`SessionStart` (`npm run brain:session:start`) hooks — **no `SessionEnd` hook exists yet**. The
PreToolUse block is scoped to the Claude Code Bash tool, not to `child_process.spawnSync` calls
made from inside a Node script, so it does not intercept `ship.mjs`'s own internal git push — but
it DOES mean a session cannot type `git push --no-verify` directly in a Bash tool call to invoke
ship manually; it must go through `npm run memory:ship`.

**`day-start.mjs`** step 5 ("Team memory", `:335-382`) does `import`/`brain-to-engram`/`export` —
no sweep for stale/local lane refs and no ship invocation. Wiring `day:start`'s sweep is new work,
not an extension of an existing branch.

**`run-check.mjs` `runIssueLinkCheck` (`:313`)**: no lane awareness yet. `:320-326` is the
non-string-body guard; `issueLink(ctx.body)` at `:327` runs next; `requiresClosingKeyword` at
`:330`; the closing-keyword refusal is `:341-349`. **Until #889 lands the `^memory/` + path-check
short-circuit, a real lane PR opened by #888 would be REFUSED by `issue-link`** (no closing
keyword, no issue reference by design) — #888 can build, test (with a fake port), and dry-run the
`ship` verb; it cannot land a merging lane PR against this repo's own gates before #889.

**Precedent: `brain-ship.mjs`** (`runShip`, `:117`) is the closest shape — injected async fns
(`checkFn`, `issueViewFn`, `labelPreflightFn`, `mrCreateFn`), never a bound port object, tested by
passing fake functions directly (`brain-ship.test.mjs:37-40`). It calls the provider module
**directly** (`await import('./vcs/providers/${provider}.mjs')`, `brain-ship.mjs:231`), bypassing
`getVcs`'s identity binding entirely — **#888 must NOT copy that part**: ADR-0033's whole point is
the identity/credential seam, so the lane ship needs `getVcs({identity})`, not a raw provider
import. What #888 SHOULD reuse: the injected-function test shape, `resolveIssueNumber`'s
fail-closed pattern, and `buildPRBody`-style pure string builders (here: the `Memory lane: <host>
<date>` body, `L1`/spec.md's exact format).

## The ship sequence

```
1. collect     → collectLane({root})                              (#887, already lands a LOCAL ref)
                 commit === null → done, exit 0, no push, no PR, no mrAutoMerge call
2. push        → git(['push','--no-verify','origin',`${ref}:${ref}`], {cwd:root})   (defaultGit, reused)
                 plain push, never --force — CAS in step 1 already made it a fast-forward
                 of whatever the previous same-day ship pushed (a same-day re-run appends)
3. PR lookup   → getVcs({identity}).mrList({project, state:'open'})
                 find by headBranch === localBranchName(ref) — idempotency: PR already open? skip mrCreate
4. mrCreate    → getVcs({identity}).mrCreate({project, title, body, head, base:'main'})
                 title/body per ADR-0034 L1: body line `Memory lane: <host> <date>`, NO issue ref
5. mrAutoMerge → getVcs({identity}).mrAutoMerge({project, number, requiredReviews: tierParams(tier).requiredReviews})
                 lite → armed; standard/regulated → refused('requires-human-approval'), PR stays open
                 never throws either way — report the outcome, never fail the ship on a refusal
```

Credential: `identity = (unattended ? readBrainMemoryToken() : null)` — at `lite` on a developer
machine, `identity: null` lets `getVcs` fall through to ambient (`VCS_TOKEN` if set, else the
provider's own ambient `gh`/`glab` session); on an unattended host, `identity:
process.env.BRAIN_MEMORY_TOKEN` is passed explicitly, and the ship process's own env, if it ever
spawns anything else, must go through `withoutCredentials(env, credentialEnvNames({extra:
['BRAIN_MEMORY_TOKEN']}))`.

## Approaches, with tradeoffs

**A — reuse `brain-ship.mjs`'s shape vs. a new `lane/ship.mjs`.** A separate `memory/lane/ship.mjs`
exporting `shipLane({collectLaneFn, pushFn, mrListFn, mrCreateFn, mrAutoMergeFn, tier, host, date,
project, identity})` — mirrors `runShip`'s injected-fn shape (testable with plain fakes, no port
object) but lives beside `plan.mjs`/`collect.mjs`, not in `brain-ship.mjs` (feature-PR shipping is
a different governance class entirely: labels, `Closes #N`, `deriveBranchType` — none of which
apply to a lane). **Chosen implicitly by the ticket's file list** (`memory/cli.mjs` `ship` op
"dispatched before backend selection like `collect`") — a `brain:memory:ship` verb, not a
`brain:ship` extension. Rejected: extending `runShip` with a lane branch — mixes two governance
classes (labels/issue vs. no-labels/no-issue) in one function's control flow.

**B — hook spawns `npm run memory:ship` detached vs. synchronous.** ADR-0034 says the trigger is
the session-end hook, `day:start`'s sweep, or by hand — L9's p50 ≤ 1h target does not demand
in-band completion. A `SessionEnd` hook that `spawnSync`s `npm run memory:ship` synchronously
(mirroring `SessionStart`'s `npm run brain:session:start` — same block shape, no precedent for
detached/background hooks in this repo's `.claude/settings.json`) is simpler and matches the one
existing hook's own shape; a detached spawn risks the session exiting before the child's push
lands, with no visible failure. Recommend synchronous, bounded by a short timeout, non-blocking on
failure (same "tooling problem must never block" discipline as `pre-push`).

**C — where the token comes from.** `BRAIN_MEMORY_TOKEN` is read directly (`process.env` or the
`.env`-then-shell reader `readEnv`, `token.mjs`'s own pattern) inside `ship.mjs`'s CLI entry,
never through `vcsToken()` (that function is hardcoded to the single `VCS_TOKEN` name, ADR-0007 —
respelling it to accept a second name would reopen the "one credential" ADR). "Unattended" is
detected the same way `agent-runtime.mjs`/`day-start.mjs` already detect non-interactive contexts,
or simply: `BRAIN_MEMORY_TOKEN` set → unattended path; unset → `lite` ambient path. Simpler than
threading a `--unattended` flag, and fail-closed in the interesting direction (a host with neither
set falls through to ambient `gh`, which is correct at `lite` on a workstation).

## Open questions for the proposal

- **Trigger wiring now vs. after #889.** The `ship` verb, its PR-exists check, and `mrCreate`
  itself can be built, tested (fake port), and `--dry-run`'d before #889 lands — but a REAL lane PR
  opened against this repo today is refused by `issue-link` (measured above). Does #888 wire the
  `SessionEnd` hook and `day:start` sweep now (dormant/erroring safely until #889 merges), or land
  the verb only and defer trigger wiring to land atomically with or after #889?
- **PR-exists detection cost.** `mrList` fetches ALL open PRs (`per_page=100`, no head-branch
  filter param in either provider's current signature) then filters client-side — fine at this
  repo's scale, but worth naming as a scan, not a targeted lookup.
- **Token scoping test.** Should #888 add `BRAIN_MEMORY_TOKEN` to `credentialEnvNames`'s
  documented `extra` usage as a *regression test* (assert it never leaks into any OTHER spawned
  process this repo already has, e.g. the cold-review producer), or is that out of scope /
  #889's — the risk is named in `design.md:222-223` but ownership isn't assigned.
- **What "unattended" means, precisely.** No existing brain module defines this predicate; #888
  either defines it narrowly (presence of `BRAIN_MEMORY_TOKEN`) or the proposal should say so
  explicitly rather than leave it implicit in the code.

## Files to touch, tests first (STRICT TDD)

| file | action | tests first |
|---|---|---|
| `brain/scripts/memory/lane/ship.mjs` | create — `shipLane({...injected fns})`, orchestration only, mirrors `runShip`'s injection shape | `brain/scripts/memory/lane/ship.test.mjs` (unit, all fakes: `commit:null` → no push/PR/merge; PR-already-exists → skip `mrCreate`, still call `mrAutoMerge`; `requiredReviews:1` refusal path never touches `mrCreateFn`'s the-merge-call twice; never throws) |
| `brain/scripts/memory/cli.mjs` | modify — `"ship"` in `VALID_OPS` (`:103-118`), dispatch block after `collect` (`:355`), `--json`/`--dry-run` | `brain/scripts/memory/cli.ship.test.mjs` (CLI, `BRAIN_MEMORY_TEST_ROOT`, mirrors `cli.collect.test.mjs`'s pattern) |
| `brain/scripts/lib/credential-env.mjs` OR a new `memory/lib/memory-token.mjs` | modify/create — read `BRAIN_MEMORY_TOKEN`, decide unattended vs. ambient | unit test: token present → identity bound; absent → `identity: null` |
| `.claude/settings.json` | modify — add `SessionEnd` hook, `npm run memory:ship` (or guarded no-op until #889) | `settings-hooks.test.mjs` precedent (`brain/scripts/harness/backends/settings-hooks.test.mjs`) — behavioural assertion on the hook block, not a source grep |
| `brain/scripts/day-start.mjs` | modify — sweep step, calling `ship` for sessions that ended badly | extend `bootstrap-smoke/smoke.mjs`'s `6/6` assertion path, or add a sub-step per day-start.mjs:316-319's "no seventh `sep()`" precedent |
| `package.json` | modify — `"memory:ship": "node ./brain/scripts/memory/cli.mjs ship"` | — |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | modify — `memory.ship.*` keys, mirroring `memory.collect.*`'s 8-key set | `i18n/coverage.test.mjs` (unmodified, both catalogs) |

Not this ticket (per scope): `issue-link`/`actor-check` lane recognition (#889), `pre-push`'s
`share` retirement (#890/3.1d).
