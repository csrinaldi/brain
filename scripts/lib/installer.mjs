// installer.mjs — Pure(ish) building blocks for the brain versioned installer.
//
// These functions implement the mechanics behind `brain:upgrade` and the
// `day:start` check-and-notify. They are deliberately small and side-effect
// free where possible so they can be unit-tested without a network or a real
// git remote (see installer.test.mjs).
//
// Contract (ADR-0003 / ADR-0006): the upgrade copies only the paths declared
// `managed` in brain/core/managed-paths.mjs and never touches `local` paths.
// Config migrations are additive: existing consumer values always win.

import {
  readdirSync,
  statSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
} from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';

// ── Glob matching ────────────────────────────────────────────────────────────
// Minimal glob → RegExp for the manifest syntax: `*` (no separator) and `**`
// (recursive). A trailing `/**` also matches the directory's own entries.

/**
 * Compiles a single glob pattern to a RegExp anchored at both ends.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**` → match anything (including separators). Swallow an optional
        // following slash so `a/**` matches `a/b` and `a/b/c`.
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        re += '[^/]*';
      }
    } else if ('\\^$.|?+()[]{}'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * Returns true if `relPath` (POSIX-style, repo-relative) matches any glob.
 * @param {string} relPath
 * @param {string[]} globs
 * @returns {boolean}
 */
export function matchesAny(relPath, globs) {
  return globs.some((g) => globToRegExp(g).test(relPath));
}

// ── File walking ─────────────────────────────────────────────────────────────

/**
 * Recursively lists files under `root`, returning POSIX-style relative paths.
 * Skips node_modules and the .git directory — neither is ever a managed path
 * and walking them would be slow and noisy.
 * @param {string} root
 * @returns {string[]}
 */
export function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        out.push(relative(root, abs).split(sep).join('/'));
      }
    }
  };
  walk(root);
  return out;
}

// ── Copy managed paths ─────────────────────────────────────────────────────────

/**
 * Copies every file under `srcRoot` whose relative path matches a `managed`
 * glob into `destRoot`, overwriting. A path that also matches a `local` glob is
 * skipped (local always wins) and reported under `skipped`.
 *
 * @param {object} opts
 * @param {string} opts.srcRoot  Installed brain package root.
 * @param {string} opts.destRoot Consumer repo root.
 * @param {string[]} opts.managed
 * @param {string[]} opts.local
 * @param {boolean} [opts.dryRun] When true, computes the plan without writing.
 * @returns {{ copied: string[], skipped: string[] }}
 */
export function copyManaged({ srcRoot, destRoot, managed, local, dryRun = false }) {
  const copied = [];
  const skipped = [];
  for (const rel of listFiles(srcRoot)) {
    if (!matchesAny(rel, managed)) continue;
    if (matchesAny(rel, local)) {
      // Overlap: local ownership wins. Never clobber the consumer.
      skipped.push(rel);
      continue;
    }
    if (!dryRun) {
      const dest = join(destRoot, rel);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(join(srcRoot, rel), dest);
    }
    copied.push(rel);
  }
  return { copied: copied.sort(), skipped: skipped.sort() };
}

// ── Config migration ─────────────────────────────────────────────────────────

/**
 * Deep-merges `defaults` into `existing`, preserving every value already
 * present in `existing`. Only missing keys are filled. Arrays and non-plain
 * values are treated as leaves (existing wins). Returns a new object.
 * @param {object} existing
 * @param {object} defaults
 * @returns {object}
 */
export function mergeDefaults(existing, defaults) {
  const isPlainObject = (v) =>
    v !== null && typeof v === 'object' && !Array.isArray(v);
  const out = { ...existing };
  for (const [key, defVal] of Object.entries(defaults)) {
    if (!(key in out)) {
      out[key] = defVal;
    } else if (isPlainObject(out[key]) && isPlainObject(defVal)) {
      out[key] = mergeDefaults(out[key], defVal);
    }
    // else: key exists with a leaf/array value — keep the consumer's value.
  }
  return out;
}

// ── Semver ───────────────────────────────────────────────────────────────────

/**
 * Parses a version string ("v0.1.0", "1.2.3") into [major, minor, patch].
 * Non-numeric or missing parts become 0. Pre-release suffixes are ignored.
 * @param {string} v
 * @returns {[number, number, number]}
 */
export function parseSemver(v) {
  const core = String(v ?? '').trim().replace(/^v/, '').split('-')[0];
  const [maj, min, pat] = core.split('.');
  return [Number(maj) || 0, Number(min) || 0, Number(pat) || 0];
}

/**
 * Compares two versions. Returns -1 if a < b, 0 if equal, 1 if a > b.
 * @param {string} a
 * @param {string} b
 * @returns {-1|0|1}
 */
export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/**
 * Applies every pending migration to a config object.
 *
 * "Pending" = migration.version > config.schemaVersion AND <= targetVersion.
 * Additive migrations (those with `defaults`) merge defaults without
 * overwriting existing values. Migrations with a `migrate` fn run it with the
 * { mergeDefaults } helper. The returned config carries the new schemaVersion.
 *
 * @param {object} config        The consumer's current brain.config.json.
 * @param {Array}  migrations    Ordered migration descriptors.
 * @param {string} targetVersion The brain version being installed.
 * @returns {{ config: object, applied: string[] }}
 */
