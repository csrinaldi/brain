// tasks-list.mjs — the ONE checkbox grammar of `tasks.md` (R881-8 Tasks tab,
// #1199 R1199-1). Pure. It lives in `lib/` because the server's snapshot
// (`status/`) and the drawer (`ui/`) both read it, and `ui/lib/**` may import
// nothing outside itself; the browser never imports it.
//
// The grammar is `sdd-layout.md`'s "Checked-task pattern": `- [ ]` (open),
// `- [x]`/`- [X]` (done), matched case-insensitively and at any indent.

const CHECKBOX_RE = /^\s*- \[([ xX])\]\s*(.*)$/;
const NO_ITEMS = 'tasks.md has no checklist items';

/** taskItems(text) -> [{line, text, done}] — one entry per checkbox line, 1-based line numbers. */
export function taskItems(text) {
  const items = [];
  text.split(/\r\n|\n/).forEach((line, idx) => {
    const m = CHECKBOX_RE.exec(line);
    if (m) items.push({ line: idx + 1, text: m[2].trim(), done: m[1].toLowerCase() === 'x' });
  });
  return items;
}

/** countTasks(text) -> {ok:true, value:{done,total}} | {ok:false, code:'no-items', reason} — zero boxes is a reason, never 0/0 (R7). */
export function countTasks(text) {
  const items = taskItems(text);
  if (items.length === 0) return { ok: false, code: 'no-items', reason: NO_ITEMS };
  return { ok: true, value: { done: items.filter((i) => i.done).length, total: items.length } };
}

/**
 * parseTasksList({text, path, attribution}) -> {ok:true, value: Array<Item>} | {ok:false, reason}
 *
 * Item: {line, text, done, actor, ts, source:{path,line}}
 *
 * Per-line actor/timestamp is NOT in `tasks.md`'s text: the SERVER reads it via one
 * `git blame --porcelain` per drawer open (`blame.mjs` parses it) and hands this
 * function `{line, actor, ts}` rows. It never shells out; a line with no matching
 * row renders `actor: 'unknown'`, never a blank.
 *
 * @param {{text: string|null, path: string, attribution?: Array<{line:number,actor:string,ts:string}>}} input
 */
export function parseTasksList({ text, path, attribution = [] } = {}) {
  if (typeof text !== 'string') return { ok: false, reason: 'no tasks.md text was given' };

  const byLine = new Map(
    attribution.filter((a) => a && typeof a.line === 'number').map((a) => [a.line, a]),
  );

  const items = taskItems(text).map((item) => {
    const attr = byLine.get(item.line);
    return { ...item, actor: attr?.actor ?? 'unknown', ts: attr?.ts ?? null, source: { path, line: item.line } };
  });

  return { ok: true, value: items };
}
