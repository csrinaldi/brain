---
status: tasked
issue: 886
---

# Design — #886 `mrAutoMerge`: one outcome constructor, two transports, one human gate

Implements `spec.md` under the ratified ruling `sdd/issue-886-mr-auto-merge/ruling` (D1–D6,
2026-09-09). Parent: #864 task 2.5, ADR-0034 L2.

## Approach in one paragraph

`mrAutoMerge` is a mutating write verb built on `branchProtect`'s discipline
(`github.mjs:263-295`): classify the transport's own words into a closed `reason`
vocabulary, return a fixed-key object, never throw. Two things are new. The refusal comes
**before** the transport, so `requiredReviews > 0` cannot reach a provider seam. And the
outcome object is built by ONE shared pure constructor that both providers import, so the
two adapters cannot drift into two shapes — the precedent is
`vcs/lib/uncomputable-cause.mjs`, the single constructor of the `{uncomputable,…}` shape.

## Deltas against the archived contract

`openspec/changes/archive/862/design.md:152` is amended by two recorded deltas, both ruled:

| archived | this slice | ruling |
|---|---|---|
| `method = 'squash'` parameter | **dropped**; `--squash` / `squash: true` hardcoded | D3 |
| no tier parameter | **`requiredReviews = 1`** added, fail-closed | D1 |

Final signature:

```
mrAutoMerge({ project, number, requiredReviews = 1, apiBase?, token?, proxyUrl?, fetchImpl? })
  -> Promise<{ enabled: true, url: string|null }
           | { enabled: false, reason: 'requires-human-approval' }
           | { enabled: false, reason: 'unsupported'|'transport', error: string }>
```

## Data flow

```
caller (#888, later) ──► mrAutoMerge({ requiredReviews })
                              │
              requiredReviews > 0 ──► refused('requires-human-approval')   ← no seam touched
                              │
                              ▼
        github: gh(['pr','merge',String(number),'--auto','--squash','--repo',project])
        gitlab: gitlabApiFetch(PUT projects/{enc}/merge_requests/{number}/merge,
                               { merge_when_pipeline_succeeds: true, squash: true })
                              │
                    ok ──► armed({ url })          fail ──► refused(classify(text), text)
                              │
                              ▼
                 lib/auto-merge-outcome.mjs — the ONLY place these keys are written
```

## Architecture decisions

### A1 — A shared outcome constructor, not two inline literals

**Choice**: new pure module `brain/scripts/vcs/lib/auto-merge-outcome.mjs` exporting
`AUTO_MERGE_REASONS` (frozen), `armed({url})`, `refused({reason, error?})`. Both providers
IMPORT it; neither re-exports it.
**Rejected**: inline object literals per provider (D4's key-set pin would catch a divergence
only where a test happens to look); a class or a `normalize.mjs` addition (that module is
about provider payload naming, not outcome shapes).
**Rationale**: the fixed key set is the contract, and a shape written twice drifts once.
`vcs/lib/` is the proven floor for shared, imported-not-re-exported helpers
(`uncomputable-cause.mjs:17-20`) — a helper RE-EXPORTED by both providers would be read as
an undeclared contract verb by `verb-contract-drift-guard.test.mjs:120`. `error` is present
**iff a provider spoke**: the tier refusal carries none, because fabricating provider text
for a decision the port made locally is the reader-empty-on-failure shape this repo removes.

### A2 — GitHub `url` is unconditionally `null`

