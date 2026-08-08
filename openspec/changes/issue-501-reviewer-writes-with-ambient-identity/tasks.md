---
status: draft
issue: 501
---

# Tareas — reviewer writes with ambient identity (issue 501)

- [x] T1 — **Measure the surface before designing.** 25 exported verbs in `github.mjs`, 19 of
      them shelling out to `gh` across 21 call sites, and `GH_TOKEN` present at exactly two
      lines, both inside `whoami`. GitLab measured separately: the per-verb token parameter
      exists at thirteen sites and the poster passes none. Both results are in design D1, and the
      GitLab result is what rules out the obvious fix.
- [x] T2 — `getVcs({ provider, identity })` binds the credential to the port (REQ-501-1, E2).
      Omitted ⇒ today's resolution, unchanged. `bindIdentity` enumerates the MODULE rather
      than a list of verb names — a hand-maintained list is the shape that failed, `whoami`
      having been its only entry for the whole life of #413.
- [x] T3 — `github.mjs`: one internal chokepoint (`gh` / `ghJson`) for every invocation.
      21 call sites routed through it; three were multi-line and **two of those three were
      write verbs the reviewer reaches** — `issueComment` (ruling mode) and `labelAdd`. That
      is the concrete form of why fixing `prReviewComment` alone was never the fix.
- [x] T4 — `gitlab.mjs`: one resolver, `glToken(token)`, replacing the inline fallback at
      **thirteen** sites (REQ-501-1, E5).
      **The site count in the first draft of these artefacts said FIVE.** It came from a grep
      whose output was truncated to six lines, and it went into design D1, the proposal and
      the spec unverified. The mutation harness's site-count assertion caught it — `SITES: 13,
      esperaba 5 — abortando` — which is the entire reason that assertion exists. Corrected in
      all four artefacts.
- [x] T5 — the review CLI builds ONE bound port from `identity.token` and hands it to both
      `gatherColdBoot` and the poster. The value `whoami` verified, threaded — never a second
      read of the env var, because a second read is a second chance to differ.
- [x] T6 — REQ-501-3, and scoped honestly: **the comparisons are not rewritten.** Once T5
      lands, `reviewerHandle` IS the writing identity — `identity.mjs` verifies the handle
      against the token (#413) and the port now carries that token to the wire (#501) — so
      `lastVerdict.author === reviewerHandle` becomes true by construction. What this task
      adds is the invariant NAMED at the guard, because a guard whose correctness depends on
      something established two modules away is how this defect stayed invisible. Keying the
      comparison on a writing identity the poster resolves itself would be a further refactor;
      it is not done here and is not needed for the guard to be correct.
- [x] T7 — **The drift guard** (REQ-501-2, E4, E5). Source-level: no raw `gh` invocation
      outside the chokepoint; no `vcsToken(PROVIDER)` fallback on a bound verb. This is the
      task that fixes the class rather than the instance — `whoami` was correct and alone for
      the entire life of #413 and nothing failed.
- [x] T8 — Tests for E1–E8: `identity-binding.test.mjs` (7) + `identity.drift.test.mjs` (4).
      **E1's fixture must drive TWO DIFFERENT identities.** With the bound token and the
      ambient credential set to the same identity, every assertion passes against a port that
      ignores the token entirely — which is how this shipped. The #405 cardinality lesson in
      another dimension: N=1 identities makes "wrote as the reviewer" trivially true.
- [x] T9 — **Red-proof: 8 mutations, 8 RED, 0 inert.**
      One came back GREEN on the first pass and it was the important one: **M7, the review CLI
      handing the poster an UNBOUND port**, left all 2722 tests green. The port-level binding
      was covered from six angles and the one line that USES it was covered by nothing — this
      change reproducing its own defect, since `whoami` could always take a token and what was
      missing was a caller passing one. Closed with a source drift guard in `cli.test.mjs`,
      following the `#405` precedent for the same situation ("the one link no seam can
      observe"); M7 is now red.
      Original plan below. Mutate, assert the substitution-site count, run the FULL suite,
      record the red. `inert: 0` or the run measures nothing.
      Minimum set:
      - the chokepoint stops applying the identity → must red
      - one verb calls `run('gh', …)` directly, bypassing the chokepoint → must red **on the
        drift test**, and that is the point of T7
      - the identity is applied to writes only, not reads → must red (E3)
      - GitLab falls back to `vcsToken(PROVIDER)` with an identity bound → must red
      - the anti-loop lock compares against `reviewerHandle` again → must red (E6)
      - the self-review abstention compares against `reviewerHandle` again → must red (E7)
      - an unbound port starts injecting a token → must red (E2)
      - **the three lock-2 mutations from PR #490, re-run** → must still be red (E8)
- [x] T10 — 2723 tests, 0 fail.
- [ ] T11 — **Draft the `vcs-contract.md` row** for `brain-drafts/`: a bound port carries its
      identity to every verb, on both providers. Tier 2 — the agent drafts, a human promotes,
      now via `brain:promote` (ADR-0028) where the shape allows.
- [ ] T12 — **PR, then the EXTERNAL reviewer on it.** Not self-review: `reviewer-protocol.md`
      §13 requires a cold subagent that is strictly a command executor of
      `npm run brain:review -- --pr <id>`, and forbids manual diff reading. #469's round 1
      violated all three (no PR, manual diff, findings written to `tasks.md`), and #405's
      rounds 17-29 were self-review, which is why eight of their nine corrections were about
      the ledger rather than the code.
      **Blocked on infrastructure this session cannot supply**: `BRAIN_REVIEWER_TOKEN` and
      `gh` are absent here, so the reviewer runs from the maintainer's machine.
      Ceiling: **four rounds**, then escalate what is left.

## Micro-decisiones en caliente

- **GitLab is the counter-example that chose the design.** A per-verb `token` parameter
  already exists there, is correct, and the reviewer still wrote with the wrong credential
  because `poster.mjs:137` never passed it. Replicating that shape on GitHub's 19 verbs would
  reproduce the failure over more surface. Binding at port construction is the only form in
  which a verb cannot be called without an identity.
- **Do not run `brain:review -- --pr 500` again before this lands.** Measured: `rev` climbs
  on every run at an unchanged head, and at `rev >= 3` a `REVISE` becomes `STOP` +
  `escalate:human` (protocol §7) on a PR nothing changed on.
- **The defect's invisibility is the reason for E1's two-identity fixture.** It only shows
  when ambient auth and the reviewer token belong to different identities, which is not the
  configuration any existing test drives.
