---
status: draft
issue: 413
epic: 313
artifact_store: openspec
topic_key: sdd/issue-413-reviewer-identity-verified/proposal
---

# Proposal: verify the reviewer identity against the token (issue #413)

Issue #413. Epic #313 (M6 — governance completeness; pulled forward: it gates #418).
Change folder: `openspec/changes/issue-413-reviewer-identity-verified/`.

## Intent

`identity.mjs` returns `reviewer.handle` **straight from config** after checking only
that the token env var is non-empty. Nothing cross-checks that the token actually
belongs to that handle, so every downstream consumer of the handle compares a
**claimed** identity:

- `cold-boot.mjs` §10 self-review abstention (`reviewer handle equals PR author`);
- `poster.mjs` anti-loop lock (`lastVerdict.author` vs the handle).

The ticket's observed reproduction: config claims `csrinaldibot`, the operator points
`BRAIN_REVIEWER_TOKEN` at their own token, and their own PR gets `verdict: APPROVE`
instead of the §10 abstention — because `csrinaldibot !== csrinaldi`. Both are L5/L6
evidence, so this weakens the same locks #375/#377/#382 armed.

## Decision

Resolve the token's real login at boot via the port's existing `whoami` verb — widened
with an optional `token` parameter — and **fail closed** on disagreement with
`reviewer.handle`, and on verification failure. Same shape as #382's boot refusal,
which set the precedent that an unverifiable reviewer identity must not proceed.

Key discovery narrowing this change: the ticket assumed no identity read existed on the
port, but **`whoami` already exists on both providers with a contract row**
(`vcs-contract.md:26`). The gap is only that it answers for the *ambient CLI session*,
not for a given token — the wrong identity in exactly the forgery scenario. So this is
a **widening of an existing verb**, not a new verb: no ADR amendment, one contract-row
update (Tier-2 draft included, human-promoted).

## Scope

- `whoami({ token? })` on both providers; zero-arg behavior byte-identical.
- `identity.mjs`: verification between the token gate and the return; two new
  fail-closed shapes (`mismatch`, `verifyError`).
- `cli.mjs`: render both refusals; gate order is missing-token → missing-handle (#382)
  → mismatch/unverifiable (#413).
- Tier-2 draft: `brain-drafts/vcs-contract-whoami-row.md`.

Out of scope: minting the reviewer identity itself (#367 did), the `lite`-tier
approval-invalidation friction (#418, blocked on this), doctrine changes (§10 already
requires the abstention and the uncomputable-evidence discipline this implements).