**Choice**: the GitHub arm returns `{ enabled: true, url: null }` — no stdout parsing at all.
**Rejected**: parsing a URL out of stdout (`mrCreate`'s `r.stdout.trim()`, `github.mjs:593`);
constructing `https://github.com/{project}/pull/{number}`.
**Rationale**: `gh pr merge --auto` prints a human confirmation line ("…will be automatically
merged when all requirements are met") on its message stream, not a URL, so a parse yields
`''` — an empty string that reads as an answer. Constructing the URL is exactly
`repoCloneUrl`'s recorded latent defect and `prView`'s `null = uncomputable` rule
(`vcs-contract.md:34,40`). #888 already holds the PR URL from `mrCreate`, so nothing needs
it. The asymmetry (GitLab reports `web_url`) is stated in the contract row, not hidden.
**Consequence for TDD**: the GitHub happy-path test drives `rawSpawn(<captured stdout>, 0)`
and asserts `url === null` — the assertion holds whatever the live capture shows, so this
decision does not depend on an unverified string.

### A3 — GitLab classifies the thrown message, anchored; `gitlabApiFetch` is not touched

**Choice**: `catch (err)` and match `err.message` with
`/API failed:\s*(?:405|406)\b/` → `unsupported`; anything else → `transport`. `error` is
`err.message` verbatim.
**Rejected**: attaching `err.status` inside `gitlab-api.mjs:65`. It is additive and two
lines, but it widens the slice to the shared transport of ~10 verbs for a signal the message
already carries under a marker three modules already parse.
**Rationale**: `GitLab API failed: <status> (<path>)` is a de-facto pinned format
(`gitlab-api.test.mjs:68`, `uncomputable-cause.test.mjs:64-91`, `providers.test.mjs:89`).
The `API failed:` anchor is load-bearing and copied deliberately from
`uncomputable-cause.mjs:45-59`: an MR whose **iid is 405** produces
`GitLab API failed: 500 (projects/x%2Fy/merge_requests/405/merge)`, and a bare `\b405\b`
rule would report a server outage as "this forge will never do this". The sibling precedent
is `gitlab.branchProtect`'s anchored `': 409'` (`gitlab.mjs:931-934`) and its
false-positive test (`providers.test.mjs:543`). A test for this hazard is mandatory, not
optional.
`401`/`403`/`5xx`/network stay `transport` per D2: a credential problem is retryable by a
human with a better token; `unsupported` means "a maintainer must change the forge".

### A4 — The refusal is the first statement, and the test spies the seam

**Choice**: `if (requiredReviews > 0) return refused({ reason: REQUIRES_HUMAN_APPROVAL });`
as the first line of both implementations, before any `gh()` / `gitlabApiFetch` call.
**Rejected**: refusing after building the request (indistinguishable from the outside until
a seam is spied); refusing in the caller (D1's rejected option a).
**Rationale**: "never merge without the review the tier demands" is an invariant of the port,
not of its callers. The proof is behavioural: GitHub's seam is `setSpawn(() => { calls++; … })`
and GitLab's is a counting `fetchImpl`; the test asserts `calls === 0`. A counter, not a
throwing seam — an assertion names the defect, an exception would fail the never-throws test
for the wrong reason (the header note at `vcs.contract.test.mjs:2160-2163` records that
exact trap).

### A5 — The `unsupported` fixture is a recorded fixture FILE, and the only copy

**Choice**: `brain/scripts/vcs/fixtures/github-mrAutoMerge-unsupported.json`, with
`_provenance: { recorded: true, endpoint: "gh pr merge <n> --auto --squash --repo csrinaldi/brain", date }`
and the verbatim `stderr`. The contract test loads it through the existing `loadFixture` +
`assertProvenance` (`vcs.contract.test.mjs:50-64`) and feeds it to `failSpawn`.
**Rejected**: an inline string in the test (branchProtect's style) — inline is fine for an
invented `403` message, but this string is EVIDENCE, and the repo already has a vocabulary
for "recorded from a real run vs hand-authored" that an inline literal cannot carry.
**Rationale**: D2's whole point is that an invented pattern is green in test and inert in
production. `_provenance.recorded: true` is a claim a reviewer can challenge; a bare string
is not. GitLab's counterpart stays inline and DERIVED (no live GitLab mirror — the file
header's standing rule, `vcs.contract.test.mjs:16-21`).
**Order of work, non-negotiable**: capture the live stderr FIRST (this repo is
`allow_auto_merge: false` today), write the fixture, then write the regex from the fixture's
own words. If the live text differs from "auto-merge is not allowed for this repository",
the regex follows the capture and this document is wrong, not the capture.

### A6 — Contract assertions vs provider-specific argv assertions

**Choice**: shapes, key sets, reasons and never-throws go in the parameterized
`MR_AUTO_MERGE_PROVIDERS` block of `providers/vcs.contract.test.mjs`, mirroring
`BRANCH_PROTECT_PROVIDERS:2168-2228`. The exact `gh` argv and the exact GitLab path+payload
go in `providers.test.mjs`, beside `branchProtect`'s argv tests (`:357-568`).
**Rationale**: the file header (`vcs.contract.test.mjs:6-10`) draws that line already —
the contract suite asserts what the contract promises, never each provider's CLI-arg detail.
`--repo <project>` is a provider detail with a real consequence (`mrCreate` resolves the repo
from the git remote instead, `github.mjs:579`), so it is pinned where argv is pinned.

### A7 — `cli.mjs`: one array entry, no flag parsing

**Choice**: add `'mrAutoMerge'` to `VERBS` (`cli.mjs:38-46`). Nothing else.
**Rationale (measured)**: the CLI takes ONE JSON blob — `args = JSON.parse(process.argv[3])`
(`cli.mjs:184-192`) — so `requiredReviews` arrives as a JSON key exactly as `branchProtect`'s
does. There is no `--required-reviews` to add. `bindIdentity` (`:159-168`) wraps every
function export exhaustively, so credential binding needs no wiring.
**Free property worth stating**: `node brain/scripts/vcs/cli.mjs mr-auto-merge
'{"project":"o/r","number":1}'` REFUSES — the fail-closed default reaches the CLI surface
too, with no extra code.

## File changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/vcs/lib/auto-merge-outcome.mjs` | Create | `AUTO_MERGE_REASONS`, `armed`, `refused` — the only writer of these keys (~30 lines) |
| `brain/scripts/vcs/lib/auto-merge-outcome.test.mjs` | Create | Unit + source guard: no provider source may write `enabled:` by hand |
| `brain/scripts/vcs/providers/github.mjs` | Modify | `mrAutoMerge` after `mrCreate` (`:595`), via the `gh()` chokepoint (`:68`) |
| `brain/scripts/vcs/providers/gitlab.mjs` | Modify | `mrAutoMerge` after `mrCreate` (`:1147`), `gitlabApiFetch` PUT in try/catch |
| `brain/scripts/vcs/cli.mjs` | Modify | `'mrAutoMerge'` in `VERBS` |
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Modify | `MR_AUTO_MERGE_PROVIDERS` block |
| `brain/scripts/vcs/providers.test.mjs` | Modify | argv / path+payload pins per provider |
| `brain/scripts/vcs/fixtures/github-mrAutoMerge-unsupported.json` | Create | The captured stderr, `recorded: true` |
| `.../brain-drafts/vcs-contract.draft.md` | Create | `brain-amendment/1`, two rows (agent authors) |
| `brain/core/methodology/vcs-contract.md` | Modify | Verb row + adapter row — **maintainer's commit only** |
| `brain/scripts/vcs/verb-contract-drift-guard.test.mjs` | **Untouched** | Acceptance signal; editing it voids the gate |

## Failure classification

| provider | observed | `reason` | `error` |
|---|---|---|---|
| github | stderr matches the captured auto-merge-not-allowed class (A5) | `unsupported` | `r.stderr.trim()` |
| github | any other non-zero exit, ENOENT launch failure (`exec.mjs:30-32`) | `transport` | `r.stderr.trim()` or `gh pr merge failed (status N)` |
| gitlab | message matches `/API failed:\s*(?:405\|406)\b/` | `unsupported` | `err.message` |
| gitlab | `401`, `403`, `5xx`, `fetch failed`, anything else | `transport` | `err.message` |
| both | `requiredReviews > 0` | `requires-human-approval` | — (absent) |

Pinned key sets: `['enabled','url']` armed · `['enabled','reason']` tier refusal ·
`['enabled','error','reason']` unsupported/transport.

## Testing strategy — STRICT TDD

Red first, in this order. Each numbered step is a failing test before a line of implementation.

| # | Layer | Test (file) | Green by |
|---|---|---|---|
| 1 | unit | `armed`/`refused` key sets + frozen vocabulary (`lib/auto-merge-outcome.test.mjs`) | the new module |
| 2 | contract | omitted `requiredReviews` refuses; `requiredReviews: 1` refuses with seam calls `=== 0` (both providers) | the refusal line only |
| 3 | contract | armed → `{enabled:true,url}`, url `null` on github / `web_url` on gitlab; key set pinned | the happy path |
| 4 | contract | unsupported (github: the recorded fixture; gitlab: `405`, and `406`) | the classifier |
| 5 | contract | transport (`5xx`, `401`, network text); `error` is a string | the default arm |
| 6 | contract | never throws on every path (`doesNotReject`); `reason ∈ AUTO_MERGE_REASONS` | — |
| 7 | regression | gitlab: a `500` on iid **405** is `transport`, not `unsupported` (A3) | the anchored regex |
| 8 | provider | github argv is exactly `pr merge <n> --auto --squash --repo <project>`; gitlab path + `{merge_when_pipeline_succeeds:true,squash:true}` | — |
| 9 | acceptance | `verb-contract-drift-guard.test.mjs`, unmodified, all three checks | `VERBS` + the promoted doc row |

Commands (from the worktree root):

```bash
node --test brain/scripts/vcs/lib/auto-merge-outcome.test.mjs
node --test brain/scripts/vcs/providers/vcs.contract.test.mjs
node --test brain/scripts/vcs/providers.test.mjs
node --test brain/scripts/vcs/verb-contract-drift-guard.test.mjs   # RED until the promotion commit
npm test                                                           # before handing the PR over
```

No network, no real spawn: GitHub through `setSpawn` (`lib/exec.mjs:11`), GitLab through the
injected `fetchImpl`.

## D5 — The doc row, the draft, and the commit order

The draft is `openspec/changes/issue-886-mr-auto-merge/brain-drafts/vcs-contract.draft.md`,
a `brain-amendment/1` non-ADR amendment (no `amendment:`/`home-summary:` keys — those are
ADR-only and are a hard parse error here, `amendment-draft.mjs:147-154`):

```
target: brain/core/methodology/vcs-contract.md
issue: 886
```

Two `amend-find`/`amend-replace` pairs, each anchoring on a whole unique line:

1. the `| \`mrCreate\` | … |` **Required verbs** row (`vcs-contract.md:33`) → itself + the new
   `mrAutoMerge` row (the guard's row regex is `^\|\s*\`([a-zA-Z]+)\`\s*\|`,
   `verb-contract-drift-guard.test.mjs:68` — the name must be backticked and alphabetic);
2. the `| \`mrCreate\` | implemented | implemented (A3 — issue #239) |` **Phase 3 adapter**
   row (`:99`) → itself + the `mrAutoMerge` adapter row.

Verification the agent runs before handing over (`brain:promote` has no dry-run — it refuses
every option and gates on a typed word, `brain-promote.mjs:123-133`):

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { planAmendment } from './brain/scripts/lib/amendment-draft.mjs';
const r = planAmendment({
  draftText: readFileSync('openspec/changes/issue-886-mr-auto-merge/brain-drafts/vcs-contract.draft.md','utf8'),
  targetText: readFileSync('brain/core/methodology/vcs-contract.md','utf8'),
  homeText: null, gitUserName: 'draft-check', today: '2026-09-09', issueFallback: '886',
});
console.log(r.ok ? (r.plan ? r.plan.acts.map(a=>a.act+':'+a.state).join(' ') + ' | ' + r.plan.commitSubject : 'ALREADY APPLIED') : r.error);
"
```

Expected: `2:pending 2:pending | docs(brain): amend brain/core/methodology/vcs-contract.md (#886)`.
Anything else — `blocked`, `partial` — means an anchor moved: re-anchor the draft, never
hand-edit the target.

**Commit order, and why it is forced.** The guard is bidirectional: check `:82` says
`VERBS ⊆ doc ∪ allowlist`, check `:74` says `doc ⊆ VERBS`, check `:120` says both providers'
shared exports `⊆ VERBS`. Implementing the verb in both providers already fires `:120`, so
the code cannot be split from `VERBS`, and `VERBS` cannot be split from the doc row. **There
is no ordering that is green before the promotion commit.** Therefore:

1. agent commits tests + `lib/` + both providers + `VERBS` + the fixture + the draft → CI RED
   on `verb-contract-drift-guard` check `:82`, by design;
2. maintainer runs `npm run brain:promote -- openspec/changes/issue-886-mr-auto-merge/brain-drafts/vcs-contract.draft.md`
   **on this branch** and commits the target edit (authorship is the point — an agent may not
   commit `brain/core/**`);
3. CI green; cold review; merge.

The red interval IS the feature: it makes the human signature a precondition of the merge
rather than a follow-up. Do not "fix" it by adding the verb to `DOCUMENTED_BUT_NOT_REQUIRED`
(`:33`) — that would record a contract verb as a probe.

## Changed-line estimate

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**` from
`diff-size-count.mjs`.

| counted path | lines |
|---|---|
| `lib/auto-merge-outcome.mjs` | ~30 |
| `providers/github.mjs` | ~40 |
| `providers/gitlab.mjs` | ~45 |
| `cli.mjs` | ~1 |
| `fixtures/github-mrAutoMerge-unsupported.json` | ~10 |
| `brain/core/methodology/vcs-contract.md` (promotion commit) | ~4 |
| **counted total** | **~130 — Low risk** |
| uncounted, reviewer-visible: contract + provider + unit tests ~180, draft ~45 | ~225 |

**One PR. No chaining.** Review order for the cold reviewer: the outcome module, then the
refusal branch, then each provider's classifier, then the draft.

## Migration / rollout

None. No config key, no state, no caller, no repository setting changed
(`allow_auto_merge` stays `false`; enabling it is #805's gate, not this slice). Rollback is
`git revert` of the PR: removing both exports, the `VERBS` entry and the doc row in one
commit leaves the guard green.

## Risks and residuals

| risk | mitigation |
|---|---|
| The captured stderr class is narrower/wider than the live text | A5's order: capture, then regex. The fixture carries `recorded: true`; a reviewer can challenge it |
| GitHub `url` is always `null` — an asymmetry a caller could read as failure | stated in the contract row and asserted by a named test; `enabled:true` is the success signal, `url` is not |
| **Immediate merge when the target branch has no required context** — `--auto` and `merge_when_pipeline_succeeds` both degrade to "merge now" | out of scope by D6; the lane's `lane-paths`/`lane-scrub` contexts (#889) are the precondition. Recorded here so #888 does not arm on an unguarded branch |
| A caller reads `enabled:true` as "merged" | the word "armed" is in the contract row, the test name and #888's handoff |
| The branch sits red until the promotion commit | by design (D5); the guard is the gate |
| `vcs-contract.md:85` says "the 21 verbs" while `VERBS` already has 25 | pre-existing drift, NOT fixed here (it would widen the amendment beyond the two ruled rows). Filed as an observation for a later doc amendment |

## Open questions

- [ ] None blocking. The two live captures (GitHub's `unsupported` stderr, and the success
      line) are TDD-time measurements by construction, not design gaps — A2 and A5 are both
      written so that neither capture can invalidate the design.
