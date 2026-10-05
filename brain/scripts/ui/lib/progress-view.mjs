// progress-view.mjs — how far along a change is, in words (#1199 R1199-3/R1199-4).
// Pure, imported by the browser AND by node:test. One function, so the card, the
// SDD view and the drawer cannot word the same count three ways, and every count
// names where it was read: the snapshot reads the working tree, the drawer reads HEAD.

export const SOURCE = { workingTree: 'working tree', head: 'at HEAD' };

/** One sentence per failure code. `missing`, `unreadable` and `no-items` come from the snapshot, `truncated` from the drawer. */
export const PROGRESS_WORDS = {
  missing: 'no tasks.md',
  unreadable: 'tasks.md could not be read',
  'no-items': 'tasks.md has no checklist items',
  truncated: 'tasks.md is truncated; no total is shown',
};

const NO_PROGRESS = 'no progress was read';

/**
 * progressLabel(progress, source, {prefix}) -> string
 *
 * With `prefix: 'tasks'`: "tasks 3 / 5 · working tree" or "tasks: <words> · working tree".
 * Without: "2 / 5 tasks done · at HEAD" or "<words> · at HEAD". A failure never prints a number.
 */
export function progressLabel(progress, source, { prefix = null } = {}) {
  if (progress?.ok === true) {
    const { done, total } = progress.value;
    return `${prefix ? `${prefix} ${done} / ${total}` : `${done} / ${total} tasks done`} · ${source}`;
  }
  const words = progress ? PROGRESS_WORDS[progress.code] ?? progress.reason : NO_PROGRESS;
  return `${prefix ? `${prefix}: ${words}` : words} · ${source}`;
}
