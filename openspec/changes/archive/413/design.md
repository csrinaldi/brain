---
status: design
issue: 413
epic: 313
artifact_store: openspec
topic_key: sdd/issue-413-reviewer-identity-verified/design
---

# Design — reviewer identity verified against the token (issue #413)

## D1 — widen `whoami`, do not add a verb

The ticket suggested "a `viewer`/authenticated-user read on the port", implying a new
verb. Survey found `whoami` already on both providers **with a contract row** — the
gap is only token-scoping. Widening keeps the port surface at its current verb count
(no ADR-0020 amendment) and the zero-arg path byte-identical. The contract-row text
change is Tier 2 → `brain-drafts/vcs-contract-whoami-row.md`, human-promoted.

## D2 — verification lives in `identity.mjs`, not `cli.mjs`

`identity.mjs` is the REQ-H1-1 "fail-closed reviewer identity gate"; verification IS
identity work. cli.mjs only renders the refusals. This also gives `identity.main()`
(the standalone gate) the same protection for free.

## D3 — gate order: missing-token → missing-handle (#382) → mismatch (#413)

An unset handle skips verification (nothing to compare) and falls to the #382 gate,
which owns that message. Verification only ever runs with both a token and a handle,
so each refusal names exactly one root cause.

## D4 — token plumbing per provider

- **GitHub:** `gh api /user` with `GH_TOKEN=token` in the child env — gh gives
  `GH_TOKEN` precedence over its keyring session, so the answer is the token's
  identity even on a machine where the operator is logged in as themselves. `run()`
  already passes `opts` through to `spawnSync`; no transport change.
- **GitLab:** glab has no per-call token, so the token path switches to the shared
  `gitlabApiFetch` (`PRIVATE-TOKEN` header) — the same transport and parameter shape
  (`apiBase`/`proxyUrl`/`fetchImpl`) as `issueView`/`prReviewComment`. The default
  verifier threads `gitlabApiConfig()` in, mirroring cold-boot's `prReviews` wiring.

## D5 — case-insensitive comparison

Logins are case-insensitive on both providers. Folding case avoids a false-positive
refusal for a correctly-configured reviewer whose config case differs from the
server's canonical form. Pinned by a negative-control test that stays green across
old and new code by design (documented as such — the #381 lesson about tests that
pass on both).

## D6 — failure semantics: refuse, never degrade

Both new failure shapes (`mismatch`, `verifyError`) refuse the run at boot with
exit 1 and zero port writes. The alternative — warn and proceed — would reproduce
the exact fail-open #382 just removed, one level up.

## Alternatives rejected

- **New port verb** (`viewer`): duplicates `whoami`, amends ADR-0020, larger Tier-2
  surface. Rejected per D1.
- **Verify lazily at post time** (poster.mjs): the forged run would still execute
  evaluators and could post under a mismatched identity on a code path that skips
  the check; boot-time is the only choke point every mode shares.
- **Cache the verification across runs**: a token swap between runs would go
  unnoticed; the verb costs one API read per review run.
