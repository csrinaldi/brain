# CP-A2b Runbook — live validation on the gitlab.com public mirror

> **Deferred e2e validation of A2** (fixture-tested + merged as #232/#233/#234). Proportional ceremony:
> nothing here is irreversible (a public mirror + two throwaway MRs). The agent prepared this; the human
> reviews and executes. Committed as an artifact (the cutover-runbook precedent).
>
> **Prereqs (human already configured):** public gitlab.com mirror · `VCS_TOKEN` masked CI variable (API
> scope) · "Pipelines must succeed" merge check ACTIVE · the mirror's **default branch is
> `feature/v2.0.0`** (the first branch pushed — everything lives there; do NOT introduce a `main`).
>
> **Order:** this micro-PR (root `.gitlab-ci.yml` + this runbook) merges to `feature/v2.0.0` → re-push →
> the human creates the two MRs → capture evidence.
>
> **Fill in:** `<GITLAB_MIRROR_URL>` · `<APPROVED_ISSUE_IID>`.

## Why the root `.gitlab-ci.yml` ships to origin (not added on the mirror)
It rides THIS micro-PR into `feature/v2.0.0` because: (a) SCIT will need it too — this repo IS the future
GitLab consumer; (b) it is literal dogfooding of ADR-0018's `include:` line through the real circuit;
(c) it preserves end-to-end SHA equality (origin == mirror), with **no phantom commit** authored on the
mirror. On GitHub the file is inert.

## Step 1 — Re-push `feature/v2.0.0` + verify by SHA
After this micro-PR merges, mirror the updated `feature/v2.0.0` (now carrying the root `.gitlab-ci.yml`)
and prove the two remotes are identical.
```bash
git remote get-url gitlab >/dev/null 2>&1 || git remote add gitlab <GITLAB_MIRROR_URL>
git fetch origin
git push gitlab origin/feature/v2.0.0:refs/heads/feature/v2.0.0

echo "origin: $(git rev-parse origin/feature/v2.0.0)"
echo "gitlab: $(git ls-remote gitlab refs/heads/feature/v2.0.0 | cut -f1)"
```
**Verify:** the two SHAs are identical. **STOP if they differ** — the mirror is not the tree A2 verified.

## Step 2 — The two test MRs (pre-drafted; the human just creates them). Both target `feature/v2.0.0`.

### MR-A — NON-COMPLIANT → must be BLOCKED at rung 1
- **Source:** `test/cp-a2b-noncompliant` off `feature/v2.0.0`; trivial diff (`echo probe > .cp-a2b-probe`).
- **Target:** `feature/v2.0.0` · **Title:** `test: CP-A2b — non-compliant (no issue link)`
- **Description (verbatim — NO issue reference on purpose):**
  > CP-A2b negative case. This MR intentionally carries NO `Closes/Fixes/Resolves/Part of #N` reference.
  > The REQUIRED `issue-link` gate must FAIL and, via "Pipelines must succeed", BLOCK the merge at rung 1.
- **Expected:** `issue-link` **fails** (REQUIRED, red) → pipeline fails → merge **blocked**. DETECTION jobs
  yellow/allowed, never blocking.

### MR-B — COMPLIANT → must PASS
- **Prereq (REQUIRED, do not skip):** an issue on the mirror labelled with the GitLab **scoped** label
  `status::approved` → its IID is `<APPROVED_ISSUE_IID>`. This is NOT cosmetic: the REQUIRED `issue-link`
  gate fetches the referenced issue (via the provider `issueView`, which IS implemented for GitLab — this
  path does NOT go through the `gh`-hardcoded m3 gap) and FAILS if the issue lacks the resolved approved
  label. On GitLab the resolver maps `status:approved` → `status::approved`, so the issue must carry the
  scoped form.
- **Source:** `test/cp-a2b-compliant` off `feature/v2.0.0`; trivial diff (`echo ok > .cp-a2b-probe2`).
- **Target:** `feature/v2.0.0` (the mirror's DEFAULT branch → the base-branch conditional REQUIRES a
  closing keyword; this is the first LIVE exercise of the phase-2 base-branch addendum).
- **Title:** `test: CP-A2b — compliant`
- **Description (verbatim):**
  > CP-A2b positive case. Closes #<APPROVED_ISSUE_IID>
  > Targets the default branch with a closing keyword; the referenced issue carries `status::approved`.
  > All REQUIRED gates must pass and the MR must be mergeable.
- **Expected:** 5 REQUIRED **green**; DETECTION allowed (note: `actor-check` WARNS — `gh` can't reach
  GitLab, the documented m3 A2/A3-boundary gap; `allow_failure: true` keeps it non-blocking). Pipeline
  "passed" (with warnings) → merge **enabled**.

## Step 3 — Evidence to capture
| Artifact | From | Proves |
|----------|------|--------|
| Pipeline log — job list + `issue-link` FAILED | MR-A | REQUIRED fail-closed on a missing issue link |
| Merge panel ("blocked / pipeline must succeed") | MR-A | rung-1 enforcement (non-compliant blocked) |
| Pipeline log — 8 jobs; 5 REQUIRED green; DETECTION yellow-allowed | MR-B | job parity + `allow_failure`-iff-DETECTION live |
| Merge panel ("mergeable") | MR-B | compliant passes; passed-with-warnings satisfies the gate |
| `issue-link` job log on MR-B (fetched the issue, saw `status::approved`) | MR-B | **live validation of the resolver `:`→`::` mapping + provider `issueView` on GitLab** |
| `issue-link` verdict on MR-B (closing keyword on the default branch) | MR-B | **live validation of the base-branch addendum** |
| `actor-check` job log on MR-B (warn, not fail) | MR-B | the m3 gap degrades SAFE (DETECTION warn, never false-pass) |

## Success criteria (CP-A2b)
MR-A: `issue-link` red, merge BLOCKED. MR-B: REQUIRED green (issue-link having verified the scoped approved
label AND enforced the closing keyword on the default branch), merge ENABLED. `allow_failure` DETECTION
never blocks either. **Any divergence from the fixture-predicted verdicts STOPS and returns to the agent.**

## Re-running after a fix (load-bearing — GitLab MR pipelines run the SOURCE tree)
A GitLab MR pipeline runs the tree of the MR's **source branch** (`refs/merge-requests/N/head`), so a plain
"retry" re-executes the OLD fragment — a fix merged to `feature/v2.0.0` is NOT picked up by simply retrying
the existing MRs. After a governance-fragment fix (e.g. findings #12/#13) merges and the mirror is
re-pushed, refresh BOTH test branches so the MRs re-evaluate against the corrected tree:
```bash
git push gitlab origin/feature/v2.0.0:refs/heads/feature/v2.0.0   # mirror carries the fix
for b in test/cp-a2b-noncompliant test/cp-a2b-compliant; do
  git fetch gitlab "$b" && git switch -c "$b" FETCH_HEAD 2>/dev/null || git switch "$b"
  git merge --no-edit origin/feature/v2.0.0     # fold the fixed fragment into the MR source tree
  git push gitlab "$b:$b"                        # new pipeline runs on the corrected tree
done
```
**Verify:** each MR shows a NEW pipeline whose commit == the merge just pushed; only then are the verdicts
attributable to the fixed fragment. (First-run findings from CP-A2b: #13 node:20→node:22 glob;
#12 issueView glab→direct API v4 — both fixed before the re-run.)

## Cleanup
Close both MRs, delete `test/cp-a2b-*` branches and the `.cp-a2b-probe*` files. The mirror
`status::approved` fixture issue can stay for future re-runs.

## Out of scope (later, own smoke)
SCIT self-hosted specifics — CE-version behavior, corporate proxy via `HTTP(S)_PROXY`, self-hosted runner
availability — when the human restores access and provides the new endpoint.
