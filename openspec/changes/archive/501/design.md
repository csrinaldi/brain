---
status: draft
issue: 501
---

# Diseño — reviewer writes with ambient identity (issue 501)

## The measurement that decides the shape

`brain:review -- --pr 500` ran with `BRAIN_REVIEWER_TOKEN` holding a `csrinaldibot` PAT, on a
machine whose `gh` was authenticated as `csrinaldi`. Identity verification **passed**; the
review posted as **`csrinaldi`**.

Surface, counted rather than estimated:

```console
$ grep -c "^export async function" brain/scripts/vcs/providers/github.mjs
25
$ # verbs that shell out to gh: 19, across 21 call sites
$ grep -n "GH_TOKEN" brain/scripts/vcs/providers/github.mjs
31:// than of whatever `gh` happens to be logged in as — `GH_TOKEN` takes
36:  const opts = token ? { env: { ...process.env, GH_TOKEN: token } } : {};
```

Two hits, both inside `whoami`.

## D1 — the identity binds at PORT CONSTRUCTION, not per verb

The obvious fix is a `token` parameter on every verb. **GitLab is the counter-example that
rules it out**: that parameter already exists there —

```js
const tok = token ?? vcsToken(PROVIDER);          // gitlab.mjs:27, and at twelve more sites
```

— it is correct, and the reviewer still writes with the wrong credential, because
`poster.mjs:137` calls `vcs.prReviewComment({ project, number, body, comments })` and never
passes one. GitLab falls back to `VCS_TOKEN`; GitHub falls back to `gh`'s keyring. **Both
providers write as someone other than the reviewer, by two different mechanisms, and the
per-verb parameter did not prevent either.**

Adding that same shape to GitHub's 19 verbs would reproduce the same failure over more
surface. A parameter that a caller may omit is a rule the caller must remember, and
`reviewer-protocol.md` §2 sets the standard that applies: *"That asymmetry cannot be a rule
the agent remembers… It must be impossible by construction."*

**Decision: `getVcs({ provider, identity })` binds the credential to the port.** The root
cause is visible at `poster.mjs:118` — `await getVcsFn({ provider })` obtains a port with no
notion of who it is, and every verb it returns then guesses. A bound port cannot be called
without an identity, because there is no unbound verb to call.

`identity` is **opt-in and defaults to today's behaviour**. `github.mjs` and `gitlab.mjs`
serve non-reviewer callers too — the `brain:vcs` CLI and the governance checks — for which
`VCS_TOKEN` or ambient auth is correct. Two credentials exist and must stay distinct:
`VCS_TOKEN` (ADR-0007/#33, generic) and `BRAIN_REVIEWER_TOKEN` (#413, the reviewer's own).
This change does not merge them; it makes the reviewer's reach the wire.

## D2 — one chokepoint per provider, and a drift guard on it

Binding at construction is not enough on its own: a verb added later can still call
`run('gh', …)` directly and bypass the binding. That is the `hasUsableAnchor` lesson from
#405 — *two copies of one rule drift; one function cannot* — and it is why this change ships
a guard rather than a convention.

- `github.mjs` gets one internal helper through which **every** `gh` invocation passes,
  applying the bound identity as `GH_TOKEN`.
- `gitlab.mjs` routes its calls through the bound token instead of `?? vcsToken(PROVIDER)`.
- **A source-level drift test asserts no raw `run('gh'` / `runJson('gh'` outside the
  helper**, and no `vcsToken(PROVIDER)` fallback on a verb the reviewer reaches.

The drift test is the deliverable that distinguishes fixing the instance from fixing the
class. Without it, verb #20 reopens the hole and every existing test stays green — which is
exactly the history this ticket records.

## D3 — the identity comparisons key on what actually wrote

Two guards currently compare against the CONFIGURED handle rather than the writing identity:

- `poster.mjs:113` — `lastVerdict.author === reviewerHandle`. Measured on PR #500: the
  anti-loop lock **saw** its own prior verdict (`rev: 2` proves `priorRevCount` was 1, so
  `prReviews` returned it and `parseVerdict` parsed it) and **disowned** it, because the
  author was `csrinaldi` and the handle is `csrinaldibot`. Two identical verdicts at one
  `head_sha`. Unbounded: `rev` climbs on every run, and at `rev >= 3` a `REVISE` becomes
  `STOP` + `escalate:human` (protocol §7) on a PR nothing changed on.
- `cold-boot.mjs:106` — the self-review abstention compares `reviewerHandle` to the PR
  author. On #500 it concluded "not a self-review" and the review was then posted by
  `csrinaldi`, **who is the PR author**.

Once D1 lands, the writing identity IS the verified handle, so both comparisons become true
statements rather than coincidences. They are still stated explicitly here because a guard
whose correctness depends on an invariant established elsewhere needs the invariant named at
the guard — the alternative is what this ticket is about.

## D4 — what this does NOT decide

**Lock 2 stays untouched.** `event: 'COMMENT'` remains hardcoded across all three
`event`-carrying payloads; ADR-0020 says no parameter, flag or branch selects a different
event, and this change adds none. Lock 2 held under three independent red-proofs on PR #490
and is the reason the present defect approved nothing.

**Whether `VCS_TOKEN` and `BRAIN_REVIEWER_TOKEN` should unify** is out of scope. They are
different identities by design (the two-key split); collapsing them is an ADR, not a bug fix.

**#473's question — where the approval signature lands — is separate and being worked in
parallel.** This change is *with which identity the reviewer writes*; #473 is *on which
object the human signs*. The file sets are disjoint (verified: #473's branch touches
`review/lib/{yaml-block,decision-block,parse-verdict}.mjs` and `evaluators/checkpoint.mjs`;
this change touches `vcs/providers/*` and the two identity comparisons).

## Contract / API impact

`getVcs({ provider })` gains an optional `identity`. Omitted, behaviour is unchanged — every
existing caller keeps ambient/`VCS_TOKEN` resolution, so no non-reviewer call site moves.

`vcs-contract.md` needs a row stating that a bound port carries its identity to every verb,
because that is now a contract both providers must satisfy and the contract test is what
keeps it symmetric. Tier 2 — drafted here, promoted by a human.

## Alternativas descartadas

- **A `token` parameter on each of GitHub's 19 verbs.** Ruled out by D1's measurement: the
  shape exists on GitLab and failed there.
- **Always inject `vcsToken()` inside the port.** Wrong credential — `VCS_TOKEN` is not the
  reviewer's identity, and it would silently give non-reviewer callers a reviewer's reach.
- **`gh auth login --with-token` before writing.** Mutates the operator's machine-wide gh
  state as a side effect of running a review, and races any concurrent gh use. `GH_TOKEN` in
  the child env is scoped to the call, which is what `whoami` already chose.
- **Fixing `prReviewComment` alone.** It is the verb the defect was observed through, not the
  defect. `issueComment` and `labelAdd` write too, and the reviewer reaches both.
