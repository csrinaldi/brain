---
status: draft
issue: 604
---

# Tasks — the reviewer's coldness is not verifiable (issue 604)

## Done in this change

- [x] **T1** — Reproduce half 1 in this environment before writing code.
      Invented token, empty token and no credential all → HTTP 200 · `csrinaldi`.
      `HTTPS_PROXY` set; `GH_TOKEN`/`GITHUB_TOKEN` 14-char sentinels;
      `BRAIN_REVIEWER_TOKEN` a 40-char PAT that nothing reads.
- [x] **T2** — `evaluateNegativeControl` + `NEGATIVE_CONTROL_SENTINEL`
      (REQ-604-1/2/3), wired into `gatherIdentity` ahead of the #413 check.
- [x] **T3** — Distinct refusal text in both `identity.mjs` and `cli.mjs`,
      naming the environment and stating that rotation is not the remedy.
- [x] **T4** — `run()` surfaces `spawnSync`'s launch error (REQ-604-4), with
      `exec.test.mjs` pinning both directions.
- [x] **T5** — Test doubles honour their token (REQ-604-5): `identity.test.mjs`,
      `cli.test.mjs`, and `gh-stub`'s `/user`.
- [x] **T6** — e2e proof through the real verb: the injected-credential
      environment refuses and posts nothing; the healthy one still posts.
- [x] **T7** — Measure whether `brain:approve` inherits half 1 (Ruling 4).
- [x] **T12** — Self-review finding **F1**: the control can cause a provider
      auth lockout and then mis-diagnose it. Split `lockout` out of `unusable`
      (REQ-604-6) with its own message — wait, do not rotate, this is not a
      proxy. Found by adversarially re-reading the change after it was already
      green: mutation testing and a passing suite did not surface it, because
      no test asked what happens when the probe's own side effect fires.

## Evidence — mutation testing

Each mutation was shown to **land** (grep on the mutated line), to turn the
suite **red**, and to revert **byte-identical** (`diff -q`).

| # | mutation | result |
|---|---|---|
| 1 | `unusable` → `rejected` (fold the failure into a clean bill) | 2 tests red |
| 2 | `if (false && control.control === 'resolved')` — skip the control | 2 tests red |
| 3 | `run()` drops `launchFailure` again | 2 tests red; the empty `(status null): ` reason returns verbatim |
| 4 | remove the `lockout` classification (F1's fix) | 4 tests red |

Suite: **3646 tests, 3645 pass, 0 fail, 1 skipped**. The 3 failures present on
the untouched baseline did not reproduce on a second baseline run — flaky, not
caused here, and not silently absorbed either.

## Sequenced, NOT done here

- [ ] **T8 — Ruling 3, provenance in the verdict.** Blocked on a runner that can
      attest to it. Land it **with** the GitHub Actions reviewer job, never
      before: a provenance field the producing agent fills in about itself is
      self-attestation, and the warm case is exactly the one that fills it in
      wrong. Building the slot first reproduces #552's shape — a declared field,
      a consumer wired to fork on it, no honest producer.
      Amends `reviewer-protocol.md` §6 (ADR → HOME.md → regenerate AGENTS.md).

- [ ] **T9 — half 2, §10 abstention compares identity and never provenance.**
      Not addressed here. It is a quality hole, not an authority hole — Lock 1
      holds and no gate consumes a `brain-review/N` verdict — but it stands
      against §2's own standard that the asymmetry be impossible by
      construction. The mechanism that closes it is most likely the CI runner
      (no authoring context **by construction**), not a field. Pairs with T8.

- [ ] **T10 — Ruling 4 follow-up: `brain:approve`'s ambient identity.**
      Measured: behind a credential-injecting proxy, approve composes a signed
      `brain-decision/1 APPROVE` attributed to the maintainer with no token
      held. Unlike a review verdict, that block **is** consumed by a gate
      (`actor-check` at `lite`, ADR-0026 Am. 2, #473).
      Held by the TTY lock and the typed `SIGN`, both verified to fire.
      Needs its own ticket: it changes approve's identity contract and touches
      ADR-0026's evidence rules. **Must not be ruled by the agent that wrote the
      reviewer's control** — that is the self-certification hazard in §7 of
      `design.md` applied to the next change.

- [ ] **T11 — confirm REQ-604-3 against real `gh`.** The no-false-positive
      claim on a maintainer machine (`gh auth login`, keyring session) rests on
      `GH_TOKEN` taking precedence over the keyring — the repo's documented
      premise and #413's foundation — and was proven against a token-honouring
      shim, because `gh` is not installed in this container. Run once on the
      maintainer's machine before relying on it.

## Review note

This change modifies the mechanism every other change is reviewed with, and
**cannot be reviewed cold by that mechanism in the environment that produced
it**: `gh` is absent here, and the control refuses here regardless. There is no
`brain:review` verdict on this PR. It needs a human review, or a run from the
maintainer's machine or a GitHub Actions job holding the PAT.
