// install-provenance.mjs — where THIS consumer's brain actually came from.
//
// WHY THIS EXISTS. `resolveInstallSpec` used to answer "registry or git?" from
// the installed package's own `name`: scoped ⇒ registry. That reads a property
// of the PACKAGE as if it were a fact about the CONSUMER. The two differ exactly
// where it matters — a consumer who installed from a git URL because they cannot
// reach the registry still has a scoped name on disk, so every `brain:upgrade`
// sent them to the registry and died there. ADR-0030's invariant list forbids
// that outcome by name: *"Never document the registry as the only way in … the
// git URL is the fallback for anyone who cannot reach the registry."*
//
// Provenance is recorded by npm in the hidden lockfile it writes beside the tree
// it installed, which is the only artifact that knows the answer.
//
// CLASSIFY, NEVER COPY. `resolved` is not a reusable install spec, and using it
// as one breaks the case this module exists to protect. Measured on real
// installs: asking npm for `git+https://…#v7.0.1` records
// `git+ssh://git@…#e0976457…` — the protocol REWRITTEN (ssh, for a consumer who
// may well have no key: the very "HTTPS-only consumers (CI, containers without
// an SSH key)" that `brain-upgrade.mjs` names) and the tag replaced by a commit
// SHA. So this module answers WHICH KIND of source, and the caller keeps
// building the spec from the manifest's `repository.url` and the requested tag.
//
// It deliberately imports NOTHING from `installer.mjs`: the search paths arrive
// as an argument. A cycle between the two would be avoidable-by-accident today
// and load-order-dependent later, and this module is genuinely about lockfiles,
// not about brain's own layout.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** npm's hidden lockfile — written beside the tree it describes, npm >= 7. */
export const HIDDEN_LOCKFILE = join('node_modules', '.package-lock.json');

/**
 * The kind of source an npm `resolved` value names.
 *
 * `git+…`, `ssh://` and `git://` are git. `file:` is a local tarball or link.
 * A plain `https://` is read as a registry tarball — which is what npm writes
 * for a `name@version` install, and is ALSO what it writes for a remote tarball
 * URL. Those two are genuinely indistinguishable here, and the ambiguity is
 * survivable rather than silent: a wrong guess produces a spec that fails to
 * install, and the caller's git fallback catches it.
 *
 * @param {unknown} resolved
 * @returns {'registry'|'git'|'file'|null}
 */
export function classifyResolved(resolved) {
  if (typeof resolved !== 'string') return null;
  const r = resolved.trim();
  if (!r) return null;
  if (/^(git\+|git:\/\/|ssh:\/\/)/.test(r)) return 'git';
  if (/^file:/.test(r)) return 'file';
  if (/^https?:\/\//.test(r)) return 'registry';
  return null;
}

/**
 * Pure core: reads the provenance of the package at one of `searchPaths` out of
 * an already-parsed hidden-lockfile document.
 *
 * Answers `unknown` with a REASON rather than a bare null, so a caller can say
 * why it is about to guess. "Could not read" and "read, and it says registry"
 * must never look the same — the `evidence-reader-empty-on-failure` shape
 * ADR-0030 Amendment 1 forbids for exactly this surface.
 *
 * @param {object}   o
 * @param {any}      o.doc          parsed `.package-lock.json`
 * @param {string[]} o.searchPaths  node_modules-relative dirs, in probe order —
 *                                  pass `installedPackageSearchPaths()` so this
 *                                  answers about the package the upgrade will use
 * @returns {{source:'registry'|'git'|'file'|'unknown', resolved:string|null, why:string}}
 */
export function evaluateProvenance({ doc, searchPaths = [] } = {}) {
  const unknown = (why) => ({ source: 'unknown', resolved: null, why });

  if (!Array.isArray(searchPaths) || searchPaths.length === 0) {
    return unknown('no package location was given to look up — the caller must pass its search paths.');
  }

  const packages = doc && typeof doc === 'object' ? doc.packages : null;
  if (!packages || typeof packages !== 'object') {
    return unknown(`${HIDDEN_LOCKFILE} has no \`packages\` map — not a lockfile this reader understands.`);
  }

  for (const dir of searchPaths) {
    const entry = packages[dir];
    if (!entry || typeof entry !== 'object') continue;
    // A `link: true` entry points elsewhere (workspace or file link) and carries
    // no install source of its own.
    if (entry.link === true) {
      return unknown(`${dir} is a link in ${HIDDEN_LOCKFILE} — its origin is the link target, not an install source.`);
    }
    const source = classifyResolved(entry.resolved);
    if (source === null) {
      return unknown(
        `${dir} is in ${HIDDEN_LOCKFILE} with no recognisable \`resolved\` (${JSON.stringify(entry.resolved ?? null)}).`,
      );
    }
    const resolved = entry.resolved.trim();
    return { source, resolved, why: `${dir} was installed from ${source} (${resolved}).` };
  }

  return unknown(`none of ${searchPaths.join(', ')} appears in ${HIDDEN_LOCKFILE}.`);
}

/**
 * Reads the consumer's install provenance from disk.
 *
 * Every failure is a STATED `unknown`, never a throw and never a silent default:
 * the hidden lockfile is npm-only, and brain supports pnpm, yarn and bun
 * (`lib/pm.mjs`), so "no provenance available" is an ordinary, expected answer
 * for a supported consumer rather than an error. The caller keeps its
 * pre-existing behaviour in that case and says that it guessed.
 *
 * @param {object}   o
 * @param {string}   o.repoRoot
 * @param {string[]} o.searchPaths
 * @param {Function} [o.readFile]  injectable for tests
 * @param {Function} [o.exists]    injectable for tests
 * @returns {{source:'registry'|'git'|'file'|'unknown', resolved:string|null, why:string}}
 */
export function readInstallProvenance({
  repoRoot,
  searchPaths = [],
  readFile = (p) => readFileSync(p, 'utf8'),
  exists = existsSync,
} = {}) {
  const lockPath = join(repoRoot, HIDDEN_LOCKFILE);
  if (!exists(lockPath)) {
    return {
      source: 'unknown',
      resolved: null,
      why: `${HIDDEN_LOCKFILE} is absent — it is written by npm >= 7, and this consumer may use pnpm, yarn or bun.`,
    };
  }
  let doc;
  try {
    doc = JSON.parse(readFile(lockPath));
  } catch (e) {
    return { source: 'unknown', resolved: null, why: `${HIDDEN_LOCKFILE} could not be parsed (${e.message}).` };
  }
  return evaluateProvenance({ doc, searchPaths });
}
