# ADR-0018 Amendment 1: the close job's project access token, and what degrades to `brain:gc` on GitLab (issue #1251)

> **Tier 2 target. Not promoted, and an agent may not promote it.** Promote it after ADR-0039,
> which decides what it records.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1251-ticket-hierarchy/brain-drafts/adr-0018-amendment-1.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0018-gitlab-governance-fragment.md
amendment: 1
issue: 1251
home-summary: ADR-0039's close job runs in the fragment on merged merge requests with a project access token in a CI variable, because `CI_JOB_TOKEN` cannot write issues; without it, and always for the direct close (GitLab has no issue-event pipeline source), control degrades to the `brain:gc` sweep, which `day:start` offers, as a stated provider limitation, #1251
body: ## Amendment 1 — the close job's project access token, and what degrades to `brain:gc` on GitLab (issue #1251)
body-end: ### Notes for the promoter
```

```amend-find
`.governance_mr_rules` gates every job on `$CI_PIPELINE_SOURCE == "merge_request_event"`. These
checks read MR-specific context that does not exist on a branch-push pipeline; running them
there would fail closed for the wrong reason. It mirrors `on: pull_request` in the GitHub
workflow.
```

```amend-replace
`.governance_mr_rules` gates every job on `$CI_PIPELINE_SOURCE == "merge_request_event"`. These
checks read MR-specific context that does not exist on a branch-push pipeline; running them
there would fail closed for the wrong reason. It mirrors `on: pull_request` in the GitHub
workflow. **[Amended by Amendment 1 (#1251, ADR-0039): ADR-0039's close job is the one job that
acts after a merge, and it needs a project access token, not `CI_JOB_TOKEN`; GitLab has no
issue-event pipeline source, so the direct close always degrades to `brain:gc`. See
Amendment 1.]**
```

## Amendment 1 — the close job's project access token, and what degrades to `brain:gc` on GitLab (issue #1251)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0039 names this ADR in "Amendments this requires".

**1. The close job and its token.** ADR-0039's close workflow (ruling C5, 2026-10-07) closes a
node's issue when its merge request merges into its parent's target, deletes a merged tracker,
closes the native milestone, marks a draft integration MR ready (ruling C10) and rewrites the
parent's generated children region (ruling N5). On GitLab it is a fragment job on the merged
merge request.

- **`CI_JOB_TOKEN` cannot write issues.** The job needs a **project access token** with `api`
  scope, stored by the consumer as a masked, protected CI/CD variable. The fragment names the
  variable and documents its creation and rotation; brain never creates or holds it.
- This is consistent with section 7: the credential is a project variable injected by GitLab, so
  it is legitimately absent from the YAML, and no GitHub credential appears.

**2. What degrades to `brain:gc`** (ADR-0039 decision 12, rulings T1 and T1-gc, 2026-10-07). When
a provider cannot automate an act because it lacks the tools, control degrades to `brain:gc`, a
dedicated sweep verb run under the user's credentials, at the tier the act has for an agent: a
Tier 2 act is shown and performed only after the human confirms, and a run without a TTY, or under
CI, only reports. `day:start` reports what is pending and offers to run it. On GitLab:

| Gap | What degrades |
|---|---|
| No project access token configured | every act of the close job |
| No issue-event pipeline source: GitLab starts pipelines on pushes, merge requests, schedules, the web UI, the API and trigger tokens, never on an issue being closed | always: the direct close of a merged-but-open node and its tracker deletion (ADR-0039 ruling S1's `issues` `closed` run has no GitLab counterpart) |

These are stated provider limitations. The fragment's job reports what it could not do; it never
passes silently.

### Why

ADR-0039's automation runs as the automation identity on GitHub because `GITHUB_TOKEN` can write
issues and a workflow can listen to issue events. GitLab's job token cannot do the first and its
pipelines cannot do the second. The maintainer's rule is that the act moves to `brain:gc`, not that
it disappears.

### What this does NOT change

Sections 1-7: the fragment's ownership, the Node entry points, `allow_failure` classes, the label
resolution, the pinned image, the merge-request-only rules for the gates, and the credential audit.

### Notes for the promoter

One in-place annotation at the end of section 6's first paragraph, plus this section.
