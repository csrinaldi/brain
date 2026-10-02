// axis-config.mjs — the ONE reader and validator of an axis's configuration shape
// (ADR-0038, issue #1114 slice S3.1). PURE: no I/O, never throws.
//
// ADR-0038 gives every axis one shape in brain.config.json:
//
//   "<axis>": { "default": "<name>", "providers": { "<name>": { "version": "…" } } }
//
// over four axes: `vcs`, `memory`, `platform`, `sdd`. Until the S3 migrations
// run, a consumer's config still carries the LEGACY keys, so `readAxis` reads
// both: the new shape when present, otherwise the legacy keys as a READ-ONLY
// alias (`memory.backend`, `vcs.provider`, flat `platform`/`engine`/`harness`).
// This slice changes no behaviour: the resolvers keep their own precedence and
// defaults and only ask HERE for "what does the config say".
//
// Where a value is NOT enforced here: undeclared (`default: ''`) is a result, not
// an error. Refusing it is S2's job (`resolveAxis`), so `validateAxisConfig` is
// not wired into any runtime path yet.

/**
 * Closed memberships. They live HERE (re-exported by `harness/platform.mjs`, which
 * its importers keep using) because `platform.mjs` must read this module, and a
 * module cannot also be read by the one it reads without an ESM cycle.
 * `MEMORY_BACKENDS` stays in `memory/lib/backend-resolve.mjs`: the memory legacy
 * alias is a single key and needs no membership test.
 */
export const SDD_ENGINES = Object.freeze(['gentle-ai', 'plain']);
export const AGENT_PLATFORMS = Object.freeze(['claude', 'antigravity', 'plain']);

export const AXES = Object.freeze(['vcs', 'memory', 'platform', 'sdd']);

/**
 * Platform-provider capability facts, exactly ADR-0038 section 5's table:
 *   orchestrate   — may be `platform.default` (the one orchestrator per session);
 *   executeStage  — may be an `sdd.roles.<stage>.engine` (runs a stage prompt).
 *
 * THIS TABLE IS A SEAM. Each fact belongs to the provider's own adapter, and
 * #1128/#1129 move it there. Until then it is declared once, here, so the
 * validator has something to read and nothing else retypes it.
 */
export const PLATFORM_CAPABILITIES = Object.freeze({
  claude: Object.freeze({ orchestrate: true, executeStage: true }),
  antigravity: Object.freeze({ orchestrate: true, executeStage: false }), // until a stage-runtime adapter exists (#1128, #1129)
  plain: Object.freeze({ orchestrate: true, executeStage: false }), // the human orchestrator
  codex: Object.freeze({ orchestrate: false, executeStage: true }),
  gemini: Object.freeze({ orchestrate: false, executeStage: true }),
});

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k);
const str = (v) => (typeof v === 'string' ? v : '');
const nonEmpty = (v) => (typeof v === 'string' && v.trim() !== '' ? v : '');

/** The flat `harness` key, raw. Legacy (#643): a platform OR an engine name, whichever it is a member of. */
export function legacyHarness(config) {
  return config?.harness;
}

function legacyValue(config, axis, harness) {
  switch (axis) {
    case 'memory': return str(config?.memory?.backend);
    case 'vcs': return str(config?.vcs?.provider);
    case 'platform': {
      const flat = str(config?.platform);
      if (flat) return flat;
      const h = str(legacyHarness(config));
      return harness && AGENT_PLATFORMS.includes(h) ? h : '';
    }
    case 'sdd': {
      const flat = str(config?.engine);
      if (flat) return flat;
      const h = str(legacyHarness(config));
      return harness && SDD_ENGINES.includes(h) ? h : '';
    }
    default: return '';
  }
}

/**
 * @param {object} config  parsed brain.config.json (anything non-object reads as {})
 * @param {'vcs'|'memory'|'platform'|'sdd'} axis
 * @param {{harness?: boolean}} [opts]  `harness: false` leaves the legacy `harness`
 *   key out of the alias: a resolver whose precedence ranks `SDD_HARNESS`/`harness`
 *   BELOW other levels reads that key itself through `legacyHarness`.
 * @returns {{default: string, providers: object, source: 'shape'|'legacy'|'none', legacyShadowed?: true}}
 */
