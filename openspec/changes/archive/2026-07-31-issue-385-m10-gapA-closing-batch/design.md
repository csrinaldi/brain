---
status: archived
issue: 385
epic: 335
artifact_store: hybrid
topic_key: sdd/issue-385-m10-phase2-rank6-batch/design
---

# Design: whoami / commitStatus / repoCloneUrl / patSetupUrl / projectResolve Contract-Parity Coverage

Issue #385. Epic #335. Reads: `proposal.md` (same folder).

Test-only, additive. **Zero production files modified.** Every latent defect this suite reaches is
LOCKED as current behavior and filed, never fixed here.

## Verified before designing

Every claim below was read from source, not assumed.

| Fact | Source |
|---|---|
| `github.whoami()` takes **no parameters**, spawns `runJson('gh', ['api','/user'])`, returns `{ username: resp.login }` | `github.mjs:30-33` |
| `gitlab.whoami()` — identical shape, `runJson('glab', ['api','/user'])`, `{ username: resp.username }` | `gitlab.mjs:31-34` |
| `github.commitStatus` reads `resp.check_runs?.[0]`, returns `null` if absent, else `normalizeCommitStatus('github', cr.status === 'completed' ? cr.conclusion : cr.status)` | `github.mjs:219-227` |
| `gitlab.commitStatus` requests `...?per_page=1` and returns `normalizeCommitStatus('gitlab', arr[0]?.status)` — **no local empty guard** | `gitlab.mjs:370-374` |
| `normalizeCommitStatus` opens with `if (raw == null) return null` — GitLab's missing guard is safe by delegation | `normalize.mjs:34-35` |
| `GITHUB_STATUS_MAP` maps `neutral` and `skipped` to **`null`** — a *completed* check collapses into the same `null` as "no checks ran" | `normalize.mjs:24-25` |
| `runJson` **throws** on non-zero exit AND on invalid JSON; neither transport verb catches it | `exec.mjs:29-33` |
| `github.repoCloneUrl` → `https://x-access-token:${token}@${host \|\| 'github.com'}/${project}.git` | `github.mjs:480-482` |
| `gitlab.repoCloneUrl` → `https://oauth2:${token}@${host}/${project}.git` — **no host fallback** | `gitlab.mjs:530-532` |
| `github.patSetupUrl` **ignores `host` entirely**, hardcodes `github.com`, param key `description` | `github.mjs:484-486` |
| `gitlab.patSetupUrl` is host-driven, param key `name` | `gitlab.mjs:534-536` |
| `projectResolve` is `return project` on both providers | `github.mjs:36-38`, `gitlab.mjs:38-40` |

Consequence that sets the whole scenario table: because `runJson` throws, `commitStatus`'s `null`
(empty result, a **successful** call) and its rejection (transport failure) are **two distinct
outcomes**, not one. They need separate scenarios. This is the same divergence `mrList`/`issueList`
are pinned on (`vcs.contract.test.mjs:383-392`, `:478-487`) and the OPPOSITE of
`authCheck`/`authLogin`'s never-throws boolean (`:505-517`).

---

## D1 — Fixture vs no-fixture split

**Decision.** Split on one criterion, and only one: **does the verb have a transport seam?**

See Engram #1761 for full design detail on fixture strategy, PROVIDERS registration, whoami scenario mechanics, commitStatus scenarios, repoCloneUrl handling, patSetupUrl divergence, projectResolve identity, fixture manifest, vcs-contract.md amendments, component map, size forecast, risks and unresolved items.

**Key decisions carried forward:**
- Transport verbs (whoami, commitStatus) use existing `jsonSpawnCallArgs` glue
- Pure verbs (projectResolve, repoCloneUrl, patSetupUrl) have fixture-free in-loop assertions
- 10 total fixtures with provenance tracking
- 3 latent defects locked (not fixed) and filed as follow-up issues
- Divergence-lock tests below the loop mirror existing precedent
