# Amendment draft — `harness-contract.md`, the archive sweep's PR now needs a GitHub App (issue #1106)

> **Tier 2 draft. Not yet promoted.** The maintainer promotes it AFTER this PR merges — never
> before, and never by an agent (agents never edit `brain/core/**`):
>
> ```
> npm run brain:promote -- openspec/changes/issue-1106-app-token-archive-sweep/brain-drafts/harness-contract-archive-sweep-app-token.draft.md
> ```

```brain-amendment/1
target: brain/core/methodology/harness-contract.md
issue: 1106
```

## Edit 1 — the "machine-guaranteed" archiving paragraph now names its precondition

```amend-find
> **`/sdd-archive` is human-optional, machine-guaranteed.** No human is required to run it, and no
> gate fails because a change is unarchived: staleness is never an audit failure class. On GitHub,
> the machine does the archiving. After every clean post-merge audit,
> `.github/workflows/governance-postmerge.yml` sweeps changes whose issue is CLOSED into
> `openspec/changes/archive/` through one `auto-archive/<date>` PR. "Optional" here means "not your
> job", not "nobody's job"; running it by hand only makes the next sweep a no-op. The GitLab
> governance fragment has no sweep step yet, so on GitLab archiving is still a manual act.
```

```amend-replace
> **`/sdd-archive` is human-optional, machine-guaranteed — on GitHub, when a GitHub App is
> configured (#1106).** No human is required to run it, and no gate fails because a change is
> unarchived: staleness is never an audit failure class. After every clean post-merge audit,
> `.github/workflows/governance-postmerge.yml` archives every change whose issue is CLOSED and
> pushes one `auto-archive/<date>` branch — that half needs no configuration, `GITHUB_TOKEN`
> already carries `contents: write`. Opening the PR is the part that needs an identity of its
> own: `GITHUB_TOKEN` either cannot create pull requests (a repository setting many orgs turn
> off) or, where it can, a PR it opens triggers no workflow run at all, so `governance.yml`
> would never run on it and it could never merge (#1106). The sweep therefore mints a GitHub
> App installation token (`BRAIN_SWEEP_APP_ID` / `BRAIN_SWEEP_APP_PRIVATE_KEY` repository
> secrets; the App needs only `Contents: read/write` and `Pull requests: read/write` on the one
> repository) and uses it for both the push and the PR.
>
> **Without those two secrets, the guarantee degrades, it does not break.** The sweep still
> archives and pushes the branch every run; it never calls `gh pr create` with a token that
> cannot open a mergeable PR; it files an issue carrying a compare link
> (`.../compare/<default>...auto-archive/<date>`) so a human opens the PR by hand. "Optional"
> here means "not your job", not "nobody's job" — configuring the App turns the last mile back
> into nobody's job too; running the compare link by hand only makes the next sweep's PR a
> no-op once it lands. The GitLab governance fragment has no sweep step yet, so on GitLab
> archiving is still a manual act regardless.
```
