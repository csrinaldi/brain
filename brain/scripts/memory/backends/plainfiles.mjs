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
import { buildRecord, serializeRecord, nowUtcSeconds, RECORD_TYPES } from "../lib/format.mjs";
import { appendRecord, rebuildIndex, readRecords } from "../lib/store.mjs";
import { normalizeDuplicates } from "../lib/duplicates.mjs";

/** The repository this record belongs to, from config, falling back to the checkout
 *  directory name. Records in this repo carry the bare name ("brain"), not the slug. */
function deriveProject(config, root) {
  const slug = config?.project?.slug;
  if (typeof slug === "string" && slug.trim() !== "") return slug.split("/").pop();
  const name = config?.project?.name;
  if (typeof name === "string" && name.trim() !== "") return name;
  return String(root).replace(/\/+$/, "").split("/").pop();
}
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
  { type, project, issue, scope, topic } = {},
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
  const config = _loadConfig(root);

  // DERIVE WHAT IS DERIVABLE, REFUSE WHAT IS A CHOICE (issue #530).
  //
  // Both fields are required by `buildRecord`, and omitting either used to reach
  // `computeRecordId` → `canonicalJson`, which threw
  // `unsupported value type 'undefined'` — a message naming neither the field nor
  // the flag. `memory save "t" "c"`, the most obvious invocation of the capture
  // path, failed that way.
  //
  // `project` is derivable: it is this repository, and the config already says
  // which. Refusing it would be asking the caller to retype something the tool
  // knows. `type` is a CHOICE among seven, and defaulting it would put a
  // fabricated meaning on a durable record — so it is refused, by name, with the
  // list. The asymmetry is the point: derive facts, never opinions.
  const resolvedProject = project ?? deriveProject(config, root);
  if (!type) {
    throw new Error(await t("memory.plainfiles.save.typeRequired", { types: RECORD_TYPES.join(", ") }));
  }
  // `validateWritableRecord`'s W2 already says "issue must be an integer" — and it is
  // UNREACHABLE for a non-numeric one, because `computeRecordId` hashes the field and
  // `canonicalJson` throws on NaN first. So `--issue abc` failed closed with
  // "non-finite numbers are not supported": correct direction, useless message, and a
  // rule that reads as enforced while the path never arrives. Refused here, by name.
  if (issue !== undefined && issue !== null && !Number.isInteger(issue)) {
    throw new Error(await t("memory.plainfiles.save.issueInvalid", { value: String(issue) }));
  }

  const candidate = buildRecord({ ts, actor, actorKind, type, project: resolvedProject, issue, content, title, source });

  const { patternSources, allowPatternSources } = resolveSecretConfig(config);
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
  const reindex = _rebuildIndex({ recordsDir, indexPath });

  // #574: every op that reindexes carries the duplicate accounting out to the
  // CLI, which prints it. `save` included — it is the verb most likely to be
  // the first thing run after a `git pull` that union-merged a duplicate in.
  // `indexCount` travels too, so the report can state the store/index gap
  // rather than making the reader compute it.
  return {
    id: candidate.id,
    file,
    written: true,
    indexCount: reindex?.count,
    duplicates: normalizeDuplicates(reindex?.duplicates),
  };
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
 * Reads through `readRecords` (#574): a duplicated physical line used to come
 * back as two identical hits, and the count printed by cli.mjs was the store's
 * line count, not its record count. The repeats are collapsed AND reported —
 * search is not exempt from the rule just because it writes nothing.
 *
 * @param {string} query
 * @param {{root?: string, mode?: 'substring'|'regex'}} [opts]
 * @param {object} [seams]  _which, _rg, _readRecords
 * @returns {Promise<{matches: object[], duplicates: object}>}
 */
export async function search(
  query,
  { root = repoRoot, mode = "substring" } = {},
  { _which = _defaultWhich, _rg = _defaultRg, _readRecords = readRecords } = {},
) {
  const recordsDir = join(root, ".memory", "records");
  const { records: observations, duplicates } = _readRecords({ recordsDir });

  if (_which("rg")) {
    try {
      _rg(query, { root, mode });
    } catch {
      /* best-effort accelerant — never fatal, never changes the result below */
    }
  }

  const predicate = _buildPredicate(query, mode);
  return { matches: observations.filter(predicate), duplicates: normalizeDuplicates(duplicates) };
}

/**
 * share() — a self-check `rebuildIndex()` ONLY (REQ-C3-4). Records already
 * ARE the store, so no data movement whatsoever.
 *
 * The self-check now has something to say (#574): `duplicates` travels out to
 * cli.mjs, which prints it. A `share` that silently indexes 139 fewer lines
 * than the store holds is not a self-check.
 */
export async function share({ root = repoRoot } = {}, { _rebuildIndex = rebuildIndex } = {}) {
  const recordsDir = join(root, ".memory", "records");
  const indexPath = join(root, ".memory", "index.jsonl");
  const { count, duplicates } = _rebuildIndex({ recordsDir, indexPath });
  return { indexCount: count, duplicates: normalizeDuplicates(duplicates) };
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
 *
 * This is the path #574's rule matters most on: the `git pull` immediately
 * above is where `merge=union` MINTS the duplicate, so the reindex right after
 * it is the first reader that can see it. It reports (or, on a disagreeing
 * pair, refuses) instead of absorbing it.
 */
export async function pull({ root = repoRoot } = {}, { _gitPull = _defaultGitPull, _rebuildIndex = rebuildIndex } = {}) {
  _gitPull(root); // throws unmodified on a dirty/conflicting tree — never auto-discarded
  const recordsDir = join(root, ".memory", "records");
  const indexPath = join(root, ".memory", "index.jsonl");
  const { count, duplicates } = _rebuildIndex({ recordsDir, indexPath });
  return { indexCount: count, duplicates: normalizeDuplicates(duplicates) };
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
  const reindex = _rebuildIndex({ recordsDir, indexPath });
  return { duplicates: normalizeDuplicates(reindex?.duplicates) };
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
