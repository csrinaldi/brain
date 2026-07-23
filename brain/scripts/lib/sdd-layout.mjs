// sdd-layout.mjs — the single source of truth for the canonical openspec/changes/**
// layout (issue #250, slice B0). Pure ESM, no side effects at import, fs-injectable
// (mirrors vcs/phase-order-check.mjs's DI discipline: every I/O op is injectable,
// real fs only as the default). B0 ships this accessor; B1 wires the six measured
// call sites onto it (see openspec/changes/issue-250-b0/tasks.md — B1 worklist).

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** The four artifacts a NEW change dir carries at its root (flat). Source of truth. */
export const REQUIRED_ARTIFACTS = Object.freeze(['proposal.md', 'spec.md', 'design.md', 'tasks.md']);

/** Machine-written, never required, staleness expected & discardable. NEVER a gate condition. */
export const OPERATIONAL_ARTIFACTS = Object.freeze(['resume.md']);

/** Root under which all in-flight change dirs live (POSIX-relative). */
export const CHANGES_ROOT = 'openspec/changes';

// Grandfather = past only. This list is sealed at B0; adding an entry requires
// ADR-level justification — a NEW change dir must never appear here.
/** EXACTLY the 12 legacy dirs measured at B0 (#584) that lack a flat spec.md. CLOSED AND FROZEN. */
export const LEGACY_GRANDFATHERED = Object.freeze([
  'installer-versionado', 'vcs-adapter', 'cli-i18n',
  'feature-working-memory', 'auto-adrs', 'governance',
  'managed-paths-namespace', 'issue-138-session-start',
  'issue-144-governance-v3', 'install-home-scaffold',
  'issue-193-ci-context-design', 'issue-196-ci-context-impl',
]);

/** `openspec/changes/<changeId>` (POSIX-relative). */
export function changeDir(changeId) {
  return `${CHANGES_ROOT}/${changeId}`;
}

/** The four scaffolded artifact paths under `changeDir(changeId)`. */
export function artifactPaths(changeId) {
  const dir = changeDir(changeId);
  return {
    proposal: `${dir}/proposal.md`,
    spec: `${dir}/spec.md`,
    design: `${dir}/design.md`,
    tasks: `${dir}/tasks.md`,
  };
}

/** `openspec/changes/archive/<iid>` — the accessor OWNS this location (design §5). */
export function archivePath(iid) {
  return `${CHANGES_ROOT}/archive/${iid}`;
}

const CHANGE_ID_RE = /^issue-(\d+)(?:-(.+))?$/;

/**
 * Parses `issue-<N>-<slug>` (or the bare `issue-<N>` violation shape).
 * @returns {{iid: string, slug: string|null}|null}
 */
export function parseChangeId(name) {
  const m = typeof name === 'string' ? name.match(CHANGE_ID_RE) : null;
  if (!m) return null;
  return { iid: m[1], slug: m[2] ?? null };
}

/** True when `changeId` is one of the sealed 12 legacy dirs. */
export function isGrandfathered(changeId) {
  return LEGACY_GRANDFATHERED.includes(changeId);
}

function defaultExists(relPath) {
  return existsSync(join(process.cwd(), relPath));
}

function defaultListDir(relPath) {
  return readdirSync(join(process.cwd(), relPath));
}

/**
 * True when `changeId` has a spec artifact under EITHER convention: flat
 * `spec.md` (canonical for new changes) OR nested `specs/*\/spec.md`
 * (LEGACY-ACCEPTED — readers tolerate it, the scaffold never produces it).
 * The ONE place the nested variant is tolerated (Pin 1).
 */
export function hasSpec(changeId, { exists = defaultExists, listDir = defaultListDir } = {}) {
  const dir = changeDir(changeId);
  if (exists(`${dir}/spec.md`)) return true;
  const specsDir = `${dir}/specs`;
  if (!exists(specsDir)) return false;
  let entries;
  try {
    entries = listDir(specsDir);
  } catch {
    return false;
  }
  return entries.some(name => exists(`${specsDir}/${name}/spec.md`));
}

/**
 * The missing REQUIRED_ARTIFACTS for `changeId`. Grandfathered dirs
 * short-circuit to `[]` — "the past is recorded, not edited." The spec slot
 * delegates to `hasSpec` so a nested spec still counts as present.
 * @returns {string[]}
 */
export function missingRequiredArtifacts(changeId, { exists = defaultExists, listDir = defaultListDir } = {}) {
  if (isGrandfathered(changeId)) return [];
  const dir = changeDir(changeId);
  const missing = [];
  for (const artifact of REQUIRED_ARTIFACTS) {
    const present = artifact === 'spec.md' ? hasSpec(changeId, { exists, listDir }) : exists(`${dir}/${artifact}`);
    if (!present) missing.push(artifact);
  }
  return missing;
}
