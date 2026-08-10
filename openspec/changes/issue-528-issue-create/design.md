---
status: draft
issue: 528
---

# Design

`vcs/lib/approval-deny.mjs` — one exported guard, imported by both providers. `vcs/lib/` is
where shared adapter helpers already live (`exec`, `token`, `normalize`, `identity-context`),
and providers import from it rather than from each other, which keeps the adapter boundary
(ADR-0008) intact.

The guard is duplicated in CALL and single in RULE. That is the split #340 records as a defect
when it goes the other way.

## Why not a wrapper in `getVcs`

`getVcs` returns the provider module directly unless an identity is bound, so there is no
universal interception layer to hook without changing what `getVcs` returns for every caller.
Putting the refusal on the verb keeps the change local and makes it visible where it applies.

## Red-proof

Six mutations, each one a plausible implementation:

| | mutation | why a reviewer might have written it |
|---|---|---|
| M1 | hardcode `'status:approved'` | the obvious literal |
| M2 | filter instead of throw | "be forgiving" |
| M3 / M4 | one provider forgets the guard | the exact asymmetry #335 tracks |
| M5 | fabricate `0` when the URL does not parse | a number looks more useful than `null` |
| M6 | case-sensitive comparison | nobody types it wrong… until they do |
