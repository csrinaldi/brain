---
status: draft
issue: 942
---

# Design — a deny list that cannot be read is not an empty deny list

Measured on worktree `brain-issue-942`, base `8ec69885`. Every ruling R1–R12 is honoured; no
deviation was required. Design decisions below are D-numbered and each names what it rejected.

## Technical approach

One new PRIMITIVE shares the READ and nothing else (R3). Five deny readers stop swallowing; three
call sites turn the throw into a refusal, each reusing a shape that already exists in its own file.
No gate contract, no config schema, no CI context changes.

```
            lib/brain-config.mjs
            loadBrainConfigOrThrow(root)      ENOENT ⇒ {}   |   anything else ⇒ throw
                   │            │            │
      ┌────────────┘            │            └──────────────┐
      ▼                         ▼                           ▼
 actor-check.mjs        brain-writes-reviewed.mjs      approve/cli.mjs
 defaultReadDenyActors  readBotAllowlist+ApprovalActors  readDeny/AgentActors
      │                         │                           │
      ▼ (throw propagates)      ▼                           ▼
 runActorCheck catch     runBWR catch (made               call-site catch
 :1325-1341 — ALREADY    tier-aware, same shape)          say('✗ …'); done(1)
 tier-aware              → fail at `required`             → exit 1, no stack trace
      ▼                         ▼                           ▼
 `actor-check: fail`     `brain-writes-reviewed: fail`   TTY refusal
```

## D1 — the primitive

