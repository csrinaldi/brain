# Design — Workflow Governance Layer for brain

**Status:** Draft for review (v2 — tool-agnostic model) · **Date:** 2026-06-28
**Context:** brain's mission is org-wide workflow governance for humans + agents with
shared knowledge (repo + engram). For that to work, the load-bearing steps must be
*enforced as far as the environment allows, and made the path of least resistance
everywhere* — because a guide's floor is the least-disciplined participant, and an
org cannot assume any particular VCS, tier, or harness.

---

## 1. The four non-negotiable invariants

1. **No merge without an approved ticket.**
2. **No PR over 400 changed lines without `size:exception`.**
3. **Memory dumped (session summary) before closing.**
4. **An ADR exists for every decision.**

## 2. Core principle

> Enforce the observable **OUTPUTS** wherever a gate can fail-closed; **guide** the
> irreducible **JUDGMENT** (capture quality, recognizing a decision) with in-context
> docs + the path of least resistance. Never claim to enforce what cannot be
> mechanically verified, and never assume a platform/tier/harness is present.

## 3. The honest boundary (read this first)

A **hard** guarantee needs a bypass-proof chokepoint at the point of no return (the
update of the shared branch). On hosted SaaS that chokepoint is owned by the
platform (branch protection / push rules) → **tool- and tier-specific**. The only
tool-native server-side gate is a `pre-receive` hook, which requires controlling the
git server (self-hosted). **Therefore a fully tool-independent HARD guarantee does
not exist on SaaS.** What IS universal: a default-on local layer + post-hoc
verification. brain is honest about this everywhere.

---

## 4. Architecture — one set of generic checks, composed at three points

The checks are **generic** (Node scripts over `git` data): diff-size, issue-link,
ADR-presence, memory-presence. Tool-independent. The same check code runs at three
**complementary** points (NOT substitutes for one another):

```
GENERIC CHECKS (node/git, tool-independent)
   │
   ├─►  FLOOR  (brain-core, ALWAYS ON, every repo/tier/platform):
   │       • client git hooks (commit-msg, pre-commit, pre-push)  → prevent-by-default, local, fast
   │       • brain:audit  → re-verify the merged history          → detection + attribution  ← the teeth
   │
   └─►  HARD GATE  (VCS adapter, ADDITIVE, capability-aware):
           • protectBranch()  → platform server-side enforcement WHERE the tier allows
           • if unavailable → reports {enforced:false, reason, remedy}; NEVER simulates it with client hooks
```

Plus a **golden-path command sequence** (§8) that makes the compliant path the path
of least resistance for human and agent alike, and self-gates step order.

### 4.1 Floor vs. hard gate — they COMPOSE, they do not fall back

This distinction is load-bearing for the document:

- **Floor (unconditional):** client hooks + `brain:audit`, running the generic
  checks. They **exist and run independently of the adapter**, on every repo, tier,
  and platform. The floor is *softer* (hooks are `--no-verify`-bypassable; the audit
  is post-hoc) but *universal*.
- **Hard gate (additive):** the VCS adapter binds the platform's *server-side*
  enforcement **where supported**; otherwise it reports the gap. It is *harder* but
  *conditional* on tier/platform.

The adapter does **NOT** "fall back to hooks." That framing is wrong and dishonest:
client hooks are bypassable, so they are not equivalent to a server gate. They are
the *floor*, not a *substitute*. Even when the hard gate IS available you keep the
floor (you always want fast local feedback + the post-hoc audit). The three points
are different moments in the lifecycle:

| Point | When | Strength |
|---|---|---|
| client hook (pre-push) | before the push leaves the machine | soft (bypassable), universal |
| platform gate | at the merge to the protected branch (server) | hard, conditional |
| `brain:audit` | after, over the merged history | detection + attribution, universal |

### 4.2 Client hooks vs. server hooks (don't conflate)

- **client hooks** (`commit-msg`/`pre-commit`/`pre-push`, via `core.hooksPath`):
  the FLOOR. Versioned, installed by `brain:env:init`, run the generic checks. Bypassable.
- **server hook** (`pre-receive`): ONE possible implementation of the adapter's hard
  gate, only on self-hosted platforms. Not bypassable. A *platform* mechanism.

Same word "hook", different layers — name them separately in any doc.

## 5. The generic checks (tool-independent library)

Extract the four checks into a shared library (`scripts/governance/checks/` or
similar), each a pure function over git/PR data. `diff-size-count.mjs` already
exists and is the template. The same functions are imported by: the client hooks,
`brain:audit`, and (where useful) the platform CI workflow. Single source of truth
for *what* a check means; the three points only differ in *where/when* they run.

## 6. The floor — client hooks + brain:audit

- **Hook suite** (always on, `core.hooksPath = scripts/hooks`):
  `commit-msg` (conventional commit + ticket ref), `pre-commit` (brain:repo:check; block
  direct commit to main), `pre-push` (the four invariant checks). Tool-independent.
- **`brain:audit`** (the universal teeth): re-verifies the invariants over the
  **merged history** — diff-size per PR, ADR-for-decision, memory-present,
  issue-link. **Forge-proof** (verifies the *outcome*, not a marker). ~90% pure git
  + a thin READ via the VCS adapter for PR/issue metadata. Flags + **attributes**
  every violation regardless of whether a hook was bypassed. In an org, visible +
  attributed violations deter almost as well as prevention — this is the
  tool-independent backbone of the guarantee.

## 7. The hard gate — the VCS adapter, capability-aware

All tier/platform reality is **isolated inside the VCS adapter**. The rest of brain
is tier-blind.

