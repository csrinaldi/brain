#!/usr/bin/env node
// brain/scripts/memory/backends/engram.mjs — engram backend for the MEMORY_BACKEND dispatcher.
//
// Encapsulates all engram-specific operations. Exported functions are called by
// brain/scripts/memory/cli.mjs; no caller should invoke the `engram` binary directly.
//
// Operations:
//   share()              — export live memory to .memory/ (engram sync)
//   pull()               — import .memory/records/ into engram (records-only, D2/C4)
//   index()              — project brain/ docs into engram (delegates to brain-to-engram.mjs)
//   setup()              — ensure .engram → .memory symlink + register merge driver
//   featureCheckpoint()  — dehydrate: stamp + validate + write resume.md (REQ-S2-1, REQ-E-1)
//   featureResume()      — hydrate: project openspec/changes/<feature>/*.md into LOCAL engram
//                          under a DISTINCT project namespace so memory:share never exports
//                          these observations (CONFIRMED: engram sync --export is project-
//                          scoped; feature obs under brain-feature-<X> stay out of .memory/)

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { hostname as osHostname, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveFeature } from "../lib/feature-resolution.mjs";
import { changeDir, OPERATIONAL_ARTIFACTS } from "../../lib/sdd-layout.mjs";
import { parseFrontmatter, serializeFrontmatter } from "../lib/resume-frontmatter.mjs";
import { validateResume } from "../lib/resume-schema.mjs";
import { currentBranch } from "../../lib/git-branch.mjs";
import { resolveSecretConfig, compilePatterns, scrubChunkFile, scanTextForSecrets } from "../lib/secret-scrub.mjs";
import { exportObservation } from "../lib/engram-export.mjs";
import { importRecord } from "../lib/engram-import.mjs";
import { appendRecord, rebuildIndex, readRecordIds, readRecords } from "../lib/store.mjs";
import { emptyDuplicates, normalizeDuplicates } from "../lib/duplicates.mjs";
import { serializeRecord } from "../lib/format.mjs";
import { collectChunkObservations } from "../lib/migrate-v1.mjs";
import { unsupportedOp } from "../lib/unsupported-op.mjs";
import { t } from "../../i18n/t.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * ensureMemorySymlink(root) — idempotent: guarantees .engram → .memory symlink.
 *
 * Scenarios (ADR-0002 / REQ-S0-1):
 *   1. .memory/ exists, .engram absent          → create symlink.
 *   2. .memory/ exists, .engram is a symlink    → already correct, no-op.
 *   3. .memory/ exists, .engram is a real dir   → warn and skip (do not clobber).
 *      This protects machines that have not yet pulled the git mv migration.
 *   4. .memory/ absent                          → warn and skip (fresh clone pre-import).
 *
 * @param {string} [root=repoRoot]  Repo root; defaults to this package's root.
 *                                  Override in tests to use temp directories.
 */
export function ensureMemorySymlink(root = repoRoot) {
  const symlinkPath = join(root, ".engram");
  const targetPath = join(root, ".memory");

  // Does the target (.memory/) exist at all?
  let targetExists = false;
  try {
    lstatSync(targetPath);
    targetExists = true;
  } catch {
    /* not found */
  }

  if (!targetExists) {
    console.warn("  ⚠ .memory/ does not exist yet — skipping symlink creation");
    return;
  }

  // What is .engram right now?
  let engramStat = null;
  try {
    engramStat = lstatSync(symlinkPath);
  } catch {
    /* .engram does not exist — normal post-migration state on a fresh clone */
  }

  if (engramStat === null) {
    // Normal case: create the symlink.
    symlinkSync(".memory", symlinkPath);
    console.log("  ✓ .engram → .memory symlink created");
  } else if (engramStat.isSymbolicLink()) {
    // Already a symlink — idempotent, nothing to do.
    console.log("  ✓ .engram → .memory symlink already in place");
  } else {
    // .engram is a real file or directory — do not clobber; warn instead.
    // Most likely cause: this machine has not yet pulled the git mv migration.
    console.warn(
      "  ⚠ .engram is a real directory — pull the migration before re-running setup",
    );
  }
}

/**
 * Resolve the `engram` binary. Throws if not found.
 */
