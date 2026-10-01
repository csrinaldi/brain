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
// Two calls on the tokenizer are used: the static `Lexer.lex` and `.blockTokens` on a
// `new Lexer(...)` instance (the pre-scan). The renderer and `marked.parse` emit HTML
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
// long run of delimiters. A span is an inline run as marked's own block phase
// produces it (Lexer#blockTokens, which defers all inline work); one holding more
// than MAX_MARKS delimiters, or one run longer than MAX_RUN, is shown as plain text
// under a notice. Four review rounds each found a divergence between a hand-copied
// block grammar and marked's, so no grammar is copied here: the block tree is read.
// The pre-scan bounds each inline span; the worker's time budget (render-budget.mjs)
// bounds the whole document, including costs the pre-scan does not see. Real
// artifacts peak at 122 marks and a run of 7.
const MAX_MARKS = 600;
const MAX_RUN = 50;
const isDelimiter = (code) => code === 42 || code === 95 || code === 126 || code === 91 || code === 93;

function countText(text) {
  let marks = 0;
  let longest = 0;
  let run = 0;
  let prev = -1;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
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

const newlines = (s) => {
  let n = 0;
  for (let i = s.indexOf('\n'); i !== -1; i = s.indexOf('\n', i + 1)) n++;
  return n;
};

// Lines a block occupies, trailing newlines aside.
const lineCount = (s) => newlines(s.replace(/\n+$/, '')) + 1;
const spanOf = (from, to, marks, longestRun) => ({ from, to, marks, longestRun, degraded: marks > MAX_MARKS || longestRun > MAX_RUN });
const rawOf = (token) => (typeof token.raw === 'string' ? token.raw : '');

// A token's source lines, relative to the first line of the text it was lexed from.
// A container (quote, list item) lexes its content with the prefix removed but the
// line count intact, so a child's line index maps straight back to the source. That
// holds only when the children's raws add up to the container's text; where they do
// not (marked drops a separator between a paragraph and a table inside a quote), the
// line index is unreliable and the whole container becomes one span.
function collectSpans(tokens, base, text, out) {
  const mine = [];
  let line = base;
  let joined = '';
  let reliable = true;
  const leaf = (token, text) => {
    const { marks, longest } = countText(text);
    mine.push(spanOf(line, line + newlines(rawOf(token).replace(/\n+$/, '')) + 1, marks, longest));
  };
  for (const token of tokens) {
    switch (token.type) {
      case 'paragraph':
      case 'text':
      case 'heading':
        leaf(token, String(token.text ?? ''));
        break;
      case 'blockquote':
        collectSpans(token.tokens ?? [], line, String(token.text ?? ''), mine);
        break;
      case 'list': {
        const items = token.items ?? [];
        let at = line;
        for (const item of items) {
          collectSpans(item.tokens ?? [], at, String(item.text ?? ''), mine);
          at += newlines(rawOf(item));
        }
        if (lineCount(items.map(rawOf).join('')) !== lineCount(rawOf(token))) reliable = false;
        break;
      }
      case 'table': {
        const row = (cells, at) => {
          const counted = cells.map((c) => countText(String(c.text ?? '')));
          mine.push(spanOf(at, at + 1, counted.reduce((n, c) => n + c.marks, 0), Math.max(0, ...counted.map((c) => c.longest))));
        };
        row(token.header ?? [], line);
        (token.rows ?? []).forEach((cells, r) => row(cells, line + 2 + r));
        break;
      }
      default:
    }
    line += newlines(rawOf(token));
    // a task item's checkbox is part of the item's raw but not of its text
    if (token.type !== 'checkbox') joined += rawOf(token);
  }
  const lines = lineCount(text);
  if (reliable && lineCount(joined) === lines) {
    out.push(...mine);
    return;
  }
  const marks = mine.reduce((n, span) => n + span.marks, 0);
  const longest = Math.max(0, ...mine.map((span) => span.longestRun));
  out.push(spanOf(base, base + lines, marks, longest));
}

/**
 * Cut a markdown body into inline spans and classify each one, from marked's block
 * phase: no inline tokenizing runs. `from` is the first line, `to` the line after
 * the last. Fenced code, html and definitions belong to no span. May throw, as the
 * block phase does on pathological nesting; the caller degrades the document.
 * @returns {{from:number, to:number, marks:number, longestRun:number, degraded:boolean}[]}
 */
export function prescan(body) {
  const lexer = new Lexer(lexOptions());
  const out = [];
  const text = String(body).replace(/\r\n|\r/g, '\n');
  collectSpans(lexer.blockTokens(text, []), 0, text, out);
  return out;
}

const degradedNotice = (marks) => `a passage with ${marks} formatting marks is shown as plain text`;

// A fresh options object per call: the lexer mutates it and a passed object
// REPLACES the defaults, so `gfm` must be explicit (tables, task items,
// strikethrough, autolinks).
const lexOptions = () => ({ gfm: true, breaks: false, pedantic: false });
const lexTokens = (text, lex) => lex(text, lexOptions());

// A degraded passage is neutralised by SAME-LENGTH substitution: each character
// the pre-scan counts (`*` `_` `~` `[` `]`) maps to one private-use character the
// tokenizer treats as plain text. The backslash is NEVER substituted: it is
// structural (`\|` keeps a pipe inside a table cell, and a substituted one let the
// pipe split the row so marked dropped the surplus cells), and left alone it
// escapes nothing, since the character after it is now a placeholder. Backslash
// escaping was tried first and is wrong: an escape is context-sensitive in
// CommonMark, literal inside a code span and an autolink, so `x_y` there came out
// as `x\_y`. The length is
// kept so token offsets, and with them the notice placement, stay true. The line's
// own block marker (quote prefix, list bullet) is left alone: the passage keeps its
// quote or its list item and only its inline marks are neutralised.
const BLOCK_PREFIX = /^(?: {0,3}> ?)*[ \t]*(?:(?:[-+*]|\d{1,9}[.)])[ \t]+)?/;
const SUBSTITUTED = ['*', '_', '~', '[', ']'];
const PUA_CHAR = /[\uE000-\uF8FF]/g;

