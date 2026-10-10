# memory-backend-contract.md Amendment 3: bulk `hydrate` exists on both backends, and `import` is its deprecated alias (issue #1115)

> **Tier 2 target. Not promoted, and an agent may not promote it.** `memory-backend-contract.md`
> is a signed `brain/core/**` artefact (`brain/core/anti-patterns/ia-escribe-brain-sin-gate.md`).
>
> ```
> npm run brain:promote -- openspec/changes/issue-1115-memory-lifecycle-verb/brain-drafts/memory-backend-contract-amendment-3.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028). Promote it after the #1115 PR merges, so that the
> doctrine never describes code that `main` does not have.

```brain-amendment/1
target: brain/core/methodology/memory-backend-contract.md
issue: 1115
body: ## Amendment 3 — bulk `hydrate` exists on both backends, and `import` is its deprecated alias (issue #1115)
body-end: ### Notes for the promoter
```

```amend-find
the bulk form is still spelled `pull` (with `git pull`) and `cli.mjs import` (without) — the contract names the operation, those verbs keep their names until #862 settles the lane.
```

```amend-replace
the bulk form, `hydrate({root})`, exists on both backends as of #1115 and is dispatched as `cli.mjs hydrate` (engram: `importMemory` under the #820 guard, deferring when the binary is absent; plainfiles: `rebuildIndex`); `brain:memory:pull` is `git pull` followed by the same projection. **[Amended by Amendment 3 (#1115): this sentence said the bulk form "is still spelled `pull` (with `git pull`) and `cli.mjs import` (without)". `cli.mjs import` is now a deprecated alias of `cli.mjs hydrate` for one release.]**
```

```amend-find
   `brain:memory:pull` and `cli.mjs import` complete, and hydrate the active backend from
```

```amend-replace
   `brain:memory:pull` and `cli.mjs hydrate` (**[Amended by Amendment 3 (#1115): was `cli.mjs import`, now its deprecated alias]**) complete, and hydrate the active backend from
```

## Amendment 3 — bulk `hydrate` exists on both backends, and `import` is its deprecated alias (issue #1115)

**Signed**: DD/MM/YYYY — <Name>

### What changed

- **The bulk form of the required `hydrate` verb is implemented.** With no `recordId`,
  `engram.hydrate({root})` runs `importMemory` under the #820 hydration guard. It returns
  `{written, skipped, deferred?, contended?}` and defers, never throws, when the binary is absent,
  the guard is contended, engram's state is unreadable, or the import fails.
  `plainfiles.hydrate({root})` is `rebuildIndex`, which matches the Conformance row that already
  said so. Both are in `brain/scripts/axes/memory/adapters/`.
- **A read-only form, `hydrate({root, verify: true})`.** An adapter given `verify: true` MUST NOT
  write the tracked tree. `plainfiles` then does not rebuild `.memory/index.jsonl`: it compares it
  with what the rebuild would write and returns `verified: true` and `stale`. `engram` ignores the
  flag: its import projects into the engram store, which is not a write to the tracked tree.
  `session:start` is the caller that passes it, because it is read-only (`harness-contract.md`).
  Callers that already write (`post-merge`, `brain:memory:pull`, `day:start`) call the default form.
- **One op name for every caller.** `cli.mjs hydrate` is the op `session:start`, `day:start` and
  the `post-merge` hook call. None of them names a backend op any more. `cli.mjs import` remains
  for one release as an alias. It prints a deprecation notice naming `hydrate` and then
  dispatches `hydrate`. It is not in `FALLBACK_OPS`, which stays `["pull"]`.
- **`verified` and `stale` are the only fields beyond the shared accounting**, and only the
  `verify` form returns them.
- **A deferred bulk hydration has its own exit status, 6** (`EXIT_DEFERRED`,
  `brain/scripts/memory/lib/backend-resolve.mjs`), so a caller can never read a deferral as
  "done". That is this contract's failure discipline, applied at the process boundary. The
  callers that load context (`post-merge`, `session:start`) treat 6 as non-fatal.

### Why

#1115 and #1189: on `plainfiles`, `session:start`, `day:start` and every `git pull` called
`cli.mjs import`, an op that only engram implemented. The output named the wrong backend
(`backend 'plainfiles' does not implement op 'import'`), and no memory context reached the agent.
The contract already required `hydrate`. Only its spelling was engram's.

### What this does NOT change

The three rules, the other required verbs (`setup`, `share`, `save`), the single-record form of
`hydrate` (which still throws on an unknown `recordId`), and the Conformance table.
`hydrate` does not return a context payload. That would widen this contract and is a follow-up.

### What the code does not do yet, said plainly

- **The alias is not removed.** It goes in the release after the one that ships `hydrate`.
- **On `plainfiles`, `session:start` reports a stale index and does not repair it.** The repair
  is the rebuild in `post-merge` or `brain:memory:share`. A consumer that never pulls through the
  hook keeps seeing the stale line until it runs one.

### Notes for the promoter

Two in-place annotations: the `hydrate` row of *Required verbs* and rule 3's list of operations.
Amendments 1 and 2 exist, so this is Amendment 3. Source: #1115 (folds #1189), PR closing both.
