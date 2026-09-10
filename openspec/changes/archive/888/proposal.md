---
status: tasked
issue: 888
epic: 864
---

# Proposal — #888 the lane ships: the push, the PR, and a credential the capturing session never holds

Parent: #864 (memory 2.0), task 3.1b — Wave 3. Slice of the #862 ruling (ADR-0034 **L5**, with
L1's body grammar, L2's tier-gated merge, L9's declared `--no-verify` push). Owns the ruling's
`trigger + credential` requirement (`openspec/changes/archive/862/spec.md:76-88`, ownership table
`:134`). Enabled by #887 (`collect`, landed `2ec28558`) and #886 (`mrAutoMerge`, archived).

## What is wrong today

The lane exists up to a **local ref and no further**. `collectLane({root})`
(`memory/lane/collect.mjs:199`) enumerates worktrees, plans, hashes, and `update-ref`s
`refs/heads/memory/<host>-<date>` — then stops. `memory/cli.mjs:294` states the boundary in
capitals of its own: *"neither this op nor `lane/collect.mjs` ever pushes a ref, opens a PR, or is
called from a hook (D7)"*. So the measured latency ADR-0034 exists to fix — **p50 21.6 h, p90
399.7 h** learn→main — is unchanged: a record still reaches `main` only when the feature PR it is
sitting in does.

Every piece the push needs already exists and is unwired: `defaultGit` is **exported**
(`collect.mjs:44`), `mrList` exists on both providers (`github.mjs:457`, `gitlab.mjs:612`),
`mrCreate` never throws (`github.mjs:572`), `mrAutoMerge` refuses before it calls anything
(`github.mjs:620,625`), and `getVcs({identity})` binds every function export to one credential
(`vcs/cli.mjs:128,148,166`).

## What lands

`brain/scripts/memory/lane/ship.mjs` — `collect → push → find-or-create PR → arm auto-merge`, all
IO injected — plus a `ship` op on `memory/cli.mjs` and `npm run memory:ship`. It opens no
automatic trigger: the verb is invocable, and nothing invokes it yet (see D4).

## Decisions

### D1 — Module, verb, output shape

| option | what it means | cost |
|---|---|---|
| **(a) `lane/ship.mjs` + a `ship` op dispatched before backend selection** | beside `plan.mjs`/`collect.mjs`; joins `VALID_OPS` (`cli.mjs:103-119`) exactly as `collect` did; `package.json` gains `"memory:ship"` | one more op on a dispatcher that already carries fifteen |
| (b) extend `brain-ship.mjs`'s `runShip` with a lane branch | one shipping function | mixes two governance classes in one control flow — `runShip` resolves an issue, a `type:*` label, a closing keyword, none of which a lane has (L1). It also imports the provider **directly** (`brain-ship.mjs:231`), bypassing `getVcs`'s identity binding — the exact seam D3 depends on |
| (c) a new top-level CLI | a second memory entry point | a second dispatcher, i18n surface and test harness for one verb |

**Recommendation: (a).** ADR-0034 L5 names the verb `brain:memory:ship`; #887's D1 already reserved
it. `brain-ship.mjs` contributes its **shape**, not its imports: injected async fns, tested with
plain fakes (`brain-ship.test.mjs:37-40`), pure string builders for the body.

```
shipLane({ root, project, tier, dryRun, collectFn, git, mrList, mrCreate, mrAutoMerge })
  → { ref, commit, pushed, pr: {number,url}|null, autoMerge: {enabled,reason?}|null,
      collected, skipped, duplicates, baseFetched, dryRun }
```

**Failure convention — the CLI's, not the port's.** Dispatched before backend selection, so
`unsupportedOp` is unreachable and the port's never-throws discipline does not govern the op. It
follows `collect` exactly: own `try/catch`, `memory.ship.*` keys in `i18n/{en,es}.mjs`, exit 0/1,
`--json` on stdout only, evidence on stderr.

