#!/usr/bin/env node
// brain/scripts/memory/backends/engram.mjs — engram backend for the MEMORY_BACKEND dispatcher.
//
// Encapsulates all engram-specific operations. Exported functions are called by
// brain/scripts/memory/cli.mjs; no caller should invoke the `engram` binary directly.
//
// Operations:
//   share()              — export live memory to .memory/ (engram sync)
//   pull()               — import .memory/ into engram    (engram sync --import)
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
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { hostname as osHostname } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveFeature } from "../lib/feature-resolution.mjs";
import { parseFrontmatter, serializeFrontmatter } from "../lib/resume-frontmatter.mjs";
import { validateResume } from "../lib/resume-schema.mjs";
import { currentBranch } from "../../lib/git-branch.mjs";
import { resolveSecretConfig, compilePatterns, scrubChunkFile, scanTextForSecrets } from "../lib/secret-scrub.mjs";
import { exportObservation } from "../lib/engram-export.mjs";
import { appendRecord, rebuildIndex, readRecordIds } from "../lib/store.mjs";
import { serializeRecord } from "../lib/format.mjs";
import { collectChunkObservations } from "../lib/migrate-v1.mjs";
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
 * @param {(root: string) => string[]} [opts._changedChunkFiles]  Chunk files materialized this run.
 * @param {(root: string) => object} [opts._loadConfig]  Reads brain.config.json.
 * @param {(path: string, patterns: RegExp[], allowPatterns: RegExp[]) => object|null} [opts._scrubChunk]
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
} = {}) {
  const engram = _requireEngram();
  _export(engram);
  await scrubMaterializedChunks(root, { _changedChunkFiles, _loadConfig, _scrubChunk });
  // Dual-write is DORMANT by default (design.md Decision 1 + 5). It runs ONLY when
  // `memory.dualWrite === true` in brain.config.json — the auditable cutover STATE
  // MARKER the human commits as step 2 of the C2b-2 runbook, IMMEDIATELY after the real
  // migrate. Absent/false → C1b behavior (export + chunk scrub only), so merging C2b-1
  // (or C2b-2, which un-refuses the CLI) never populates `records/` ahead of the
  // migrate's abort-if-populated guard. This is a committed state marker, NOT the
  // ad-hoc CLI bypass switch rejected in C2-migrate (C1b doctrine: gates live in
  // auditable config). Transitional — retired when the chunks are (C3/C4).
  if (_loadConfig(root)?.memory?.dualWrite === true) {
    await dualWriteRecords(root, { _readObservations, _exportObservation, _appendRecord, _rebuildIndex, _loadConfig });
  }
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
 *   skippedPersonal: number, unparseableChunks: number, emptyObservationsChunks: number,
 *   indexCount?: number}>}
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
    candidates.push(result.record);
  }

  const accounting = {
    written: 0,
    deduped: 0,
    errored,
    rejected,
    skippedPersonal,
    unparseableChunks: unparseable.length,
    emptyObservationsChunks: emptyObservations.length,
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
  if (toAppend.length > 0) {
    const { count } = _rebuildIndex({ recordsDir, indexPath });
    accounting.indexCount = count;
  }
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
 * Default seam: the `.memory/chunks/*.jsonl.gz` files `git status` reports as
 * changed (new or modified) after `engram sync --export` ran. Chunks are
 * content-addressed, so an untouched chunk never appears here — this is the
 * "materialized THIS run" boundary the scrubber respects (never the whole store).
 *
 * Excludes porcelain DELETIONS (cutover finding 7, id:388): once chunks moved
 * to `legacy/`, `git status --porcelain` on `.memory/chunks` reports deletion
 * lines (` D`, `D `, `AD`, …) whose path still ends in `.jsonl.gz`. Left
 * unfiltered, a deletion would pass the suffix-only filter and `scrubChunkFile`
 * would `readFileSync` a path that no longer exists → ENOENT. A status code
 * containing `D` in either column is a deletion and is dropped before the
 * suffix filter runs.
 *
 * @param {string} root
 * @returns {string[]}  Absolute paths.
 */
export function _defaultChangedChunkFiles(root, { _spawn = spawnSync } = {}) {
  const r = _spawn("git", ["status", "--porcelain", "--", ".memory/chunks"], {
    encoding: "utf8",
    cwd: root,
  });
  // Fail CLOSED on any git failure (binary absent, not a repo, or the common
  // safe.directory "dubious ownership" → status 128 with empty stdout). A silent
  // [] here would scan ZERO chunks and let a secret through — the one path that
  // must never fail open in a fail-closed slice (matches the r.status guard in
  // _defaultIsManifestDirty / _defaultRestoreManifest).
  if (r.error || r.status !== 0) {
    throw new Error(
      `secret-scrub: 'git status' failed — cannot determine which chunks were materialized this run; refusing to share (fail closed): ${r.stderr || r.error || `exit ${r.status}`}`
    );
  }
  return (r.stdout ?? "")
    .split("\n")
    .filter((line) => line.length > 3 && !line.slice(0, 2).includes("D"))
    .map((line) => line.slice(3).trim())
    .filter((p) => p.endsWith(".jsonl.gz"))
    .map((p) => join(root, p));
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
 * importMemory() — import .memory/ chunks into local engram (engram sync --import).
 *
 * This is the import-only step, with no git pull. Use it when the working tree
 * is already up-to-date (e.g. after day-start's step-2 git merge, or in the
 * post-merge hook where git itself has already integrated the new commits).
 *
 * Called by:
 *   - pullMemory() as its default _import seam
 *   - cli.mjs "import" verb (import-only, no manifest restore, no git pull)
 *   - post-merge hook (via cli.mjs import)
 *   - day-start step 5 (via cli.mjs import, after step 2 already pulled)
 */
export async function importMemory() {
  const engram = requireEngram();
  execFileSync(engram, ["sync", "--import"], { stdio: "inherit" });
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
 *   3. Calls importMemory() to hydrate local engram from the merged .memory/.
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

  // Step 3: hydrate local engram from the newly merged .memory/.
  await _import();
}

/**
 * pull() — import .memory/ into engram using the churn-resilient safe pull.
 * Replaces the former thin `engram sync --import` wrapper.
 * Called by brain/scripts/memory/cli.mjs when op = "pull".
 */
export async function pull() {
  await pullMemory();
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

  const changeDir = join(root, "openspec", "changes", resolvedFeature);
  const rp = join(changeDir, "resume.md");

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
  mkdirSync(changeDir, { recursive: true });
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

  const changeDir = join(root, "openspec", "changes", resolvedFeature);
  const rp = join(changeDir, "resume.md");

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
    files = readdirSync(changeDir).filter((f) => f.endsWith(".md"));
  } catch {
    console.warn(`  ⚠ could not read change dir: ${changeDir}`);
    return;
  }

  for (const filename of files) {
    const filePath = join(changeDir, filename);
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

function _defaultEngramSave(title, content, { type, project, topic }) {
  execFileSync(
    "engram",
    ["save", title, content, "--type", type, "--project", project, "--topic", topic],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}
