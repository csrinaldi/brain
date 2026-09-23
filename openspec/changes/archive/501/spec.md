---
status: draft
issue: 501
---

# Spec — reviewer writes with ambient identity (issue 501)

## Requisitos delta

### REQ-501-1 — a bound port carries its identity to EVERY verb

`getVcs({ provider, identity })` returns a port whose every server call is made under
`identity`. Not the write verbs only: a read made under the wrong credential can see a
different repository than the one being written to.

Omitting `identity` leaves today's resolution untouched — `gh`'s ambient auth on GitHub,
`vcsToken(PROVIDER)` on GitLab — so no existing non-reviewer caller changes behaviour.

**Both providers, by two different mechanisms.** GitHub never accepted a per-verb token;
GitLab always did (`token ?? vcsToken(PROVIDER)`, thirteen sites) and the poster never passed
one. The fix is the same for both because the failure is the same: the identity is not bound
where the port is obtained.

### REQ-501-2 — `gh` is unreachable except through the chokepoint

Every `gh` invocation in `github.mjs` goes through one internal helper that applies the bound
identity. **Asserted on the source**, not on behaviour: a verb added later that calls
`run('gh', …)` directly would bypass the binding, pass every behavioural test, and reopen
this exact defect.

The same guard covers the GitLab side: no verb the reviewer reaches may fall back to
`vcsToken(PROVIDER)` when a bound identity exists.

This is the deliverable that separates fixing the instance from fixing the class. `whoami`
was correct and alone for the whole life of #413; nothing failed when the other nineteen
verbs did not follow.

### REQ-501-3 — the identity guards compare against what WROTE

- The anti-loop lock (`poster.mjs:113`) treats a prior verdict as its own when that verdict
  was authored by the identity this port writes under.
- The self-review abstention (`cold-boot.mjs:106`) compares the PR author against the same
  identity.

Both currently compare against the configured `reviewerHandle`. Once REQ-501-1 holds those
coincide — the requirement exists so that they coincide **by construction** rather than by
the two happening to be configured alike, which is the assumption that failed.

### REQ-501-4 — lock 2 is untouched, and that is asserted

`event: 'COMMENT'` remains hardcoded across all three `event`-carrying payloads in
`prReviewComment`. This change introduces no parameter, flag or branch that reaches it.

Stated as a requirement because this change threads a credential into the same function, and
"while I was in there" is how the two blockers on PR #490 were introduced. The existing
lock-2 red-proofs must still be red after this change, re-run rather than assumed.

## Escenarios

### E1 — the write carries the bound identity, not the ambient one (REQ-501-1)

```
GIVEN  a port bound to identity T
AND    an ambient credential belonging to a DIFFERENT identity A
WHEN   any write verb is invoked
THEN   the server call carries T
AND    it does not carry A
```

The two identities must differ in the fixture. A fixture where the bound token and the
ambient credential are the same identity is **green for a port that ignores the token
entirely** — which is precisely how this shipped, and is the #405 cardinality lesson in
another dimension: with N=1 identities, "wrote as the reviewer" is trivially true.

### E2 — an unbound port is unchanged (REQ-501-1)

```
GIVEN  a port obtained without `identity`
WHEN   any verb is invoked
THEN   the call is made exactly as it is today
```

Non-reviewer callers — the `brain:vcs` CLI, the governance checks — must not acquire a
reviewer's reach as a side effect of this fix.

### E3 — reads are bound too (REQ-501-1)

```
GIVEN  a port bound to identity T
WHEN   a READ verb is invoked (prView, prReviews, prStatusRollup, …)
THEN   the call carries T
```

Driven separately from E1 because "write verbs only" is the narrower fix a reader would
reach for, and it leaves the reviewer reading a repository it may not be writing to.

### E4 — no `gh` invocation escapes the chokepoint (REQ-501-2)

```
GIVEN  the source of github.mjs
WHEN   it is scanned for `run('gh'` / `runJson('gh'`
THEN   every occurrence is inside the chokepoint helper
```

### E5 — no bound verb falls back to the generic token (REQ-501-2)

```
GIVEN  the source of gitlab.mjs
WHEN   a verb the reviewer reaches is scanned
THEN   it does not resolve `vcsToken(PROVIDER)` when a bound identity exists
```

### E6 — the anti-loop lock recognises its own verdict (REQ-501-3)

```
GIVEN  a prior verdict at head H authored by the identity the port writes under
WHEN   the reviewer runs again at head H
THEN   nothing is posted, and the run reports the anti-loop skip
```

Measured today as failing: two verdicts at `663d850` on PR #500, `rev: 1` and `rev: 2`,
bodies identical.

### E7 — the self-review abstention uses the writing identity (REQ-501-3)

```
GIVEN  a port whose writing identity equals the PR author
WHEN   cold-boot runs
THEN   it abstains
```

### E8 — lock 2 survives (REQ-501-4)

```
GIVEN  this change applied
WHEN   the three lock-2 mutations from PR #490 are re-run
THEN   all three are still RED
```
