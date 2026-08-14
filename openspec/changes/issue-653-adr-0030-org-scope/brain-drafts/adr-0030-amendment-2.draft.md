# ADR-0030 Amendment 2 — draft (issue #653)

> **Tier 2 draft. Not yet promoted.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-653-adr-0030-org-scope/brain-drafts/adr-0030-amendment-2.draft.md
> ```
>
> The verb renders the plan, waits for the typed word, performs §1c's three acts,
> writes the `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them,
> and stops. **Your commit is the signature** (ADR-0028).
>
> **Promote this BEFORE the rename lands.** #590 measured what the reverse
> costs.

```brain-amendment/1
target: brain/project/decisions/adr-0030-distribution-scoped-registry-package.md
amendment: 2
issue: 653
home-summary: the deferred organisation scope is no longer deferred — the package is `@logikas/brain`, and a scoped package must declare `access: public` or publish private, #653
body: ## Amendment 2 — the deferred organisation scope is no longer deferred (issue #653)
body-end: ### Notes for the promoter
```

```amend-find
- **`@csrinaldi/brain` is free** — `404` on the registry, a user scope requiring
  no organisation.
```

```amend-replace
- **`@csrinaldi/brain` is free** — `404` on the registry, a user scope requiring
  no organisation.
  **[Amended by Amendment 2 (#653) — still true and no longer the choice. Measured
  again: `@logikas/brain` is also `404`, and the organisation now exists. Nothing
  was ever published under `@csrinaldi/brain`, so the change costs nothing.]**
```

```amend-find
npm install --save-dev @csrinaldi/brain
```

```amend-replace
npm install --save-dev @logikas/brain

# Amended by Amendment 2 (#653): the scope is @logikas. The line below is what
# Decision 1 originally read.
#   npm install --save-dev @csrinaldi/brain
```

```amend-find
**The scope is `@csrinaldi`** — a user scope, free, no organisation to create.
An organisation scope was considered and rejected for now: it buys a transferable
identity brain does not yet need, at the cost of a decision that is easy to make
later and awkward to unmake early.
```

```amend-replace
**The scope is `@csrinaldi`** — a user scope, free, no organisation to create.
An organisation scope was considered and rejected for now: it buys a transferable
identity brain does not yet need, at the cost of a decision that is easy to make
later and awkward to unmake early.

**[Amended by Amendment 2 (#653) — SUPERSEDED. The scope is `@logikas`. This
paragraph deferred the organisation scope and named the condition for revisiting
it; that condition now holds. Read the deferral as satisfied, not overruled. A
scoped package also publishes `restricted` unless `publishConfig.access` says
otherwise — see Amendment 2.]**
```

```amend-find
**An organisation scope.** Deferred, not rejected. Easy later, awkward to unmake
now.
```

```amend-replace
**An organisation scope.** Deferred, not rejected. Easy later, awkward to unmake
now.
**[Amendment 2 (#653): the deferral ended. "Easy later" was the correct
prediction — before a first publish it is one constant and four passages. After
one it would have been an unpublishable rename.]**
```

```amend-find
registry` resolves to, and only if that registry carries `@csrinaldi/brain`.
```

```amend-replace
registry` resolves to, and only if that registry carries `@logikas/brain`
(`@csrinaldi/brain` when Amendment 1 was written — see Amendment 2).
```

## Amendment 2 — the deferred organisation scope is no longer deferred (issue #653)

**Signed**: DD/MM/YYYY — <Name>

### The ADR is being followed, not overruled

Stated first because an amendment that changes the package name reads like a
reversal. It is not.

ADR-0030 did not reject an organisation scope. It **deferred** one, and named the
condition:

> **An organisation scope.** Deferred, not rejected. Easy later, awkward to unmake
> now.

The organisation now exists and owns the publishing credential. The condition
holds, so the deferral ends. Everything else in ADR-0030 — the registry as the
mechanism, the visibility/publication split, the `files` ordering, Amendment 1's
reachability cost and the git-URL fallback — stands unchanged.

### The measurement

| name | result |
|---|---|
| `@logikas/brain` | **404 — free** |
| `@csrinaldi/brain` | `404` — still free, never published |
| `brain` | `200` — the deprecated placeholder |

Zero packages published under `@logikas`. Because **nothing was ever published
under `@csrinaldi/brain`**, this costs nothing: no unpublish, no deprecation, no
redirect, no consumer to migrate twice. It is one constant in `installer.mjs`
(#623 made it exactly one) and five passages in this record.

"Easy later" was the right prediction, and this is the last moment it is true.

### What an organisation scope changes beyond the string

Three things, none of which a rename alone handles:

1. **A scoped package publishes `restricted` by default.** `npm publish` without
   `--access public` fails asking for a paid plan, or publishes private. It
   belongs in `publishConfig.access` in `package.json` **and** in the workflow's
   flag — the flag alone leaves a manual publish from a laptop doing the wrong
   thing, which is the failure that looks like success.
2. **The token must be scoped to `@logikas/*`, not to a package.** The package
   does not exist yet, so a granular token limited to selected packages cannot
   cover its first publish.
3. **The publishing identity becomes transferable.** That is precisely the
   property Decision 1 called one "brain does not yet need". It needs it now, and
   that is the whole content of this amendment.

### What this does NOT change

- The registry remains the distribution mechanism.
- **Amendment 1 stands in full**: reachability is still a named cost, and the
  git-URL install is still a supported, measured-equivalent fallback. Only the
  scope inside its sentence moves.
- ADR-0006 stays superseded.
- The `files` allowlist ordering in *Never do* is untouched: the pre-flight and
  the allowlist still land before `private: false`.

### Notes for the promoter

**Five in-place edits**, one of them inside **Amendment 1's own signed section**.
That is deliberate and worth naming: a reader landing on Amendment 1's paragraph
would otherwise read `@csrinaldi/brain` as the current scope. An amendment
section is current doctrine, not an archived record — unlike
`openspec/changes/**`, which #648 deliberately leaves alone — so it gets
corrected in place, with the original named in the parenthesis rather than
erased.

Promote **before** the rename lands. The mechanism must not precede its record;
#590 is the measurement of what that costs.
