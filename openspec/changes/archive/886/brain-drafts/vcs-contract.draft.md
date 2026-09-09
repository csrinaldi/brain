# Amendment draft — `vcs-contract.md`, the `mrAutoMerge` verb (issue #886)

**For**: `npm run brain:promote -- openspec/changes/issue-886-mr-auto-merge/brain-drafts/vcs-contract.draft.md`

> Drafted by agent, applied by the maintainer via `brain:promote` (Tier 2
> doctrine). This is the D5 handover: the code, its tests, and this draft
> ship on the PR branch agent-authored; only the maintainer may commit the
> edit to `brain/core/**`.

## Why

`mrAutoMerge` is a new required verb (#886, parent #864 task 2.5, ADR-0034
L2, ratified D1–D6 — `sdd/issue-886-mr-auto-merge/ruling`): both providers
export it, so `verb-contract-drift-guard.test.mjs` requires it in both the
Required Verbs table and `cli.mjs`'s `VERBS` array before it will report
green. The branch already carries the `VERBS` entry (task 6.1) — this draft
is the other half.

```brain-amendment/1
target: brain/core/methodology/vcs-contract.md
issue: 886
```

## Act 1 — the Required verbs table gains the `mrAutoMerge` row

Anchored on the `mrCreate` row (the guard's row regex is
`^\|\s*\`([a-zA-Z]+)\`\s*\|` — the new row's name is backticked and
alphabetic, same shape).

```amend-find
| `mrCreate` | `({ project, title, body, head, base?, labels?, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<{ url }\|{ url: null, error }>` | Opens a PR/MR. `base` defaults to `'main'`; `labels` omitted (not sent empty) when none given. GH: `gh pr create`. GL: `POST projects/{enc}/merge_requests` over `gitlabApiFetch` (issue #239 A3). Never throws — `{ url: null, error }` on failure. |
```

```amend-replace
| `mrCreate` | `({ project, title, body, head, base?, labels?, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<{ url }\|{ url: null, error }>` | Opens a PR/MR. `base` defaults to `'main'`; `labels` omitted (not sent empty) when none given. GH: `gh pr create`. GL: `POST projects/{enc}/merge_requests` over `gitlabApiFetch` (issue #239 A3). Never throws — `{ url: null, error }` on failure. |
| `mrAutoMerge` | `({ project, number, requiredReviews?, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<{enabled:true,url:string\|null}\|{enabled:false,reason:string,error?:string}>` | Mutating; arms auto-merge by tier — never merges, never throws. `requiredReviews` defaults to `1` (fail-closed): only the number `0` arms — any other value, including `null`, `NaN`, negative or non-number, refuses with `{enabled:false,reason:'requires-human-approval'}` WITHOUT calling the provider. Squash hardcoded, no `method` parameter (issue #886, D3). GH: `gh pr merge <number> --auto --squash --repo <project>`; `url` is unconditionally `null` — `gh pr merge --auto` prints a human confirmation line, not a URL, so stdout is never parsed. GL: `PUT projects/{enc}/merge_requests/{number}/merge` with `{merge_when_pipeline_succeeds:true,squash:true}`; `url` is the response's `web_url`, or `null` when absent. `reason` is one of `requires-human-approval`\|`unsupported`\|`transport`; `unsupported` is the forge itself refusing (GitHub's captured "auto-merge is not allowed" stderr class; GitLab `405`/`406`); `transport` covers network failure, `5xx`, `401`, `403`. `error` is present iff a provider spoke — never fabricated for the tier-refusal branch. `{enabled:true}` means armed, never merged. |
```

## Act 2 — the Phase 3 adapter status table gains the `mrAutoMerge` row

```amend-find
| `mrCreate` | implemented | implemented (A3 — issue #239) |
```

```amend-replace
| `mrCreate` | implemented | implemented (A3 — issue #239) |
| `mrAutoMerge` | implemented | implemented (#886) |
```

### Notes for the promoter

Two anchors, each verified to occur exactly once in the current
`vcs-contract.md`. Neither touches any other row or table. No caller wires
`mrAutoMerge` yet (#888), no repository has `allow_auto_merge` flipped (#805
gates enablement) — this amendment documents the verb the port now
implements, nothing more.
