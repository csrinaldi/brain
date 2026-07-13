# Design — The Antigravity Harness Adapter + The Baptism (Track B / B2)

> **Status:** design · **Issue:** #256 · **Branch:** `feat/issue-256-b2`
> **Reads:** [proposal.md](proposal.md) · [[sdd/issue-256-b2/measurements]] (#604) · [[sdd/issue-256-b2/constraints]] (#601).
> **Signature (LOAD-BEARING, host-scoped):** Antigravity CLI 1.1.1 · Gemini 3.5 Flash (Medium) · 2026-07-12 · host `gandalf`. **CAVEAT:** the port-proof — engram MCP auto-discovery, the `settings.json` shape, `AGENTS.md`/`GEMINI.md` load order — is MEASURED on THIS pre-configured host, NOT factory Antigravity.
> **Honors:** TDD (RED→GREEN over seams); Pin 1 (generate-never-author); STOP-finding rule (no gate weakened for Antigravity); ADR-0009 (English).

## Technical Approach

B2 Half 1 adds ONE backend file, `brain/scripts/harness/backends/antigravity.mjs`, exporting async `init(opts)`, mirroring `plain.mjs`/`gentle-ai.mjs`. It is a **compiler**: `init()` reads brain's canonical source docs and EMITS a self-contained `AGENTS.md` at repo root — the file Exp 1 measured Antigravity reads. Zero `cli.mjs` change (the dispatcher is already backend-agnostic; `plain.mjs` is the n=2 precedent). A pure `compileAgentsMd()` function does the assembly so the unit test and the staleness drift-guard exercise it without touching the real repo. Half 2 (the #247 baptism) is human-operated, downstream, and NOT in this PR.

## Architecture Decisions

### Decision: `init()` shape — pure compiler behind injectable seams

**Choice:** `init()` reads 5 canonical docs via a `_readDoc` seam, calls the pure `compileAgentsMd()`, writes via a `_writeAgents` seam. Never throws (read/write wrapped in guards that `console.warn` and return, matching `gentle-ai.mjs` Step-1..4 idiom).

```js
// brain/scripts/harness/backends/antigravity.mjs
export const SOURCE_DOCS = [
  'brain/HOME.md',
  'brain/core/methodology/agent-authorities.md',   // Tier table VERBATIM (Exp 4)
  'brain/core/methodology/harness-contract.md',     // verb table
  'brain/core/methodology/sdd-layout.md',           // layout summary
  'brain/core/methodology/workflow-governance.md',  // gate list + skip labels (Fork B)
];
export const AGENTS_EMIT_PATH = 'AGENTS.md';        // repo root — MEASURED target (Exp 1)

// Pure, fs-free — the seam the test + drift-guard both call.
export function compileAgentsMd(docs /* { [relPath]: string } */) { /* → string */ }

export async function init({
  _readDoc   = _defaultReadDoc,    // (relPath) => string   (readFileSync from repoRoot)
  _writeAgents = _defaultWriteAgents, // (relPath, content) => void (writeFileSync)
  _repoRoot  = repoRoot,
} = {}) { /* read 5 docs → compileAgentsMd → write AGENTS.md; never throws */ }
```

**Alternatives considered:** one monolithic `init()` with inline fs (no pure function) — rejected: the drift-guard needs a fs-free compile to compare committed bytes against a fresh regeneration.
**Rationale:** matches the repo's established seam convention (`_`-prefixed opts + `_default*`), keeps compilation deterministic and independently testable.

### Decision: Fork 5 — COMPILE, not `@path` import

**Choice:** `AGENTS.md` is a **self-contained compiled** artifact. Do NOT emit a thin file of `@path` (memport) imports.
**Alternatives considered:** memport `@path` imports (zero-drift via native mechanism).
**Rationale:** `AGENTS.md` is the multi-harness STANDARD file. memport `@path` is Gemini-native; Codex (the free secondary smoke) does NOT process it → would read a literal `@path` string, seeing no rules. A compiled file serves EVERY standard reader (Gemini, Codex, Claude-as-observer). Drift is closed by the drift-guard test (below), not by the import mechanism. **Exp 5** (does `@path` resolve in Antigravity, ~2 min) is a cheap PENDING human experiment — recorded, NOT blocking: it only mattered if import were chosen, and its result may still inform the future Gemini-specific `GEMINI.md` layer.

### Decision: Staleness drift-guard — regenerate-and-diff (F2 tripwire-as-test)

**Choice:** a `**/*.test.mjs` reads the 5 REAL `SOURCE_DOCS`, calls `compileAgentsMd()`, and asserts the result **byte-equals** the committed `AGENTS.md`. Fails on any hand-edit of `AGENTS.md` OR any source change without regeneration.
**Alternatives considered:** a source-hash embedded in the provenance banner.
**Rationale:** the repo ALREADY uses regenerate-and-compare drift-guards (`governance-checks.test.mjs`, `sdd-layout.test.mjs`) — same house pattern, readable diff on failure, no hashing step. The provenance banner still NAMES its sources for human legibility; the test is the enforcement. Test file is excluded from the diff-size budget (`**/*.test.mjs` in ignore-list).

### Decision: Composition — emitter emits the REPO layer only

**Choice:** the emitted `AGENTS.md` is documented as the repo-scoped layer that COMPOSES with Antigravity's host globals (`~/.gemini/GEMINI.md` rules+persona, engram MCP, chrome-devtools plugin) and any repo-local `GEMINI.md`. The emitter controls NONE of these.
**Rationale:** Exp 4 proved Antigravity cited "our global rules" (host `~/.gemini/GEMINI.md`) alongside the repo `AGENTS.md`. Assuming `AGENTS.md` governs alone is false. Composition is a **runbook awareness check performed once** (Half 2), not emitter logic.

### Decision: Fork B — governance gate-list SOURCE confirmed

**Choice:** the gate list compiles from **`brain/core/methodology/workflow-governance.md`** (the "Four Invariants and Their Gates" table: invariant → CI job `name:` → skip label → character), cross-referenced to the canonical job names in `GOVERNANCE_JOBS` (`brain/scripts/vcs/governance-checks.mjs`).
**Rationale:** confirmed by reading both. `workflow-governance.md` is the prose gate table WITH skip labels (`size:exception`, `skip:memory-gate`, label-conditional); `governance-checks.mjs` is the machine job-name registry. The emitter compiles the prose table; the doc is on the frozen `SOURCE_DOCS` list.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `brain/scripts/harness/backends/antigravity.mjs` | Create | `init()` + pure `compileAgentsMd()` + `SOURCE_DOCS`/`AGENTS_EMIT_PATH`. Seam-injected; never throws. |
| `AGENTS.md` (repo root) | Create (GENERATED) | Compiled output. Provenance banner + verbatim tier table + verb table + layout summary + gate list. **Do-not-edit; regenerated by `init()`.** |
| `brain/scripts/harness/backends/antigravity.test.mjs` | Create | RED-first: injects fake docs, asserts compiled content (verbatim tier table + provenance + named sources) + real `dispatch('antigravity','init')`. |
| `brain/scripts/harness/backends/antigravity.drift.test.mjs` | Create | Regenerate-and-diff staleness guard vs committed `AGENTS.md`. |
| `brain/core/managed-paths.mjs` | Modify | Add `'AGENTS.md'` literal to `managed`. |

### managed-paths.mjs — the exact literals

Add to `managed[]`:

```js
'AGENTS.md',   // generated Antigravity/AGENTS-standard context (issue #256 B2). LITERAL —
               // repo root, outside every existing glob. Regenerated by antigravity.mjs#init;
               // brain:upgrade ships it because its sources (brain/core/**) are managed.
```

`brain/scripts/harness/backends/antigravity.mjs` needs **NO new literal** — it is ALREADY managed by the existing `brain/scripts/**` glob. Adding a redundant literal is avoided (PLAN §1 rule 6 targets the EMITTED artifact — `AGENTS.md` — which is the only path outside the globs). Flagged for tasks: confirm no `managed-paths.test.mjs` assertion requires the backend be listed explicitly.

## Provenance banner (emitted at top of `AGENTS.md`)

```
<!-- GENERATED — do not edit. Regenerate: SDD_HARNESS=antigravity npm run brain:env:init
     Compiled from: brain/HOME.md, brain/core/methodology/agent-authorities.md,
     harness-contract.md, sdd-layout.md, workflow-governance.md.
     Drift-guarded by antigravity.drift.test.mjs — hand-edits fail CI. -->
```

## Interfaces / Contracts

- `init(opts?) → Promise<void>` — dispatchable via `SDD_HARNESS=antigravity`, never throws.
- `compileAgentsMd(docs) → string` — pure; `docs` keyed by relative source path.
- `SOURCE_DOCS: string[]`, `AGENTS_EMIT_PATH: string` — exported for the drift-guard.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `compileAgentsMd()` includes verbatim tier table + provenance + named sources | Inject fake docs; assert substrings/order (RED first) |
| Unit | `init()` writes to `AGENTS_EMIT_PATH`, never throws on read/write failure | Inject failing `_readDoc`/`_writeAgents`; assert no throw + warn |
| Integration | real `dispatch('antigravity','init',[])` resolves through unmodified `cli.mjs` | mirror `plain.test.mjs` 3.3/3.4 (n=3) |
| Drift | committed `AGENTS.md` == regenerate from real sources | regenerate-and-diff, fail-closed |

## Fork A — baptism-runbook permissions (Half 2, TO-VERIFY against real Antigravity)

Pre-declare the circuit set via Antigravity `settings.json` (Exp 2: 4-option dialog offers "always-allow, persist to settings.json"). **The exact shape is verified against REAL Antigravity at runbook time — Gemini-CLI inheritance is PARTIAL (constraints #601), so this is the PROPOSED shape, flagged for live confirmation:**

```jsonc
// ~/.gemini/settings.json (or project .antigravity/ — CONFIRM location live)
{ "tools": { "allowed": ["run_shell_command(npm test)",
                          "run_shell_command(git commit)",
                          "run_shell_command(git push)",
                          "run_shell_command(gh pr create)"] } }
```

**Rollback (documented in the runbook):** record the pre-existing `settings.json` (or its absence); after #247 merges, remove exactly the 4 added allow-entries (or restore the saved copy / delete the file if it did not exist). Nothing else touched.

**Runbook hygiene rules (measured hazards):** (1) verify every slash-command with `/help` before use — namespace is shared with plugins and matching is LAX (`/memory show` mis-resolved to a chrome-devtools plugin, contaminated a session). (2) There is **no `/memory show|reload`** in CLI 1.1.1 — the ONLY context-inspection instrument is the **sentinel-prompt in a fresh session**. (3) Composition check performed ONCE: confirm host `~/.gemini/GEMINI.md` + engram MCP compose with the repo `AGENTS.md` (Exp 4).

## Budget + Split Forecast (honest)

Ignore-list (`brain.config.json.governance.ignoreList`) excludes `**/*.test.mjs` — tests are budget-FREE. It does **NOT** exclude `AGENTS.md` → **the generated `AGENTS.md` COUNTS** (the forecast-underestimate lesson, made concrete).

| Item (Half 1, counted) | Est. lines |
|---|---|
| `antigravity.mjs` (adapter + compiler) | ~140–190 |
| `AGENTS.md` (GENERATED, verbatim tier table + tables + gate list) | ~130–180 |
| `managed-paths.mjs` | ~1 |
| Tests (2 files) | 0 (ignore-list) |
| **Total counted** | **~270–370** |

- **400-line budget risk: Medium-High.** The generated `AGENTS.md` is the swing factor; a fat verbatim compile can tip Half 1 over 400.
- **Decision needed before apply: Yes** (owner: budget disposition).
- **Chained PRs recommended: No** — the emitter and its output `AGENTS.md` + drift-guard are one coherent unit (the drift-guard REQUIRES both present); splitting them is incoherent. If it exceeds 400, the honest move is a labeled **`size:exception` ("bulk is a generated, drift-guarded artifact compiled from reviewed sources")**, NOT an artificial split and NOT weakening a gate.
- Half 2 (the baptism) is human-operated, downstream, **not in this PR**.

## Migration / Rollout

No data migration. `init()` is idempotent (regenerates `AGENTS.md` from sources). Adding the backend is additive; no `VALID_OPS` change.

## Open Questions

- [ ] **Owner (STOP-finding guard):** if Half 1 exceeds 400, may `AGENTS.md` join the `**/*.golden.json` generated-file ignore-list CLASS? Defensible as general policy — but it MUST NOT be motivated by B2's own budget (self-serving gate-weakening). Surface to owner; do not self-resolve.
- [ ] **tasks.md:** confirm `managed-paths.test.mjs` has no assertion requiring backend files be listed explicitly (vs glob-covered).
- [ ] **Half 2:** confirm live the `settings.json` location + key shape against real Antigravity (partial Gemini-CLI inheritance).
- [ ] Exp 5 (`@path` memport in Antigravity) — cheap, pending, non-blocking; informs future `GEMINI.md` layer only.