```js
provider.protectBranch({ project, branch, checks, requiredReviews })
   → { enforced: true }                                  // tier allows it
   → { enforced: false, reason: 'tier'|'unsupported',    // 403 / not available
       remedy: '...' }                                   // NEVER a raw crash

provider.capabilities()   // PROBED, not hardcoded
   → { hardEnforcement: 'available'|'unavailable'|'unknown', detail }
```

- **Probe, don't hardcode the matrix** — capabilities differ per platform AND change
  over time; a hardcoded matrix rots. The adapter attempts + caches the 403/result.
- Illustrative (probed in reality): GitHub public → free; GitHub private free → none
  (403); GitHub Pro/Team/Enterprise → yes (+ GHE pre-receive); **GitLab free →
  protected branches yes** (more generous), Premium/self-managed → more; Bitbucket →
  mostly paid; self-hosted → `pre-receive`.
- **`brain:governance status`** reports per-consumer, explicitly:
  ```
  Tu repo: github · private · free
    ✓ hooks (commit-msg/pre-commit/pre-push)  → ON  [universal]
    ✓ brain:audit                              → ON  [universal]
    ✗ platform hard gate                       → unavailable  (remedy: GitHub Pro for private, or make public)
  ```
  Nobody learns via a surprise 403. brain probes, adapts, and reports.

## 8. The golden path — the hard guide (human AND agent)

The workflow is codified as a sequence of **self-gating brain verbs** — the same for
a dev with no agent and for an agent:

```
brain:start <issue>  → verify issue exists + status:approved → branch/worktree   [gate: no approved ticket → refuse]
   … work …
brain:check          → run the generic checks + tests + repo:check               [fast feedback]
brain:save           → capture session summary + materialize memory              [gate before close]
brain:ship           → re-verify invariants → open PR (template + Closes #N + labels)   [gate: refuse if unmet]
   … merge (platform gate where available) …
brain:audit          → re-verify merged history                                  [continuous]
brain:next           → state machine: "your next step is X"                      [agent-like guidance for humans]
```

- **Self-gating**: each verb verifies the prior step's output → step order can't be
  skipped *within* the flow.
- **Path of least resistance**: one verb per step; compliance is easier than not.
- **`brain:next`**: gives a dev-without-an-agent an agent-like experience — brain
  tells them the next command.
- **Unification**: one golden path, traversed by human and agent. The agent is
  additionally bound by the harness (§9) + instruction; the human is guided by
  `brain:next` + the verbs' self-gating. **Same outcomes, verified the same way.**
- **Honest hardness**: you cannot force a human onto the verbs (raw git is always
  possible) — but deviation is gated locally (verbs) + caught universally (hooks at
  push, audit at the outcome).

## 9. The `--no-verify` policy

- **brain's own scripts** never use `--no-verify` / `git commit -n` → make it a
  **prohibited reference** in `brain:repo:check` (the check-refs engine already does
  prohibited-reference detection, ADR-0007). Enforceable + tool-independent.
- **The agent** → a **harness PreToolUse hook** (Claude Code) blocks any Bash command
  containing `--no-verify` / `-n` on git → the agent literally cannot run it in the
  sanctioned harness. Harness-specific but it's the sanctioned harness.
- **What slips through** → caught by `brain:audit` (it verifies the outcome, not the
  flag).
- **Precondition (the session's lesson)**: hooks MUST be reliable (zero false
  positives) or bypass is *rational* — agents and humans will (and did) `--no-verify`
  a hook that cries wolf. Trustworthy hooks are a prerequisite of the policy. (The
  memory:pull churn fix, #59, was part of earning that trust.)

## 10. New ADR

**ADR-0014 — Workflow governance.** Records: the four invariants; enforce-outputs /
guide-judgment; the **floor (always-on hooks + audit) vs. additive capability-aware
hard gate** split; the generic-checks library; the golden-path self-gating verbs +
human/agent unification; the `--no-verify` policy; the honest tool-independence
boundary. Never-do: claim to enforce judgment; treat client hooks as a substitute
for the hard gate; hardcode the tier matrix; auto-activate protection without
coordinating open non-compliant branches; let check-names drift from job-names.

## 11. Reshaped epic (slices/phases)

- **S1 Foundation** ✅ (done): ADR-0014, PR template, `governance.ignoreList`
  migration, managed-paths.
- **S2 Platform CI (GitHub adapter)** ✅ (done): `governance.yml` issue-link +
  diff-size — now understood as ONE enforcement adapter (additive, conditional).
- **S3 `brain:protect` + capability-aware adapter** (code done; activation blocked by
  tier): make `protectBranch()` return `{enforced, reason, remedy}` (no crash); add
  `capabilities()`; add `brain:governance status`. Activation is per-consumer +
  deliberate.
- **S4 → reshaped: the FLOOR (the real independence)** — extract the four checks to a
  generic library; wire the full client-hook suite to run them; build **`brain:audit`**
  (re-verify merged history). THIS is the tool-independent guarantee.
- **S5 The golden path** — the self-gating verb sequence (`brain:start/check/save/
  ship/next`) unifying human + agent; the `--no-verify` policy (brain:repo:check prohibition
  + the harness hook).
- **Phase 3** — GitLab/Bitbucket/self-hosted `protectBranch` + `pre-receive`; ruleset
  support; the full session_summary check (engram schema spike + `session/{issue}`
  convention).

## 12. Open questions

- The `brain:audit` cadence: on-demand, pre-push, scheduled, or a CI job? (Probably
  all — same code.)
- `brain:next` state source: derive from git + brain.config + open PRs/issues?
- The harness-hook shipping: brain ships a `.claude/` PreToolUse config as a managed
  path? (Mirrors the `.github/workflows/governance.yml` managed-path decision.)
- The session_summary↔issue linkage convention (`session/{issue}` topic_key) — the
  Phase-3 prerequisite for the full memory check.
