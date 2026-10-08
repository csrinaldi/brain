// record-summary.mjs — a record's title and a bounded plain-text excerpt,
// derived from its own `content` (#1313). Pure: no node: import, no clock, no I/O.
//
// Every record this repository holds begins `**<title>**` (memory-format.md
// item 8: the importer folds an Engram title into `content` as a leading bold
// line), so the title is read from there and never from a `title` field no
// record carries. The excerpt is the rest of the content with markdown markers
// removed. Markdown is NOT tokenized here: the tokenizer may run only in the
// page's worker (#1218), and a conservative regex strip over a bounded slice is
// linear in that slice.

export const TITLE_MAX = 200;
export const EXCERPT_MAX = 120;
/** The most characters of `content` ever examined, whatever a record holds. */
export const SCAN_MAX = 2000;

/** The record has no `content` string at all. The record was read; the field is absent. */
export const NO_TEXT = 'this record has no content field';
/** The record has a `content` string with no text in it. */
export const EMPTY_TEXT = 'this record has no text in its content';

const ELLIPSIS = '…';
/** What joins the cells of a table row: the excerpt reads the cells, never the layout (#1377). */
export const CELL_SEPARATOR = ' · ';
const BOLD_LEAD = /^\*\*((?:(?!\*\*).)+)\*\*$/;

/** Cut to `max` code points, the last one an ellipsis. Returns the text and whether it was cut. */
function cap(text, max) {
  // A code point is one or two code units: at most `max` units never needs counting, and a cut text
  // never needs more than twice `max` units looked at.
  if (text.length <= max) return { text, cut: false };
  const points = Array.from(text.slice(0, max * 2 + 1));
  if (points.length <= max) return { text, cut: false };
  return { text: points.slice(0, max - 1).join('') + ELLIPSIS, cut: true };
}

function collapse(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/** Remove inline markers: images and links keep their text, code and emphasis keep theirs. */
function stripInline(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\((?:[^()\s]|\([^()]*\))*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*|~~/g, '')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=$|[\s).,;:!?])/g, '$1$2');
}

/** Remove the markers a line starts with: a heading, a quote, a list bullet or number. */
function stripLine(line) {
  return line
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/^\s*(?:[-*+]|\d{1,9}[.)])\s+/, '');
}

/**
 * A table row (a line that starts with a pipe) as the text of its cells joined by CELL_SEPARATOR.
 * The pipes are layout; an escaped pipe (`\|`) is a character of a cell. Empty cells say nothing.
 */
function tableRowText(line) {
  const cells = line.trim().replace(/^\|/, '').split(/(?<!\\)\|/)
    .map((cell) => collapse(stripInline(cell.replace(/\\\|/g, '|'))))
    .filter((cell) => cell !== '');
  return cells.join(CELL_SEPARATOR);
}

const isTableRow = (line) => /^\s*\|/.test(line);

/** One line as plain text. A fence line carries no text of its own. */
function plainLine(line) {
  if (/^\s*(```|~~~)/.test(line)) return '';
  // A table's separator row (`|---|:-:|`) is layout, not text.
  if (/^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-*:?\s*$/.test(line) && line.includes('-')) return '';
  if (isTableRow(line)) return tableRowText(line);
  return collapse(stripInline(stripLine(line)));
}

/** The window of `content` that is examined, never ending on half a surrogate pair. */
function windowOf(content) {
  if (content.length <= SCAN_MAX) return { text: content, cut: false };
  let end = SCAN_MAX;
  const last = content.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return { text: content.slice(0, end), cut: true };
}

/**
 * @param {unknown} content
 * @returns {{ok: true, title: string, excerpt: string, truncated: boolean} | {ok: false, reason: string}}
 */
export function summarizeContent(content) {
  if (typeof content !== 'string') return { ok: false, reason: NO_TEXT };
  const win = windowOf(content);
  const lines = win.text.split(/\r?\n/);
  const first = lines.findIndex((line) => line.trim() !== '');
  if (first === -1) return { ok: false, reason: EMPTY_TEXT };

  const lead = lines[first].trim();
  const bold = BOLD_LEAD.exec(lead);
  let titleText = bold ? collapse(stripInline(bold[1])) : plainLine(lead);
  let from = first + 1;
  if (titleText === '') {
    // A lead of nothing but markers has no text: the next line that has some is the title.
    for (; from < lines.length && titleText === ''; from += 1) titleText = plainLine(lines[from]);
    if (titleText === '') return { ok: false, reason: EMPTY_TEXT };
  }
  const title = cap(titleText, TITLE_MAX);

  // Lines are read only until the excerpt is full: the rest could not appear in it.
  const parts = [];
  let length = 0;
  for (; from < lines.length && length <= EXCERPT_MAX; from += 1) {
    const text = plainLine(lines[from]);
    if (text === '') continue;
    parts.push(text);
    length += text.length + 1;
  }
  // Each part is already collapsed, so the join is too.
  const body = parts.join(' ');
  const excerpt = cap(body, EXCERPT_MAX);
  let text = excerpt.text;
  // The window ended before the content did: the excerpt is a cut too, and says so.
  if (win.cut && !excerpt.cut) text = cap(`${body}${ELLIPSIS}`, EXCERPT_MAX).text;
  return { ok: true, title: title.text, excerpt: text, truncated: excerpt.cut || win.cut };
}
