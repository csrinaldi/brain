# Design: `brain:` namespace rename (issue #137)

## Technical Approach

Four pillars, five slices. First remove every runtime dependence on a
package.json verb NAME (S1), then add the namespaced verbs as additive aliases
(S2), repoint references (S3/S4), and finally teach `brain:upgrade` to inject
the new aliases into consumer package.json via a never-overwrite specialMerge
(S5). The merge reuses the exact precedent of `mergeClaudeSettings`: a managed
JSON file that is *merged additively*, never copied over the consumer's copy.

## Architecture Decisions

### Decision: De-risk call sites to direct `node` invocation
**Choice**: Replace the 2 programmatic `npm run repo:check` calls with
`node brain/scripts/check-refs.mjs`, the existing house pattern
(`brain-next.mjs:143`, `day-start.mjs:326`, git hooks).
- `brain-check.mjs:131`: `repoCheckFn: () => spawnCommand('node', ['brain/scripts/check-refs.mjs'], cwd)`. `spawnCommand` returns `{ ok, output }`; exit semantics identical (`status===0`). `cwd` unchanged (repo root), relative path resolves against it exactly as the `npm test` sibling does.
- `verify-change.mjs:28`: `commands: () => [['node', 'brain/scripts/check-refs.mjs']]`, replacing `pm.runArgs('repo:check', true)`. Same array-of-argv shape the MATRIX runner consumes; `pm`/`detectPM` no longer needed for this row.
**Alternatives**: keep `npm run` + rename in lockstep — rejected: any missed site breaks all consumers on upgrade.
**Rationale**: after S1, NO managed script references a verb by name, so the rename cannot break runtime. This is the safety foundation.

### Decision: Additive dual-alias, SILENT documented deprecation (no warning)
**Choice**: brain's package.json carries both the old verb and the new
`brain:*` verb, **both pointing at the identical direct `node` target**. Old
keys are deprecated via CHANGELOG + `harness-contract.md` verb table only — no
runtime warning.
**Alternatives considered**:
| Option | Tradeoff | Verdict |
|--------|----------|---------|
| Shell forwarder `echo … && npm run brain:…` | Reintroduces the package.json-name indirection S1 removed; the echo copy is an untranslated user-facing string outside the i18n catalog | Reject |
| One-time warn from underlying script via `npm_lifecycle_event` | Re-couples scripts to verb names (soft, warning-only) + adds friction for consumers who cannot migrate yet | Reject |
| Silent documented deprecation, identical targets | Zero indirection, no name dependency, no i18n leak, merge stays trivial | **Choose** |
**Rationale**: specialMerge only ever INJECTS the new `brain:*` keys; a
consumer's pre-existing old keys are left untouched. The dual-alias state is
reached additively, so a per-invocation warning would only nag consumers about
keys brain itself injected. Removal is deferred to a future MAJOR.

### Decision: package.json specialMerge — pure core + IO wrapper
**Choice**: split into a pure function and a thin IO adapter, mirroring how
`mergeClaudeSettings` isolates JSON logic from `copyManaged`.

```
// MANAGED_SCRIPT_KEYS — single source of truth (managed-paths.mjs)
export const MANAGED_SCRIPT_KEYS = [
  'brain:env:init','brain:day:start','brain:ticket:start','brain:project:feature',
  'brain:project:status','brain:tracker:board','brain:repo:check','brain:change:verify',
];

// PURE — installer.mjs. Returns serialized package.json text (2-space, trailing \n).
mergePackageJsonScripts(consumerPkgRaw, managedScripts) → string
```
- `consumerPkgRaw`: text or parsed object. Text → `JSON.parse` with a
  file-identifying error (same pattern as `mergeClaudeSettings`).
- `managedScripts`: `{ key: target }` map of the managed `brain:*` entries.
- **Key-injection rules**: `out = { ...consumer }`; `out.scripts = { ...consumer.scripts }` (create if absent). For each `[k,v]` in `managedScripts`: if `k` NOT in `out.scripts` → add `out.scripts[k] = v`; if present → leave consumer value (consumer wins). Never delete, never reorder existing keys; additions appended in `MANAGED_SCRIPT_KEYS` order → deterministic.
- **Non-scripts fields** preserved verbatim by the spread.
- **Serialization**: `JSON.stringify(out, null, 2) + '\n'` — matches every other JSON writer in the repo (`mergeClaudeSettings`, `migrateConfig`). Documented churn: a consumer using non-2-space indentation gets reformatted, identical tradeoff to `mergeClaudeSettings`.

**Source of truth**: `MANAGED_SCRIPT_KEYS` lives in `managed-paths.mjs` (the
distribution manifest). The merge VALUES are read from brain's own
package.json `scripts` at merge time — keys in one place, targets in one place,
never hardcoded twice.

