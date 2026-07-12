#!/usr/bin/env node
// brain/scripts/memory/backends/plainfiles.mjs — the `plainfiles` backend for
// the MEMORY_BACKEND dispatcher (C3, issue #246). `.memory/records/*.jsonl`
// IS the store — git is the only writer, zero non-Node binaries required.
// Mirrors engram.mjs's conventions: every op is async, every external
// dependency is an injectable seam. Full rationale: openspec/changes/
// issue-246-c3/design.md. Q1 asymmetry (obs #578): save/search/share/pull/
// setup are real here; index/featureCheckpoint/featureResume defer loudly.

import { mkdirSync, readFileSync } from "node:fs";
import { hostname as osHostname } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

import { _getGitBranch } from "./engram.mjs";
import { buildRecord, serializeRecord, nowUtcSeconds } from "../lib/format.mjs";
import { appendRecord, rebuildIndex, readRecordObservations } from "../lib/store.mjs";
import { resolveSecretConfig, compilePatterns, scanTextForSecrets } from "../lib/secret-scrub.mjs";
import { unsupportedOp } from "../lib/unsupported-op.mjs";
import { t } from "../../i18n/t.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * The door-typed `actorKind` for every `save()` record (obs #578): records
 * the entry DOOR (cli save is agent-by-construction), never a caller input —
 * spoof-resistant since it can never be overridden. See the doc-scan
 * tripwire test if a human-authored save path ever emerges.
 */
export const PLAINFILES_ACTOR_KIND = "agent";

/** Reads brain.config.json for governance.memorySecret* keys. Never throws. */
function _defaultLoadBrainConfig(root) {
  try {
    return JSON.parse(readFileSync(join(root, "brain.config.json"), "utf8"));
  } catch {
    return {};
  }
}

/**
 * save() — scan-then-write: appends one validated record to
 * `.memory/records/<yyyy-mm>.jsonl` with MEASURED, never-flagged provenance
 * (REQ-C3-2). Mirrors `_defaultEngramSave`'s arg shape; `scope`/`topic` are
 * accepted for shape parity but not persisted (no home in the record
 * format, C0/C1). No `actor`/`actorKind`/`ts` field accepted anywhere:
 * `actor` ← getBranch seam, `actorKind` ← PLAINFILES_ACTOR_KIND,
 * `ts` ← getTimestamp seam (C2a canonical, never `new Date()` directly).
 * Order mirrors dualWriteRecords: scan for secrets BEFORE any write.
 *
 * @param {string} title
 * @param {string} content
 * @param {{type: string, project: string, scope?: string, topic?: string}} [opts]
 * @param {object} [seams]  root, getBranch, getTimestamp, getHostname, _appendRecord, _rebuildIndex, _loadConfig
 * @returns {Promise<{id: string, file: string, written: boolean}>}
 */
export async function save(
  title,
  content,
  // scope/topic accepted for _defaultEngramSave arg-shape parity — the record
  // format has no home for them (out of scope for C3), so they are ignored
  // LOUDLY (a console.warn naming them, never a silent drop) rather than
  // erroring (an error would break the arg-shape parity the mirror exists for).
  { type, project, scope, topic } = {},
  {
    root = repoRoot,
    getBranch = _getGitBranch,
    getTimestamp = nowUtcSeconds,
    getHostname = () => osHostname(),
    _appendRecord = appendRecord,
    _rebuildIndex = rebuildIndex,
    _loadConfig = _defaultLoadBrainConfig,
  } = {},
) {
  const ignoredOpts = [scope && "scope", topic && "topic"].filter(Boolean);
  if (ignoredOpts.length > 0) {
    console.warn(await t("memory.save.plainfilesIgnoredOpts", { opts: ignoredOpts.join(", ") }));
  }

  const ts = getTimestamp();
  const actor = getBranch(root);
  const actorKind = PLAINFILES_ACTOR_KIND;
  const source = `plainfiles save on ${getHostname()}`;

  const candidate = buildRecord({ ts, actor, actorKind, type, project, content, title, source });

  const { patternSources, allowPatternSources } = resolveSecretConfig(_loadConfig(root));
  const patterns = compilePatterns(patternSources);
  const allowPatterns = compilePatterns(allowPatternSources);
  const hit = scanTextForSecrets(serializeRecord(candidate), patterns, allowPatterns);
  if (hit) {
    throw new Error(
      await t("memory.plainfiles.save.secretFound", { line: hit.lineNumber, pattern: hit.pattern }),
    );
  }

  const recordsDir = join(root, ".memory", "records");
  const indexPath = join(root, ".memory", "index.jsonl");

  const { file } = _appendRecord(candidate, { recordsDir });
  _rebuildIndex({ recordsDir, indexPath });

  return { id: candidate.id, file, written: true };
}

