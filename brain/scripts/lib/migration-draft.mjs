// migration-draft.mjs — issue #809: the `brain-migration/1` draft contract —
// parser, number proposal and splicer for config-migration promotion. Mirrors
// `amendment-draft.mjs`'s division of labour: everything here is PURE and
// refuses with a sentence; I/O, the plan, the typed confirmation and the git
// seam stay in `brain-promote.mjs`.
//
// THE CONTRACT IS JSON, NEVER JS (proposal D1). Nothing in a draft is ever
// eval'd: a fenced block that fails JSON.parse is refused, whatever it is.
// Declarative entries only — `migrate()` has existed for nine shipped
// versions and been used by zero, and an imperative body could not be
// validated without executing it; those entries remain genuine hand edits.

export const MIGRATION_CONTRACT_TAG = 'brain-migration/1';
export const MIGRATION_DRAFT_BASENAME_RE = /^config-migrations-(\d+\.\d+\.\d+)\.md$/;

const FENCE_RE = new RegExp('```' + MIGRATION_CONTRACT_TAG + '\\n([\\s\\S]*?)```', 'g');

/**
 * Exactly one fenced `brain-migration/1` block, JSON only.
 * @param {string} text
 * @returns {{entry: {version?: string, description: string, defaults: object}|null, refusal: string|null}}
 */
export function parseMigrationDraft(text) {
  const blocks = [...String(text ?? '').matchAll(FENCE_RE)].map((m) => m[1]);
  if (blocks.length !== 1) {
    return {
      entry: null,
      refusal: `migration-draft: expected exactly one \`${MIGRATION_CONTRACT_TAG}\` block, found ${blocks.length}.`,
    };
  }
  let entry;
  try {
    entry = JSON.parse(blocks[0]);
  } catch (err) {
    return { entry: null, refusal: `migration-draft: the block is not JSON (${err.message}). Nothing in a draft is ever eval'd — JS is refused, whatever it says.` };
  }
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return { entry: null, refusal: 'migration-draft: the block must be one JSON object.' };
  }
  if ('migrate' in entry) {
    return { entry: null, refusal: 'migration-draft: `migrate` entries are imperative and stay hand edits — this contract is declarative only (nine shipped versions, zero imperative uses).' };
  }
  if (typeof entry.description !== 'string' || entry.description.length === 0) {
    return { entry: null, refusal: 'migration-draft: `description` is required — a migration nobody can read the reason for is a hand grenade in every consumer upgrade.' };
  }
  if (entry.defaults === null || typeof entry.defaults !== 'object' || Array.isArray(entry.defaults)) {
    return { entry: null, refusal: 'migration-draft: `defaults` must be a plain object tree — the additive merge has no meaning for anything else.' };
  }
  return { entry, refusal: null };
}

const parseSemver = (v) => String(v).split('.').map(Number);
const gtSemver = (a, b) => {
  const [a1, a2, a3] = parseSemver(a); const [b1, b2, b3] = parseSemver(b);
  return a1 !== b1 ? a1 > b1 : a2 !== b2 ? a2 > b2 : a3 > b3;
};

/**
 * #806: the migration number is the package version — in practice the NEXT
 * one, above both the current package and the list tail (the #456 precedent:
 * 0.11.0 → 1.2.0 while package.json said 1.1.0). The draft's own number is
 * reported, never trusted: renumbering happens in the open, under the typed
 * confirmation.
 *
 * @param {{draftVersion: string, packageVersion: string, tailVersion: string, asOverride?: string}} args
 * @returns {{version: string|null, renumbered: boolean, refusal: string|null}}
 */
export function proposeVersion({ draftVersion, packageVersion, tailVersion, asOverride }) {
  const floor = gtSemver(packageVersion, tailVersion) ? packageVersion : tailVersion;
  if (asOverride !== undefined) {
    if (!gtSemver(asOverride, tailVersion)) {
      return { version: null, renumbered: false, refusal: `migration-draft: --as ${asOverride} is not above the tail ${tailVersion} — version numbers are content identifiers and monotonic-forever (the #231 doctrine note in config-migrations.mjs itself).` };
    }
    return { version: asOverride, renumbered: asOverride !== draftVersion, refusal: null };
  }
  const [maj, min] = parseSemver(floor);
  const version = `${maj}.${min + 1}.0`;
  return { version, renumbered: version !== draftVersion, refusal: null };
}

/** Serializes one entry as source in the shipped key order: version, description, defaults. */
function entrySource(entry, version) {
  const body = JSON.stringify({ version, description: entry.description, defaults: entry.defaults }, null, 2)
    .split('\n')
    .map((line, i, all) => (i === 0 || i === all.length - 1 ? line : `  ${line}`))
    .join('\n')
    .replace(/"([A-Za-z_$][A-Za-z0-9_$]*)":/g, '$1:')
    .replace(/"/g, "'");
  return `  ${body.replace(/^\{/, '{').replace(/\}$/, '}')},`;
}

/**
 * Appends the entry before the migrations array's closing bracket. Anchor
 * missing → refusal, never a guess: this splices ONE known file shape.
 *
 * @param {string} fileText
 * @param {{description: string, defaults: object}} entry
 * @param {string} version
 * @returns {{next: string|null, refusal: string|null}}
 */
export function spliceMigrationEntry(fileText, entry, version) {
  const open = fileText.indexOf('export const migrations = [');
  if (open === -1) {
    return { next: null, refusal: 'migration-draft: `export const migrations = [` not found — this splices one known file shape and refuses anything else.' };
  }
  const close = fileText.indexOf('\n];', open);
  if (close === -1) {
    return { next: null, refusal: 'migration-draft: the migrations array\'s closing `];` not found after its opening — refusing to guess an anchor.' };
  }
  const next = fileText.slice(0, close) + '\n' + entrySource(entry, version) + fileText.slice(close);
  return { next, refusal: null };
}
