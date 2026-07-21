# A ruling binds a correct property to a mechanism nobody ran

- **Discovered in:** issue #297 (D2 PR3 reverter-skip) / the rev-3 ruling itself,
  authored by the external reviewer
- **Applies to:** any review verdict, ruling, or design note that names a
  specific function, predicate, flag, or range as the way to satisfy a property
  — reviewer output as much as author output

## Symptom

A ruling states the right invariant and then names the wrong machinery for it,
and the naming reads as authoritative because the property behind it is
correct. The rev-3 ruling required "a tree-keyed offender whose own payload is
present at the audited tip can never be exempted" — exactly right — and bound
it to:

```js
exempt = isResolvedAt(candidate, auditedTip).resolved && netAddFull(candidate) <= 0;
```

Implemented verbatim, it made the two fixtures the ruling discussed go green
and broke two it never mentioned: `isResolvedAt` sums the half-open range
`(candidate, tip]`, which is **empty for every tip-most merge**, so
`resolved: false` came back categorically — denying the exemption to precisely
the legitimate tip-most cleanup reverters the mechanism exists to serve. The
patch author found it only because they ran the whole suite before committing.

## Cause

Mechanism bindings get held to a lower evidentiary standard than the claims
around them. A finding carries evidence, a fix carries a test — but the clause
that says *"implement it as `f(x) && g(y)`"* travels on the author's fluency
with the code, and fluency is exactly what a degenerate range defeats. The
range asymmetry here was documented in the module and still misread: `netAddFull`
uses a deliberately FULL-WINDOW inclusive range so a tip-most reverter can see
the offender behind it, while `netPresent`/`isResolvedAt` use a DIRECTIONAL
half-open one so a live re-add at the tip can never resolve itself away. Both
are correct; composing them collapses the first into the second.

Two structural amplifiers make it worse. A ruling is **downstream of the
frozen tests but not checked against them** — the reviewer reasoned about the
fixtures named in the escalation and not the frozen set as a whole. And its
verdict is **socially load-bearing**: the cheapest response to "the ruling
breaks two fixtures" is to weaken the two fixtures.

## Solution / correct pattern

**Run the binding, or state the property and leave the mechanism to the
implementer.** A ruling may always assert the invariant — that is the
reviewer's job and needs no execution. The moment it names *how*, it inherits
the same run-don't-assert bar as everyone else's claims.

```yaml
# WRONG — a mechanism named, never executed, inside an authoritative verdict
ruling: "gate the exemption with isResolvedAt(candidate, tip).resolved && netAddFull(candidate) <= 0"

# RIGHT — the property is the ruling; the binding is proposed, not decreed
ruling: >
  A candidate whose own payload is present at the audited tip must never be
  exempted. Suggested binding (UNRUN — verify against the full frozen set
  before adopting): ...
```

When the binding does break something, the correction goes in the ruling, not
in the fixtures. The frozen set is the spec: neither the implementer nor the
reviewer edits the spec to make an error fit. #297 recorded the gap as a
`correction` finding against its own prior revision and re-ruled — which is why
the error cost one escalation instead of a silently weakened guard.

Related, same class one layer down: an author's claim about a flag ("this
reddens on drop") is worth nothing until the mutant is forged and the test
actually goes red. See
[Evidence reader returns empty on failure](evidence-reader-empty-on-failure.md)
for the fail-open flavor of the same root cause — a state nobody checked
becoming an approval.
