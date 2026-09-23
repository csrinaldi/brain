# ADR-0006 Amendment 2 — draft (issue #729)

> **Tier 3 target. Not promoted, and not promotable by an agent.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-729-adr-0006-stale-scope/brain-drafts/adr-0006-amendment-2.draft.md
> ```
>
> The verb renders the plan, waits for the typed word, performs §1c's acts, writes
> the `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops.
> **Your commit is the signature** (ADR-0028).
>
> `brain/project/decisions/**` is Tier 3 and `brain:promote` refuses without a TTY.
> Both are why this file is a draft and not an edit.

```brain-amendment/1
target: brain/project/decisions/adr-0006-distribucion-installer-versionado.md
amendment: 2
issue: 729
home-summary: Amendment 1's own text named `@csrinaldi/brain`, a scope nothing was ever published under, and described a mechanism that has since shipped — the scope is `@logikas/brain` and the accepted loss it recorded is paid, #729
body: ## Amendment 2 — the scope Amendment 1 named was never published, and the loss it accepted is paid (issue #729)
body-end: ### Notes for the promoter
```

```amend-find
**[Amended by Amendment 1 (#617) — SUPERSEDED. Distribution is a published scoped package, `@csrinaldi/brain`. See ADR-0030. The install line below is historical.]**
```

```amend-replace
**[Amended by Amendment 1 (#617) — SUPERSEDED. Distribution is a published scoped package. See ADR-0030. The install line below is historical.]**
**[Amended by Amendment 2 (#729) — the scope. Amendment 1 wrote `@csrinaldi/brain`; ADR-0030 Amendment 2 (#653) moved it to `@logikas` and corrected its own copy of this sentence, not this one. Nothing was ever published under `@csrinaldi/brain` (`404`). The package is **`@logikas/brain`**, published since 2026-08-18.]**
```

```amend-find
#   npm install --save-dev @csrinaldi/brain
```

```amend-replace
#   npm install --save-dev @logikas/brain          # ← Amendment 2 (#729): the scope is @logikas
```

```amend-find
**ADR-0030 is signed while the mechanism is still ADR-0006's.** `main` carries
`private: true`, `"name": "brain"` and an install spec pointing at the git URL.
For as long as #435's mechanical half is open, ADR-0030 records an intent and
ADR-0006's install line is what actually runs.
```

```amend-replace
**ADR-0030 is signed while the mechanism is still ADR-0006's.** `main` carries
`private: true`, `"name": "brain"` and an install spec pointing at the git URL.
For as long as #435's mechanical half is open, ADR-0030 records an intent and
ADR-0006's install line is what actually runs.

**[Amended by Amendment 2 (#729) — PAID. Every clause above expired when #435
closed on 2026-08-18: `private: false`, `"name": "@logikas/brain"`,
`installSpecDetail` resolves `kind: 'registry'` (#644), and `@logikas/brain@1.1.0`
is on the registry. ADR-0030 no longer records an intent, and ADR-0006's install
line is no longer what runs. The paragraph is kept because the loss was real and
deliberately accepted — deleting it would erase the reasoning that justified
signing first — but it must not be read as a description of today.]**
```

## Amendment 2 — the scope Amendment 1 named was never published, and the loss it accepted is paid (issue #729)

**Signed**: DD/MM/YYYY — <Name>

Amendment 1 (#617) was written while the chosen scope was `@csrinaldi`. Two things
have happened to it since, and neither reached this file.

### 1 · The scope moved, and only ADR-0030 was told

ADR-0030 Amendment 2 (#653) changed the scope to `@logikas` and annotated its own
copy of the sentence. **ADR-0006's cross-reference was not touched**, so this ADR
went on naming `@csrinaldi/brain` in the present tense — the scope, and the line
its code block tells a reader to type instead.

Measured on `main` @ `76c2cea`:

```
@csrinaldi/brain . . . 404   (never published)
@logikas/brain . . . . 200   (1.1.0, published 2026-08-18)
```

A superseded decision is allowed to be wrong about the future. It is not allowed to
hand a reader an install line that resolves to nothing, in a comment written for the
express purpose of telling them what to type instead.

### 2 · The accepted loss is paid, and saying so is the point

Amendment 1 recorded a deliberate ordering: sign ADR-0030 first, ship the mechanism
after, and accept the interval in which the decision describes something that does
not yet exist. That interval closed with #435.

The paragraph is **kept, not deleted**. Deleting it would erase the reasoning — #590's
measurement of what the reverse ordering costs, which is why the interval was accepted
at all. What it needed was a terminator, so it stops reading as a description of the
present.

### What was deliberately left alone

The row *"`@csrinaldi/brain` is free (`404`)"* in the measurement table above sits under
the heading **"measured on `main` @ `3dfbdd4`"**. It was true when measured and is still
`404`. **A dated measurement is not a stale claim.** The same holds for the row saying
`test/fresh-install/run.sh` still exits 2 without `VCS_TOKEN`, which #728 has since made
false: as a record of what Amendment 1 saw, it stays.

Rewriting either would destroy the evidence Amendment 1 reasoned from, and ADR-0030
handles the identical fact the same way — annotating rather than replacing.

### The rule this leaves behind

**An amendment that renames a thing must chase every ADR that names it, not only its
own.** #653 corrected ADR-0030 and stopped there, because that is where the decision
lived — but the name it changed had already been quoted into a second signed artefact.
A cross-reference is a copy, and a copy does not update itself.

### Notes for the promoter

- Three `amend-find`/`amend-replace` pairs, each anchor verified to occur **exactly
  once** in the target before this draft was written.
- This is the first live exercise of `brain:promote`'s Route B after #676 repaired it.
  Read the rendered plan rather than skimming it.
- The `brain/HOME.md` marker is §1c's fourth act and the one with no gate behind it
  (#516) — confirm it landed before committing.
