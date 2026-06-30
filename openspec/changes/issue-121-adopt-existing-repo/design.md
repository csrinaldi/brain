# Design: Adopt brain into an existing repo — S1 inventory + classify (read-only)

## Technical Approach

A thin CLI (`brain/scripts/adopt.mjs`, verb `brain:adopt`) walks the consumer tree, and for each file delegates to PURE library functions under `brain/scripts/lib/adopt/`. I/O lives only at the CLI edge (read bytes, write two output files). The two design-critical algorithms — logical-name resolution and divergence classification — are pure, deterministic, and unit-tested with `node --test`. Mirrors the `installer.mjs` + `brain-upgrade.mjs` split: pure mechanics in lib, side-effects in the wrapper. Reuses `managed-paths.mjs` (manifest) and `installer.mjs` helpers (`globToRegExp`, `matchesAny`, `listFiles`); modifies neither.

## Architecture Decisions

### Decision: Compare by logical name, not path
**Choice**: Normalize each consumer path to its upstream-equivalent *logical name*, then test that against `managed[]`/`local[]`.
**Alternatives**: Direct path match against globs (rejected — a flat `brain/methodology/x.md` never matches `brain/core/**`, so every flat doc would be misread as project-owned — the #1 risk).
**Rationale**: The flat→core divergence is the whole problem. `brain/methodology/x.md` and upstream `brain/core/methodology/x.md` are the SAME logical artifact; only logical-name comparison catches it.

### Decision: Conservative, deterministic language classifier with `flag-for-review` default
**Choice**: A marker-ratio heuristic (Spanish diacritics/inverted punctuation + stopword tokens vs English stopwords). Strong Spanish dominance → `translation`; clear English with differing bytes → `drift`; anything ambiguous → `flag-for-review`.
**Alternatives**: A language-detection dependency (rejected — adds a dep, non-deterministic across versions); trust byte-diff alone (rejected — can't tell translation from drift, violates ADR-0009).
**Rationale**: ADR-0009 says core is always EN, so a Spanish copy is a translation by policy. Heuristic is cheap, explainable, testable, and NEVER silently labels translation — uncertainty flags for human review.

### Decision: Read-only enforced structurally
**Choice**: Lib modules import only `node:path` + installer pure helpers (zero `node:fs`/`node:child_process`). The CLI's only writes are `<out>/plan.json` + `<out>/report.md` (default `.brain-adopt/`, never inside `brain/`, `scripts/`, `.git`, `.github`, or config).
**Alternatives**: Trust a `--dry-run` flag (rejected — read-only is a contract, not a flag).
**Rationale**: A guard test asserts the lib has no fs/child_process imports; the CLI never calls git/spawn/hooks. Read-only is provable, not promised.

## Data Flow

    adopt.mjs (CLI, I/O edge)
      listFiles(root) ──► [consumer paths]
           │
           ▼ per file
      resolveLogicalName(path, manifest) ──► { logicalName, classification, matchedGlob }
           │ generic + bytes differ
           ▼
      readUpstream(node_modules/brain/<logicalName>)  classifyDivergence(consumerText, upstreamText)
           │                                                   │
           └───────────────► buildPlan(...) ◄──────────────────┘
                                  │
                       ┌──────────┴──────────┐
                       ▼                     ▼
                  plan.json           renderReport(plan) ─► report.md

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `brain/scripts/lib/adopt/resolve-logical-name.mjs` | Create | Pure logical-name resolver + classification. |
| `brain/scripts/lib/adopt/classify-divergence.mjs` | Create | Pure language/divergence heuristic. |
| `brain/scripts/lib/adopt/build-plan.mjs` | Create | Pure plan assembler (readers injected). |
| `brain/scripts/lib/adopt/render-report.mjs` | Create | Pure MD report renderer. |
| `brain/scripts/adopt.mjs` | Create | Thin CLI: walk, read, write plan+report. |
| `brain/scripts/lib/adopt/*.test.mjs` | Create | `node --test` units + catastro fixture. |
| `package.json` | Modify | Register `brain:adopt` verb. |
| `brain/core/managed-paths.mjs`, `installer.mjs` | Reuse | Imported read-only; untouched in S1. |

## Interfaces / Contracts

### Logical-name resolution (load-bearing)
```js
// resolveLogicalName(filePath, { managed, local }) -> { logicalName, classification, matchedGlob }
// Normalize to POSIX, then map consumer path → upstream logical name:
//   brain/scripts/**                  → as-is            (already canonical)
//   scripts/**           (root)       → brain/scripts/** (flat scripts → managed)
//   brain/core/**                     → as-is            (already core-split)
//   brain/project/**                  → as-is            (local; stays project-owned)
//   brain/<seg>/** (seg ∉ core|project|scripts) → brain/core/<seg>/**  (flat doc → core)
//   anything else (.gitattributes, .github/**, root docs) → as-is
// classification = matchesAny(logicalName, managed) && !matchesAny(logicalName, local)
//   ? 'generic' : 'project-owned'
```
Upstream reference bytes resolve from `resolveUpstreamRoot(repoRoot)`: prefer `node_modules/brain/`, fall back to `repoRoot` itself when its `package.json.name === 'brain'` (self-host). Bytes = `join(upstreamRoot, logicalName)`. Absent file → `divergence: 'upstream-missing'`, flagged.

### Divergence classifier
```js
// classifyDivergence(consumerText, upstreamText) -> { divergence, languageSignal, reason }
// 1. identical bytes                              -> 'identical'
// 2. languageSignal(consumerText): count es markers (ñ ¿ ¡ áéíóúü + es stopwords)
//    vs en stopwords -> { es, en, verdict }
// 3. es dominant (es>=MIN_HITS && es>en)           -> 'translation'
//    clear en (en>0 && es~0) && bytes differ       -> 'drift'
//    ambiguous / short / mixed                      -> 'flag-for-review'  (conservative default)
```

### JSON plan (canonical schema for the spec)
```json
{ "schemaVersion": "1", "tool": "brain:adopt", "generatedAt": "<ISO>",
  "target": { "shape": "flat-brain|no-brain", "root": "." },
  "manifestSource": "node_modules/brain|self-host",
  "summary": { "total":0,"generic":0,"projectOwned":0,"identical":0,
               "translation":0,"drift":0,"flagForReview":0,"upstreamMissing":0 },
  "files": [ { "path":"brain/methodology/x.md",
               "logicalName":"brain/core/methodology/x.md",
               "classification":"generic","matchedGlob":"brain/core/**",
               "divergence":"translation","languageSignal":{"es":12,"en":1,"verdict":"es"},
               "proposedAction":"adopt-upstream","reason":"..." } ] }
```
`proposedAction`: generic→`adopt-upstream` (divergent generics also listed under report "Replacements"); project-owned flat-brain→`keep-as-project`; project-owned no-brain→`place-under-brain-project`. Target shape = `flat-brain` if any generic match, else `no-brain`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `resolveLogicalName` | flat doc→core; root `scripts/`→`brain/scripts/`; `brain/project/**` stays project; no-brain root docs project-owned |
| Unit | `classifyDivergence` | identical / Spanish→translation / EN-diff→drift / ambiguous→flag-for-review |
| Unit | `renderReport` | sections present; replacements listed |
| Integration | `buildPlan` | injected readers over `__fixtures__/catastro-flat/` (Spanish translation + project doc + root script) → asserts plan summary/actions |
| Guard | read-only | assert lib modules import no `node:fs`/`node:child_process` |

## Migration / Rollout

No migration. Read-only; rollback = delete `.brain-adopt/`, the new script/lib, and the `package.json` verb.

## Open Questions

- [ ] `MIN_HITS` threshold + final stopword lists (tune against the catastro fixture; spec to pin exact numbers).
- [ ] Default out-dir name (`.brain-adopt/`) and whether to also emit to stdout when `--out` omitted.
