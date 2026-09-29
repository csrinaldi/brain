# Definition of done — brain 2.0

This is the plain-language version of what "done" means for brain's production
release. The tracker is epic
[#1121](https://github.com/csrinaldi/brain/issues/1121) — this page doesn't
duplicate its phase checklists, it explains what they're for and links to it.

---

## The rule that governs every other rule

> **A change is done when it works on a fresh consumer install, at a cost one
> person can pay.**
> — [ADR-0036](../brain/project/decisions/adr-0036-a-change-is-done-when-it-works-on-a-fresh-consumer-install.md)

Brain's own test suite runs inside brain's own repository, which has preconditions
no consumer has: every script alias already there, an `openspec/changes/`
directory, a `.gitignore`, a configured `vcs.provider`, a memory store that isn't
empty. A defect that depends on one of those preconditions is invisible to brain's
suite by construction — and it has shipped that way more than once (see
`docs/KNOWN-LIMITATIONS.md` for the current list). Green tests in this repository
are a **claim** about consumers. They stop being read as the **proof**.

"A cost one person can pay" means three concrete things, checked on a fresh
install:

1. **No second approver, account, or identity is required by default.** The `lite`
   tier ([ADR-0026](../brain/project/decisions/adr-0026-governance-doctrine-tiers.md))
   is what makes this true for a new consumer.
2. **No unnamed manual step.** Every action the operator must take outside the
   verbs is printed by `init`, `env:init`, `brain:upgrade`, or the diagnosis verb,
   with the command to run.
3. **No ADR is required reading.** A verb may cite an ADR as the reason. The
   instruction itself is in its output.

## The five properties brain 2.0 is measured on

From the maintainer's 2026-09-02 vision (`#313`), carried into `#1121`:

| # | Property | What it means in practice |
|---|---|---|
| 1 | **Team with shared memory** | Several identities — human or agent — write and read the same memory, and a correction reaches an agent as current, not as a stale duplicate sitting next to the fix. |
| 2 | **Platform-agnostic** | Every supported value on every configurable axis (agent platform, memory backend, VCS provider) passes the same contract test. Nothing is agnostic in doctrine only. |
| 3 | **Automatic end to end; the human is the exception** | A feature goes from an approved intent to a merged change with no human click, unless a gate is red or the product escalates. Configurable — see [ADR-0037](../brain/project/decisions/adr-0037-autonomy-is-configurable-modes-a-b-c.md) (modes A/B/C). |
| 4 | **A hardened flow: every stage is honoured** | No stage can be skipped or self-approved, and every place the flow stops is visible — never a silent pass reported as a success. |
| 5 | **Minimal tokens and hallucinations** | Token cost is measured per stage, and the discipline that keeps an agent from asserting something it didn't check is instrumented, not just written down. |

Each property has a baseline (as measured 2026-09-02) and an exit criterion — see
`#1121` for the numbers and the phase that closes each gap.

## Phase exits, in plain words

`#1121` breaks the work into seven phases. Each phase's exit criterion is something
a person can run and watch pass or fail — never "the code that implements this
merged."

| Phase | Exit, in one sentence |
|---|---|
| 0 — Doctrine | The defining ADRs are signed, and `docs/adoption.md` alone takes a new consumer from zero to a green diagnosis. |
| 1 — An honest consumer path | A fresh `github × claude × plainfiles` install and a fresh `github × claude × engram` install both complete with no step outside install/bootstrap/upgrade, and without committing a credential. |
| 2 — Pluggable axes | Every axis (platform, memory, VCS) is selected by configuration behind one resolver, with a guard that keeps it that way; every axis value passes its own contract test. |
| 3 — Install, upgrade, diagnosis | `brain:doctor` is green on every supported combination after a fresh install, and green again after upgrading a 1.x fixture. |
| 4 — The development process | One feature goes from issue to merge with each SDD stage run by its assigned agent/role, a cold review from a distinct identity, and an automatic merge under mode B — with a gate that refuses a merge attempted by the producing identity. |
| 5 — The local UI | For one GitHub consumer and one GitLab consumer, the local UI shows epics, features, tickets, decisions, and reviews, reconstructed from the repository and the tracker. |
| 6 — Release 2.0.0 | The publish gate — a fresh install of the packed tarball, per supported combination — is green, the five properties above meet their exit criteria, and `2.0.0` is published. |

**Full detail, task-by-task, lives in `#1121`.** This page is the map, not the
territory — when a phase's scope changes, the epic is what's authoritative.

## What this page is not

- Not a replacement for `#1121`'s checklists — those track work-in-progress; this
  page explains the shape once it's done.
- Not a promise about a specific date.
- Not a claim that any phase is done today — check `#1121` for current status.
