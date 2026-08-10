---
status: draft
issue: 130
epic: 313
---

# Proposal — one rule, two pipelines

## What #130 asked for, and what was already there

#130 was filed on 2026-06-30 from a real adoption (catastro/plataforma-scit on GitLab):
*"how do I approve the ticket?"* — GitHub Actions never runs on GitLab, so `issue-link` and
`diff-size` were conventions rather than gates for a GitLab consumer.

**Measured before implementing anything**, because the ticket is six weeks old:

| #130's ask | state |
|---|---|
| gate logic in portable scripts | **done** — `governance/run-check.mjs` + `governance/checks/*` |
| a GitLab template shipping the gates | **done** — `brain/scripts/ci/gitlab-governance.yml`, all 8 jobs, a managed path (`STRATEGY.REFUSE`) |
| brain dogfoods it | **done** — the root `.gitlab-ci.yml` includes the fragment |
| the audit reads one neutral credential | **done** — #479, merged today |
| job-name and `allow_failure` parity guards | **done** — `ci-context-drift-guard.test.mjs` |

So the pipeline exists. What did **not** exist is the thing that makes it one pipeline
rather than two that happen to look alike.

## The gap: the guards compared names, not behaviour

The existing parity guards assert the two files declare the same **job names** and the same
`allow_failure` classification. Neither says a job **does the same thing** on both providers
— and one had already diverged:

| | `issue-link` |
|---|---|
| GitLab | `node brain/scripts/governance/run-check.mjs issue-link` |
| GitHub | **~50 lines of inline bash** with `grep -oiE` over the PR body |

Two implementations of one rule is the defect #340 records, and this pair was not a
theoretical risk. `governance.yml`'s own comment recorded the consequence as a follow-up
nobody came back to:

> this job compares BASE_BRANCH against the LITERAL 'main', not the repo's actual default
> branch — a consumer whose default branch is not 'main' inherits the wrong policy here.

A consumer on `master` or `develop` got the **slice** policy on their integration PRs:
`Part of #N` accepted where a closing keyword is required. The gate silently weakened, on
exactly the consumers #130 exists to serve. A name-set guard is blind to that by
construction — both files said `issue-link`.

## The change

`governance.yml`'s `issue-link` job now runs the portable check. The bash is gone.

The portable check is not merely equivalent, it is **strictly stronger**:

- it derives the policy from `ctx.defaultBranch` and **fails closed** when that is
  uncomputable, instead of assuming `'main'` — a literal comparison cannot fail closed
  because it never knows it is wrong;
- it distinguishes *"could not read the PR body"* (infra) from *"no issue reference found"*
  (governance) — the distinction whose absence made #522/#523 read as governance failures
  when the reader had simply come back empty.

Its step declares `VCS_TOKEN` rather than `GH_TOKEN`, so the one job this change touches is
also the first of #535's four to be resolved.

## The guard that keeps it one rule

A per-job command comparison across the two files, plus teeth against the exact failure mode
that let the divergence live: a `run: |` block yields **no extractable command**, so a guard
comparing only what it could read would see two empty lists and call them equal.

## Out of scope, and named

`approveIssue` — the ticket's own first comment proposes `brain:approve <issue>` applying the
approval label through the adapter, so a GitLab human has a command where GitHub has a
button. It is not here, and not by oversight: #124 and reviewer-protocol §9 make that label a
human signature, and #528 put the refusal **at the port** precisely so no caller can route
around it. A verb that writes the label needs a sanctioned path through a port that currently
refuses it unconditionally — a `decision` change with an ADR, not a slice of this one.

`brain:approve` today is a different thing (a `brain-decision/1` signature over a PR diff, no
label writes), so the friction the ticket was born from is still real and still open.
