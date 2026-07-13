# Checkpoint Report — CP-C1a

> **Change:** `issue-205-memory-format-lib` · **Slice:** C1a (implementation) · **Branch:** `feat/issue-205-memory-format-lib` (base `feature/v2.0.0` @ `ac12d29`)
> **Issue:** #205 (`status:approved`). **Depends on:** #201 (C0 contract) + #203 (rung-1 fix), both merged.
> **Status: STOPPED at CP-C1a.** Working tree only — no PR, nothing pushed. Awaiting the external verdict.
> **Verdict requested:** validate the C1a format library, `memory:reindex`, the degenerate-state policy, and the git-union integration test against the C0 contract (REQ-MF-1..6, pins R1/R2/R3).

## 1. The split (pre-approved)

C1 was split at the pre-approved boundary: **C1a** (this slice) = the format library + `memory:reindex` + degenerate-state policy + the git-union integration test. **C1b** (deferred, tracked unchecked in `tasks.md`) = the secret-scrub hook + `governance.memorySecret{Patterns,AllowPatterns}` + the `0.5.0` config migration + the repo-wide `.gitattributes merge=union` line + the `managed-paths.mjs` literal. Justified: C1a is 330 counted; C1a+C1b (~406) would exceed the 400 budget. C1b will be a stacked `Part of #205` slice.

## 2. Files (working tree, uncommitted)

| File | Change |
|---|---|
| `brain/scripts/memory/lib/format.mjs` | NEW (211) — pure: `canonicalJson` (RFC 8785 subset), `computeRecordId`, `buildRecord`, `validateRecord`, `serializeRecord`, `parseRecordLine`, `buildIndexEntry`, `serializeIndex` |
| `brain/scripts/memory/lib/store.mjs` | NEW (73) — thin I/O: `appendRecord`, `rebuildIndex` |
| `brain/scripts/memory/cli.mjs` | `reindex` op (backend-agnostic, i18n-routed) |
| `package.json` | `memory:reindex` script |
| `brain/scripts/i18n/{en,es}.mjs` | `memory.reindex.done`/`.failed` |
| `openspec/changes/issue-205-memory-format-lib/**` | SDD artifacts + this report |
| tests | `format.test.mjs`, `store.test.mjs`, `records-merge.integration.test.mjs` |

**Budget: 330 / 400** counted (`*.test.mjs`, `openspec/changes/**`, `.memory/**` excluded). **`brain/core|project/** untouched`** → `brain-writes-reviewed` will PASS on the C1a PR (the L6 WARN is a C1b concern, when the config-migration + managed-paths land).

## 3. Baseline
`npm test` → **920 pass, 0 fail** (strict TDD, RED→GREEN per unit). `brain:repo:check` clean · `brain:nav` green.

## 4. CP-C1a evidence

**Reindex R1 property test (verbatim):**
```
ok - rebuildIndex: property — delete index, reindex, byte-identical to the original
```
`index.json` is JSONL (one entry per physical line, sorted by `id`) — a full rewrite each run still yields a minimal `git diff` because sorted-by-id determinism keeps every other line byte-identical (byte-equality asserted, not deep-equal).

**Git-union integration test (REQ-MF-3, verbatim):** two branches append records to `.memory/records/2026-07.jsonl`; a real `git merge` under a temp `.gitattributes merge=union`:
```
Auto-merging .memory/records/2026-07.jsonl
Merge made by the 'ort' strategy.
--- merged file ---
{"id":"rec-a6704902d091df8c",...,"content":"Decision B, from branch Y."}
{"id":"rec-52f44658bbaeff1e",...,"content":"Decision A, from branch X."}
```
Both records survive, no conflict markers; `rebuildIndex` on the merged file yields 2 entries. (`ort` is the top-level strategy; `union` is the per-file driver underneath — verified: the SAME add/add scenario WITHOUT `merge=union` produces `CONFLICT (add/add)` + markers.)

**Degenerate states (2b):** (a) `records/` absent/empty → empty index, `exit 0`, no warning, legacy `.memory/chunks/*.gz` untouched. (b) corrupt line → **fail-closed** with `${filename}:${lineNo}` in the error, **no silent skip**.

## 5. Adversarial review (fresh context) — the load-bearing pieces independently verified
- **`id` contract byte-exact** — a reviewer recomputed the hash with an independent canonicalizer: field set `{type,actor,actorKind,ts,project,issue?,supersedes?,content}` == REQ-MF-2; `source` excluded; `issue:null` hashes identically to absent (**R3**); title folded into `content` before hashing (**R2**). **C4's migration will compute matching ids.**
- **Fail-closed store real** — the single `try/catch` re-throws with file:line; no `evidence-reader-empty-on-failure` skip anywhere.
- **The "union mislabel" worry was REFUTED** with evidence (ort-strategy/union-driver distinction; the test does set `merge=union` and models a genuine conflict).
- **Verdict: READY for external CP-C1a review.**

## 6. Flagged for the external reviewer (MINOR/NIT — none blocking)
- **MINOR — `validateRecord` does not verify `id` integrity.** A tampered/stale `id` passes; `rebuildIndex` trusts `record.id`. C0 deliberately scoped the validator to shape-only, and nothing in C1a emits mismatched ids — a **conscious boundary**. Recommended hardening for **C1b/C4**: `rebuildIndex` recomputes `computeRecordId(record)` and fails closed on mismatch.
- **MINOR — integration coverage:** covers add/add; a steady-state variant (append onto a committed base record) and the dedup-via-real-merge case are acceptable proxies (the latter is proven by a unit double-append) — consider adding in C1b.
- **NIT** — the multi-line rejection lives in `serializeRecord` (throws), not literally in `validateRecord`; enforcement is real (content newlines are always `\n`-escaped).
- **NIT** — `cli.mjs reindex` dispatcher untested (per existing convention); smoke-tested end-to-end OK; `share`/`pull`/`index` untouched.

## 7. Substrate
`brain:governance-status` → **RUNG 1** active (mechanical branch protection, correct after the #203/#204 fix). The C1a PR merges under it; the 5 REQUIRED must be green.

## 8. Next slice — C1b
Secret-scrub (fail-closed, scan-this-run-only, allowlist, no `--no-scrub`) + `0.5.0` config migration + `.gitattributes merge=union` (repo-wide) + `managed-paths.mjs` literal. Will touch `brain/core/` → `brain-writes-reviewed` WARN expected (DETECTION, human-reviewed). Fold in the id-integrity hardening (§6).

---

**Awaiting the external CP-C1a verdict. No PR opened, nothing pushed.**
