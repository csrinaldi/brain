# `openspec/README.md` rule 3 — lane exception (issue #862, epic task 5.3)

> **Not a `brain-amendment/1` draft. No `brain:promote` verification applies —
> stated here explicitly so a reader does not go looking for one.**
> `openspec/README.md` sits **outside `brain/**`**, so
> `amendment-draft.mjs`'s `target.startsWith('brain/')` guard refuses it and
> `brain:promote` does not apply to this file at all. This note is a patch for
> the maintainer to apply **directly**, by hand, in task 5.3's own PR (the
> follow-up ticket for the promotion sitting) — not promoted through the
> verb, and not applied in this PR either (D0: this change writes drafts,
> nothing else).

## Current text (`openspec/README.md:25`)

```
3. **Always committed.** Artifacts travel with the code in the same MR.
```

## Proposed text

```
3. **Always committed**, with one exception: `.memory/records/**` travels on
   its own memory lane (ADR-0034, #862), not with the code's MR. Every other
   artifact under `openspec/` and `brain/` still travels with the code in the
   same MR.
```

## Why

Rule 3 was written before the lane existed and states a rule the lane's own
PR would otherwise violate by design: a lane PR's diff is additions under
`.memory/records/` only, carrying no code and no other artifact. Recording
the exception here — rather than leaving rule 3 silently wrong for one class
of PR — is task 5.3's own act, applied by the maintainer alongside the three
`brain-amendment/1`/new-ADR drafts in this folder, same sitting shape as
#863's promotion (#876 for #875).