export function readAxis(config, axis, { harness = true } = {}) {
  const node = isObj(config) ? config[axis] : undefined;
  const legacy = legacyValue(isObj(config) ? config : {}, axis, harness);

  if (isObj(node) && (has(node, 'default') || has(node, 'providers'))) {
    // An UNDECLARED shape ("") does not shadow a legacy value written after the migration
    // (`brain:config set memory.backend x` still targets the legacy key until S2 retires it).
    if (str(node.default) === '' && legacy !== '') {
      const providers = isObj(node.providers) ? node.providers : {};
      return { default: legacy, providers: { ...providers, [legacy]: providers[legacy] ?? {} }, source: 'legacy' };
    }
    const out = {
      default: str(node.default),
      providers: isObj(node.providers) ? node.providers : {},
      source: 'shape',
    };
    if (legacy !== '') out.legacyShadowed = true;
    return out;
  }
  if (legacy !== '') return { default: legacy, providers: { [legacy]: {} }, source: 'legacy' };
  return { default: '', providers: {}, source: 'none' };
}

/**
 * Validates the ADR-0038 shape. Only the new shape is checked; a legacy config has
 * nothing to validate. Never throws.
 * @returns {{ok: boolean, errors: Array<{axis: string, path: string, code: string, message: string}>}}
 */
export function validateAxisConfig(config) {
  const errors = [];
  const err = (axis, path, code, message) => errors.push({ axis, path, code, message });
  try {
    const cfg = isObj(config) ? config : {};

    for (const axis of AXES) {
      const node = cfg[axis];
      if (!isObj(node)) continue;
      if (has(node, 'providers') && !isObj(node.providers)) {
        err(axis, `${axis}.providers`, 'providers-not-a-map', `${axis}.providers must be a map of provider name to its settings`);
      }
      if (has(node, 'providers') && !has(node, 'default')) {
        err(axis, `${axis}.default`, 'missing-default',
          `${axis} has providers but no default key — write "default": "" when the axis is undeclared`);
      }
      if (has(node, 'default') && typeof node.default !== 'string') {
        err(axis, `${axis}.default`, 'default-not-a-string', `${axis}.default must be a provider name ("" when undeclared)`);
      }
      const def = nonEmpty(node.default);
      if (def !== '' && !has(node.providers, def)) {
        err(axis, `${axis}.default`, 'default-not-in-providers',
          `${axis}.default is "${def}", which is not a key of ${axis}.providers`);
      }
    }

    const platformProviders = isObj(cfg.platform?.providers) ? cfg.platform.providers : {};
    const sddProviders = isObj(cfg.sdd?.providers) ? cfg.sdd.providers : {};

    const platformDefault = nonEmpty(cfg.platform?.default);
    if (platformDefault !== '' && PLATFORM_CAPABILITIES[platformDefault]?.orchestrate !== true) {
      err('platform', 'platform.default', 'default-cannot-orchestrate',
        `platform.default "${platformDefault}" does not declare orchestrate, so it cannot be the session's orchestrator`);
    }

    const roles = isObj(cfg.sdd?.roles) ? cfg.sdd.roles : {};
    for (const [stage, role] of Object.entries(roles)) {
      if (!isObj(role)) continue;
      const base = `sdd.roles.${stage}`;
      if (has(role, 'agent')) {
        const provider = str(role.agent).split(':')[0];
        if (!has(sddProviders, provider)) {
          err('sdd', `${base}.agent`, 'role-agent-provider-unknown',
            `${base}.agent "${str(role.agent)}" names SDD provider "${provider}", which is not a key of sdd.providers`);
        }
      }
      if (has(role, 'engine')) {
        const engine = str(role.engine);
        if (!has(platformProviders, engine)) {
          err('sdd', `${base}.engine`, 'role-engine-unknown',
            `${base}.engine "${engine}" is not a key of platform.providers`);
        } else if (PLATFORM_CAPABILITIES[engine]?.executeStage !== true) {
          err('sdd', `${base}.engine`, 'role-engine-cannot-execute',
            `${base}.engine "${engine}" cannot execute a stage prompt`);
        }
      }
    }
  } catch (e) { // surfaced: validation never throws; the failure is itself a reported error
    errors.push({ axis: '*', path: '', code: 'validator-failed', message: `axis config could not be validated: ${e?.message ?? e}` });
  }
  return { ok: errors.length === 0, errors };
}
