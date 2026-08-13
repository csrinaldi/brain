// sdd-layout.mjs — the single source of truth for the canonical openspec/changes/**
// layout (issue #250, slice B0). Pure ESM, no side effects at import, fs-injectable
// (mirrors vcs/phase-order-check.mjs's DI discipline: every I/O op is injectable,
// real fs only as the default). B0 ships this accessor; B1 wires the six measured
// call sites onto it (see openspec/changes/issue-250-b0/tasks.md — B1 worklist).

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';



/**
 * The file each tier-table artefact name resolves to (#555).
 *
 * NOT a suffix rule. `verification` is `verify-report.md` — the sdd-verify
 * convention `phase-order-check.mjs` has always probed. The first cut of #555
 * derived filenames by appending `.md`, which produced `verification.md`: a file
 * this repository writes nowhere. A `regulated` change carrying all five REAL
 * artefacts then passed `phase-order` and failed `check-refs` — #555's own
 * complaint, relocated from `lite` to `regulated`.
 *
 * The mapping used to exist twice — here as a suffix, and in `phase-order-check`'s
 * `buildChangeDir` as explicit probes — and they disagreed. This is the one copy.
 * `phase-order`'s missing-artefact MESSAGE reads from it too: that message carried
 * the same defect before #555 touched anything, naming `verification.md` for a
 * probe of `verify-report.md`.
 */
export const ARTEFACT_FILE = Object.freeze({
  proposal: 'proposal.md',
  spec: 'spec.md',
  design: 'design.md',
  tasks: 'tasks.md',
  verification: 'verify-report.md',
});

/**
 * Bare artefact names → the files they are written as. Refuses an unknown name
 * rather than guessing, because guessing is exactly what produced the blocker:
 * a name with no file behind it is a config error, and inventing one hides it
 * until a consumer at that tier cannot satisfy a gate it has already satisfied.
 *
 * @param {string[]} names
 * @returns {string[]}
 */
export function artefactFiles(names) {
  return names.map((name) => {
    const file = ARTEFACT_FILE[name];
    if (!file) {
      throw new Error(
        `sdd-layout: unknown artefact name "${name}" — no file is declared for it in ARTEFACT_FILE. ` +
        'Appending ".md" would invent a path no gate probes (#555).',
      );
    }
    return file;
  });
}

/**
 * The SCAFFOLD set: what `brain:project:feature` writes into a new change dir.
 * Four, at every tier.
 *
 * This is NOT what the gates demand — that is tier-scoped, `requiredArtifactsFor`
 * (governance-tiers.mjs). REQ-L4-2′ draws the line in as many words: "the tier
 * scopes what the GATE demands, never what the SCAFFOLD produces." #555's first
 * cut deleted this constant while fixing the gate question, collapsing two things
 * the spec deliberately separates.
 */
export const REQUIRED_ARTIFACTS = Object.freeze(artefactFiles(['proposal', 'spec', 'design', 'tasks']));

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
 * The missing artifacts for `changeId`, against the set PASSED IN. Grandfathered dirs
 * short-circuit to `[]` — "the past is recorded, not edited." The spec slot
 * delegates to `hasSpec` so a nested spec still counts as present.
 * @returns {string[]}
 */
export function missingRequiredArtifacts(
  changeId,
  { artefacts, exists = defaultExists, listDir = defaultListDir } = {},
) {
  // #555: the required set is RECEIVED, never held here. `requiredArtifactsFor`
  // (governance-tiers.mjs) resolves it from the declared tier; this module keeps
  // no list of its own, so there is exactly one in the system and no second copy
  // to drift. `artefacts` is mandatory on purpose — a default would be that
  // second list wearing a different name.
  if (!Array.isArray(artefacts)) {
    throw new TypeError(
      'missingRequiredArtifacts: `artefacts` is required — pass requiredArtifactsFor(tier). ' +
      'A default here would reintroduce the two-set divergence #555 removed.',
    );
  }
  if (isGrandfathered(changeId)) return [];
  const dir = changeDir(changeId);
  const missing = [];
  for (const artifact of artefacts) {
    const present = artifact === 'spec.md' ? hasSpec(changeId, { exists, listDir }) : exists(`${dir}/${artifact}`);
    if (!present) missing.push(artifact);
  }
  return missing;
}