/** Default seam: `which rg` — never throws. */
function _defaultWhich(bin) {
  const r = spawnSync("which", [bin], { encoding: "utf8" });
  return r.status === 0;
}

/** Default seam: best-effort `rg` accelerant — output never determines the result (see search()). */
function _defaultRg(query, { root, mode }) {
  try {
    const recordsDir = join(root, ".memory", "records");
    const args = mode === "regex" ? ["-i", query, recordsDir] : ["-i", "-F", query, recordsDir];
    spawnSync("rg", args, { encoding: "utf8" });
  } catch {
    /* best-effort accelerant — never fatal */
  }
}

/** Case-insensitive substring (default) or regex (`mode: 'regex'`) predicate over content/type. */
function _buildPredicate(query, mode) {
  if (mode === "regex") {
    const re = new RegExp(query, "i");
    return (record) => re.test(record.content ?? "") || re.test(record.type ?? "");
  }
  const q = String(query).toLowerCase();
  return (record) =>
    (record.content ?? "").toLowerCase().includes(q) || (record.type ?? "").toLowerCase().includes(q);
}

/**
 * search() — zero-binary Node scan over `.memory/records/` (REQ-C3-3).
 * `rg` is an OPTIONAL accelerant gated on `which rg`; the final match set is
 * ALWAYS produced by the same Node predicate over the same observation set —
 * rg's presence changes speed, never output.
 *
 * @param {string} query
 * @param {{root?: string, mode?: 'substring'|'regex'}} [opts]
 * @param {object} [seams]  _which, _rg, _readRecordObservations
 * @returns {Promise<{matches: object[]}>}
 */
export async function search(
  query,
  { root = repoRoot, mode = "substring" } = {},
  { _which = _defaultWhich, _rg = _defaultRg, _readRecordObservations = readRecordObservations } = {},
) {
  const recordsDir = join(root, ".memory", "records");
  const observations = _readRecordObservations({ recordsDir });

  if (_which("rg")) {
    try {
      _rg(query, { root, mode });
    } catch {
      /* best-effort accelerant — never fatal, never changes the result below */
    }
  }

  const predicate = _buildPredicate(query, mode);
  return { matches: observations.filter(predicate) };
}

/**
 * share() — a self-check `rebuildIndex()` ONLY (REQ-C3-4). Records already
 * ARE the store, so no data movement whatsoever.
 */
export async function share({ root = repoRoot } = {}, { _rebuildIndex = rebuildIndex } = {}) {
  const recordsDir = join(root, ".memory", "records");
  const indexPath = join(root, ".memory", "index.jsonl");
  const { count } = _rebuildIndex({ recordsDir, indexPath });
  return { indexCount: count };
}

/** Default seam: `git pull` — throws on non-zero exit (mirrors engram.mjs's `_defaultGitPull`). */
function _defaultGitPull(root) {
  execFileSync("git", ["pull"], { stdio: "inherit", cwd: root });
}

/**
 * pull() — `git pull` then `rebuildIndex()`, records-only (REQ-C3-4). NO
 * manifest-dirty-discard, NO importMemory step: plainfiles never
 * materializes anything, git is the only writer, so a dirty tree is real
 * work and MUST NOT be auto-discarded — `_gitPull`'s error propagates
 * unmodified through this rejection into cli.mjs's existing catch-and-exit-1.
 */
export async function pull({ root = repoRoot } = {}, { _gitPull = _defaultGitPull, _rebuildIndex = rebuildIndex } = {}) {
  _gitPull(root); // throws unmodified on a dirty/conflicting tree — never auto-discarded
  const recordsDir = join(root, ".memory", "records");
  const indexPath = join(root, ".memory", "index.jsonl");
  const { count } = _rebuildIndex({ recordsDir, indexPath });
  return { indexCount: count };
}

/**
 * setup() — deliberately MINIMAL (design Decision 1): ensures
 * `.memory/records/` exists + `rebuildIndex()` self-check. NO `.engram`
 * symlink (ADR-0002 is engram-only), NO merge-driver registration (backend-
 * agnostic, owned by the record format).
 */
export async function setup({ root = repoRoot } = {}, { _rebuildIndex = rebuildIndex } = {}) {
  const recordsDir = join(root, ".memory", "records");
  const indexPath = join(root, ".memory", "index.jsonl");
  mkdirSync(recordsDir, { recursive: true });
  _rebuildIndex({ recordsDir, indexPath });
}

// ---------------------------------------------------------------------------
// Deferred ops (REQ-C3-5) — no plainfiles-native projection target. Each
// defers loudly via the shared unsupportedOp helper — never a silent no-op.
// ---------------------------------------------------------------------------

export async function index() {
  await unsupportedOp("index", "plainfiles");
}

export async function featureCheckpoint() {
  await unsupportedOp("featureCheckpoint", "plainfiles");
}

export async function featureResume() {
  await unsupportedOp("featureResume", "plainfiles");
}
