# ADR-0004 Amendment 5: the bulk `hydrate` verb is delivered, and `import` is its deprecated alias (issue #1115)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1115-memory-lifecycle-verb/brain-drafts/adr-0004-amendment-5.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0004-adapter-memoria-memory-backend.md
amendment: 5
issue: 1115
home-summary: the required `hydrate` verb is delivered on both backends as `cli.mjs hydrate` (engram: guarded import that defers without the binary; plainfiles: index rebuild); session:start, day:start and post-merge call only it, `import` is a deprecated alias for one release, and day:start no longer exports engram into `.memory/`, #1115, #1189
body: ## Amendment 5 — the bulk `hydrate` verb is delivered, and `import` is its deprecated alias (issue #1115)
body-end: ### Notes for the promoter
```

```amend-find
`hydrate` (today `pull` / `cli.mjs import`)
```

```amend-replace
`hydrate` (today `pull` / `cli.mjs import` **[Amended by Amendment 5 (#1115): the bulk form is `cli.mjs hydrate` on both backends; `cli.mjs import` is its deprecated alias for one release]**)
```

```amend-find
backend (`share`, `pull`, `import`, `index`, `setup`, `search`, `feature-*`, `heal-duplicates`)
```

```amend-replace
backend (`share`, `pull`, `import`, `index`, `setup`, `search`, `feature-*`, `heal-duplicates` **[Amended by Amendment 5 (#1115): and `hydrate`; `import` is now its deprecated alias and refuses the same way]**)
```

## Amendment 5 — the bulk `hydrate` verb is delivered, and `import` is its deprecated alias (issue #1115)

**Signed**: DD/MM/YYYY — <Name>

### What changed

The Dispatcher line named `hydrate` as a required verb "today `pull` / `cli.mjs import`".
`import` was engram's spelling, and the callers used it:

- **`hydrate` is an op of the dispatcher** (`brain/scripts/memory/cli.mjs`), implemented by both
  adapters. With no `recordId`, engram runs its guarded import and defers, never throws, without
  its binary. plainfiles rebuilds the derived index. The contract records the verb
  (`memory-backend-contract.md` Amendment 3).
- **The callers use only `hydrate`.** That covers `session:start`, `day:start` step 4a and the
  `post-merge` hook. None of them names a backend's op, and `session:start` names the active
  backend instead of "engram".
- **`import` is a deprecated alias for one release.** It prints a notice naming `hydrate` and
  dispatches it. It is not added to `FALLBACK_OPS`. Like every op that consults a backend, it
  refuses with exit 3 or 4 when none is declared (Amendment 3).
- **day:start no longer runs `engram sync --export`.** That step copied the backend into
  `.memory/`, the opposite of record-first (contract rule 2).

### Why

#1115 and #1189: on a `plainfiles` consumer every one of those callers printed
`backend 'plainfiles' does not implement op 'import'`, and the agent received no memory context.
The selector decided which backend runs, but the callers still decided which op to ask for.

### What this does NOT change

The selector, the resolver, the lock, the backend directory, the canonical `.memory/` directory,
and `pull` (which keeps its name: it is `git pull` followed by the same projection).

### What the code does not do yet, said plainly

- **day:start step 4b** (`brain-to-engram.mjs`) still probes `engram --version` and projects
  doctrine into engram by name, instead of calling the `index` verb. A follow-up owns it.
- **The alias is not removed** until the next release.

### Notes for the promoter

Two in-place annotations: the Dispatcher line's `hydrate` and Amendment 3's list of ops that
refuse. Amendment 4 is the latest today, so this is number 5. Sources: #1115, #1189.
