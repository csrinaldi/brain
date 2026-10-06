// brain/scripts/axes/lib/stage-output.mjs — the output contract every review engine shares (#1129).
//
// Before this module, codex redacted over the full text, stripped control bytes and capped
// the tail at 4 KiB, gemini redacted only, and claude not at all; `validateOutput`,
// `canonicalPath` and `isWithin` existed in three copies that disagreed. This is the one
// copy of each. It names no provider: an engine passes its own name where a message needs one.

import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const CONTROL_BYTES = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

/**
 * The tail of an engine's output, safe for a failure `reason`:
 * stderr (else stdout), redacted over the FULL text, control bytes removed, the last
 * 4 KiB kept, the last two lines joined, the last `max` characters kept.
 *
 * Redaction runs on the full text first: truncating first would cut a secret that
 * straddles the window and leave its suffix unmatched (#1274).
 *
 * @param {{stderr?: unknown, stdout?: unknown}} result
 * @param {Array<string|undefined|null>} secrets
 * @returns {string} ` — the engine last said: <text>`, or `''`.
 */
export function engineTail(result, secrets, { max = 300, cap = 4096 } = {}) {
  const raw = String(result?.stderr ?? '').trim() || String(result?.stdout ?? '').trim();
  if (!raw) return '';
  let safe = raw;
  for (const secret of secrets ?? []) {
    if (typeof secret === 'string' && secret.length > 0) safe = safe.split(secret).join('[redacted]');
  }
  safe = safe.replace(CONTROL_BYTES, '').slice(-cap).trim();
  if (!safe) return '';
  const last = safe.split('\n').filter(Boolean).slice(-2).join(' / ');
  return ` — the engine last said: ${last.length > max ? `…${last.slice(-max)}` : last}`;
}

/** The non-empty values of `names` in `env`: what an adapter passes to `engineTail` as secrets. */
export function secretValues(env, names) {
  return (names ?? []).map((name) => env?.[name]).filter((v) => typeof v === 'string' && v !== '');
}

/** `path` with its deepest EXISTING ancestor resolved through symlinks and the rest appended. */
export function canonicalPath(path) {
  const unresolved = [];
  let current = resolve(path);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    unresolved.unshift(relative(parent, current));
    current = parent;
  }
  const base = existsSync(current) ? realpathSync(current) : current;
  return resolve(base, ...unresolved);
}

/** Whether `child` is `parent` or inside it. A child named `..x` is inside; `../x` is not. */
export function isWithin(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

const label = (engine) => (typeof engine === 'string' && engine !== '' ? engine[0].toUpperCase() + engine.slice(1) : 'engine');

/**
 * The host-owned final-message descriptor check, shared by every `final-message` engine.
 * @returns {string|null} a refusal reason, or null when the descriptor is sound.
 */
export function validateFinalMessageOutput(output, cwd, { engine } = {}) {
  const name = label(engine);
  if (output?.mode !== 'final-message' || typeof output.tempPath !== 'string' || typeof output.artifactPath !== 'string') {
    return `the ${name} transport needs a host-owned final-message output descriptor`;
  }
  if (!isAbsolute(output.tempPath) || !isAbsolute(output.artifactPath)) {
    return 'the host-owned final-message paths must be absolute';
  }
  let candidate;
  let tempPath;
  let artifactPath;
  try {
    candidate = canonicalPath(cwd);
    tempPath = canonicalPath(output.tempPath);
    artifactPath = canonicalPath(output.artifactPath);
  } catch (err) {
    return `the host-owned final-message path cannot be resolved safely — ${err?.message ?? String(err)}`;
  }
  if (isWithin(candidate, tempPath) || isWithin(candidate, artifactPath)) {
    return 'the host-owned final-message output must be outside the candidate';
  }
  if (tempPath === artifactPath) return `the ${name} temporary output and final artifact paths must differ`;
  return null;
}
