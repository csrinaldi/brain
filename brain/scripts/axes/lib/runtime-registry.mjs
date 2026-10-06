// brain/scripts/axes/lib/runtime-registry.mjs — the runtime providers of the
// `platform` config axis (ADR-0038 section 5), discovered from their descriptors
// (issues #1128, #1129).
//
// Every `<name>.mjs` adapter under `axes/platform/adapters/` and
// `axes/review-engine/adapters/` ships one `<name>.descriptor.mjs`: an import-free
// leaf that declares what the runtime can do. This module lists those two
// directories, loads each descriptor, validates it and serves the result. It
// keeps NO list of names, so a third runtime is one adapter file, one descriptor
// and config.
//
// It is a LEAF: its static imports are `node:` builtins only, and descriptors
// import nothing. That is what makes the top-level await below safe — the #682
// deadlock was a cycle re-entered through a module suspended at its await, and
// this module closes no cycle (REQ-1128-5).

import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The two directories that make up the platform CONFIG axis (ADR-0038 section 5). */
export const RUNTIME_AXES = Object.freeze(['platform', 'review-engine']);

const DEFAULT_BASE = new URL('../', import.meta.url); // axes/

const OUTPUT_MODES = Object.freeze(['file', 'final-message']);
const MODEL_POLICIES = Object.freeze(['opaque', 'pinned', 'default']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Validate one descriptor against the D1 shape. Throws an Error naming `file`.
 *
 * @param {unknown} d
 * @param {string} file A label for the error message.
 * @param {string} basename The adapter name the file claims.
 */
export function validateDescriptor(d, file, basename) {
  const bad = (why) => { throw new Error(`${file}: ${why}`); };
  if (!isObj(d)) bad('DESCRIPTOR must be an object');
  if (d.name !== basename) bad(`name "${d.name}" must equal the file's basename "${basename}"`);
  if (d.rank !== undefined && !Number.isFinite(d.rank)) bad('rank, when present, must be a finite number');
  const c = d.capabilities;
  if (!isObj(c) || typeof c.orchestrate !== 'boolean' || typeof c.executeStage !== 'boolean') {
    bad('capabilities must be { orchestrate: boolean, executeStage: boolean }');
  }
  if (typeof d.readiness !== 'boolean') bad('readiness must be a boolean');
  if (c.executeStage && !isObj(d.stage)) bad('stage is required when executeStage is true');
  if (!c.executeStage && d.stage !== undefined) bad('stage is only allowed when executeStage is true');
  if (c.executeStage) {
    if (!OUTPUT_MODES.includes(d.stage.outputMode)) bad(`stage.outputMode must be one of ${OUTPUT_MODES.join(', ')}`);
    const m = d.stage.model;
    if (!isObj(m) || !MODEL_POLICIES.includes(m.policy)) bad(`stage.model.policy must be one of ${MODEL_POLICIES.join(', ')}`);
    const hasId = typeof m.id === 'string' && m.id !== '';
    if (m.policy === 'opaque' && m.id !== undefined) bad('stage.model.id must be absent for the opaque policy');
    if (m.policy !== 'opaque' && !hasId) bad(`stage.model.id is required for the ${m.policy} policy`);
  }
}

/** Adapter basenames in a directory: `<name>.mjs`, no further dot, not a test. */
function listDir(dirUrl) {
  const path = fileURLToPath(dirUrl);
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => f.slice(0, -'.mjs'.length))
    .filter((stem) => !stem.includes('.'))
    .sort();
}

/** Same files, descriptors only: `<name>.descriptor.mjs` stems. */
function listDescriptors(dirUrl) {
  const path = fileURLToPath(dirUrl);
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((f) => f.endsWith('.descriptor.mjs'))
    .map((f) => f.slice(0, -'.descriptor.mjs'.length))
    .sort();
}

const byRankThenName = (a, b) => {
  const ra = a.rank ?? Infinity;
  const rb = b.rank ?? Infinity;
  if (ra !== rb) return ra < rb ? -1 : 1;
  return a.name.localeCompare(b.name);
};

/**
 * Build a registry from the descriptors under `base`.
 *
 * @param {{ base?: URL }} [opts] `base` holds `platform/adapters/` and `review-engine/adapters/`.
 */
export async function loadRuntimeRegistry({ base = DEFAULT_BASE } = {}) {
  const found = new Map(); // name -> { descriptor, dir, label }
  const adapters = new Map(); // name -> label of the adapter file

  for (const axis of RUNTIME_AXES) {
    const dir = new URL(`${axis}/adapters/`, base);
    for (const name of listDir(dir)) {
      if (!adapters.has(name)) adapters.set(name, `${axis}/adapters/${name}.mjs`);
    }
    for (const name of listDescriptors(dir)) {
      const label = `${axis}/adapters/${name}.descriptor.mjs`;
      if (found.has(name)) {
        throw new Error(`duplicate descriptor for "${name}": ${found.get(name).label} and ${label}`);
      }
      const mod = await import(pathToFileURL(fileURLToPath(new URL(`${name}.descriptor.mjs`, dir))).href);
      validateDescriptor(mod.DESCRIPTOR, label, name);
      found.set(name, { descriptor: mod.DESCRIPTOR, dir, label });
    }
  }

  for (const [name, label] of adapters) {
    if (!found.has(name)) {
      throw new Error(`${label} has no descriptor: expected ${label.replace(/\.mjs$/, '.descriptor.mjs')} beside it`);
    }
  }

  const all = [...found.values()].map((x) => x.descriptor);
  const names = all.map((d) => d.name).sort((a, b) => a.localeCompare(b));
  const capabilities = {};
  for (const d of [...all].sort((a, b) => a.name.localeCompare(b.name))) {
    capabilities[d.name] = Object.freeze({ orchestrate: d.capabilities.orchestrate, executeStage: d.capabilities.executeStage });
  }
  const orchestrators = all.filter((d) => d.capabilities.orchestrate).sort(byRankThenName).map((d) => d.name);
  const stageRuntimes = all.filter((d) => d.capabilities.executeStage).sort(byRankThenName).map((d) => d.name);
  const dirs = {};
  for (const [name, x] of found) dirs[name] = x.dir;

  return Object.freeze({
    names: Object.freeze(names),
    capabilities: Object.freeze(capabilities),
    orchestrators: Object.freeze(orchestrators),
    stageRuntimes: Object.freeze(stageRuntimes),
    dirs: Object.freeze(dirs),
    descriptor: (name) => found.get(name)?.descriptor ?? null,
  });
}

/** The shipped tree's registry, loaded once at module evaluation. */
export const RUNTIME_REGISTRY = await loadRuntimeRegistry();
