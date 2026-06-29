// branch-type.mjs — derive a conventional branch-type prefix from issue labels.
//
// This repo namespaces its labels (`type:bug`, `type:feature`, …), so the
// `type:` prefix is stripped before the lookup — otherwise no label ever matches
// and every ticket falls back to `feat/` regardless of its real type (#101).

const LABEL_TYPE = {
  feat: 'feat', feature: 'feat',
  fix: 'fix', bug: 'fix',
  chore: 'chore',
  docs: 'docs',
  refactor: 'refactor',
  ci: 'ci',
  build: 'build',
};

/**
 * Maps an issue's labels to a conventional branch-type prefix.
 * The `type:` namespace is stripped (so `type:bug` → `fix`); non-type labels
 * (`status:approved`, `good first issue`, …) simply don't match. The first
 * label that maps wins; falls back to `feat` when none do.
 *
 * @param {string[]} labels  Issue label names (namespaced or bare).
 * @returns {string} A branch-type prefix: feat | fix | chore | docs | refactor | ci | build.
 */
export function deriveBranchType(labels) {
  const list = Array.isArray(labels) ? labels : [];
  return (
    list
      .map((l) => LABEL_TYPE[String(l).toLowerCase().replace(/^type:/, '')])
      .find(Boolean) ?? 'feat'
  );
}
