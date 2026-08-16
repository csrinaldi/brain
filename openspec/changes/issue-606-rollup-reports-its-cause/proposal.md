---
status: draft
issue: 606
---

# Proposal — the rollup returns its cause, and the cause survives a `gh` upgrade

## The ruling

**Stop returning `null` from `prStatusRollup`. Return the array on success and a frozen
`{ uncomputable: true, reason, detail }` on failure**, where `detail` is the provider's own
words verbatim and `reason` is a label a pure classifier assigns — **conservatively, and
non-load-bearingly**. Ship the shape and the classifier as a shared `vcs/lib/` mechanism, adopt
it on **one verb, both providers**, and file the measured remaining 13 rather than pretend this
was an incident.

## Measured before writing anything

**The collapse is four causes, not five.** `github.mjs:478` already returns `[]` for a fetched
rollup that is genuinely empty — "no checks" is the one case this verb gets right today. What
`catch { return null }` at `:474` fuses is *rate-limited · unauthenticated · network down ·
not-found*, plus a fifth nobody named: *response present, `statusCheckRollup` not an array*.

**Both production consumers guard on `Array.isArray`, not on `=== null`:**

| Call site | Guard today | Under the new shape |
|---|---|---|
| `review/evaluators/tranche.mjs:270` → `evaluateTranche:133` | `!Array.isArray(requiredGates)` → `REVISE` | **unchanged** — still fails closed |
| `brain-metrics.mjs:487` → `detectionConclusion:179` | `!Array.isArray(rollup)` → `null` | **unchanged** — still uncounted |
| `vcs/cli.mjs:45` (CLI dispatch) | prints JSON | now prints the reason |
| `vcs.contract.test.mjs:1233` | `assert.equal(result, null)` | **the one assertion that changes** — it is the claim being revised |

So this is a **small** change, not a shape that forces every caller to move. That is why the
failure arm widens and the success arm does not.

**This is a RATE.** Read verbs that discard the cause:

| Provider | Sites | Notes |
|---|---|---|
| `github.mjs` | `:204 :309 :402 :474 :524 :587 :630` | `:309 checkRuns` returns **`[]`** on failure — the anti-pattern in its pure form, worse than this ticket's |
| `gitlab.mjs` | `:230 :307 :360 :393 :493 :554 :672 :1010` | |

**15 sites, 13 of them bare `catch {}` with nothing bound.** `prView:402`'s all-null shape is the
same defect's second mouth in the same verdict: it feeds `baseRefOid`, whose absence produces
`tranche.mjs:177`'s *other* unexplained `evidence uncomputable`.

## The five rulings

| # | Question | Ruling | Cost accepted |
|---|---|---|---|
| 1 | Return shape | `Array \| Uncomputable` (frozen object). **Not** `null`+side-channel (an opt-in diagnostic re-creates the silence for whoever forgets it). **Not** `{ok:true,checks}` (moves the success arm for no gain). **Not** throw (`mrList`'s divergence exists and its callers must wrap it). | A third arm in a port with one convention — mitigated by shipping it as the *shared* shape, so adopting it elsewhere is mechanical |
| 2 | Which layer classifies | Port **carries** verbatim; a pure `vcs/lib/uncomputable-cause.mjs` **labels**; `tranche.mjs` **renders** into `conditions`. | The classifier — not the provider verb, not the evaluator — owns `gh`/`glab` message knowledge, so it is corpus-testable and the evaluator stays provider-agnostic |
| 3 | `gh`'s text is not an API | **`detail` travels always, matched or not.** A rotted regex degrades `rate-limited: <text>` → `unclassified: <text>`; it can never degrade to silence. `reason` defaults to `unclassified`, never to anything readable as clean. `status` (already on `exec.mjs:32`, incl. `null` = binary missing, #604) is checked before text. A corpus test pins real observed spellings. | An **explicitly accepted, pinned** coupling — precedent `review/identity.mjs:50,71,85-92` + `identity.test.mjs:296-304`, the same three-state conservative classifier this repo already runs |
| 4 | GraphQL → REST | **Out of scope. Filed separately.** It fixes the incident and none of the class: a rate-limited REST rollup still returns an unnamed nothing. Landing it here would erase the incident before the diagnostic that explains it exists. | Order is deliberate: name the cause, then change the transport *with* the instrument in place |
| 5 | Siblings | **Fix one verb well + ship the shared mechanism + file the 13.** Not a silent single fix. `checkRuns:309` is filed at higher priority than the rest. | This ticket does not repair the rate; it makes repairing it mechanical and makes the inventory public |

## Capabilities

### New Capabilities
- `vcs-uncomputable-cause`: the `{ uncomputable, reason, detail }` shape, the conservative
  classifier and its pinned corpus, `prStatusRollup`'s adoption on **both** providers, and
  `evaluateTranche`'s `conditions` carrying the cause.

### Modified Capabilities
- None. Both consumers' *behaviour* is unchanged (`Array.isArray` still fails closed); what
  changes is the message, which is a new requirement rather than an altered one.

## Affected areas

| Area | Impact | What changes |
|---|---|---|
| `brain/scripts/vcs/lib/uncomputable-cause.mjs` | New | shape + pure classifier |
| `brain/scripts/vcs/providers/github.mjs:470-484` · `gitlab.mjs:337-363` | Modified | bind the error, return the cause |
| `brain/scripts/review/evaluators/tranche.mjs:123-143, 259-293` | Modified | thread + render the cause |
| `brain/scripts/vcs/providers/vcs.contract.test.mjs:1231-1234` | Modified | the assertion being revised |
| `brain/core/methodology/vcs-contract.md:35` | Modified | the `prStatusRollup` row |

## Risks

| Risk | L | Mitigation |
|---|---|---|
| A truthiness check (`if (!rollup)`) elsewhere now sees a truthy object | Med | Only two production consumers exist and both use `Array.isArray`; an explicit audit task, plus `isUncomputable()` exported for new callers |
| The classifier rots silently and stops classifying | Med | Structurally impossible to lose the cause (ruling 3); the corpus test pins the spellings that *are* claimed |
| A third port convention confuses the next author | Med | The contract doc row states it, and it is the declared destination for the filed 13 — not a one-off |
| The 13 filed siblings never get done | High | The inventory ships in the follow-up issue with line numbers, so the rate is countable |

## Rollback

One commit, no migration, no persisted state. Revert restores `catch { return null }` and the
`assert.equal(result, null)` contract test; both consumers are untouched by the revert because
they were untouched by the change.

## Success criteria

- [ ] A rate-limited rollup produces a verdict naming *rate-limited* and quoting `gh`'s words.
- [ ] An **unrecognised** failure still quotes the words verbatim, labelled `unclassified` — proved by a test that feeds an invented message.
- [ ] No classifier outcome can make an uncomputable rollup read as clean; `evaluateTranche` still returns `REVISE`.
- [ ] A genuinely check-less PR still yields `[]`, distinct from every failure.
- [ ] The 13 remaining sites are filed with line numbers, `checkRuns:309` first.

## Links

#604 (`exec.mjs` — launch failure vs ran-and-said-nothing) · #633 (a hook never discards stderr) ·
#634 (readers report what they collapsed) · #522/#523 (`governance.yml` — infra vs governance) ·
ADR-0021 Decision 2 · `evidence-reader-empty-on-failure`
