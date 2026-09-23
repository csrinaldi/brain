# Amendment draft — `agent-authorities.md`, Tier 2 and Tier 3 lists

**For**: `npm run brain:promote -- openspec/changes/issue-671-ai-attribution-rationale/brain-drafts/agent-authorities.draft.md`

> Drafted by agent, applied by the maintainer. `brain/core/**` is Tier 3 —
> prohibited **even if explicitly asked** — and `brain:promote` is the sanctioned
> path: it renders this draft, shows the plan, requires the typed word, then
> **stages and stops**. Running the printed `git commit` is the human signature.
>
> Requested by the maintainer on 2026-08-15. The request does not move the
> boundary, which is why this is a draft the verb consumes rather than an edit.

## Why

`brain/scripts/harness/backends/` ships **`antigravity.mjs`, `claude.mjs`,
`gentle-ai.mjs`, `plain.mjs`** — the harness layer is multi-platform, and this
session reports `harness: antigravity`. The Tier-3 bullet names one vendor.

`agent-authorities.md` is compiled **verbatim** into every consumer's
`AGENTS.md` (`SOURCE_DOCS`, *"Tier table VERBATIM"*), so a consumer on
Antigravity, gentle-ai or anything not yet invented reads a prohibition naming a
tool they do not use. The enforcement is already agnostic — the hooks read
`git config brain.aiAgents` (#671) — so the wording is the only vendor-specific
part left.

Two further defects measured in the same two lists, both shipping verbatim:

- **Wrong ecosystem.** `@logikas/brain` is an npm package; `JAR` is a Java
  artefact.
- **A dead command.** `backend:deploy` appears **zero times** in `package.json`
  — a citation that reads as verified and resolves to nothing, the same shape as
  the `CLAUDE.md` reference #671 repaired.

Each anchor below was verified to occur **exactly once** in the target.

```brain-amendment/1
target: brain/core/methodology/agent-authorities.md
issue: 671
```

## Act 1 — Tier 3: the attribution bullet stops naming one vendor

```amend-find
- Add AI attribution in commits (`Co-Authored-By: Claude...`)
```

```amend-replace
- Add AI attribution to commits — an agent co-author trailer, a session URL or a
  "generated with" footer, whatever the tool is called. Provenance is not
  authorship: it is evidence when a runner attests to it, and a claim when the
  producer asserts it about itself (ADR-0031). Enforced by `hooks/commit-msg`
  and `hooks/pre-receive`; the agent vocabulary is `git config brain.aiAgents`,
  so a consumer governs their own tooling without waiting for a brain release
```

## Act 2 — Tier 3: the registry bullet stops naming one ecosystem

```amend-find
- Publish JARs to the Package Registry without explicit human instruction
```

```amend-replace
- Publish release artefacts to the package registry without explicit human
  instruction — whatever the ecosystem's artefact is
```

## Act 3 — Tier 2: drop the command that does not exist

The publish path here is the `publish.yml` workflow, not a local script. The
replacement names **no** command: naming the workflow would age the same way
`backend:deploy` did, and doctrine has no `cites-resolve` guard to catch it.

```amend-find
- **Deploy to the Package Registry** (`npm run backend:deploy`) — affects artifacts
  shared by all consumers
```

```amend-replace
- **Publish to the package registry** — affects artefacts shared by all consumers
```

## Not proposed

The rest of the Tier-3 list. Those entries are accurate and ecosystem-neutral,
and widening this beyond the three defects measured above would be editing
signed doctrine on an agent's taste rather than on evidence.

## After promoting

`brain:promote` runs §1d's cascade itself, including the **`AGENTS.md`
regeneration** — the step a hand-rolled promoter lost on the human's side once
before, which is why this verb exists.
