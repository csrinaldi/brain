// markdown.mjs — the ONE door between the vendored tokenizer and the page
// (#1198). marked's token shape stops here: everything below this file sees
// only the small tree this module returns. The rulings are applied in this
// file so the DOM builder can be a dumb walk:
//
//   R1  relative / anchor links render as inert text, never as a link
//   R5  raw html (block or inline) is shown as literal text
//   R6  an image is its alt text; its URL never reaches the tree
//   R7  a link is live only for http(s), after `safeHref` has looked at it
//
// Only `Lexer.lex` is used. The renderer and `marked.parse` emit HTML
// strings, and the page never assigns markup (see marked-usage-guard).
//
// Pure and deterministic: no clock, no randomness, no environment.

import { Lexer } from '../vendor/marked.esm.js';

const MAX_DEPTH = 32;
// The route caps a document at 262144 bytes; twice that is the most this adapter
// will hand the tokenizer. Measured: 2000 nested list indents (4 MB) exhaust
// the heap inside marked, 360 (130 KB) take 0.2 s.
const MAX_INPUT = 524288;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const LANG = /^[\w+-]{1,32}$/;
// Control characters, Unicode whitespace, zero-width and bidi controls. A
// browser strips tabs and newlines anywhere inside a URL, so they are
// stripped here before the scheme is read.
const INVISIBLE = /[\u0000-\u0020\u007F-\u00A0\u1680\u2000-\u200F\u2028-\u202F\u205F-\u2064\u3000\uFEFF]/g;

const defaultLex = (text, options) => Lexer.lex(text, options);

