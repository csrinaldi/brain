> **DRAFT — agent-authored, awaiting human promotion.** This is a `brain-drafts/`
> artifact (Tier 2 / ADR-0013: the agent drafts, the human promotes to
> `brain/project/decisions/` and signs). **Promotion is the human keystroke.**
> Proposed number **ADR-0022** (next free after ADR-0021) — confirm on promotion.
> Co-promote the `brain/HOME.md` index entry in the same MR (`decision-gate`
> step 1; the #197→#199 lesson). Nothing below is in force while it lives here.

# ADR-0022 — Widen the VCS port for the cold reviewer: `baseRefOid` on `prView`

**Status**: Draft — agent-drafted per ADR-0013; awaiting human signature (the human sets Status: Accepted + sign-off on promotion). DO NOT merge as Draft.
**Date**: 2026-07-17

## Context

The cold reviewer (`brain:review`, Track H phase H1) needs the PR's **base sha** — the tip of the branch the PR merges into — for two cold re-derivations that never trust a report:

1. **Budget** (H1-2c tranche): `git diff --numstat base...head | diff-size-count.mjs` (`brain/scripts/review/evaluators/tranche.mjs:10`). Without `base`, the changed-line budget is uncomputable.
2. **TDD-RED by reversion** (H1-3 checkpoint, the evaluator's headline defense): `git checkout <base> -- <impl-files>`, run the PR's new tests, require them to **fail** (issue #266 acceptance; tasks §10.4). Without `base`, the check cannot run.

ADR-0021 widened `prView` to expose `headRefOid` but **not** `baseRefOid` — the port returns `{ number, labels, body, author, headRefOid }` (`brain/scripts/vcs/providers/github.mjs:161`, `gitlab.mjs:116`). Today the base sha is reachable **only** through `ci-context.mjs`'s `BASE_SHA` env var, which is set in CI but **unset when a human runs `brain:review` locally**. So both re-derivations fold to protocol §10 fail-closed (REVISE + `evidence uncomputable`) outside CI — documented in `tranche.mjs:10-22`. This is the open finding **H1-2C-BASE** (issue #266; #279 body).

For H1-2c the fallback only cost the budget dimension — tolerable. For H1-3 it would gut the checkpoint's **most valuable** check. Adding to the port is itself a decision (protocol §4, ADR-0020's own rule) — hence this ADR. Human ruling (issue #266 comment 5008243569, "Lectura i"): widen the port for `baseRefOid` **first**; the H1-3 evaluator develops in parallel against an injected `deps.baseSha` seam and opens its PR only once this widening lands. H1-2C-BASE **closes** with this widening.

## Decision

1. **Widen `prView` to include `baseRefOid`** in its return shape, on **both** providers — additive, existing callers reading only `number`/`labels`/`body`/`author`/`headRefOid` are unaffected. The uncomputable path returns `baseRefOid: null`, matching the existing fail-safe (`{ number, labels: null, ..., headRefOid: null }`). This is Decision-1-shaped only: **no new verb** (unlike ADR-0021's `prStatusRollup`) and **no seam to retire** (unlike ADR-0021 Decision 3).

   - **GitHub**: `gh pr view --json` does **not** expose `baseRefOid` — verified: its field set offers `baseRefName`, `headRefName`, `headRefOid`, but no `baseRefOid` (`gh pr view --json baseRefOid` → "Unknown JSON field"). So the base sha is sourced additively via one supplementary call, `gh api repos/{owner}/{repo}/pulls/{number} --jq .base.sha` (the REST endpoint's authoritative `base.sha`; `gh` auto-fills `{owner}/{repo}` from the repo, keeping `prView`'s "works from repo root, `project` optional" property). The existing `gh pr view --json …,headRefOid` call is **untouched** — `baseRefOid` is a strictly additive supplement.
   - **GitLab**: the MR payload's `diff_refs.base_sha` (the mirror of `diff_refs.head_sha`, which already sources `headRefOid`). No extra request.

2. **Close H1-2C-BASE**: the tranche budget re-derivation (`gatherTrancheInputs`, `tranche.mjs`) takes its `baseSha` default from `prView().baseRefOid` instead of only `ci-context.mjs`'s `BASE_SHA`, so the budget dimension computes in **both** CI and local runs. The `ci-context` reader stays as the CI-native source; the port becomes the provider-agnostic default that also serves local runs. `baseRefOid: null` (uncomputable) still folds to the **same** §10 fail-closed rule — this widens the *reach* of the evidence, never relaxes the rule.

3. **Unblock H1-3**: the checkpoint evaluator's reversion check consumes the same `baseSha`, injected as `deps.baseSha` during parallel development and defaulting to `prView().baseRefOid` in production once this widening lands. The evaluator's PR does not open until then (comment 5008243569, Lectura i).

## Consequences

- **Positive**: the base sha reaches the reviewer through the single provider-agnostic port — the same seam that serves GitHub and self-hosted GitLab — closing H1-2C-BASE. The budget dimension and the H1-3 reversion check both compute in CI **and** local runs; no dimension ships degraded, no consumer is wired to `ci-context` and later rewired to the port (one wire, not two).
- **Positive**: `baseRefOid` is a read, never a write — it widens the reviewer's *evidence* reach without widening its *authority* (the three §2 locks and the four ADR-0020 write verbs are untouched). No APPROVE path, no label mutation.
- **Negative**: GitHub's `prView` now makes a second subprocess call (`gh api …/pulls/{n}`) because `gh pr view --json` cannot supply `baseRefOid`. Kept minimal and additive rather than refactoring the merged `headRefOid` path; a future simplification could fetch both `head.sha` and `base.sha` from the one `gh api …/pulls/{n}` call, out of scope here.
- **Negative**: touching the port shape is a decision that needs this ADR + a `decision` label + L6 human review at the PR — the deliberate cost of a port change (never a silent widening).
- **Note**: `base.sha` (GitHub) / `diff_refs.base_sha` (GitLab) is the base **branch tip**; `git diff base...head` (three-dot) resolves the merge-base internally, so the budget re-derivation is correct as-is. The reversion check (H1-3) chooses its exact reference (base tip vs `git merge-base base head`) at the evaluator layer — a consumer concern, not a port concern.

## References

- H1-2C-BASE finding + owner ruling (Lectura i): issue #266 comment 5008243569; index comment 5004258781. To be pinned as a durable `.memory/records/` record on promotion.
- Protocol §4 (adding to the port is a decision), §8 (cold boot), §10 (fail-closed on uncomputable evidence): `brain/core/methodology/reviewer-protocol.md`.
- ADR-0021 (headRefOid on prView + prStatusRollup + seam retirement) — this ADR extends `prView` for the reviewer's remaining READ need, the base sha.
- ADR-0020 (the four COMMENT-only reviewer write verbs + two-key split).
- Port + verb contract: `brain/core/methodology/vcs-contract.md`, `brain/scripts/vcs/cli.mjs` (`VERBS`); the fail-closed base handling this closes: `brain/scripts/review/evaluators/tranche.mjs:10-22`.
