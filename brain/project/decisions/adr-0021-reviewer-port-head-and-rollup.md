# ADR-0021 — Widen the VCS port for the cold reviewer: `headRefOid` on `prView` + a `prStatusRollup` read verb; retire the H1-1 cold-boot seam

**Status**: Accepted
**Date**: 2026-07-17 -- Cristian Rinaldi

## Context

The cold reviewer (`brain:review`, Track H phase H1) needs two pieces of server state that the VCS port does not expose today:

1. **`headRefOid`** — the API's head sha for a PR, the anchor the reviewer checks out **detached** at (protocol §8: "never a branch name, never a sha quoted in a report"). `prView` returns only `{ number, labels, body, author }` (`brain/scripts/vcs/providers/github.mjs:157-159`, `gitlab.mjs:110`) — no head sha.
2. **The full `statusCheckRollup`** — every required check's `status`/`conclusion`, which the tranche evaluator (H1-2c) re-derives cold to decide "required gates green" (protocol §H1 Express). The port's `commitStatus` cannot provide it: it needs the sha as input (chicken-and-egg with (1)) and returns only `check_runs[0]` (`github.mjs:193`), a single check, not the rollup.

H1-1 shipped an **interim**: a cold-boot `fetchHead` DI-seam reader (Fork A option (a), human decision comment 4993202904, durable record `rec-34a5a5d79a37cfa0`). It dispatches by provider but is **not a first-class port verb** — a parallel mini-port. Fork A **condition 2** bound its retirement to this widening, "so it never calcifies."

Adding to the port is itself a decision (protocol §4, ADR-0020's own rule) — hence this ADR.

## Decision

1. **Widen `prView` to include `headRefOid`** in its return shape, on **both** providers — additive, existing callers unaffected. GitHub: add `headRefOid` to `gh pr view --json` (`github.mjs:158`). GitLab: the MR payload's `sha` (mirrored at `diff_refs.head_sha`). The uncomputable path returns `headRefOid: null`, matching the existing fail-safe (`{ number, labels: null, ... }`).

2. **Add a new READ verb `prStatusRollup({ project, number })`** returning the full status rollup — a normalized array of `{ name, status, conclusion }` per check — on **both** providers. It is a read, never a write; there is no APPROVE path and no label mutation (consistent with §2/§4; the reviewer's four write verbs from ADR-0020 are unaffected). Added to `VERBS` (`brain/scripts/vcs/cli.mjs:26-29`) and the `vcs-contract.md` required-verbs table; the parameterized contract drift-guard (`providers/vcs.contract.test.mjs`) runs it over `['github','gitlab']` and turns red until both implement it.

3. **Retire the H1-1 cold-boot `fetchHead` DI-seam reader** (`brain/scripts/review/cold-boot.mjs`'s `defaultFetchHead`) and its `TODO(#266)` comments once `prView` exposes `headRefOid`. Cold-boot switches to `prView().headRefOid`. **No parallel mini-port survives** (Fork A condition 2). This lands in the same code slice (H1-2b) as the widening.

## Consequences

- **Positive**: the reviewer reaches the head anchor and the required-gate rollup through the single provider-agnostic port — the same seam that already serves GitHub and self-hosted GitLab. The interim reader dies; no drift between a mini-port and the real port.
- **Positive**: `prStatusRollup` is a read verb with no write surface — it widens the reviewer's _evidence_ reach without widening its _authority_ (the three §2 locks are untouched).
- **Negative**: touching the port shape + adding a verb is a decision that needs this ADR + a `decision` label + L6 human review at the PR — the deliberate cost of a port change (never a silent widening).
- **Negative**: both providers must implement `prStatusRollup` or the drift-guard blocks; GitLab's pipeline/checks model differs from GitHub's checks API, so the normalization (`{ name, status, conclusion }`) is the contract both must satisfy.

## References

- Fork A decision (option (a) + condition 2, the retirement): issue #266 comment 4993202904; durable record `rec-34a5a5d79a37cfa0`.
- Protocol §4 (adding to the port is a decision), §8 (cold boot anchors at `headRefOid`): `brain/core/methodology/reviewer-protocol.md`.
- ADR-0020 (the four COMMENT-only reviewer write verbs + two-key split) — this ADR extends the port for the reviewer's READ needs.
- Port + verb contract: `brain/core/methodology/vcs-contract.md`, `brain/scripts/vcs/cli.mjs` (`VERBS`).
