// mode.mjs — REQ-H1-7: mode is derived from repo state, NEVER declared (R6,
// protocol §H1; design.md §4). Pure over { labels, changedFiles } — the two
// ONLY derivation inputs; the implementer never declares the mode by any
// other in-tree marker.
//
// H1-2c wires only the `tranche` branch end-to-end in cli.mjs. `ruling` and
// `checkpoint` modes are still derived correctly here (this module is the
// full REQ-H1-7 contract), but their evaluators land in H1-3/H1-4 — cli.mjs
// treats them as explicit not-yet-implemented stubs.

const CHECKPOINT_REPORT_RE = /(^|\/)checkpoint-report\.md$/;

/**
 * @param {{ labels?: string[], changedFiles?: string[] }} [input]
 * @returns {'ruling'|'checkpoint'|'tranche'}
 */
export function deriveMode({ labels = [], changedFiles = [] } = {}) {
  if (labels.includes('needs-ruling')) return 'ruling';
  if (changedFiles.some(f => CHECKPOINT_REPORT_RE.test(f))) return 'checkpoint';
  return 'tranche';
}
