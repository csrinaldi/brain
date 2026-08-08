---
status: draft
issue: 499
---

# Spec — tier boundary written three ways (issue 499)

## Requisitos delta

### REQ-499-1 — a cited `brain/…` path that does not exist FAILS the gate

`check-brain-nav.mjs` extracts every backticked `brain/…` path from every `brain/**/*.md`,
resolves it against the filesystem, and **exits non-zero** when any does not resolve. It
names each one with its containing file.

Failing, not reporting. The red-proof found the first version counting the findings, printing
them, and exiting 0 — which in CI is indistinguishable from finding nothing.

Directories count, not only `.md` files: the four dead Tier-3 paths are all directories, and a
check that resolved only files would have reported 4 of 22 and looked done.

### REQ-499-2 — a glob is not a destination

`` `brain/**` `` and `` `brain/core/**` `` describe sets. They must never be demanded to exist,
or every zone-map row fails the gate.

Measured: the regex requires a closing backtick and `*` is outside its character class, so a
glob produces **no match at all** — it does not degrade to `brain/`. The explicit
`.filter(p => !p.includes('*'))` is therefore dead code today. It stays as belt-and-braces and
is **labelled as dead in the source**, because an unlabelled inert guard is a protection that
reads as real — the defect class this ticket is about.

### REQ-499-3 — the script stays runnable standalone

`check-brain-nav.mjs` is copied on its own into test fixtures and into the adoption
scaffolding. It must not acquire relative imports.

Measured: moving the extractor to `lib/cited-paths.mjs` turned 5 existing tests red with
`ERR_MODULE_NOT_FOUND`. Stated as a requirement so the next refactor does not rediscover it.

### REQ-499-4 — the doctrine corrections are DRAFTED, not applied

`brain/core/**` is Tier 2. The agent drafts; a human signs. The draft separates the 22 into
what is mechanical and what is not, because only one bucket can be applied without a ruling:

- **mechanical renames** — `brain/decisions/` → `brain/project/decisions/`, and four more;
- **ambiguous** — `brain/anti-patterns/` resolves to **two** real directories. Every occurrence
  is inside a prohibition, so the intent is almost certainly both; picking one would narrow a
  prohibition silently;
- **dangling** — four references whose target exists nowhere. Each needs a call: drop the
  reference, or write the doc. An agent guessing here invents doctrine.

## Escenarios

### E1 — a dead citation fails the gate (REQ-499-1)

```
GIVEN  a brain/ doc citing `brain/decisions/`, which does not exist
WHEN   check-brain-nav.mjs runs
THEN   it exits 1, says "ruta(s) CITADA(S)", and names the citation
```

### E2 — a resolving citation keeps the gate green (REQ-499-1)

```
GIVEN  every cited brain/ path resolves
WHEN   check-brain-nav.mjs runs
THEN   it exits 0
```

### E3 — a cited DIRECTORY counts (REQ-499-1)

```
GIVEN  a doc citing `brain/project/architecture/`, absent
WHEN   the gate runs
THEN   it exits 1
AND    once that directory exists, it exits 0
```

### E4 — a glob is not demanded to exist (REQ-499-2)

```
GIVEN  a doc citing `brain/**` and `brain/core/**`
WHEN   the gate runs
THEN   it exits 0
```

### E5 — the gate FAILS against the real `brain/core/**` until the prose is fixed (REQ-499-4)

```
GIVEN  the repository as it stands
WHEN   npm run brain:nav runs
THEN   it exits 1 with 22 cited paths
```

**This is the finding, not a defect in the guard.** It is also why two `nav-integrity` tests
are red on this branch: they copy the real `brain/core/**` into a fixture and expect exit 0.
All three go green when REQ-499-4's draft is applied.