export function migrateConfig(config, migrations, targetVersion) {
  const from = config.schemaVersion ?? '0.0.0';
  let result = { ...config };
  const applied = [];
  const ordered = [...migrations].sort((a, b) => compareSemver(a.version, b.version));
  for (const m of ordered) {
    const isAfterCurrent = compareSemver(m.version, from) > 0;
    const isWithinTarget = compareSemver(m.version, targetVersion) <= 0;
    if (!isAfterCurrent || !isWithinTarget) continue;
    if (typeof m.migrate === 'function') {
      result = m.migrate(result, { mergeDefaults });
    } else if (m.defaults) {
      result = mergeDefaults(result, m.defaults);
    }
    applied.push(m.version);
  }
  result.schemaVersion = compareSemver(targetVersion, result.schemaVersion ?? '0.0.0') > 0
    ? targetVersion
    : (result.schemaVersion ?? targetVersion);
  return { config: result, applied };
}

// ── Install URL resolution ─────────────────────────────────────────────────────

/**
 * Canonical HTTPS install URL for the brain package.
 * Used as a fallback when the installed package.json has no repository.url or
 * when that URL cannot be parsed.
 */
export const BRAIN_REPO_HTTPS = 'git+https://github.com/csrinaldi/brain.git';

/**
 * Normalizes any git repository URL to an npm-installable `git+https://` form.
 *
 * Accepted input forms and their canonical output:
 *   git+https://host/owner/repo.git  → as-is
 *   https://host/owner/repo.git      → prefix `git+`
 *   git+ssh://git@host/owner/repo.git → convert host and path to git+https
 *   git@host:owner/repo.git          → SCP form → convert to git+https
 *   github:owner/repo                → expand to git+https://github.com/…
 *
 * Null / empty input returns BRAIN_REPO_HTTPS (safe fallback).
 *
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function resolveInstallUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) return BRAIN_REPO_HTTPS;

  const u = url.trim();

  // Already the correct form.
  if (u.startsWith('git+https://')) {
    return u.endsWith('.git') ? u : `${u}.git`;
  }

  // Plain https — just prefix git+.
  if (u.startsWith('https://')) {
    return 'git+' + (u.endsWith('.git') ? u : `${u}.git`);
  }

  // github: shorthand — npm resolves this to SSH, which is the problem we're fixing.
  const githubShorthand = u.match(/^github:([^#]+)/);
  if (githubShorthand) {
    const path = githubShorthand[1].replace(/\.git$/, '');
    return `git+https://github.com/${path}.git`;
  }

  // git+ssh://git@host/owner/repo.git
  const gitSsh = u.match(/^git\+ssh:\/\/(?:[^@]+@)?([^/]+)\/(.+?)(?:\.git)?$/);
  if (gitSsh) {
    return `git+https://${gitSsh[1]}/${gitSsh[2]}.git`;
  }

  // git@host:owner/repo.git  (SCP shorthand)
  const scp = u.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (scp) {
    return `git+https://${scp[1]}/${scp[2]}.git`;
  }

  // Unknown form — ensure at least the git+ prefix.
  return u.startsWith('git+') ? u : `git+${u}`;
}

/**
 * Returns the full npm install specifier for brain at the given tag.
 *
 * Reads `repository.url` from the installed brain's `package.json` at
 * `<root>/node_modules/brain/package.json`, normalizes it with
 * `resolveInstallUrl`, and appends `#<tag>`.
 *
 * Falls back to `BRAIN_REPO_HTTPS#<tag>` when the file is absent,
 * unparseable, or the `repository.url` field is missing.
 *
 * The result is ALWAYS in the form `git+https://…#<tag>` — never SSH or
 * `github:` shorthand — so HTTPS-only consumers (CI, containers without
 * SSH keys) can install the private repo without extra setup.
 *
 * @param {string} root Consumer repo root (e.g. `process.cwd()`).
 * @param {string} tag  Git tag to install (e.g. `"v0.4.0"`).
 * @returns {string}
 */
export function installSpec(root, tag) {
  const pkgPath = join(root, 'node_modules', 'brain', 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const repoUrl = pkg?.repository?.url ?? (typeof pkg?.repository === 'string' ? pkg.repository : undefined);
    if (repoUrl && typeof repoUrl === 'string') {
      return `${resolveInstallUrl(repoUrl)}#${tag}`;
    }
  } catch {
    // File absent or unparseable — fall through to constant fallback.
  }
  return `${BRAIN_REPO_HTTPS}#${tag}`;
}

// ── Update check (for day:start) ───────────────────────────────────────────────

/**
 * Parses `git ls-remote --tags` output into the highest semver tag found.
 * Ignores peeled tag refs (`^{}`) and non-semver tags.
 * @param {string} lsRemoteStdout
 * @returns {string|null} The highest tag (e.g. "v1.2.0"), or null if none.
 */
export function highestTag(lsRemoteStdout) {
  const tags = [];
  for (const line of String(lsRemoteStdout).split('\n')) {
    const m = line.match(/refs\/tags\/(\S+)/);
    if (!m) continue;
    const tag = m[1];
    if (tag.endsWith('^{}')) continue;
    if (!/^v?\d+\.\d+\.\d+/.test(tag)) continue;
    tags.push(tag);
  }
  if (tags.length === 0) return null;
  return tags.sort(compareSemver).at(-1);
}

/**
 * Reads the installed brain version. In a consumer, that's the version field
 * of node_modules/brain/package.json. In the brain repo itself (self-host),
 * it's the repo's own package.json. Returns null if neither is found.
 * @param {string} repoRoot
 * @returns {string|null}
 */
export function readInstalledVersion(repoRoot) {
  const candidates = [
    join(repoRoot, 'node_modules', 'brain', 'package.json'),
    join(repoRoot, 'package.json'),
  ];
  for (const path of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(path, 'utf8'));
      if (pkg.name === 'brain' && pkg.version) return pkg.version;
    } catch {
      // try next candidate
    }
  }
  return null;
}