// Five private-use characters the document does not already use, or null when it
// uses the whole block (then nothing can be substituted safely).
function placeholders(text) {
  const taken = new Set(text.match(PUA_CHAR) ?? []);
  const forward = new Map();
  for (let code = 0xe000; code <= 0xf8ff && forward.size < SUBSTITUTED.length; code++) {
    const ch = String.fromCharCode(code);
    if (!taken.has(ch)) forward.set(SUBSTITUTED[forward.size], ch);
  }
  return forward.size === SUBSTITUTED.length ? forward : null;
}

function substituteLine(line, forward) {
  const keep = BLOCK_PREFIX.exec(line)[0].length;
  return line.slice(0, keep) + line.slice(keep).replace(/[*_~[\]]/g, (ch) => forward.get(ch));
}

// Put the originals back in every string of the token tree — text, code, link text
// and href, image alt, raw — so no placeholder reaches the page.
function restoreTokens(tokens, forward) {
  const back = new Map([...forward].map(([original, placeholder]) => [placeholder, original]));
  const pattern = new RegExp(`[${[...back.keys()].join('')}]`, 'g');
  const fix = (s) => s.replace(pattern, (ch) => back.get(ch));
  const seen = new Set();
  const walk = (value) => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const key of Object.keys(value)) {
      const v = value[key];
      if (typeof v === 'string') value[key] = fix(v);
      else walk(v);
    }
  };
  walk(tokens);
}

// The text with every degraded span substituted, and the offset in it of each span's
// first line, in span order.
function neutralise(text, degraded, forward) {
  const lines = text.split('\n');
  const mark = new Set();
  for (const span of degraded) for (let i = span.from; i < span.to; i++) mark.add(i);
  const starts = [];
  const out = [];
  let offset = 0;
  let next = 0;
  for (let i = 0; i < lines.length; i++) {
    if (next < degraded.length && degraded[next].from === i) starts[next++] = offset;
    const line = mark.has(i) ? substituteLine(lines[i], forward) : lines[i];
    out.push(line);
    offset += line.length + 1;
  }
  return { neutral: out.join('\n'), starts };
}

/**
 * The text exactly as the tokenizer receives it: every degraded span substituted, or
 * null when nothing degrades. Exported so a test can compare its block structure with
 * the original's.
 */
export function neutralText(body) {
  const text = String(body).replace(/\r\n|\r/g, '\n');
  const degraded = prescan(text).filter((span) => span.degraded);
  const forward = degraded.length ? placeholders(text) : null;
  return forward ? neutralise(text, degraded, forward).neutral : null;
}

// One lex of the whole document, always. A degraded passage is substituted in place
// first, so the tokenizer runs in linear time on it and every neighbour (a
// reference definition, a list's other items) is tokenized in its own context.
// Each degraded passage is announced by a notice block placed before the
// top-level block that contains it, found by source offset.
function bodyBlocks(body, lex) {
  const text = body.replace(/\r\n|\r/g, '\n'); // what marked does first; keeps token offsets true
  const degraded = prescan(text).filter((span) => span.degraded);
  if (degraded.length === 0) return blocks(lexTokens(text, lex), 0);

  const forward = placeholders(text);
  if (forward === null) {
    // the document uses every private-use character: show it as written
    const marks = degraded.reduce((sum, span) => sum + span.marks, 0);
    return [{ t: 'degraded', notice: degradedNotice(marks) }, { t: 'literal', text: body }];
  }
  const { neutral, starts } = neutralise(text, degraded, forward);
  const tokens = lexTokens(neutral, lex);
  restoreTokens(tokens, forward);

  const notices = degraded.map((span, k) => ({ at: starts[k], node: { t: 'degraded', notice: degradedNotice(span.marks) } }));
  const before = new Map(); // token index -> notice nodes announced before it
  const total = tokens.reduce((sum, token) => sum + (typeof token.raw === 'string' ? token.raw.length : NaN), 0);
  if (total === neutral.length) {
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

// Adjacent text nodes are one node: marked emits an `escape` token per escaped
// character and an `html` token per inline tag, all shown as plain text, so a long
// passage would otherwise be one node per mark (#1218).
function inline(tokens) {
  const out = [];
  for (const token of tokens ?? []) {
    const node = inlineNode(token);
    const last = out[out.length - 1];
    if (node.t === 'text' && last?.t === 'text') last.text += node.text;
    else out.push(node);
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