```js
// brain/scripts/lib/brain-config.mjs — new export, alongside loadBrainConfig()
export function loadBrainConfigOrThrow(root = REPO_ROOT) {
  const path = join(root, 'brain.config.json');
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return {};                       // nothing to read
    throw new Error(`brain.config.json at ${path} could not be read: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`brain.config.json at ${path} could not be parsed: ${err.message}`);
  }
}
```

- Mirrors `memory/lib/upstream-records.mjs:61-77` `loadBrainConfigAt` byte-for-byte in behaviour —
  the house model, and the only reader in the tree that already distinguishes absent from
  unreadable. The message names the PATH and the failure KIND ("could not be read" vs "could not be
  parsed"); the parse wrapper deliberately does not say "is not valid JSON", because the wrapped
  `JSON.parse` message already ends that way (#701 cold review round 2).
- **How it differs from `loadBrainConfig()` (untouched, R8)**: `loadBrainConfig()` throws on BOTH
  absence and malformation and resolves `CONFIG_PATH` from the module location only. Its five
  callers (`run-check.mjs`, `governance-tiers.mjs`, `phase-order-check.mjs`, `approved-label.mjs`,
  `approve/cli.mjs`) correctly read any throw as "absent"; changing it would change their failure
  contract for no gain.
- **`root` default**: `REPO_ROOT` is the module-relative constant already computed at
  `brain-config.mjs:20`. So `approve/cli.mjs` calls `loadBrainConfigOrThrow()` with no argument and
  resolves the same file `loadBrainConfig()` resolves today (no behaviour change on the happy path),
  while the gate readers, which already hold a `cwd`, call `loadBrainConfigOrThrow(cwd)` and keep
  the self-judging property (explore §7). One function, both call conventions, no second constant.
- *Rejected*: a `{ ok, config, error }` result object — the three consumers differ in policy, and a
  result object makes ignoring the error the path of least resistance, which is the defect.

## D2 — reader-by-reader table

| Reader | file:line | Key | Direction | Change |
|---|---|---|---|---|
| `defaultReadDenyActors` | `vcs/actor-check.mjs:1099-1108` | `reviewActors ∪ agentActors` | **deny** | `loadBrainConfigOrThrow(cwd)`, `catch` removed |
| `defaultReadBotAllowlist` | `vcs/brain-writes-reviewed.mjs:249-258` | `reviewActors` | **deny** (human-approver exclusion) | `catch` removed |
| `defaultReadApprovalActors` | `vcs/brain-writes-reviewed.mjs:269-278` | `approvalActors` | allow (override whitelist) — in R-scope | `catch` removed; see D3 |
| `defaultReadDenyActors` | `approve/cli.mjs:116-122` | via `approvalDenySet` | **deny** | `loadBrainConfigOrThrow(root)`, `catch` removed, exported |
| `defaultReadAgentActors` | `approve/cli.mjs:133-140` | `agentActors` | **deny** (names the key) | same; call-site guard at `:246-247` KEPT |
| `defaultReadBotAllowlist` | `vcs/actor-check.mjs:1058-1066` | `approvalActors` | allow | **unchanged, deliberately** |
| `defaultReadAgentActors` | `vcs/actor-check.mjs:1146-1155` | `agentActors` | allow (commit exemption) | **unchanged, deliberately** |
| `defaultReadConfig` | `actor-check.mjs:1157-1165`, `brain-writes-reviewed.mjs:286-292` | tier | ratified default | **unchanged** — REQ-TIER-10; must not throw, `resolveTierForFailure` depends on it |
| `readConfigSafe` | `governance-tiers.mjs:517-522` | tier | ratified default | **unchanged** |
| `defaultReadConfig` | `vcs/phase-order-check.mjs:484-491` | tier | ratified default | **unchanged** |
| `loadFullConfig` | `brain-check.mjs:52-59` | `ignoreList` | allow | **unchanged** |
| `ignoreList` readers | `governance/run-check.mjs:164-172`, `brain-audit.mjs:159-166`, `brain-metrics.mjs:121-128`, `vcs/diff-size-count.mjs:91-100` | `ignoreList` | allow | **unchanged** — empty makes diff-size stricter |
| label reader | `governance/approved-label.mjs:44-51` | `approvedLabel` | allow | **unchanged** |
| secret-scrub readers | `memory/backends/plainfiles.mjs:41-47`, `engram.mjs:448-456`, `memory/lane/collect.mjs:94-100`, `governance/lane-scrub.mjs:53-58` | `memory.secrets` | out of scope | **unchanged** — #712 |

The asymmetry is the point: fourteen readers keep `catch { return [] }` and five lose it. A reviewer
who wants to check R1 reads the Direction column.

## D3 — the one measured correction inside R-scope (not a deviation)

The exploration classified `brain-writes-reviewed.mjs:269-278` `defaultReadApprovalActors` as
deny-direction. Measured, it feeds `overrideActors` → `overrideLabelPresent` (`:355, :358`): empty
means NO override is honoured, i.e. **stricter** — allow-direction by R1's test. R1 says an allow
reader *MAY* degrade, so hardening it violates nothing, and the proposal's Scope names both readers
at `:249-278`. It is also **behaviourally unobservable**: `readBotAllowlist()` runs first (`:354`)
and throws before `readOverrideActors()` (`:355`) is ever called. Kept in scope for one-file
consistency, recorded here so a reviewer is not misled into thinking it carries the fix.

## D4 — the three refusal surfaces

**1. `actor-check` — verified, no new plumbing.** `readDenyActors()` is called at `:1245`, inside
`gatherActorCheckInputs`, which `runActorCheck` calls inside its `try` at `:1324`. The catch at
`:1325-1341` resolves the tier via `resolveTierForFailure` (which cannot itself throw — it uses the
ratified-default `defaultReadConfig` and falls back to `'standard'`) and then
`resolveGatePolicy('actor-check', tier)`. `GATE_MATRIX:207-209` is `required` at all three tiers, so
the verdict is `fail` at every tier. **Confirmed by reading: a throw routes through the existing
tiered catch with zero new plumbing.** The only edit needed is the reason string — today it reads
`could not gather inputs (gh api failure?)`, which would send an operator to GitHub for a broken
local file. It becomes `could not gather inputs (gh/api or brain.config.json failure) — ${err.message}`;
`err.message` already names the path and the parse error.

**2. `brain-writes-reviewed` — the catch becomes tier-aware (R6), mirroring actor-check.**

```js
// :407-415 replacing the unconditional warn
} catch (err) {
  const tier = resolveTierForFailure(cwd, deps);           // local helper, same shape as
  if (resolveGatePolicy('brain-writes-reviewed', tier) === 'required') {   // actor-check:1181-1189
    return { level: 'fail', reason:
      `brain-writes-reviewed: could not gather inputs (gh/git or brain.config.json failure) — ` +
      `${err.message} — failing closed: this gate is required at the "${tier}" tier.` };
  }
  return { level: 'warn', reason: `… (detection-tier at "${tier}").` };
}
```

`resolveGatePolicy` is imported from `./governance-tiers.mjs` — already imported at `:21` for
`resolveTier`/`tierParams`, so R4 holds: the file's only NEW import edge is `lib/brain-config.mjs`.
`resolveTierForFailure` is duplicated as a ~10-line local helper rather than imported from
`actor-check.mjs`: a gate→gate import edge between L5 and L6 is a worse coupling than a helper whose
whole body is "resolve the tier without throwing" (*rejected*: exporting it from `actor-check.mjs`;
*rejected*: moving it to `governance-tiers.mjs`, a wider refactor than this change pays for).
`GATE_MATRIX:216-218` is `required` at all three tiers, so the branch is `fail` today and the
`detection` arm is dead-but-correct, exactly as in `actor-check`.

**R7 (same change)**: `:365-370`'s "while this job is detection-only (DETECTION_JOBS)" is false —
`DETECTION_JOBS` is empty (`tranche.test.mjs:164`) and `checkContexts('standard')` returns ten
required contexts. The docstring is rewritten to state the tier-aware rule the code now implements.

**3. `approve/cli.mjs` — `say('✗ …'); return done(1)`.** The deny reader is called UNGUARDED at
`:234`, and the entrypoint at `:341-359` has no `try`, so a throw today would be an unhandled
rejection and a raw stack trace in a TTY. The call site is wrapped in the shape the `whoami` failure
already uses at `:221-227`:

```js
let denyActors;
try { denyActors = readDenyActorsFn(); }
catch (err) {
  say(`✗ could not read the approval deny list: ${err.message}`);
  say('  A deny list that cannot be read denies nobody — refusing to sign until it parses.');
  return done(1);
}
```

The agent-list reader's existing call-site guard (`:246-247`) is KEPT untouched: `approve/cli.test.mjs:252-266`
already pins that "a message cannot turn a refusal into a crash", and that test must stay green
byte-for-byte — it is the pre-existing lock that proves the refusal shape, not a new one.

## D5 — test plan (STRICT TDD, `node --test`)

Red first, per case. All fixtures use `testTmp()` (`lib/test-tmp.mjs:35`) — temp dirs only, never
the real clone, never the real `.memory`. Neither case exists in the tree today.

| # | Test file | Fixture | Assertion |
|---|---|---|---|
| T1 | `lib/brain-config.test.mjs` | dir with no file | `loadBrainConfigOrThrow(dir)` returns `{}` |
| T2 | `lib/brain-config.test.mjs` | `brain.config.json` = `{oops` | throws; message contains the path and `could not be parsed` |
| T3 | `lib/brain-config.test.mjs` | `brain.config.json` is a DIRECTORY | throws `could not be read` (proves ENOENT is the only exemption) |
| T4 | `vcs/actor-check.test.mjs` | unparseable config, `cwd: dir`, NO `readDenyActors` injected | `runActorCheck` → `level: 'fail'`, reason matches `/brain\.config\.json/` |
| T5 | `vcs/actor-check.test.mjs` | no config at all, same call | today's behaviour: not `fail` for this reason; deny set empty (R11) |
| T6 | `vcs/brain-writes-reviewed.test.mjs` | unparseable config, `cwd: dir`, no reader injected | `runBrainWritesReviewedCheck` → `level: 'fail'` (not `warn` — this is R6's lock) |
| T7 | `vcs/brain-writes-reviewed.test.mjs` | no config at all | `botAllowlist: []`, gate reaches its normal verdict (R11) |
| T8 | `vcs/brain-writes-reviewed.test.mjs` | unparseable config + `deps.tier` forced to a hypothetical detection cell | the `warn` arm is reachable (guards the dead branch) |
| T9 | `approve/cli.test.mjs` | exported `defaultReadDenyActors(tmpDir)` with unparseable config | throws, message names the file |
| T10 | `approve/cli.test.mjs` | exported `defaultReadDenyActors(tmpDir)`, no config | returns `[]` (R11) |
| T11 | `approve/cli.test.mjs` | `runApprove` with `readDenyActorsFn: () => { throw … }` | `exitCode === 1`, output matches `/^✗/m`, promise does NOT reject, `prReviewComment` call count `0` |
| T12 | mutation guard (one per call site) | restore `catch { return [] }` in any hardened reader | at least one of T4/T6/T9 goes red |

`approve/cli.mjs`'s two default readers gain an optional `root` parameter and are EXPORTED so T9/T10
can drive them against a temp dir; passing `undefined` falls through to `REPO_ROOT` (D1), so the
production call sites are unchanged. Note `cli.test.mjs:244-250` asserts the file does not re-derive
`governance?.reviewActors` — the change keeps importing `approvalDenySet`, so that lock stays green.

## D6 — the R2 doctrine draft

File: `openspec/changes/issue-942-deny-fail-closed/brain-drafts/deny-readers-fail-closed.draft.md`
(written by `sdd-apply`; never `brain/core/**` directly).

- **Target**: `brain/core/anti-patterns/evidence-reader-empty-on-failure.md` — non-ADR, so the
  contract needs `target:` + `body:` only (no `amendment:`, and `home-summary:` is REFUSED for a
  non-ADR target, `amendment-draft.mjs:151-153`).
- **Anchor passage**: §"Solution / correct pattern", the line at `:34`:
  `` `null` — REQUIRED gates fail closed ("cannot fetch labels — failing closed"), ``
  `amend-replace` rewrites that line to add the direction clause in place, so a reader who never
  scrolls to the appended section is not left with the undirected rule (§1c act 2).
- **Uniqueness requirement**: `assessEdit` (`lib/amendment-draft.mjs:412-420`) computes
  `free = f − r·k` over overlap-counting `countOccurrences` and returns `pending` ONLY when
  `free === 1`; `applyEdits` refuses anything else rather than editing something adjacent. So the
  `amend-find` text MUST occur **exactly once** in the target. The chosen line qualifies: the string
  `cannot fetch labels` occurs once in the 53-line file.
- **In-flight collision check**: grepped every `openspec/changes/*/brain-drafts/**` — no unarchived
  draft targets `evidence-reader-empty-on-failure.md`. The nearest neighbour,
  `issue-405-inline-review-comments/brain-drafts/anti-pattern-mutation-blind-by-axis.md`, creates a
  DIFFERENT file. Constraint recorded for `sdd-apply`: if a sibling draft lands on this anchor
  before promotion, one of the two must move to a different unique line — two drafts anchoring the
  same text make the second one `blocked`, not merged.
- **Body**: appends `## Direction decides whether empty is safe (issue #942)` — R1's rule, the
  deny/allow table's shape, and the named exemption for ratified tier defaults.

## D7 — line budget

`governance.ignoreList` (`brain.config.json:18-29`) excludes `**/*.test.mjs` and
`openspec/changes/**`, so tests AND the doctrine draft are outside the counted diff
(`vcs/diff-size-count.mjs:54-72`, additions + deletions).

| Counted file | Est. counted lines |
|---|---|
| `lib/brain-config.mjs` | ~26 (docblock + body, pure addition) |
| `vcs/actor-check.mjs` | ~14 (reader ~8, reason string ~4, docblock ~2) |
| `vcs/brain-writes-reviewed.mjs` | ~58 (2 readers ~18, tier-aware catch ~20, helper ~12, docstring ~8) |
| `approve/cli.mjs` | ~30 (2 readers ~14, call-site guard ~10, docblocks ~6) |
| **Total counted** | **~128** (R12 said ~110; still far inside 400) |
| Uncounted | tests ~180, draft ~45 |

`400-line budget risk: Low`. R12's pre-declared chain boundary (PR1 = R3 + actor-check +
approve/cli; PR2 = R6 + R7 + L6) stays unused unless the L6 surface triples.

### Failure modes

| Failure | Direction today | After |
|---|---|---|
| `brain.config.json` malformed | all deny sets empty ⇒ gates pass, `brain:approve` signs | `actor-check` fail, `brain-writes-reviewed` fail, `brain:approve` exit 1 |
| `brain.config.json` absent | `{}` ⇒ empty ⇒ green | identical, green (R11) |
| `brain.config.json` is a directory / EACCES | empty ⇒ green | throws `could not be read` ⇒ fail closed |
| `governance.tier` unknown, config parses | throws in `gatherInputs` ⇒ already fails closed | unchanged |
| config parses, `reviewActors` is a scalar | `approvalDenySet` returns `[]` | unchanged — a parsed config is genuinely computable |

## D8 — the operational consequence, and where the operator reads it

Ratified: **an unparseable `brain.config.json` now reds every PR in the repo at once** — every open
PR runs `actor-check` and `brain-writes-reviewed` against its own checked-out tree (explore §7), so
one bad commit on the trunk turns them all red simultaneously. The message must therefore be
self-servicing at four surfaces:

1. **CI job log** — `actor-check.mjs:1357-1358` / `brain-writes-reviewed.mjs:431-432` print
   `<gate>: fail` then the reason, which carries the primitive's `brain.config.json at <path> could
   not be parsed: <JSON.parse message>` verbatim (path + kind + parser offset). This is why D4's
   reason-string rewording is load-bearing: without it the line blames the gh API.
2. **Local, before pushing** — `check-refs.mjs:133-152` already prints
   `✗ brain.config.json is present but unreadable`; unchanged, and now it is the cheap early copy of
   the same verdict.
3. **`brain:approve`** — refuses in-terminal before any network call (D4.3), so a maintainer cannot
   sign around the broken file.
4. **The draft doctrine** — states the direction rule so the next reader of a hardened reader knows
   the `catch` was removed on purpose.

R9 stands: no `config-parses` job is added, because R1 already makes the condition red at
`actor-check` and a new required context is a branch-protection change in another risk class.

## Open questions

None blocking. The four exploration questions are all closed by ratified rulings (R6, R5, R10, R8).
