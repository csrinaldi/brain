# Checkpoint Report — CP-C1b

> **Change:** `issue-214-secret-scrub-idintegrity` · **Slice:** C1b (implementation — completes C1) · **Branch:** `feat/issue-214-secret-scrub-idintegrity` (base `feature/v2.0.0` @ `3d1e356`)
> **Issue:** #214 (`status:approved`). **Depends on:** #205 C1a (format lib + reindex), merged.
> **Status: STOPPED at CP-C1b.** Working tree only — no PR, nothing pushed. Awaiting the external verdict.
> **Verdict requested:** validate the fail-closed secret-scrub, the `id`-integrity hardening, the config/`.gitattributes` plumbing, the C0 doc-sync, and the `index.json`→`index.jsonl` rename.

## 1. What was built
- **`lib/secret-scrub.mjs`** (pure) — fail-closed secret scanner: `DEFAULT_SECRET_PATTERNS` (GitHub PAT, `glpat-`, AWS `AKIA`, private-key headers), `resolveSecretConfig` (additive defaults + config + allowlist), `scanTextForSecrets`, `scrubChunkFile` (gunzip → pretty-print → line-scan).
- **`backends/engram.mjs` `share()`** — wired the scrub: scans **only the chunks materialized this run** (`git status --porcelain -- .memory/chunks`, content-addressed = exact), fails closed on a hit (non-zero, blocks) naming pattern + `file:line`.
- **`lib/store.mjs` `rebuildIndex`** — **`id`-integrity**: recomputes via the ONE shared `computeRecordId` (from `format.mjs`, never a second hasher) and fails closed on mismatch with `file:line`.
- **`brain/core/config-migrations.mjs`** `0.5.0` (both keys, additive, `schemaVersion` bump) · **`brain/core/managed-paths.mjs`** + **`.gitattributes`** `/.memory/records/*.jsonl merge=union` (git's **built-in** driver — no per-clone `git config`, unlike the legacy `merge=engram-manifest` line).
- **Doc-sync** — the C0 drafts (`memory-format.md`, `adr-0017`) union-exclusion rationale corrected (R1 made "single JSON object" stale → now "index lines are replaced/reordered → union would dup/stale"). **Rename** `index.json`→`index.jsonl` across code + the active C0/C1a specs/drafts.

## 2. Design decisions (design.md)
- **Scrub target (pre-C2 gap): option (a)** — scan what `share` materializes today (engram gzip chunks, decompressed); C2 re-points to `records/` without changing `scanTextForSecrets`. Rationale: today's real leak risk lives in the chunks.
- **Rename adopted** — the index is JSONL, not a whole-file JSON document; renaming now (zero migration cost — nothing committed) avoids the `JSON.parse(entireFile)` trap.

## 3. Budget & baseline
**320 / 400** counted (`*.test.mjs`, `openspec/changes/**` excluded). `npm test` → **953 pass, 0 fail** (strict TDD). `brain:repo:check` clean · `brain:nav` green. **`brain/core/` touched** (config-migration + managed-paths, per §1.4/§1.6) → **`brain-writes-reviewed` WARN expected** on the PR (DETECTION, non-blocking, human-reviewed).

## 4. Adversarial review (fresh context, security-focused)
Verdict: needs ONE fix. **Applied:**
- **MAJOR (FIXED, TDD) — `_defaultChangedChunkFiles` failed OPEN on any git error.** It read `r.stdout` with no `r.status`/`r.error` check → a git failure (safe.directory dubious-ownership, no-repo, absent binary → status 128, empty stdout) returned `[]` → zero chunks scanned → a secret would pass. Now **fails closed** (refuses to share, surfaces git stderr); guarded by two new tests (git-failure → throws; clean run → `[]`, no permablock). This was the one path that didn't honor the slice's fail-closed promise.
- **MINOR/NIT swept:** i18n error now hints `gunzip -c <file> | jq .` (the `file:line` is against the pretty-printed view); a design note that an over-broad allowlist (`.*`) silently disables the gate (backstop = human config review); the stale-active `index.json` refs + the exact stale union rationale in `issue-201/design.md,spec.md` corrected; the dangling "below" in the corrected drafts reworded.

**Independently verified SOLID (the two that matter most):**
- **Fail-closed core** — all 5 default patterns are correct real-token regexes; config is additive (cannot empty the list below the 5 defaults); a bad regex throws (fails closed); no `try/catch` swallows a hit; no `--no-scrub` flag.
- **`id`-integrity no false mismatch** — uses the exact `computeRecordId` `buildRecord` uses; a legit record (title folded, optionals omitted, `source` excluded, keys sorted) recomputes to its stored id byte-for-byte; a tampered id fails closed with `file:line`.
- **No permablock** (content-addressed chunks → old secrets never re-scanned); decompression finds secrets in gzip; `0.5.0` idempotent + drift-guarded; `pull`/`import`/`index`/`reindex` untouched.

## 5. Evidence (verbatim)
- Fail-closed: `ok - scrubMaterializedChunks: a secret hit fails closed and names the pattern + file:line`; `ok - share(): a secret hit in a materialized chunk fails closed`.
- M1: `ok - _defaultChangedChunkFiles: git failure fails CLOSED (refuses to share), never returns [] silently`.
- id-integrity: `ok - rebuildIndex: a legitimate record ... never produces a false id mismatch`; a tampered id throws with `filename:line`.

## 6. Substrate
`brain:governance-status` → **RUNG 1** active. The C1b PR merges under it; the 5 REQUIRED must be green (`brain-writes-reviewed` WARN is DETECTION, non-blocking).

## 7. This completes C1
C1 = C1a (#205, format lib + reindex, merged) + C1b (#214, this). After merge:
- **Human R4 promotion MR** — promote the **amended** `memory-format.md` + `adr-0017` + `brain/HOME.md` (co-promote all three; the union rationale is now current).
- **Next slice: C2** — engram backend speaks the format + `memory:migrate-v1` (re-points the scrub to `records/`; **fresh `ts` = seconds precision**, the validator rejects millis — pin recorded).

---

**Awaiting the external CP-C1b verdict. No PR opened, nothing pushed.**