**IO wrapper** `mergePackageJson(destPath, srcPath)` (specialMerge signature):
read brain's package.json (`srcPath`), filter `scripts` to
`MANAGED_SCRIPT_KEYS` → `managedScripts`; read consumer (`destPath`, may be
absent → start from brain's package.json scripts subset); call the pure fn;
**write only if the result differs from the current file bytes** (idempotent
no-op write — avoids needless mtime churn on re-upgrade).

### Decision: Wire package.json into copyManaged
**Choice**: add `'package.json'` to `managed[]` in `managed-paths.mjs` and
`specialMerge: { '.claude/settings.json': mergeClaudeSettings, 'package.json': mergePackageJson }`
in `brain-upgrade.mjs:98`. `copyManaged` already excludes specialMerge paths
from the collision guard and skips the merge fn under `--dry-run` (path still
reported under `merged`). The self-host guard (`name === 'brain'` refuses
without `--force`) is untouched and still fires before any copy.
**Rationale**: zero new control flow — package.json rides the proven
specialMerge rail.

## Data Flow

    brain:upgrade ──→ copyManaged ──┬─ plain copy (brain/core, scripts, …)
                                    ├─ specialMerge['.claude/settings.json'] → mergeClaudeSettings
                                    └─ specialMerge['package.json']          → mergePackageJson
                                                                                   │
                            brain pkg scripts ∩ MANAGED_SCRIPT_KEYS ── managedScripts
                                                                                   ↓
                            consumer package.json ──→ mergePackageJsonScripts (pure) ──→ write-if-changed

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `brain/scripts/brain-check.mjs` | Modify | line 131 → direct `node` invocation (S1) |
| `brain/scripts/verify-change.mjs` | Modify | line 28 MATRIX row → direct `node` argv (S1) |
| `package.json` | Modify | add 8 `brain:*` verbs; keep old 8 (S2) |
| `brain/core/managed-paths.mjs` | Modify | add `'package.json'` to `managed[]`; export `MANAGED_SCRIPT_KEYS` (S5) |
| `brain/scripts/lib/installer.mjs` | Modify | add `mergePackageJsonScripts` (pure) + `mergePackageJson` (IO) (S5) |
| `brain/scripts/brain-upgrade.mjs` | Modify | register `package.json` in specialMerge map (S5) |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | Modify | verb strings → `brain:*` (S3) |
| `brain/scripts/i18n/coverage.test.mjs` | Modify | assertions lockstep with strings (S3) |
| `brain/core/methodology/harness-contract.md` | Modify | verb table, mark old deprecated (S4) |
| `README.md`, `docs/adoption.md`, `docs/inbox/*` | Modify | doc refs (S4) |
| `test/fixtures/*/package.json` | Modify | `env:init` → keep both old + `brain:env:init` (S4) |
| `test/{fresh-install,upgrade}/in-container.sh` | Modify | invocation verb names (S4) |
| `brain/scripts/lib/installer.test.mjs` | Modify | unit tests for merge invariants (S5) |

## Interfaces / Contracts

```
mergePackageJsonScripts(consumerPkgRaw: string|object, managedScripts: Record<string,string>): string
  // additive, consumer-wins, idempotent; returns 2-space JSON + trailing newline.
mergePackageJson(destPath: string, srcPath: string): void   // specialMerge signature
export const MANAGED_SCRIPT_KEYS: string[]                   // single source of truth
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | de-risk: `runCheck` calls `repoCheckFn` returning `{ok}` | inject fake fn, assert exit code (S1) |
| Unit | **never-overwrite**: consumer `brain:repo:check:"custom"` survives merge | `node --test` on pure fn (S5) |
| Unit | **idempotency**: merge(merge(x)) byte-equal to merge(x); second run = no-op write | run twice, assert equal (S5) |
| Unit | additive: missing `brain:*` keys injected; old keys + non-scripts fields preserved | pure fn (S5) |
| Unit | absent consumer file → scripts subset written | pure fn (S5) |
| Unit | coverage.test.mjs green with new strings | lockstep edit (S3) |
| Integration | fresh-install + upgrade inject `brain:*` without clobber | `test/{fresh-install,upgrade}/in-container.sh` (S5) |

## Migration / Rollout

Additive, non-breaking → version 0.7.2 → **0.8.0** (minor). Consumers gain the
`brain:*` aliases automatically on `brain:upgrade`; their existing verbs keep
working. Revert any slice independently; aliases keep old names valid
throughout, so partial rollback never breaks runtime.

**Slice dependency order**: S1 → S2, then S3 / S4 / S5 all depend only on S2
(verbs must exist in brain's package.json as the injection source) and are
mutually independent. S5 is the isolated high-risk slice.

## Open Questions

- [ ] Test fixtures: keep old verb only, or add both? Recommend BOTH (mirrors the real consumer end-state and lets S5 integration assert the merge is a no-op when the new key already exists).