### D2 — The sequence, and what makes a re-run safe

```
1 collect     collectLane({root})  →  commit === null  ⇒  exit 0, "nothing to ship",
                                       no push, no mrList, no mrCreate, no mrAutoMerge
2 push        git(['push','--no-verify','origin',`${ref}:${ref}`])   — ADR-0034 L9, NEVER --force
                 non-fast-forward ⇒ report `diverged`, exit 1, nothing else runs
3 find        mrList({project, state:'open'})  →  headBranch === ref.replace('refs/heads/','')
4 create      absent ⇒ mrCreate({project, title, body, head, base:'main', labels: []})
5 arm         mrAutoMerge({project, number, requiredReviews: tierParams(resolveTier(config)).requiredReviews})
```

**Idempotency is `mrList`, not a stored marker.** A same-day re-run appends a commit to the ref
(#887 D2), pushes it as a fast-forward, finds the open PR by head branch, and skips `mrCreate`.
The scan is a scan, not a lookup: `mrList` fetches all open PRs (`per_page=100`, no head filter on
either provider) and filters client-side — fine at this repo's scale, named rather than hidden.

**`mrAutoMerge` is re-called on every run, unconditionally.** No read verb reports whether
auto-merge is already armed, and inventing one is new port surface (#886's ticket, not this one).
Re-arming is cheap and the verb never throws; **an already-armed refusal must be reported, never
fatal** — the assumption "`gh pr merge --auto` on an armed PR is benign" is **unmeasured** and is
carried as a Risk, with the mitigation being that no refusal reason fails the ship.

**The PR number comes from the URL.** `mrCreate` returns `{url}` only — no number, on either
provider — and `mrAutoMerge` needs one. Both providers' URLs end in the identifier
(`…/pull/123`, `…/-/merge_requests/12`), so the number is the trailing integer; if the match
fails, one `mrList` re-scan recovers it, and if that fails too the run reports `pr` with
`number: null` and skips step 5 rather than guessing.

**Body — L1's grammar, and nothing #889 has to parse.** Lane recognition is **structural**
(`archive/862/spec.md:16-18`: head `^memory/` **and** every diff path an addition under
`.memory/records/`), so the body is evidence for a human, not an oracle for a gate. Per
`archive/862/tasks.md:146-147`:

```
title: memory lane: <host> <date>
body:  Memory lane: <host> <date>
       Records: <n>
       - .memory/records/<file>.jsonl   (one line per record in this PR)
```

No closing keyword, no issue reference (L1 — the standing-issue alternative was rejected because
it reopens the #867 class), **no labels** (`labels: []`): a label on a lane is a claim
`actor-check` would have to read, and `actor-check`'s lane awareness is #889's.

### D3 — The credential (ADR-0033 shape, ADR-0034 L5)

**Measured**: `getVcs({identity})`'s `identity` is a **token value**, not a name — `const bound =
identity ?? _token(name)` (`vcs/cli.mjs:148`), and `_token` = `vcsToken()`, which knows the single
generic `VCS_TOKEN` (ADR-0007). There are **no named identities in `brain.config.json`**; the one
precedent is `review/cli.mjs:405` — `getVcs({...opts, identity: identity.token})`.

| option | what it means | cost |
|---|---|---|
| **(a) `identity = process.env.BRAIN_MEMORY_TOKEN ?? null`, read once, threaded** | token present ⇒ every verb runs bound to it; absent ⇒ `identity: null` and `getVcs` falls through to ambient (`VCS_TOKEN`, else the `gh`/`glab` session) — the `lite` developer path L5 allows | one literal env read outside `token.mjs` |
| (b) teach `vcsToken()` a second name | one reader | reopens ADR-0007's one-credential ruling for a caller that needs the opposite of a default |
| (c) a `memory.lane.tokenEnv` config key, like `reviewer.tokenEnv` | configurable | ADR-0034 names `BRAIN_MEMORY_TOKEN` literally; a config key nothing else reads is a knob with no second setting |

**Recommendation: (a)**, read **once** and threaded — never a second `process.env` read, for
`review/cli.mjs:392-401`'s stated reason: *"a second read is a second chance to differ from the one
that was checked"*.

**"Unattended" is the token's presence, not a property of the machine.** No brain module defines
that predicate; defining it by hardware or TTY would be a guess. `BRAIN_MEMORY_TOKEN` set ⇒ bound
identity; unset ⇒ ambient. Fail-open in the correct direction: a workstation with neither falls
through to the human's own `gh`, which is exactly what L5 permits at `lite`.

**The scoping is by construction, not by each caller remembering.** Export
`MEMORY_TOKEN_ENV = 'BRAIN_MEMORY_TOKEN'` from `lib/credential-env.mjs` and add it to
`credentialEnvNames()`'s **default** set (`credential-env.mjs:135-138`), beside
`REVIEWER_TOKEN_ENV`. ADR-0034's Risk 5 says the token is *"scoped to the ship process alone,
asserted via `withoutCredentials` everywhere else"* — a default entry makes "everywhere else" true
without an `extra: [...]` argument any future spawn could forget. That file's own doctrine agrees:
*"derived where there is a source"*. `credential-env.test.mjs` pins the name count and will fail
until updated — the intended signal, not a surprise.

### D4 — Triggers: the verb lands, the automatic callers do not

| option | what it means | cost |
|---|---|---|
| **(a) manual verb only this slice; wire `SessionEnd` + `day:start` in the slice that makes a lane mergeable** | `npm run memory:ship` works and is testable; nothing calls it automatically | L5's two automatic triggers arrive one slice later than the verb |
| (b) wire both now, dormant behind a config flag | triggers exist | a flag with one setting and no second, plus dead code paths nobody exercises |
| (c) wire both now, live | L5 satisfied literally | **measured harm**: `runIssueLinkCheck` (`run-check.mjs:313-349`) has no lane awareness until #889, so every lane PR is refused; a `day:start` sweep would open one un-mergeable PR per host per day |

**Recommendation: (a)** — and the cost is smaller than it looks, because `.claude/settings.json`
is **not** a hand-edited file. It is emitted by `compileSettingsHooksJson()`
(`harness/backends/settings-hooks.mjs:42`), which is shared by **both** platform backends and
whose output is asserted byte-equal against the committed `.gemini/settings.json`
(`antigravity.drift.test.mjs:111`). Adding `SessionEnd` there emits a Claude-Code-specific hook
name into Gemini's settings too — an unmeasured platform claim, made in the same slice as the push.
That belongs in its own change with its own evidence.

The ruling's two `trigger + credential` scenarios (`archive/862/spec.md:83-88`) are still satisfied
here, and both are asserted: `pre-push` does not invoke ship (true by construction — asserted
behaviourally, not by grep), and on a host with `BRAIN_MEMORY_TOKEN` the port is bound to it.
**Hand-off to #889**: the `SessionEnd` hook and `day:start`'s sweep, plus L7's first scenario
("a record does not wait for its feature") — which cannot pass before the gates recognise a lane
anyway, and which gates #890's retirements.

### D5 — What #888 proves without a live lane PR

A real lane PR is refused by `issue-link` today (measured). So the proof is local and complete:

- `--dry-run` collects, computes the ref, branch, title and body, and reports the plan with
  `pushed: false`, `pr: null` — **zero network calls**, no `git push`;
- unit tests drive `shipLane` with fakes for every injected fn;
- an integration test pushes to a **local bare remote** in a temp repo (real `git`), with fake
  `mrList`/`mrCreate`/`mrAutoMerge`, and asserts the pushed ref's commit contents;
- the first **real** lane PR is an exit criterion of **#889**, stated there, not claimed here.

### D6 — Scope

**In**: `lane/ship.mjs`; the `ship` op in `VALID_OPS` + its dispatch block (`--json`, `--dry-run`);
`MEMORY_TOKEN_ENV` in `lib/credential-env.mjs` and its default set; `memory.ship.*` in
`i18n/{en,es}.mjs`; `"memory:ship"` in `package.json`; the four test files below.

**Out / non-goals**: `issue-link` / `actor-check` lane recognition and the `lane-paths` /
`lane-scrub` required contexts (#889); `pre-push:70`'s `share` and the other four feature-PR
surfaces (#890); any change to `collect`, `plan`, `mrCreate`, `mrList`, `mrAutoMerge`,
`vcsToken()`, `share`, `memory-gate`, or the record format; a `mrMerge`/"is auto-merge armed" read
verb; `--force` in any form; a `SessionEnd` hook or a `day:start` sweep (D4).

**Doctrine**: no `brain/core/**` write, no `brain-drafts/` file — ADR-0034 already carries this
slice's ruling, and no drift guard reads it.

**Capabilities (contract with `sdd-spec`)**: **New: none. Modified: none.**
`openspec/specs/**` is empty in this repo by convention; the normative surface is ADR-0034 plus
`archive/862/spec.md`, neither of which changes here.

## STRICT TDD — tests first, in this order

1. `lane/ship.test.mjs` — unit, all fakes: `commit: null` ⇒ no push/list/create/arm;
   PR-already-open ⇒ `mrCreate` never called, `mrAutoMerge` still called; non-fast-forward push ⇒
   `diverged`, exit 1, no PR call; `requiredReviews: 1` ⇒ refusal reported, exit 0, PR left open;
   `--dry-run` ⇒ zero calls on every injected IO fn; the push argv contains `--no-verify` and never
   `--force`; the body matches L1's grammar exactly; the PR number is derived from the URL.
2. `credential-env.test.mjs` (extend) — `BRAIN_MEMORY_TOKEN` is in `credentialEnvNames()` by
   default and is stripped by `withoutCredentials` from a spawned child's env; the pinned count
   moves by exactly one.
3. `lane/ship.integration.test.mjs` — temp repo + local bare remote, real `git`, fake port: the
   ref lands on the remote with the expected tree; a second run fast-forwards and opens no second
   PR; a diverged remote is refused without force.
4. `memory/cli.ship.test.mjs` — `BRAIN_MEMORY_TEST_ROOT`, mirroring `cli.collect.test.mjs`:
   `--json` on stdout only, exit codes, and no printed token under either credential path.

Then `ship.mjs`, then `credential-env.mjs`, then the CLI op + i18n + `package.json`.

## Changed-line forecast (400-line budget)

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**` from the counted diff.

| path | counted |
|---|---|
| `brain/scripts/memory/lane/ship.mjs` | ~180 |
| `brain/scripts/memory/cli.mjs` (dispatch block) | ~45 |
| `brain/scripts/lib/credential-env.mjs` | ~12 |
| `brain/scripts/i18n/en.mjs` + `es.mjs` | ~20 |
| `package.json` | ~1 |
| **counted total** | **~258 — Low/Medium risk** |
| uncounted, reviewer-visible: 4 test files | ~450 |

**Recommendation: one PR, with a pre-agreed split line.** ~258 counted is inside the budget;
reviewer-visible is ~710. If the shell overruns, split where the design already draws the seam —
**PR 1**: `ship.mjs` + `credential-env.mjs` + tests 1–3 (a library with no user-invocable surface);
**PR 2**: the CLI op + i18n + `package.json` + test 4. Both are autonomous and revert cleanly.
`delivery_strategy: ask-on-risk` — the call belongs to `sdd-tasks`' forecast; this is its input.

## Risks

| risk | likelihood | mitigation |
|---|---|---|
| Re-arming an already-armed PR returns a refusal (**unmeasured** — no read-only probe was possible in this phase) | Med | `mrAutoMerge` never throws; **no** refusal reason fails the ship. The outcome is reported in `autoMerge.reason` and the run exits 0 |
| A lane PR opened by hand before #889 is refused by `issue-link` and lingers open | Med | no automatic trigger ships here (D4); `--dry-run` is the documented pre-#889 exercise. The stale PR is closed by hand |
| **The merged-lane residual.** After a lane merges (squash ⇒ merge base unchanged), a same-day re-run appends to the same local ref, so the next PR's three-dot diff re-lists already-merged records | Med | harmless by construction — identical bytes, still additions under `.memory/records/`, so `lane-paths` still passes and the merge is a no-op. Reported, not silently absorbed; pruning merged lane refs is `day:start` sweep work (#889/#890), and this slice **never** deletes a ref |
| `BRAIN_MEMORY_TOKEN` widens the credential surface ADR-0033 narrowed (the ADR's own Risk 5) | Med | default membership in `credentialEnvNames()` + a leak-regression test; the token is read once, threaded, and never printed (asserted) |
| `--no-verify` reads as a governance bypass | Low | ADR-0034 L9 rules it: a *computed* ref is never checked out, so there is no honest local hook to run. The PreToolUse guard still blocks a hand-typed `git push --no-verify` in a Bash tool call (`.claude/settings.json:9`) — the verb is the only sanctioned route |
| `mrList` scans every open PR per run | Low | named as a scan; a head-branch filter is provider surface, not this slice's |
| The verb ships and nothing calls it | High (by design) | intended, same as #887: `npm run memory:ship` is invocable by hand, so it is provable before its callers exist |

## Rollback

Revert the PR. No hook, no CI context, no config key and no existing op changes behaviour; the
only new default is one env-var name in a **denylist**, whose failure mode is a scrub that removes
one variable too few after the revert — no credential is granted by it. A run's durable side
effects are a remote branch and possibly a PR: `git push origin --delete memory/<host>-<date>` and
closing the PR removes both; records are append-only and nothing merged needs undoing.

## Success criteria

- [ ] `npm test` green; `npm run memory:ship -- --dry-run` prints the plan and makes zero network
      calls and zero `git push` invocations.
- [ ] `commit: null` from `collect` ⇒ exit 0, no push, no PR, no `mrAutoMerge` call — asserted.
- [ ] A second run on the same day fast-forwards the ref and opens **no** second PR.
- [ ] A diverged remote ref is refused (`diverged`, exit 1) and `--force` appears nowhere in the
      source or on any argv — asserted.
- [ ] With `BRAIN_MEMORY_TOKEN` set, every port call runs bound to it; unset, `identity` is `null`.
      The token is stripped from a spawned child by default and appears in no output.
- [ ] At `lite` (`requiredReviews: 0`) auto-merge is armed; at `standard`/`regulated` the refusal
      is reported and the run still exits 0.
- [ ] No hook file, no `.claude/settings.json` / `.gemini/settings.json` byte, no `brain/core/**`
      file, and no `collect`/port source is touched.

## Proposal question round

Each has a working recommendation above; none blocks `sdd-spec` / `sdd-design`.

1. **D4 defers L5's automatic triggers one slice.** The ruling assigns `trigger + credential` to
   3.1b, and this proposal satisfies both of its scenarios while shipping neither automatic
   caller — because a live lane PR is refused until #889 and the hook is compiler-emitted into two
   platforms. Is the deferral the intended reading, with the hook + sweep landing beside the gates?
2. **D3 changes a default denylist.** Adding `BRAIN_MEMORY_TOKEN` to `credentialEnvNames()`'s
   default set scopes it everywhere by construction, but it also widens a set the cold-review
   producer depends on and moves a pinned count. Default membership, or `extra: [...]` at each
   spawn site?
3. **The merged-lane residual (Risk 3).** Is re-listing already-merged records in a later same-day
   lane PR acceptable, or should ship prune/re-parent the local ref — a mutation #887 deliberately
   declined to make?
4. **Delivery.** One PR at ~258 counted / ~710 visible lines, or the library/CLI split from the
   start?