function requireEngram() {
  const result = spawnSync("which", ["engram"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("engram binary not found. Install via: gentle-ai install");
  }
  return "engram";
}

/**
 * share() — export live engram memory to .memory/ (idempotent, content-addressed),
 * fail-closed secret-scrub whatever chunks were materialized this run as the
 * transitional backstop (issue #214, C1b), THEN dual-write the exported
 * observations into `.memory/records/` under scan-then-write (issue #221,
 * C2b-1, design.md Decision 1).
 *
 * Order (issue #221 fix pass, MINOR): the chunk backstop runs BEFORE the
 * records dual-write. Rationale — `dualWriteRecords()` APPENDS to the
 * append-only `records/` log; if it ran first and a LATER gate (the chunk
 * backstop) then failed, `records/` would already be mutated on an aborted
 * share. Scanning chunks first means a chunk-only secret (e.g. a
 * `scope:personal` observation the records candidate filter already
 * excluded) aborts the share before `records/` is ever touched.
 *
 * Scrub scope: TWO independent fail-closed scans run, never one gating
 * the other's write:
 *   1. scrubMaterializedChunks() — the chunks engram's export just wrote are
 *      scanned AFTER materialization (C1b's original design, unchanged): a
 *      hit blocks the push but the chunk itself was already written locally.
 *   2. dualWriteRecords() — candidate records (transformed from observations
 *      via exportObservation) are scanned BEFORE any `records/` append; a hit
 *      aborts before the append-only log is ever touched (Decision 1). It
 *      also dedups by content-addressed `id` against what `records/` already
 *      has (issue #221 fix pass, BLOCKER) — a retry after ANY abort is safe.
 * There is NO `--no-scrub` flag for either path; the only bypass is the
 * config allowlist (`governance.memorySecretAllowPatterns`).
 *
 * @param {object} [opts]  Injectable seams for testing — production defaults
 *   call the real engram binary, git, and filesystem.
 * @param {string} [opts.root]  Repo root.
 * @param {() => string} [opts._requireEngram]  Resolves the engram binary; throws if absent.
 * @param {(engram: string) => void} [opts._export]  Runs `engram sync --export`.
 * @param {(root: string) => {observations: object[], unparseable: string[], emptyObservations: string[]}} [opts._readObservations]
 *   Observations materialized this run, plus the chunk-level accounting buckets.
 * @param {typeof exportObservation} [opts._exportObservation]
 * @param {typeof appendRecord} [opts._appendRecord]
 * @param {typeof rebuildIndex} [opts._rebuildIndex]
 * @param {(root: string) => string[]} [opts._changedChunkFiles]  Every chunk present (issue #469).
 * @param {(root: string) => object} [opts._loadConfig]  Reads brain.config.json.
 * @param {(path: string, patterns: RegExp[], allowPatterns: RegExp[]) => object|null} [opts._scrubChunk]
 * @param {(p: string) => string|null} [opts._resolveDir]  Resolves .engram/.memory (issue #469, REQ-469-3).
 */
export async function share({
  root = repoRoot,
  _requireEngram = requireEngram,
  _export = _defaultShareExport,
  _readObservations = _defaultReadObservations,
  _exportObservation = exportObservation,
  _appendRecord = appendRecord,
  _rebuildIndex = rebuildIndex,
  _changedChunkFiles = _defaultChangedChunkFiles,
  _loadConfig = _defaultLoadBrainConfig,
  _scrubChunk = scrubChunkFile,
  _resolveDir = _defaultResolveDir,
} = {}) {
  const engram = _requireEngram();
  _export(engram);
  // BEFORE the scrub, not after (issue #469, REQ-469-3): if the export wrote
  // somewhere this process does not read, the scrub would scan an unrelated
  // directory and pass, which is the failure being caught. Ordering the check
  // ahead of it means the run cannot report a clean scrub it never performed.
  assertExportDestinationIsRead(root, { _resolveDir });
  await scrubMaterializedChunks(root, { _changedChunkFiles, _loadConfig, _scrubChunk });
  // Record-write is UNCONDITIONAL (design.md Decision 1, D3/C4, issue #229 — the
  // `memory.dualWrite` gate is retired BY DELETION). Records-only is the only
  // path; there is no flag left to condition on. The transitional cutover state
  // marker (C2b-1/C2b-2) served its purpose: the key is also removed from
  // brain.config.json (move 2) and the 0.6.0 migration entry that introduced it
  // is removed too (move 3) — it was never shipped to any released consumer.
  // RETURNED, not discarded (#574). Every number dualWriteRecords measures used
  // to die here: cli.mjs printed `unprovenanced` only because the generic
  // dispatch tail happened to see the value, and it never saw one from `share`
  // because `share` returned undefined. The duplicate accounting would have
  // died the same way.
  const accounting = await dualWriteRecords(
    root, { _readObservations, _exportObservation, _appendRecord, _rebuildIndex, _loadConfig },
  );

  // The self-check, for the one path dualWriteRecords returns from before it
  // ever reads `records/`: engram exported nothing project-scoped, so there
  // were no candidates. That run still SHARES a store, and the store may have
  // been union-merged since — leaving `share` silent there would reproduce this
  // ticket's bug on the quietest path there is. Mirrors plainfiles.share(),
  // which has always been a bare rebuildIndex() self-check.
  if (accounting.indexCount === undefined) {
    const { count, duplicates } = _rebuildIndex({
      recordsDir: join(root, ".memory", "records"),
      indexPath: join(root, ".memory", "index.jsonl"),
    });
    accounting.indexCount = count;
    accounting.duplicates = normalizeDuplicates(duplicates);
  }
  return accounting;
}

/**
 * Default seam: the observations materialized by this run's `engram sync
 * --export` — read back from the gzip chunks it just wrote under
 * `.memory/chunks` (reuses migrate-v1.mjs's collectChunkObservations, never a
 * second reader). Returns the FULL bucket shape — `observations` plus the
 * `unparseable`/`emptyObservations` chunk-level buckets — so dualWriteRecords()
 * can account for every chunk, not just the ones that parsed into observations
 * (issue #221 fix pass, MAJOR).
 *
 * @param {string} root
 * @returns {{observations: object[], unparseable: string[], emptyObservations: string[]}}
 */
export function _defaultReadObservations(root) {
  return collectChunkObservations(join(root, ".memory", "chunks"));
}

/**
 * dualWriteRecords() — scan-then-write over the RECORDS log (issue #221,
 * C2b-1; design.md Decision 1, REQ-C2B1-3). Independent of requireEngram()/
 * the real export so it is unit-testable with zero engram/git dependency,
 * mirroring scrubMaterializedChunks()'s testable-core pattern.
 *
 * Order: read observations → transform each into a CANDIDATE record via
 * exportObservation() → scan the candidate record LINES for secrets → only
 * if clean, dedup by content-addressed `id` against what `records/` already
 * has (issue #221 fix pass, BLOCKER) → append every NEW candidate to
 * `records/` + rebuild the index. A secret hit aborts BEFORE any
 * `appendRecord` call — the append-only `records/` log is never written with
 * a secret.
 *
 * Accounting (issue #221 fix pass, MAJOR — mirrors migrate-v1.mjs's
 * buildMigrationReport() honesty contract): every observation is accounted
 * for exactly once, never silently dropped. `errored` (a throwing
 * exportObservation), `rejected` (non-enum type), and `skippedPersonal`
 * (scope:personal) each get their own counter — none of them abort the run
 * for the others (per-observation isolation) — and the chunk-level
 * `unparseableChunks`/`emptyObservationsChunks` buckets from
 * `_readObservations()` are surfaced too. `deduped` counts candidates whose
 * `id` was already present in `records/` (a prior run) OR earlier in THIS
 * batch (two observations exporting to the same content-addressed record).
 *
 * @param {string} root
 * @param {object} [opts]
 * @param {(root: string) => {observations: object[], unparseable?: string[], emptyObservations?: string[]}} [opts._readObservations]
 * @param {typeof exportObservation} [opts._exportObservation]
 * @param {typeof appendRecord} [opts._appendRecord]
 * @param {typeof rebuildIndex} [opts._rebuildIndex]
 * @param {typeof readRecordIds} [opts._readRecordIds]
 * @param {(root: string) => object} [opts._loadConfig]
 * @returns {Promise<{written: number, deduped: number, errored: number, rejected: number,
 *   skippedPersonal: number, unprovenanced: number, unparseableChunks: number,
 *   emptyObservationsChunks: number, indexCount?: number,
 *   duplicates: {ids: number, lines: number, divergent: number, groups: object[]}}>}
 *   `duplicates` (#574) is the union-merge residual already sitting in
 *   `records/`, distinct from `deduped` (candidates THIS run declined to
 *   append). Zero on the early return, which measured nothing.
 */
export async function dualWriteRecords(
  root,
  {
    _readObservations = _defaultReadObservations,
    _exportObservation = exportObservation,
    _appendRecord = appendRecord,
    _rebuildIndex = rebuildIndex,
    _readRecordIds = readRecordIds,
    _loadConfig = _defaultLoadBrainConfig,
  } = {},
) {
  const { observations, unparseable = [], emptyObservations = [] } = _readObservations(root);

  const candidates = [];
  let errored = 0;
  let rejected = 0;
  let skippedPersonal = 0;
  // #541: observations that arrived with NO §4 provenance block. `exportObservation`
  // has always returned this flag and the loop has always discarded it, so the
  // fallback — actor `@legacy`, no `issue` — was applied silently and the resulting
  // record looked like any other. Counting it is what turns "the emitter does not
  // exist" from a thing you discover by reading 2000 records into a number printed on
  // every share.
  //
  // Counted, NOT rejected. Failing here would refuse the 2070 historical observations
  // this repository already holds and make `share` unusable — the same trap #529's
  // ruling refused for `memory-gate`. Visibility first; the gate only once the emitter
  // exists to satisfy it.
  let unprovenanced = 0;
  for (const obs of observations) {
    let result;
    try {
      result = _exportObservation(obs);
    } catch {
      errored += 1; // one bad observation must never abort the whole share
      continue;
    }
    if (result.skipped) {
      skippedPersonal += 1;
      continue;
    }
    if (result.rejected) {
      rejected += 1;
      continue;
    }
    if (!result.recovered) unprovenanced += 1;
    candidates.push(result.record);
  }

  const accounting = {
    written: 0,
    deduped: 0,
    errored,
    rejected,
    skippedPersonal,
    unprovenanced,
    unparseableChunks: unparseable.length,
    emptyObservationsChunks: emptyObservations.length,
    // #574. `deduped` above counts candidates this RUN declined to append; this
    // counts physical lines already sitting in `records/` under a repeated id —
    // the union-merge residual. Zero here means "measured, none", and on the
    // early returns below it means "no reindex ran, so nothing was measured":
    // never a number this function did not observe.
    duplicates: emptyDuplicates(),
  };

  if (candidates.length === 0) return accounting;

  const { patternSources, allowPatternSources } = resolveSecretConfig(_loadConfig(root));
  const patterns = compilePatterns(patternSources);
  const allowPatterns = compilePatterns(allowPatternSources);

  const candidateText = candidates.map(serializeRecord).join("\n");
  const hit = scanTextForSecrets(candidateText, patterns, allowPatterns);
  if (hit) {
    throw new Error(
      await t("memory.share.secretFoundRecords", {
        line: hit.lineNumber,
        pattern: hit.pattern,
      }),
    );
  }

  const recordsDir = join(root, ".memory", "records");
  const indexPath = join(root, ".memory", "index.jsonl");

  const existingIds = _readRecordIds({ recordsDir });
  const seenInBatch = new Set();
  const toAppend = [];
  for (const record of candidates) {
    if (existingIds.has(record.id) || seenInBatch.has(record.id)) {
      accounting.deduped += 1;
      continue;
    }
    seenInBatch.add(record.id);
    toAppend.push(record);
  }

  for (const record of toAppend) {
    _appendRecord(record, { recordsDir });
  }
  accounting.written = toAppend.length;
  // Reindex UNCONDITIONALLY from here on (#574) — the former `toAppend.length > 0`
  // guard was the churn discipline reading of ADR-0017, but it also meant that
  // the steady-state share (engram exported, everything already in `records/`,
  // nothing to append) never read the log and so could never notice the
  // duplicates a `git pull` had merged in since. The guard bought nothing it
  // was meant to: `rebuildIndex` is deterministic, so re-running it over an
  // unchanged store rewrites byte-identical content and `git diff` stays empty
  // — the churn rule is about the DIFF, not the write (measured: rebuilding
  // over this repo's 2038-record store reproduces the committed index
  // byte-for-byte). The zero-candidate early return above still short-circuits
  // before this; `share()` covers that path with its own self-check.
  const { count, duplicates } = _rebuildIndex({ recordsDir, indexPath });
  accounting.indexCount = count;
  accounting.duplicates = normalizeDuplicates(duplicates);
  return accounting;
}

function _defaultShareExport(engram) {
  execFileSync(engram, ["sync", "--export"], { stdio: "inherit" });
}

/**
 * Default seam: reads `brain.config.json` for the `governance.memorySecret*`
 * keys. Never throws — an absent/unparseable config falls back to `{}`, which
 * resolveSecretConfig() turns into the default pattern set.
 *
 * @param {string} root
 * @returns {object}
 */
function _defaultLoadBrainConfig(root) {
  try {
    return JSON.parse(readFileSync(join(root, "brain.config.json"), "utf8"));
  } catch {
    return {};
  }
}

/**
 * Default seam: every `.memory/chunks/*.jsonl.gz` present, read from the
 * FILESYSTEM (issue #469, design D1). Same directory `_defaultReadObservations`
 * already enumerates via `collectChunkObservations` — one source of truth for
 * what a share run touches, not two.
 *
 * This used to ask `git status --porcelain -- .memory/chunks` and describe the
 * result as the "materialized THIS run" boundary. `.memory/chunks/` is
 * GITIGNORED (`.gitignore:84`), and `git status --porcelain` never reports
 * ignored paths, so the set was **always empty**: the scrub had never scanned a
 * chunk. An empty set is not an error, so the fail-closed guard below never
 * tripped — it fails closed on a git ERROR and passed on a git result that was
 * empty for a structural reason. `evidence-reader-empty-on-failure` with a
 * third case neither branch modelled: the query cannot ever return anything.
 *
 * `--ignored` is NOT the fix, measured rather than argued (design D1): three of
 * the four git spellings report `!! .memory/chunks/` — the DIRECTORY — which the
 * `.jsonl.gz` suffix filter then dropped, leaving the scan at zero. Only plain
 * `--ignored -uall` lists files, while `--ignored=matching -uall`, which reads as
 * the tighter request, does not. A gate one plausible flag edit silently disarms
 * is the defect being fixed, re-armed and harder to see.
 *
 * The "materialized THIS run" boundary is gone, and was never real for
 * gitignored chunks: it did not narrow the scan, it emptied it. This scans the
 * WHOLE store, deliberately — the premise that an untouched chunk was cleared by
 * an earlier run is false, because no earlier run scanned anything. Restoring a
 * real boundary (pre/post-export snapshot) trades completeness for speed in a
 * gate whose whole job is completeness; deferred to a ticket with a measurement.
 *
 * Directories are dropped on their TYPE, not their name — the git spellings that
 * returned a directory path are exactly what a suffix-only filter cannot see.
 *
 * Fail CLOSED on any read error, including ENOENT. `share()` reaches here only
 * AFTER `engram sync --export` ran, so a missing chunk directory means the export
 * wrote where this process does not read — the REQ-469-3 failure, caught twice.
 * An EMPTY directory is not an error: a fresh clone with no memory yet is
 * legitimate, and that is the distinction the git version could not draw.
 *
 * ## The scanned set must CONTAIN the read set (round-1 cold review, BLOCKER)
 *
 * The invariant is not that this function and `_defaultReadObservations` agree;
 * it is that **nothing reaches `records/` unscanned**. The first draft of this
 * fix used `Dirent.isFile()` to drop directories (E5) and thereby dropped
 * SYMLINKS too — `isFile()` is false for a symlink entry — while the reader's
 * `readFileSync` follows them. Measured on a chunks directory holding one
 * symlink to a chunk carrying `ghp_…`:
 *
 * ```
 * SCANNER sees : [ 'plain.jsonl.gz' ]
 * READER  sees : [{"text":"ghp_0123…"},{"text":"fine"}]
 * ```
 *
 * The secret bypassed the scrub and landed in the append-only log, in a public
 * repository — the one outcome this gate exists to prevent, opened by the guard
 * added to close a different one. So the type test is `statSync`, which FOLLOWS
 * symlinks: a symlink to a chunk is scanned, a directory (or a symlink to one)
 * is not, and the reader can read nothing this does not see.
 *
 * An entry that cannot be stat'd fails CLOSED for the same reason the directory
 * read does: "cannot look" must never be reported as "nothing to scan".
 *
 * @param {string} root
 * @param {object} [opts]
 * @param {(dir: string, opts: object) => import("node:fs").Dirent[]} [opts._listDir]
 * @param {(p: string) => import("node:fs").Stats} [opts._stat]
 * @returns {string[]}  Absolute paths.
 */
export function _defaultChangedChunkFiles(root, { _listDir = readdirSync, _stat = statSync } = {}) {
  const dir = join(root, ".memory", "chunks");
  let entries;
  try {
    entries = _listDir(dir, { withFileTypes: true });
  } catch (err) {
    throw new Error(
      `secret-scrub: cannot read ${dir} — cannot determine which chunks this run materialized; refusing to share (fail closed): ${err?.code ?? ""} ${err?.message ?? err}`.replace(
        /\s+/g,
        " ",
      ),
    );
  }
  const out = [];
  for (const e of entries) {
    if (!e.name.endsWith(".jsonl.gz")) continue;
    const full = join(dir, e.name);
    let st;
    try {
      st = _stat(full);
    } catch (err) {
      throw new Error(
        `secret-scrub: cannot stat ${full} — a chunk the reader may still follow cannot be classified; refusing to share (fail closed): ${err?.code ?? ""} ${err?.message ?? err}`.replace(
          /\s+/g,
          " ",
        ),
      );
    }
    if (st.isFile()) out.push(full);
  }
  return out;
}

/**
 * Default seam: resolve a path through symlinks, or `null` when it does not
 * exist (issue #469, REQ-469-3). Separated so `share()`'s export-destination
 * check is testable without building a real symlink.
 *
 * @param {string} p
 * @returns {string|null}
 */
export function _defaultResolveDir(p) {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

/**
 * Throws when `engram sync --export` writes to a directory `share()` does not
 * read from (issue #469, REQ-469-3).
 *
 * engram writes under `.engram/`; every reader here — `_defaultReadObservations`,
 * `_defaultChangedChunkFiles` — reads under `.memory/`. `ensureMemorySymlink`
 * keeps those the same directory, but its case 3 (`.engram` is a REAL directory)
 * only `console.warn`s and does not clobber, which is right. Nothing downstream
 * checked, so the export succeeded, printed `Created chunk …`, zero records were
 * appended, and the run reported success. Reproduced in the maintainer's own
 * checkout.
 *
 * Compares RESOLVED paths rather than symlink type: what matters is that the two
 * land on the same directory, and `realpathSync` answers that for a symlink, a
 * bind mount, or anything else that makes them agree.
 *
 * An ABSENT `.engram` passes — engram then writes to `.memory` directly, the
 * normal post-migration state on a fresh clone.
 *
 * Throws rather than warns: a warning is what `ensureMemorySymlink` already does,
 * and the defect reached production with that warning in place.
 *
 * @param {string} root
 * @param {object} [opts]
 * @param {(p: string) => string|null} [opts._resolveDir]
 */
export function assertExportDestinationIsRead(root, { _resolveDir = _defaultResolveDir } = {}) {
  const engramPath = join(root, ".engram");
  const engramResolved = _resolveDir(engramPath);
  if (engramResolved === null) return;

  const memoryPath = join(root, ".memory");
  const memoryResolved = _resolveDir(memoryPath);
  if (engramResolved === memoryResolved) return;

  throw new Error(
    `memory:share: 'engram sync --export' writes under ${engramPath} (${engramResolved}), ` +
      `but this run reads chunks and records from ${memoryPath} (${memoryResolved ?? "missing"}). ` +
      `Every chunk the export just wrote would be invisible: the secret scrub would scan nothing and ` +
      `zero records would be appended, while the run reported success. ` +
      `Fix: make .engram a symlink to .memory (npm run memory:setup, after pulling the migration), ` +
      `or remove the real .engram directory once its contents are merged.`,
  );
}

/**
 * scrubMaterializedChunks() — the fail-closed core, independent of requireEngram()
 * so it is unit-testable with zero real engram/git/gzip dependency. Resolves
 * the effective pattern set (defaults + `governance.memorySecretPatterns`,
 * additive) and the allowlist (`governance.memorySecretAllowPatterns`, the sole
 * bypass — no CLI flag), then scans every changed chunk. Throws on the FIRST
 * hit, naming the matched pattern and the file:line location.
 *
 * @param {string} root
 * @param {object} [opts]
 * @param {(root: string) => string[]} [opts._changedChunkFiles]
 * @param {(root: string) => object} [opts._loadConfig]
 * @param {(path: string, patterns: RegExp[], allowPatterns: RegExp[]) => object|null} [opts._scrubChunk]
 */
export async function scrubMaterializedChunks(
  root,
  {
    _changedChunkFiles = _defaultChangedChunkFiles,
    _loadConfig = _defaultLoadBrainConfig,
    _scrubChunk = scrubChunkFile,
  } = {},
) {
  const { patternSources, allowPatternSources } = resolveSecretConfig(_loadConfig(root));
  const patterns = compilePatterns(patternSources);
  const allowPatterns = compilePatterns(allowPatternSources);

  for (const chunkPath of _changedChunkFiles(root)) {
    const hit = _scrubChunk(chunkPath, patterns, allowPatterns);
    if (hit) {
      throw new Error(
        await t("memory.share.secretFound", {
          file: chunkPath,
          line: hit.lineNumber,
          pattern: hit.pattern,
        }),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// pullMemory — churn-resilient memory pull (issue #59)
// ---------------------------------------------------------------------------

/**
 * Default seam: check whether .memory/manifest.json has uncommitted local changes.
 *
 * @param {string} root  Repo root.
 * @returns {boolean}
 */
function _defaultIsManifestDirty(root) {
  const r = spawnSync(
    "git",
    ["status", "--porcelain", "--", ".memory/manifest.json"],
    { encoding: "utf8", cwd: root },
  );
  return !!r.stdout?.trim();
}

/**
 * Default seam: discard uncommitted local changes to .memory/manifest.json.
 * Non-fatal: logs a warning on failure instead of throwing.
 *
 * @param {string} root  Repo root.
 */
function _defaultRestoreManifest(root) {
  const r = spawnSync("git", ["checkout", "--", ".memory/manifest.json"], {
    stdio: "pipe",
    cwd: root,
  });
  if (r.status !== 0) {
    console.warn(
      "  ⚠ could not restore .memory/manifest.json —",
      r.stderr?.toString().trim() || "unknown error",
    );
  } else {
    console.log("  ✓ .memory/manifest.json restored (discarded local churn)");
  }
}

/**
 * Default seam: run `git pull` in the repo root.
 * Throws (via execFileSync) on non-zero exit so callers can detect failure.
 *
 * @param {string} root  Repo root.
 */
function _defaultGitPull(root) {
  execFileSync("git", ["pull"], { stdio: "inherit", cwd: root });
}

/**
 * Default seam: read every record currently in `.memory/records/`, ONE per
 * `id`, WITH the duplicate accounting. Deduped at the reader since #574 —
 * `engram import` INSERTS, so a union-merged duplicate physical line that
 * reaches the payload twice becomes two observations in the live layer,
 * permanently (importMemory's own measured note below). The dedup that used to
 * happen only at index time now also happens on the hydration path.
 *
 * Returns the `{records, duplicates}` pair rather than a bare array so the
 * `import` verb can REPORT what it collapsed. That matters more here than
 * anywhere else: `import` is what the post-merge hook runs, i.e. the moment
 * right after the merge that mints the duplicate, and it is the one automated
 * call site that keeps stderr.
 *
 * @param {string} root
 * @returns {{records: object[], duplicates: object}}
 */
export function _defaultReadRecordObservations(root) {
  return readRecords({ recordsDir: join(root, ".memory", "records") });
}

/**
 * importMemory() — hydrate local engram from `.memory/records/*.jsonl`
 * (records-only, design.md Decision 2 / D2, C4 #229). Replaces the former
 * thin `engram sync --import` chunk wrapper — the chunks path is retired,
 * `records/` is the sole read+write truth (REQ-C4-2).
 *
 * Read `.memory/records/*.jsonl` via readRecords → transform each
 * record via importRecord() → write per-record via `engram save` (the exact
 * per-observation verb already used by _defaultEngramSave()). No bulk verb
 * exists, so per-record with progress reporting is the honest primitive for
 * the ~275 records in the real store.
 *
 * IDEMPOTENT (MANDATORY, REQ-C4-2 scenario 2): `topic: record.id` is passed
 * on every save — the record's own content-addressed id becomes the engram
 * `topic_key`. engram's real topic_key match (same project+scope) UPSERTS
 * the existing observation instead of inserting a new one, and — unlike its
 * separate content-hash dedup path — this match is NOT time-windowed, so it
 * holds across arbitrarily-spaced re-runs. Re-running pull over an
 * already-populated engram therefore revises the same 275 observations, it
 * never duplicates them.
 *
 * Called by:
 *   - pullMemory() as its default _import seam
 *   - cli.mjs "import" verb (import-only, no manifest restore, no git pull)
 *   - post-merge hook (via cli.mjs import)
 *   - day-start step 5 (via cli.mjs import, after step 2 already pulled)
 *
 * @param {object} [opts]
 * @param {string} [opts.root]  Repo root (defaults to this package's root).
 * @param {() => string} [opts._requireEngram]
 *   Resolves the engram binary; throws a friendly error if absent.
 * @param {(root: string) => {records: object[], duplicates?: object}} [opts._readRecords]
 *   Returns every record observation under `.memory/records/` (one per `id`),
 *   plus the duplicate accounting it collapsed getting there (#574).
 * @param {(record: object) => object} [opts._importRecord]
 *   Transforms one record into an engram-observation shape.
 * @param {(title: string, content: string, opts: object) => void} [opts._engramSave]
 *   Writes one observation to engram. Called once per record.
 * @param {(line: string) => void} [opts._log]
 *   Progress/summary sink — defaults to console.log.
 * @returns {Promise<{written: number}>}
 */
export function buildImportPayload({
  records,
  existingTopicKeys,
  startedAt,
  _importRecord = importRecord,
}) {
  // The delta. A record already in engram is SKIPPED rather than re-sent,
  // because `engram import` INSERTS — it does not upsert by topic_key, measured
  // directly: importing one file twice turned 2 observations into 4. All
  // deduplication therefore has to happen here, before the payload is built.
  //
  // Equivalent to the upsert this replaces ONLY because brain records are
  // immutable: an id is content-derived, so an edit yields a NEW record instead
  // of mutating one already imported. `engram.batch-import.test.mjs` pins that
  // premise separately — it is the test that fails first if it ever breaks.
  //
  // The `seenInBatch` half is #574's rule applied where it bites hardest. The
  // reader now hands over one record per id (`readRecords`), so this is the
  // belt to that suspenders — but it is not decoration: `engram import`
  // INSERTS, the duplicate it creates is permanent (nothing self-heals it, per
  // the note in importMemory), and the input is a log a `git merge` is allowed
  // to append repeats to. A dedup this cheap belongs on both sides of the seam.
  const seenInBatch = new Set();
  const fresh = records.filter((r) => {
    if (existingTopicKeys.has(r.id) || seenInBatch.has(r.id)) return false;
    seenInBatch.add(r.id);
    return true;
  });
  const skipped = records.length - fresh.length;

  // Nothing new: return no payload at all rather than an empty one. An empty
  // payload would still cost a process spawn, on the steady-state path that
  // every `git pull` runs.
  if (fresh.length === 0) return { payload: null, written: 0, skipped };

  // One synthetic session per project. Measured against the real binary: an
  // observation whose session row is missing fails with `FOREIGN KEY constraint
  // failed`, and `session_id: null` fails identically — the session row is what
  // establishes the project. Per project, not one global row, so a records file
  // spanning several projects cannot hang observations off the wrong one.
  const sessions = [];
  const sessionFor = new Map();
  for (const r of fresh) {
    const project = _importRecord(r).project;
    if (sessionFor.has(project)) continue;
    const id = `brain-batch-import-${project}`;
    sessionFor.set(project, id);
    sessions.push({ id, project, started_at: startedAt, ended_at: null, summary: null });
  }

  const observations = fresh.map((r) => {
    const o = _importRecord(r);
    return {
      title: o.title,
      content: o.content,
      type: o.type,
      project: o.project,
      scope: o.scope,
      // The record id IS the topic key: the anchor the NEXT run reads back to
      // recognise this record as already present. Without it the delta has
      // nothing to match on and every run re-imports everything.
      topic_key: r.id,
      session_id: sessionFor.get(o.project),
      created_at: o.created_at,
      updated_at: o.created_at,
      last_seen_at: o.created_at,
      duplicate_count: 0,
      revision_count: 0,
    };
  });

  return {
    payload: { version: "0.1.0", exported_at: startedAt, sessions, prompts: [], observations },
    written: fresh.length,
    skipped,
  };
}

export async function importMemory({
  root = repoRoot,
  _requireEngram = requireEngram,
  _readRecords = _defaultReadRecordObservations,
  _importRecord = importRecord,
  _engramExistingTopicKeys = _defaultExistingTopicKeys,
  _engramImport = _defaultEngramImport,
  _log = console.log,
  _warn = console.error,
  _now = () => new Date().toISOString().replace("T", " ").slice(0, 19),
} = {}) {
  _requireEngram();

  const { records, duplicates } = _readRecords(root);
  const total = records.length;

  if (total === 0) {
    _log(await t("memory.import.empty"));
    return { written: 0, duplicates: normalizeDuplicates(duplicates) };
  }

  // Reading what engram already holds is the delta's only input, and it runs
  // before anything is written. The store may be empty, locked, or written by a
  // different engram version.
  //
  // This FAILS CLOSED, and the reason is measured rather than assumed. Degrading
  // to "import everything" is not "correct, merely slower" — `engram import`
  // INSERTS, so re-sending known records DUPLICATES them:
  //
  //   import p1 (rec-a, rec-b) → obs=2
  //   import p2 (rec-c)        → obs=3
  //   import p1 again          → obs=5   keys=[rec-a, rec-a, rec-b, rec-b, rec-c]
  //
  // And it is permanent: the next run reads those keys back and skips them, so
  // nothing self-heals. One transient lock on the `git pull` path — where this
  // runs with output suppressed — would silently double the store.
  //
  // A hydration that did not happen is recoverable by running again. Duplicates
  // are not. So: skip the import, SAY why, let the next run retry.
  //
  // The distinction the reader must preserve is "the store is genuinely empty"
  // (an empty Set — import everything, correctly) versus "the store could not be
  // read" (a throw, or anything that is not a Set). Conflating those two is the
  // `evidence-reader-empty-on-failure` class; this is the consumer end of it,
  // where the policy on empty is the destructive one.
  let existingTopicKeys = null;
  let unreadable = null;
  try {
    existingTopicKeys = _engramExistingTopicKeys();
  } catch (err) {
    // execFileSync captures engram's stderr on `pipe`; surfacing it is the whole
    // point — #433 survived as long as it did because this path runs quiet.
    unreadable = explainEngramFailure(err);
  }
  if (!unreadable && !(existingTopicKeys instanceof Set)) {
    unreadable = "the reader returned no key set";
  }
  if (unreadable) {
    // To STDERR, not stdout. The post-merge hook redirects stdout to /dev/null,
    // so a skipped hydration on the `git pull` path would otherwise be as silent
    // as the duplication it replaced — better, but still invisible. `|| true` in
    // the hook keeps this from ever blocking a merge.
    _warn(await t("memory.import.stateUnreadable", { reason: unreadable }));
    return { written: 0, skipped: 0, deferred: true, duplicates: normalizeDuplicates(duplicates) };
  }

  const { payload, written, skipped } = buildImportPayload({
    records,
    existingTopicKeys,
    startedAt: _now(),
    _importRecord,
  });

  if (payload) _engramImport(payload);

  _log(await t("memory.import.done", { written, total }));
  // `total` is unique RECORDS, not physical lines — it always was the length of
  // what this function imports, and since #574 the reader collapses repeats, so
  // the two stopped being the same number. The gap is what `duplicates` states.
  return { written, skipped, duplicates: normalizeDuplicates(duplicates) };
}

/**
 * pullMemory() — churn-resilient memory pull (issue #59).
 *
 * Problem: `engram sync --export` (run by memory:share / pre-push) rewrites
 * .memory/manifest.json, leaving it dirty in the working tree. A subsequent
 * `git pull` aborts with "your local changes would be overwritten by merge"
 * because manifest.json is a tracked file with uncommitted local changes.
 * The union-merge driver only helps with COMMITTED conflicts, not dirty-tree blocks.
 *
 * Solution: the manifest is a DERIVED index that engram regenerates on every
 * export. Discarding local churn is therefore always safe. This function:
 *   1. Detects and discards uncommitted manifest churn before pulling.
 *   2. Runs `git pull` (the union-merge driver handles any committed-manifest merges).
 *   3. Rebuilds `.memory/index.jsonl` from the merged `records/` (#574).
 *   4. Calls importMemory() to hydrate local engram from the merged .memory/.
 *
 * Step 3 is new, and it is where #574's rule reaches the engram side of
 * `pull()`. The `git pull` in step 2 is the exact event that MINTS a duplicate
 * physical line (`merge=union`, ADR-0017 REQ-MF-3), and this path used to walk
 * straight from there into hydrating the live layer — never rebuilding the
 * derived index, never reading the log, reporting nothing. `plainfiles.pull()`
 * has always been `git pull` + reindex; both backends now say the same thing
 * about the same store. Ordering matters as much as presence: the reindex is
 * the fail-closed gate, so a store that cannot be indexed (a tampered line, or
 * two lines claiming one id with different bytes) refuses BEFORE engram is
 * hydrated from it, rather than after.
 *
 * Use pullMemory() for cross-machine syncs (npm run memory:pull).
 * Use importMemory() when git pull already ran (post-merge hook, day-start step 5).
 *
 * Injectable seams make the function fully unit-testable without real git/engram:
 *
 * @param {object} [opts]
 * @param {string}  [opts.root]              Repo root (defaults to this package's root).
 * @param {(root: string) => boolean}  [opts._isManifestDirty]
 *   Returns true when manifest.json has uncommitted local changes.
 * @param {(root: string) => void}     [opts._restoreManifest]
 *   Discards uncommitted manifest changes (non-fatal, best-effort).
 * @param {(root: string) => void}     [opts._gitPull]
 *   Runs `git pull`; MUST throw on non-zero exit so import is not called on failure.
 * @param {() => void | Promise<void>} [opts._import]
 *   Runs the import step — defaults to importMemory().
 */
export async function pullMemory({
  root = repoRoot,
  _isManifestDirty = _defaultIsManifestDirty,
  _restoreManifest = _defaultRestoreManifest,
  _gitPull = _defaultGitPull,
  _rebuildIndex = rebuildIndex,
  _import = importMemory,
} = {}) {
  // Step 1: discard regenerable manifest churn so git pull can proceed.
  if (_isManifestDirty(root)) {
    console.log(
      "  ℹ .memory/manifest.json has uncommitted local changes — restoring before pull",
    );
    _restoreManifest(root);
  }

  // Step 2: pull latest commits (throws on failure — import must not run).
  _gitPull(root);

  // Step 3: rebuild the derived index from the just-merged records/ (#574).
  // Throws on a store the merge left unindexable — hydration must not run on
  // one, so this deliberately sits BEFORE the import.
  const { count, duplicates } = _rebuildIndex({
    recordsDir: join(root, ".memory", "records"),
    indexPath: join(root, ".memory", "index.jsonl"),
  });

  // Step 4: hydrate local engram from the newly merged .memory/.
  await _import();

  return { indexCount: count, duplicates: normalizeDuplicates(duplicates) };
}

/**
 * pull() — import .memory/records/ into engram using the churn-resilient safe
 * pull. Replaces the former thin `engram sync --import` chunk wrapper — the
 * chunks path is retired (records-only, D2/C4).
 * Called by brain/scripts/memory/cli.mjs when op = "pull".
 */
export async function pull() {
  return pullMemory();
}

// ---------------------------------------------------------------------------
// save / search — the Q1 asymmetry's engram side (design Decision 5, obs
// #578's "engram.search stub: YES" ruling). engram already has a native
// `mem_save`/`mem_search`; a second CLI-mediated door would create a second
// surface to keep in parity forever. Both refuse loudly via the shared
// unsupportedOp helper — never cryptic, never a silent no-op, on either verb.
// ---------------------------------------------------------------------------

/** @returns {Promise<never>} */
export async function save() {
  await unsupportedOp("save", "engram", { key: "memory.save.engramUnsupported" });
}

/** @returns {Promise<never>} */
export async function search() {
  await unsupportedOp("search", "engram", { key: "memory.search.engramUnsupported" });
}

/**
 * index() — project brain/ documents into engram.
 * Delegates entirely to brain-to-engram.mjs — no logic duplication.
 */
export async function index() {
  const scriptPath = join(repoRoot, "brain", "scripts", "brain-to-engram.mjs");
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    cwd: repoRoot,
  });
  if (result.status !== 0) {
    throw new Error(`brain-to-engram.mjs exited with status ${result.status}`);
  }
}

/**
 * setup() — idempotent setup for the engram backend:
 *   1. Ensure .engram → .memory symlink (delegates to ensureMemorySymlink).
 *   2. Register the merge driver for .memory/manifest.json (ADR-0002).
 *
 * Called by bootstrap.sh §7 via: node brain/scripts/memory/cli.mjs setup
 */
export async function setup() {
  // 1. Ensure symlink .engram → .memory using the hardened helper.
  ensureMemorySymlink();

  // 2. Register merge driver for .memory/manifest.json.
  const result = spawnSync(
    "git",
    [
      "config",
      "merge.engram-manifest.driver",
      "node brain/scripts/merge-engram-manifest.mjs %O %A %B",
    ],
    { stdio: "inherit", cwd: repoRoot },
  );
  if (result.status !== 0) {
    throw new Error("Failed to register engram-manifest merge driver");
  }
  console.log("  ✓ merge driver engram-manifest registered");
}

// ---------------------------------------------------------------------------
// Internal helpers for feature verbs
// ---------------------------------------------------------------------------

/**
 * Read the current git branch name.
 * Returns 'unknown' on any failure (git absent, detached HEAD, etc.).
 *
 * Thin wrapper over the shared `lib/git-branch.mjs#currentBranch` primitive
 * (issue #138, design §1.2) — preserves this module's existing 'unknown'
 * contract on top of the de-duplicated detection logic. Note the observable
 * behavior change on detached HEAD: the old inline implementation returned
 * the literal `'HEAD'` string; this wrapper normalizes it to `'unknown'`
 * like every other failure case, via `currentBranch`'s `null` sentinel.
 *
 * @param {string} root  Repo root to run git in.
 * @param {{ _spawn?: Function }} [opts]  Injectable spawn seam for tests
 *   (forwarded to `currentBranch`); existing single-arg call sites are
 *   unaffected since this parameter defaults to `{}`.
 * @returns {string}
 */
export function _getGitBranch(root, opts = {}) {
  return currentBranch(root, opts) ?? "unknown";
}

/**
 * Best-effort enrichment: if the engram binary is available, search for
 * sdd/<feature>/apply-progress in the 'brain' project and fold any useful
 * text into empty frontmatter fields.
 *
 * NEVER throws. NEVER calls engram save or engram sync.
 * Wrapped in try/catch by the caller; also wrapped here for safety.
 *
 * @param {string} feature
 * @param {Record<string,*>} frontmatter  Mutated in place — only fills EMPTY fields.
 */
function _engramEnrich(feature, frontmatter) {
  try {
    const whichResult = spawnSync("which", ["engram"], { encoding: "utf8" });
    if (whichResult.status !== 0) return;

    const searchResult = spawnSync(
      "engram",
      [
        "search",
        `sdd/${feature}/apply-progress`,
        "--project",
        "brain",
        "--limit",
        "1",
      ],
      { encoding: "utf8", timeout: 5000 },
    );

    if (searchResult.status !== 0 || !searchResult.stdout?.trim()) return;

    // The search output is human-readable text (not JSON).
    // Only enrich fields that are still the skeleton defaults (empty / placeholder).
    // We intentionally keep this minimal: the agent is expected to keep resume.md
    // current; enrichment is a last-resort convenience, not a required data source.
    const text = searchResult.stdout;

    if (
      (!frontmatter.next_action ||
        frontmatter.next_action ===
          "Update this skeleton with the current state") &&
      text.includes("next_action")
    ) {
      // Leave as skeleton; the obs text is structured but too complex to parse
      // here without risking corruption. The agent should update manually.
    }
  } catch {
    // Enrichment is best-effort — never fatal.
  }
}

// ---------------------------------------------------------------------------
// featureCheckpoint — dehydrate the in-flight state to resume.md (REQ-S2-1)
// ---------------------------------------------------------------------------

/**
 * Stamp the current state into openspec/changes/<feature>/resume.md.
 *
 * REQ-E-1 contract (enforced here):
 *   The CORE WRITE (writeFileSync) is a pure filesystem operation.
 *   The only external calls permitted are:
 *     (a) git rev-parse for the branch name (getBranch injectable, guarded).
 *     (b) The _doEngramEnrich helper — a best-effort try/catch block that reads
 *         the engram DB; it NEVER calls engram save or engram sync.
 *   Both (a) and (b) are injectable so tests can replace them with no-ops,
 *   making it trivially verifiable that the core write has zero engram dependency.
 *
 * @param {string|undefined} feature       Explicit feature name (from argv) or undefined.
 * @param {object} [opts]                  Injectable seams for testing.
 * @param {string} [opts.root]             Repo root override.
 * @param {() => string} [opts.getTimestamp]  Returns current UTC ISO-8601 string.
 * @param {() => string} [opts.getHostname]   Returns hostname string.
 * @param {(root: string) => string} [opts.getBranch]  Returns current branch name.
 * @param {(feature: string, fm: object) => void} [opts._doEngramEnrich]
 *   Best-effort enrichment function — injected as no-op in tests.
 */
export async function featureCheckpoint(
  feature,
  {
    root = repoRoot,
    getTimestamp = () => new Date().toISOString(),
    getHostname = () => osHostname(),
    getBranch = _getGitBranch,
    _doEngramEnrich = _engramEnrich,
  } = {},
) {
  // 1. Resolve feature — never throws from featureCheckpoint (pre-push safety).
  let resolvedFeature;
  try {
    resolvedFeature = resolveFeature(root, feature);
  } catch (err) {
    console.warn(`  ℹ memory: ${err.message} — skipping checkpoint`);
    return; // exit 0: must never break the pre-push hook
  }
  if (!resolvedFeature) {
    console.warn("  ℹ memory: no active feature found — skipping checkpoint");
    return;
  }

  const targetDir = join(root, changeDir(resolvedFeature));
  const rp = join(targetDir, OPERATIONAL_ARTIFACTS[0]);

  // 2. Read existing resume.md or build a minimal skeleton.
  let frontmatter = {};
  let body = "";
  try {
    const existing = readFileSync(rp, "utf8");
    const parsed = parseFrontmatter(existing);
    if (parsed.frontmatter) {
      frontmatter = { ...parsed.frontmatter };
      body = parsed.body;
    } else {
      // File exists but has no parseable frontmatter — treat content as body only.
      body = existing;
    }
  } catch {
    // File absent — create skeleton with required fields.
    frontmatter = {
      feature: resolvedFeature,
      current_slice: "unknown",
      next_action: "Update this skeleton with the current state",
      blockers: [],
    };
  }

  // 3. Ensure required fields exist (guards against partially-written files).
  if (!frontmatter.feature) frontmatter.feature = resolvedFeature;
  if (frontmatter.current_slice == null) frontmatter.current_slice = "unknown";
  if (frontmatter.next_action == null)
    frontmatter.next_action = "Update this file with the current state";
  if (!Array.isArray(frontmatter.blockers)) frontmatter.blockers = [];

  // 3.5. Branch-scope guard (#102). On the AUTOMATIC path (no explicit feature —
  //      i.e. the pre-push hook fires on every push), do NOT churn the active
  //      feature's resume.md when the current branch is unrelated to it. The
  //      feature's branch is the one recorded in `checkpointed_from`
  //      (host/branch); a mismatch means this push belongs to other work, so we
  //      skip without writing. An explicit feature arg always proceeds — the
  //      caller asked to checkpoint THIS feature regardless of branch. A feature
  //      with no prior checkpointed_from (first checkpoint) also proceeds and
  //      establishes its branch.
  const explicit = feature !== undefined && feature !== null && feature !== "";
  if (!explicit && frontmatter.checkpointed_from) {
    const recordedBranch = String(frontmatter.checkpointed_from)
      .split("/")
      .slice(1)
      .join("/");
    const currentBranch = getBranch(root);
    if (recordedBranch && currentBranch && recordedBranch !== currentBranch) {
      console.warn(
        `  ℹ memory: branch '${currentBranch}' ≠ feature '${resolvedFeature}' branch '${recordedBranch}' — skipping checkpoint (unrelated push)`,
      );
      return;
    }
  }

  // 4. Re-stamp provenance fields.
  frontmatter.checkpointed_at = getTimestamp();
  frontmatter.checkpointed_from = `${getHostname()}/${getBranch(root)}`;

  // 5. Best-effort engram enrichment (NEVER fatal, NEVER a prerequisite).
  //    Wrapped in its own try/catch in addition to being injectable.
  try {
    _doEngramEnrich(resolvedFeature, frontmatter);
  } catch {
    // Enrichment failed — proceed to core write regardless.
  }

  // 6. Validate (NEVER fatal — warn only).
  try {
    validateResume(frontmatter);
  } catch (err) {
    console.warn(`  ⚠ resume.md validation warning: ${err.message}`);
  }

  // 7. CORE WRITE — pure filesystem; no engram save, no engram sync, no child
  //    process.  This is the REQ-E-1 invariant line.
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(rp, serializeFrontmatter(frontmatter, body));
  console.log(`  ✓ resume.md checkpointed for ${resolvedFeature}`);
}

// ---------------------------------------------------------------------------
// featureResume — hydrate openspec/changes/<feature>/*.md into local engram
// ---------------------------------------------------------------------------

/**
 * Project all .md files in openspec/changes/<feature>/ into the LOCAL engram
 * under the distinct project namespace 'brain-feature-<feature>'.
 *
 * This namespace separation ensures that a subsequent `memory:share`
 * (= engram sync --export, which defaults to the 'brain' project) does NOT
 * pick up these observations and write them to .memory/ — keeping feature
 * obs out of the durable committed store.
 *
 * CONFIRMED (task 2.1): engram sync --export is project-scoped by default,
 * so observations saved under 'brain-feature-*' will not appear in .memory/.
 *
 * @param {string|undefined} feature  Explicit feature name or undefined.
 * @param {object} [opts]             Injectable seams for testing.
 * @param {string} [opts.root]        Repo root override.
 * @param {() => boolean} [opts._checkEngram]  Returns true if engram binary is available.
 * @param {(title, content, opts) => void} [opts._engramSave]
 *   Called once per .md file. Default: real execFileSync('engram', ['save', ...]).
 */
export async function featureResume(
  feature,
  {
    root = repoRoot,
    _checkEngram = _defaultCheckEngram,
    _engramSave = _defaultEngramSave,
  } = {},
) {
  // 1. Resolve feature — featureResume DOES propagate errors (ambiguous → cli exits 1).
  const resolvedFeature = resolveFeature(root, feature);
  if (!resolvedFeature) {
    console.log("  ℹ memory: no active feature found");
    return;
  }

  const targetDir = join(root, changeDir(resolvedFeature));
  const rp = join(targetDir, OPERATIONAL_ARTIFACTS[0]);

  // 2. If resume.md is absent → informational message, exit 0.
  if (!existsSync(rp)) {
    console.log(`  ℹ memory: no resume point for ${resolvedFeature}`);
    return;
  }

  // 3. Parse frontmatter for the summary print.
  const resumeContent = readFileSync(rp, "utf8");
  const { frontmatter } = parseFrontmatter(resumeContent);
  if (frontmatter) {
    console.log(`\n  Feature:      ${resolvedFeature}`);
    console.log(`  Slice:        ${frontmatter.current_slice ?? "unknown"}`);
    console.log(`  Next action:  ${frontmatter.next_action ?? "(not set)"}`);
    const blockers = frontmatter.blockers;
    if (Array.isArray(blockers) && blockers.length > 0) {
      console.log("  Blockers:");
      for (const b of blockers) {
        console.log(`    - ${b}`);
      }
    }
  }

  // 4. Check engram availability.
  const engramAvailable = _checkEngram();
  if (!engramAvailable) {
    // Degrade: print resume.md content directly; no engram save.
    console.log("\n--- resume.md ---\n");
    console.log(resumeContent);
    return;
  }

  // 5. Project each .md file into engram under 'brain-feature-<feature>'.
  //    Modeled on brain-to-engram.mjs — one save per file, topic as upsert key.
  //    The distinct project namespace keeps these obs out of memory:share exports.
  const featureProject = `brain-feature-${resolvedFeature}`;
  let files;
  try {
    files = readdirSync(targetDir).filter((f) => f.endsWith(".md"));
  } catch {
    console.warn(`  ⚠ could not read change dir: ${targetDir}`);
    return;
  }

  for (const filename of files) {
    const filePath = join(targetDir, filename);
    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      console.warn(`  ⚠ could not read ${filename} — skipping`);
      continue;
    }

    const stem = basename(filename, ".md");
    const topic = `sdd/${resolvedFeature}/${stem}`;
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : stem;

    try {
      _engramSave(title, content, {
        type: "reference",
        project: featureProject,
        topic,
      });
      console.log(
        `  ✓ ${filename} → engram [reference] topic=${topic} project=${featureProject}`,
      );
    } catch (err) {
      console.warn(`  ⚠ ${filename}: ${String(err.message).trim()}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Default injectable implementations
// ---------------------------------------------------------------------------

function _defaultCheckEngram() {
  const r = spawnSync("which", ["engram"], { encoding: "utf8" });
  return r.status === 0;
}

// NOTE (C4 review): `engram save` accepts --type/--project/--scope/--topic but
// has NO timestamp flag, so it cannot carry a record's original `ts` — every
// hydrated observation is re-stamped with engram's wall-clock insert time. The
// committed `records/` keeps the correct `ts` (source of truth); only engram's
// rebuildable local cache loses original recency ordering on pull. Preserving
// created_at would need an engram-side ingestion verb (tracked as a follow-up).
/**
 * Reads back the topic keys engram already holds, via ONE `engram export`.
 *
 * Measured at 0.67s for 2248 observations — cheap enough to run every time,
 * which is what makes the delta possible without brain keeping a watermark of
 * its own (a second source of truth that could drift from the store).
 *
 * ── Whose cost this is ──────────────────────────────────────────────────────
 *
 * `engram export` takes no project filter, so the read covers the WHOLE LOCAL
 * STORE. That is a mechanical fact and it is why the cost is what it is.
 *
 * What is NOT true — an earlier version of this comment said it — is that the
 * cost therefore belongs to somebody else. Re-measured against the live store:
 * 2698 observations across 7 projects, of which brain is **2450, or 90.8%**. So
 * this cost tracks brain's OWN record growth, near enough that treating it as
 * external would be self-deception. (The earlier note also quoted "1596 across
 * 6 projects" one paragraph below "2248 observations" — two figures that cannot
 * both describe the same store. Both are gone.)
 *
 * The key set IS a shared namespace, and that part stands: 547 of the 2577
 * distinct topic keys are semantic keys written by `mem_save` (`skill-registry`,
 * `sdd-init/…`), not record ids. Reading them is safe — brain ids are
 * `rec-<16 hex>` with the project inside the hash (format.mjs), so no foreign
 * key can collide with one — but the set being global is worth knowing.
 *
 * ── Why this validates instead of coercing ──────────────────────────────────
 *
 * `parsed?.observations ?? []` used to sit here, under a docstring promising the
 * reader never returns an empty Set on failure. It could not honour that: any
 * file that parses as JSON but carries no `observations` array yielded an empty
 * Set, which importMemory reads as "the store is genuinely empty" and answers
 * with a full re-import — the permanent duplication the fail-closed path exists
 * to prevent.
 *
 * And the two states cannot be told apart by shape, because a genuinely empty
 * store exports `"observations": null` (measured, engram v1.17.0):
 *
 *     { "version": "0.1.0", "sessions": null, "observations": null, … }
 *
 * So `null` is legitimately empty and must import everything. The dangerous case
 * is a schema this reader was not written against.
 *
 * The cross-check is engram's own count, printed on STDOUT (`Observations: N`)
 * and previously discarded by `stdio: [_, "ignore", _]`. Comparing it against
 * what was parsed catches a moved schema without a version allowlist — which
 * would go stale on the next engram release and fail closed for no reason.
 *
 * @returns {Set<string>}  The keys, or THROWS if the state could not be read.
 *   Never an empty Set on failure: importMemory must be able to tell "the store
 *   is empty" from "the store could not be read", because its policy on the
 *   first is to import everything.
 */
/**
 * Turns a failed `engram` invocation into ONE readable line.
 *
 * engram writes an update banner to stderr on every run —
 *
 *     Update available: 1.17.0 -> 1.20.0
 *     To update:
 *       brew update && brew upgrade engram
 *       …
 *     engram: pragma "PRAGMA journal_mode = WAL": unable to open database file
 *
 * — so the raw stderr is a five-line blob with the actual cause LAST, and it
 * gets interpolated mid-sentence into a one-line template. Prefer the binary's
 * own `engram:`-prefixed diagnostics; failing that, the last non-empty line;
 * failing that, whatever the Error carries.
 *
 * @param {unknown} err
 * @returns {string}
 */
function explainEngramFailure(err) {
  const lines = String(err?.stderr ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const diagnostics = lines.filter((l) => l.startsWith("engram:"));
  return (
    diagnostics.join(" ") ||
    lines[lines.length - 1] ||
    err?.message ||
    String(err)
  );
}

/**
 * The validation half of `_defaultExistingTopicKeys`, as a PURE function.
 *
 * Split out because the guard was unreachable from the suite: every test injects
 * `_engramExistingTopicKeys`, so the default reader — the only place the
 * cross-check lived — was never executed. Measured: neutralising the comparison
 * to `if (false && …)` left the whole suite at **2416/2416 green**. The
 * schema-drift proof existed, but as a MANUAL act, not a regression guard.
 *
 * That is the same defect this file's own history is about. #445 shipped a
 * docstring promising "never an empty Set on failure" that the code could not
 * keep; shipping the guard against that class with nothing pinning it would
 * repeat the shape one layer up. An absent assertion and a vacuous one fail
 * identically.
 *
 * @param {string} stdout        What `engram export` printed (carries `Observations: N`).
 * @param {string} fileContents  The exported JSON.
 * @returns {Set<string>}  Topic keys. THROWS if the export cannot be confirmed
 *   complete — never an empty Set on failure.
 */
export function topicKeysFromExport(stdout, fileContents) {
  const parsed = JSON.parse(fileContents);

  const observations = parsed?.observations;
  if (observations != null && !Array.isArray(observations)) {
    throw new Error(
      `engram export: 'observations' is ${typeof observations}, not an array — ` +
      `this reader was not written against export schema ${parsed?.version ?? "(no version)"}`,
    );
  }
  // `null` is the LEGITIMATELY EMPTY store — measured, engram v1.17.0 exports
  // `"observations": null` when it holds nothing. It must yield an empty Set so
  // first-ever hydration still imports everything.
  const rows = observations ?? [];

  // engram reports what it wrote. If that disagrees with what we parsed, the
  // file is not what the binary thinks it exported, and an empty `rows` here
  // would become "the store is empty" — the exact conflation being guarded.
  const reported = /^\s*Observations:\s*(\d+)\s*$/m.exec(stdout);
  if (!reported) {
    throw new Error(
      "engram export: no observation count on stdout — the export cannot be confirmed complete",
    );
  }
  if (Number(reported[1]) !== rows.length) {
    throw new Error(
      `engram export: reported ${reported[1]} observations but the file carries ${rows.length} — the read is incomplete`,
    );
  }

  const keys = new Set();
  for (const o of rows) {
    if (o?.topic_key) keys.add(o.topic_key);
  }
  return keys;
}

function _defaultExistingTopicKeys() {
  const dir = mkdtempSync(join(tmpdir(), "brain-engram-state-"));
  const file = join(dir, "state.json");
  try {
    const stdout = execFileSync("engram", ["export", file], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    return topicKeysFromExport(stdout, readFileSync(file, "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Writes every pending observation with ONE `engram import`.
 *
 * Replaces the per-record `engram save` loop that made #433: 1722 records ×
 * one execFileSync each measured at 1053 seconds, paid synchronously by
 * session:start AND by the post-merge hook on every `git pull`.
 *
 * ── An UNSTATED behaviour change, recorded because it is one ────────────────
 *
 * `engram import` is ALL-OR-NOTHING. Measured: a payload whose second
 * observation has an unresolvable `session_id` fails the whole call —
 *
 *   engram: import observation 0: constraint failed: FOREIGN KEY constraint failed
 *   exit=1        store unchanged — the VALID observation did not land either
 *
 * — while that same valid observation imports fine on its own.
 *
 * The old per-record loop imported records 1..k-1 and died at k, leaving a
 * partial hydration. This one imports zero. That is arguably the better
 * behaviour (no half-state to reason about, and the retry is a clean re-run),
 * but it is a change and it was not declared.
 *
 * Note also that engram reports the failing row as `observation 0` when the
 * offender was observation 1. That is engram's bug, not brain's; it is written
 * down here so whoever debugs a failed import does not trust the index.
 *
 * @param {object} payload  As built by buildImportPayload.
 */
function _defaultEngramImport(payload) {
  const dir = mkdtempSync(join(tmpdir(), "brain-engram-import-"));
  const file = join(dir, "payload.json");
  try {
    writeFileSync(file, JSON.stringify(payload));
    execFileSync("engram", ["import", file], { stdio: ["ignore", "ignore", "pipe"] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function _defaultEngramSave(title, content, { type, project, scope, topic }) {
  execFileSync(
    "engram",
    [
      "save", title, content,
      "--type", type,
      "--project", project,
      ...(scope ? ["--scope", scope] : []),
      "--topic", topic,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}