// ── pre-scan (#1218): bound the cost of an inline span before marked sees it ──
// marked's emphasis, strikethrough and link rules backtrack quadratically on a
// long run of delimiters. A span is the lines between the block boundaries
// below; one holding more than MAX_MARKS delimiters, or one run longer than
// MAX_RUN, is shown as plain text under a notice. Real artifacts peak at 122
// marks and a run of 7. Every regex is anchored, so a line is scanned once.
const MAX_MARKS = 600;
const MAX_RUN = 50;
const BLANK = /^\s*$/;
// What starts a block of its own once any quote prefix is gone.
const BLOCK_START = /^(?:\s*(?:[-+*]|\d{1,9}[.)])(?:\s|$)| {0,3}#{1,6}(?:\s|$)|\s*\|)/;
// marked's own fence rule (vendor/marked.esm.js, block `fences`), line by line:
// at most three leading spaces; a backtick run of three or more whose info
// string holds no backtick, or a tilde run of three or more. A closer is at most
// three spaces, the opener's exact run, any further ~ or `, then spaces only.
// Anything looser blinds the pre-scan to text marked will lex as inline.
const FENCE = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/;
const FENCE_TAIL = /^[~`]* *$/;
// marked's thematic break (block `hr`) and its setext underline (the tail of
// block `lheading`), line by line. A thematic break interrupts a paragraph and
// is a block of its own; an underline closes the paragraph above it, which marked
// then lexes as a heading, so the underline line is the last line of its span.
const HR = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})$/;
const SETEXT = /^ {0,3}(?:=+|-+) *$/;
const closesFence = (line, opener) => {
  const rest = /^ {0,3}(.*)$/.exec(line)[1];
  return rest.startsWith(opener) && FENCE_TAIL.test(rest.slice(opener.length));
};

// Quote depth and the text after the prefix, in one linear pass: a quote marker
// is up to three spaces, `>`, and one optional space, repeated.
function unquote(line) {
  let pos = 0;
  let depth = 0;
  for (;;) {
    let p = pos;
    while (p < line.length && p - pos < 3 && line.charCodeAt(p) === 32) p++;
    if (line.charCodeAt(p) !== 62) break;
    p++;
    if (line.charCodeAt(p) === 32) p++;
    pos = p;
    depth++;
  }
  return { depth, rest: depth === 0 ? line : line.slice(pos) };
}
const isDelimiter = (code) => code === 42 || code === 95 || code === 126 || code === 91 || code === 93;

function countLine(line) {
  let marks = 0;
  let longest = 0;
  let run = 0;
  let prev = -1;
  for (let i = 0; i < line.length; i++) {
    const code = line.charCodeAt(i);
    if (!isDelimiter(code)) {
      run = 0;
      prev = -1;
      continue;
    }
    marks++;
    run = code === prev ? run + 1 : 1;
    prev = code;
    if (run > longest) longest = run;
  }
  return { marks, longest };
}

/**
 * Cut a markdown body into inline spans and classify each one. Pure and
 * linear; never calls the tokenizer. `from` is the first line, `to` the line
 * after the last. Fenced code belongs to no span.
 * @returns {{from:number, to:number, marks:number, longestRun:number, degraded:boolean}[]}
 */
export function prescan(body) {
  const lines = String(body).split('\n');
  const spans = [];
  let open = null;
  let fence = null;
  const close = (to) => {
    if (open) {
      open.to = to;
      open.degraded = open.marks > MAX_MARKS || open.longestRun > MAX_RUN;
      const { quote, ...span } = open;
      spans.push(span);
      open = null;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      if (closesFence(line, fence)) fence = null;
      continue;
    }
    const opener = FENCE.exec(line);
    if (opener) {
      close(i);
      fence = opener[1];
      continue;
    }
    // marked lexes a quote's lines as one paragraph (lazy lines included) until a
    // blank or empty quote line, a block of its own, or a deeper quote.
    const { depth, rest } = unquote(line);
    if (BLANK.test(rest)) {
      close(i);
      continue;
    }
    if (open && depth === open.quote && SETEXT.test(rest)) {
      close(i + 1);
      continue;
    }
    if (HR.test(rest)) {
      close(i);
      continue;
    }
    if (BLOCK_START.test(rest)) close(i);
    else if (depth > 0 && open && depth > open.quote) close(i);
    if (!open) open = { from: i, to: i, marks: 0, longestRun: 0, degraded: false, quote: depth };
    const { marks, longest } = countLine(line);
    open.marks += marks;
    if (longest > open.longestRun) open.longestRun = longest;
  }
  close(lines.length);
  return spans;
}

const degradedNotice = (marks) => `a passage with ${marks} formatting marks is shown as plain text`;

// A fresh options object per call: the lexer mutates it and a passed object
// REPLACES the defaults, so `gfm` must be explicit (tables, task items,
// strikethrough, autolinks).
const lexTokens = (text, lex) => lex(text, { gfm: true, breaks: false, pedantic: false });

// Backslash-escape the openers the pre-scan counts (`*` `_` `~` `[`), plus the
// backslash itself, so marked reads the passage as literal text and every
// character shows as typed. `]` stays as written: with no `[` to close it can
// open nothing, and escaping it measurably slows marked (`\[a\](` x 5e4: 650 ms
// against 78 ms). The
// line's own block marker (quote prefix, list bullet) is left alone: the passage
// keeps its quote or its list item and only its inline marks are neutralized.
const BLOCK_PREFIX = /^(?: {0,3}> ?)*[ \t]*(?:(?:[-+*]|\d{1,9}[.)])[ \t]+)?/;
const SPECIAL = /[\\*_~[]/g;
function escapeLine(line) {
  const keep = BLOCK_PREFIX.exec(line)[0].length;
  return line.slice(0, keep) + line.slice(keep).replace(SPECIAL, '\\$&');
}

// One lex of the whole document, always. A degraded passage is escaped in place
// first, so the tokenizer runs in linear time on it and every neighbour (a
// reference definition, a list's other items) is tokenized in its own context.
// Each degraded passage is announced by a notice block placed before the
// top-level block that contains it, found by source offset.
function bodyBlocks(body, lex) {
  const text = body.replace(/\r\n|\r/g, '\n'); // what marked does first; keeps token offsets true
  const degraded = prescan(text).filter((span) => span.degraded);
  if (degraded.length === 0) return blocks(lexTokens(text, lex), 0);

  const lines = text.split('\n');
  const mark = new Set();
  for (const span of degraded) for (let i = span.from; i < span.to; i++) mark.add(i);
  const starts = []; // offset in the escaped text of each degraded span's first line, in span order
  const out = [];
  let offset = 0;
  let next = 0;
  for (let i = 0; i < lines.length; i++) {
    if (next < degraded.length && degraded[next].from === i) starts[next++] = offset;
    const line = mark.has(i) ? escapeLine(lines[i]) : lines[i];
    out.push(line);
    offset += line.length + 1;
  }
  const escaped = out.join('\n');
  const tokens = lexTokens(escaped, lex);

  const notices = degraded.map((span, k) => ({ at: starts[k], node: { t: 'degraded', notice: degradedNotice(span.marks) } }));
  const before = new Map(); // token index -> notice nodes announced before it
  const total = tokens.reduce((sum, token) => sum + (typeof token.raw === 'string' ? token.raw.length : NaN), 0);
  if (total === escaped.length) {
    let start = 0;
    let k = 0; // notices and tokens are both in source order: one merge pass
    tokens.forEach((token, index) => {
      const end = start + token.raw.length;
      while (k < notices.length && notices[k].at < end) before.set(index, [...(before.get(index) ?? []), notices[k++].node]);
      start = end;
    });
  } else {
    // raw offsets do not add up (a tokenizer that is not marked): announce first
    before.set(0, notices.map((n) => n.node));
  }
  const result = [];
  let pending = [];
  tokens.forEach((token, index) => {
    pending.push(...(before.get(index) ?? []));
    const node = blockNode(token, 0);
    if (!node) return;
    result.push(...pending, node);
    pending = [];
  });
  result.push(...pending);
  return result;
}

/**
 * Classify an href. Only absolute http(s) URLs with a host and no
 * credentials are ok; everything else says why it is not.
 * @returns {{ok:true, href:string}|{ok:false, reason:'relative'|'anchor'|'scheme'|'malformed'}}
 */
export function safeHref(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'malformed' };
  const s = raw.replace(INVISIBLE, '');
  if (s.startsWith('#')) return { ok: false, reason: 'anchor' };
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(s);
  if (!scheme) return { ok: false, reason: 'relative' };
  const name = scheme[1].toLowerCase();
  if (name !== 'http' && name !== 'https') return { ok: false, reason: 'scheme' };
  let url;
  try {
    url = new URL(s);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const sane = (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '' && url.username === '' && url.password === '';
  return sane ? { ok: true, href: url.href } : { ok: false, reason: 'malformed' };
}

const rawText = (token) => String(token.raw ?? token.text ?? '');

// A run of `escape` tokens is one text node: an escaped passage arrives as one
// token per character, and the page should not carry a node for each.
function inline(tokens) {
  const out = [];
  let prevEscape = false;
  for (const token of tokens ?? []) {
    const node = inlineNode(token);
    const last = out[out.length - 1];
    const isEscape = token.type === 'escape';
    if (isEscape && prevEscape && last?.t === 'text') last.text += node.text;
    else out.push(node);
    prevEscape = isEscape;
  }
  return out;
}

function inlineNode(token) {
  switch (token.type) {
    case 'text':
    case 'escape':
      return { t: 'text', text: String(token.text ?? '') };
    case 'strong':
    case 'em':
    case 'del':
      return { t: token.type, children: inline(token.tokens) };
    case 'codespan':
      return { t: 'codespan', text: String(token.text ?? '') };
    case 'br':
      return { t: 'br' };
    case 'image':
      return { t: 'text', text: `[image: ${token.text ?? ''}]` };
    case 'link': {
      const verdict = safeHref(token.href);
      const children = inline(token.tokens);
      return verdict.ok
        ? { t: 'link', href: verdict.href, children }
        : { t: 'inert', target: String(token.href ?? '').trim(), children };
    }
    default:
      // inline html and anything unknown: shown, never interpreted
      return { t: 'text', text: rawText(token) };
  }
}

const trimEol = (s) => s.replace(/\n+$/, '');
const literal = (token) => ({ t: 'literal', text: trimEol(rawText(token)) });

function blocks(tokens, depth) {
  const out = [];
  for (const token of tokens ?? []) {
    const node = blockNode(token, depth);
    if (node) out.push(node);
  }
  return out;
}

function blockNode(token, depth) {
  switch (token.type) {
    case 'space':
    case 'checkbox':
      return null;
    case 'def':
      return typeof token.tag === 'string' && token.tag.startsWith('^') ? literal(token) : null;
    case 'heading':
      return { t: 'heading', level: token.depth, children: inline(token.tokens) };
    case 'paragraph':
    case 'text':
      return { t: 'paragraph', children: token.tokens ? inline(token.tokens) : [{ t: 'text', text: String(token.text ?? '') }] };
    case 'html':
      return literal(token);
    case 'code':
      return { t: 'code', lang: LANG.test(token.lang ?? '') ? token.lang : null, text: String(token.text ?? '') };
    case 'hr':
      return { t: 'hr' };
    case 'blockquote':
      return depth >= MAX_DEPTH ? literal(token) : { t: 'blockquote', blocks: blocks(token.tokens, depth + 1) };
    case 'list':
      if (depth >= MAX_DEPTH) return literal(token);
      return {
        t: 'list',
        ordered: Boolean(token.ordered),
        start: token.ordered ? (Number.isFinite(token.start) ? token.start : 1) : null,
        items: (token.items ?? []).map((item) => ({
          task: Boolean(item.task),
          checked: item.task ? Boolean(item.checked) : null,
          blocks: blocks(item.tokens, depth + 1),
        })),
      };
    case 'table':
      return {
        t: 'table',
        align: (token.align ?? []).map((a) => a ?? null),
        header: (token.header ?? []).map((cell) => inline(cell.tokens)),
        rows: (token.rows ?? []).map((row) => row.map((cell) => inline(cell.tokens))),
      };
    default:
      return literal(token);
  }
}

/**
 * Markdown text to the page's tree. Never throws.
 * `lex` is a seam for tests; production always uses the vendored `Lexer.lex`.
 * @returns {{blocks: object[], notices: string[]}}
 */
export function markdownTree(text, lex = defaultLex) {
  const source = typeof text === 'string' ? text : '';
  const notices = [];
  const out = [];
  if (source.length > MAX_INPUT) {
    notices.push('The document is too large to render as markdown; the text is shown as written.');
    return { blocks: [{ t: 'code', lang: null, text: source }], notices };
  }
  let body = source;
  const fm = FRONTMATTER.exec(source);
  if (fm) {
    out.push({ t: 'frontmatter', text: fm[1] });
    body = source.slice(fm[0].length);
  }
  try {
    out.push(...bodyBlocks(body, lex));
  } catch {
    notices.push('The markdown could not be parsed; the text is shown as written.');
    return { blocks: [{ t: 'code', lang: null, text: source }], notices };
  }
  if (out.length === 0 && source.length > 0) out.push({ t: 'literal', text: source });
  return { blocks: out, notices };
}
