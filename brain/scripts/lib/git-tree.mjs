// git-tree.mjs — the one reader of `git ls-tree -z` output and the one pick of
// "which change dir carries this issue" (#1201 D35). Pure, zero I/O: the drawer
// reader (`ui/change-route.mjs`) and the remote-changes reader
// (`status/remote-changes.mjs`) share it, so two parsers cannot drift.

import { parseChangeId } from './sdd-layout.mjs';

/**
 * `ls-tree -z` or `ls-tree -l -z` output to `Map<path, {mode, type, sha, size}>`.
 * `size` is a number for a sized blob and `null` for a tree or when the listing
 * has no size column.
 */
export function parseTreeListing(out) {
  const entries = new Map();
  for (const record of String(out ?? '').split('\0')) {
    if (!record) continue;
    const tab = record.indexOf('\t');
    const [mode, type, sha, size] = record.slice(0, tab).trim().split(/\s+/);
    entries.set(record.slice(tab + 1), { mode, type, sha, size: size === undefined || size === '-' ? null : Number(size) });
  }
  return entries;
}

/**
 * The one dir name carrying `issue`, or why not: `missing` (none), `unreadable`
 * (more than one — never a guess among them).
 * @returns {{ok: true, dir: string} | {ok: false, state: 'missing'|'unreadable', reason: string}}
 */
export function pickChangeDir(names, issue) {
  const wanted = String(issue);
  const matches = names.filter((name) => parseChangeId(name)?.iid === wanted);
  if (matches.length === 1) return { ok: true, dir: matches[0] };
  if (matches.length === 0) return { ok: false, state: 'missing', reason: `no change dir for #${wanted}` };
  return { ok: false, state: 'unreadable', reason: `more than one change dir carries #${wanted}: ${matches.join(', ')}` };
}

const CAUSE = /^(?:fatal|error):/;

/**
 * One line naming why a command failed: the first `fatal:`/`error:` line of
 * stderr, else its first non-empty line, else the first line of the message.
 * Trimmed, on one line, at most `cap` characters (`…` replaces the cut).
 */
export function gitErrorLine(err, cap = 200) {
  const lines = (text) => String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const stderr = lines(err?.stderr);
  const line = stderr.find((l) => CAUSE.test(l)) ?? stderr[0] ?? lines(err?.message ?? err)[0] ?? '';
  return line.length > cap ? `${line.slice(0, cap - 1)}…` : line;
}
