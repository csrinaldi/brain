// markdown.test.mjs — the adapter between marked's tokenizer and the page's
// own tree (#1198). Every rule the maintainer ruled (R1 inert relative links,
// R5 html as text, R6 images as text) is applied HERE, so the DOM builder can
// stay a dumb walk over this tree.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownTree } from './markdown.mjs';

test('#1198 R5: an html token renders as literal text', () => {
  const { blocks } = markdownTree('<script>alert(1)</script>');
  assert.deepEqual(blocks, [{ t: 'literal', text: '<script>alert(1)</script>' }]);
});

import { safeHref } from './markdown.mjs';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const first = (md) => markdownTree(md).blocks[0];
const T = (text) => ({ t: 'text', text });

// ── block constructs: one test per mapping so deleting one fails its test ──

test('#1198 headings h1 to h4 keep their level', () => {
  const { blocks } = markdownTree('# a\n\n## b\n\n### c\n\n#### d');
  assert.deepEqual(blocks.map((b) => [b.t, b.level]), [['heading', 1], ['heading', 2], ['heading', 3], ['heading', 4]]);
  assert.deepEqual(blocks[0].children, [T('a')]);
});

test('#1198 a paragraph carries inline children', () => {
  assert.deepEqual(first('hello world'), { t: 'paragraph', children: [T('hello world')] });
});

test('#1198 lists nest: ul inside li, ol keeps its start', () => {
  const ul = first('- a\n  - b\n- c');
  assert.equal(ul.t, 'list');
  assert.equal(ul.ordered, false);
  assert.equal(ul.start, null);
  assert.equal(ul.items.length, 2);
  const nested = ul.items[0].blocks.find((b) => b.t === 'list');
  assert.equal(nested.items[0].blocks[0].children[0].text, 'b');
  const ol = first('3. x\n4. y');
  assert.deepEqual([ol.ordered, ol.start, ol.items.length], [true, 3, 2]);
  assert.equal(first('1. x').start, 1);
});

test('#1198 task items carry task and checked, with no literal [x] text', () => {
  const list = first('- [x] done\n- [ ] open\n- plain');
  assert.deepEqual(list.items.map((i) => [i.task, i.checked]), [[true, true], [true, false], [false, null]]);
  assert.ok(!JSON.stringify(list).includes('[x]'));
  assert.ok(!JSON.stringify(list).includes('[ ]'));
});

test('#1198 a GFM table keeps header, alignment and rows', () => {
  const table = first('| a | b |\n|:-|-:|\n| 1 | 2 |');
  assert.equal(table.t, 'table');
  assert.deepEqual(table.align, ['left', 'right']);
  assert.deepEqual(table.header, [[T('a')], [T('b')]]);
  assert.deepEqual(table.rows, [[[T('1')], [T('2')]]]);
});

test('#1198 fenced code stays verbatim: no markup is interpreted inside it', () => {
  const code = first('```js\n<b>x</b> **not bold**\n```');
  assert.deepEqual(code, { t: 'code', lang: 'js', text: '<b>x</b> **not bold**' });
  assert.ok(!('children' in code));
});

test('#1198 D13: a code lang is kept only when it is a plain token', () => {
  assert.equal(first('```c++\nx\n```').lang, 'c++');
  assert.equal(first('```" onclick="x\nx\n```').lang, null);
  assert.equal(first('```\nx\n```').lang, null);
});

test('#1198 blockquote and hr map to their blocks', () => {
  assert.deepEqual(first('> quoted'), { t: 'blockquote', blocks: [{ t: 'paragraph', children: [T('quoted')] }] });
  assert.deepEqual(markdownTree('a\n\n---\n\nb').blocks[1], { t: 'hr' });
});

test('#1198 an unsupported construct degrades to its literal source', () => {
  const { blocks } = markdownTree('[^1]: note');
  assert.deepEqual(blocks, [{ t: 'literal', text: '[^1]: note' }]);
});

// ── inline constructs, R6 images, html inline ────────────────────────────────

test('#1198 inline constructs: codespan, strong, em, del, br', () => {
  const kids = first('`c` **s** *e* ~~d~~ x  \ny').children;
  assert.deepEqual(kids.filter((k) => k.t !== 'text').map((k) => k.t), ['codespan', 'strong', 'em', 'del', 'br']);
  assert.deepEqual(kids.find((k) => k.t === 'codespan'), { t: 'codespan', text: 'c' });
  assert.deepEqual(kids.find((k) => k.t === 'strong').children, [T('s')]);
});

test('#1198 R1198-6: strikethrough maps to its own del element', () => {
  const kids = first('a ~~gone~~ b').children;
  assert.deepEqual(kids.find((k) => k.t === 'del').children, [T('gone')]);
});

test('#1198 R1198-6: a hard line break maps to its own br element', () => {
  assert.equal(first('line one  \nline two').children.filter((k) => k.t === 'br').length, 1);
});

test('#1198 R6: an image is its alt text and never carries the URL', () => {
  const tree = markdownTree('![architecture diagram](https://a.example/x.png) and ![](u)');
  assert.deepEqual(tree.blocks[0].children.filter((k) => k.t === 'text').map((k) => k.text), ['[image: architecture diagram] and [image: ]'], 'adjacent text is one node');
  assert.ok(!JSON.stringify(tree).includes('a.example'));
  assert.ok(!JSON.stringify(tree).includes('"u"'));
});

test('#1198 R5: inline html tags are literal text and a comment stays visible', () => {
  const text = first('see <b>bold</b> now').children.map((k) => k.text).join('');
  assert.equal(text, 'see <b>bold</b> now');
  const note = markdownTree('<!-- note to self -->');
  assert.deepEqual(note.blocks, [{ t: 'literal', text: '<!-- note to self -->' }]);
});

// ── safeHref (R7/R8) ─────────────────────────────────────────────────────────

test('#1198 safeHref: http and https are the only live schemes', () => {
  assert.deepEqual(safeHref('https://a.example'), { ok: true, href: 'https://a.example/' });
  assert.deepEqual(safeHref('http://a.example/x?y=1'), { ok: true, href: 'http://a.example/x?y=1' });
});

test('#1198 safeHref: relative, anchor and refused schemes are classified, never live', () => {
  for (const rel of ['./design.md', 'x/y.md', '../other/spec.md', '//evil.example/']) {
    assert.deepEqual(safeHref(rel), { ok: false, reason: 'relative' }, rel);
  }
  assert.deepEqual(safeHref('#top'), { ok: false, reason: 'anchor' });
  for (const u of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'ftp://a.example/', 'file:///etc/passwd', 'mailto:a@b.c']) {
    assert.deepEqual(safeHref(u), { ok: false, reason: 'scheme' }, u);
  }
});

test('#1198 safeHref: obfuscated script schemes are never ok', () => {
  for (const u of [' javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'jav&#x61;script:alert(1)', '&#106;avascript:alert(1)', 'java%73cript:alert(1)', 'java\0script:alert(1)', '‮javascript:alert(1)', 'java\nscript:x']) {
    assert.equal(safeHref(u).ok, false, JSON.stringify(u));
  }
});

test('#1198 safeHref: credentials, empty hosts and non-strings are malformed', () => {
  assert.deepEqual(safeHref('https://github.com@evil.example'), { ok: false, reason: 'malformed' });
  assert.deepEqual(safeHref('https:///'), { ok: false, reason: 'malformed' });
  for (const v of [undefined, null, 42, {}]) assert.deepEqual(safeHref(v), { ok: false, reason: 'malformed' });
});

function links(md) {
  const out = [];
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.t === 'link' || n.t === 'inert') out.push(n);
    for (const v of Object.values(n)) walk(v);
  };
  walk(markdownTree(md).blocks);
  return out;
}

test('#1198 R1: relative and anchor links are inert and show their path as text', () => {
  const [rel, anchor] = links('[spec](./spec.md) [top](#top)');
  assert.deepEqual(rel, { t: 'inert', target: './spec.md', children: [T('spec')] });
  assert.deepEqual(anchor, { t: 'inert', target: '#top', children: [T('top')] });
});

test('#1198 R7: an allowed link is live with the normalised href, a refused scheme is inert', () => {
  const [live, dead] = links('[a](https://a.example/p) [b](javascript:alert(1))');
  assert.deepEqual(live, { t: 'link', href: 'https://a.example/p', children: [T('a')] });
  assert.equal(dead.t, 'inert');
  assert.equal(dead.target, 'javascript:alert(1)');
});

test('#1198 R7: a javascript autolink and a javascript reference definition stay inert', () => {
  assert.ok(links('<javascript:alert(1)>').every((l) => l.t === 'inert'));
  assert.ok(links('[r]: javascript:alert(1)\n\n[click][r]').every((l) => l.t === 'inert'));
});

// ── frontmatter, depth, termination, determinism ────────────────────────────

test('#1198 D11: leading frontmatter is its own block and the rest is lexed', () => {
  const { blocks } = markdownTree('---\nstatus: draft\nissue: 1\n---\n\n# Title');
  assert.deepEqual(blocks[0], { t: 'frontmatter', text: 'status: draft\nissue: 1' });
  assert.equal(blocks[1].t, 'heading');
  assert.notEqual(markdownTree('---\nno close here').blocks[0].t, 'frontmatter');
});

function maxDepth(blocks) {
  let deepest = 0;
  const walk = (bs, d) => {
    for (const b of bs) {
      deepest = Math.max(deepest, d);
      if (b.t === 'blockquote') walk(b.blocks, d + 1);
      if (b.t === 'list') b.items.forEach((i) => walk(i.blocks, d + 1));
    }
  };
  walk(blocks, 1);
  return deepest;
}

test('#1198 D4: nesting is capped at 32, deeper content becomes literal', () => {
  const quotes = markdownTree('>'.repeat(40) + ' deep');
  assert.ok(maxDepth(quotes.blocks) <= 33);
  assert.ok(JSON.stringify(quotes).includes('"literal"'));
  const lists = markdownTree(Array.from({ length: 40 }, (_, i) => `${' '.repeat(i * 2)}- x`).join('\n'));
  assert.ok(maxDepth(lists.blocks) <= 33);
  assert.ok(JSON.stringify(lists).includes('"literal"'));
});

test('#1198 D4: an oversized document is shown as text with a notice, never handed to the tokenizer', () => {
  const out = markdownTree('x'.repeat(600000));
  assert.equal(out.blocks[0].t, 'code');
  assert.equal(out.notices.length, 1);
});

test('#1198 D4: 2000 levels of nesting terminate, either capped or degraded to text with a notice', () => {
  for (const input of ['>'.repeat(2000) + ' deep', Array.from({ length: 2000 }, (_, i) => `${' '.repeat(i * 2)}- x`).join('\n')]) {
    const out = markdownTree(input);
    assert.ok(out.blocks.length > 0);
    assert.ok(maxDepth(out.blocks) <= 33);
    assert.ok(JSON.stringify(out).includes('"literal"') || out.notices.length === 1);
  }
});

test('#1198 termination: pathological input returns quickly, never throws, never empty', () => {
  const inputs = ['['.repeat(50000), '*'.repeat(50000), '>'.repeat(10000), '```\nunclosed', '<!-- unclosed', `|${' a |'.repeat(1000)}\n|${'---|'.repeat(1000)}\n|${' b |'.repeat(1000)}`, '\0\0\0', '[a](', '[x](<', '| a | b |\n|---|', '\n', '   '];
  for (const input of inputs) {
    const t0 = performance.now();
    const out = markdownTree(input);
    assert.ok(performance.now() - t0 < 2000, `slow on ${JSON.stringify(input.slice(0, 20))}`);
    assert.ok(input.length === 0 || out.blocks.length > 0, `empty for ${JSON.stringify(input.slice(0, 20))}`);
  }
  assert.deepEqual(markdownTree('').blocks, []);
});

// Every string the tree would show: text-bearing fields, walked recursively.
function visibleText(node) {
  if (Array.isArray(node)) return node.map(visibleText).join(' ');
  if (node && typeof node === 'object') {
    return Object.entries(node).map(([k, v]) => (k === 't' || k === 'lang' ? '' : visibleText(v))).join(' ');
  }
  return typeof node === 'string' ? node : '';
}

test('#1198 R1198-13: malformed constructs degrade to text, the input\'s non-markup characters survive', () => {
  const cases = [
    ['```js\nunclosed', ['unclosed']],
    ['**unclosed', ['unclosed']],
    ['[a](', ['a']],
    ['| a | b |\n|---|', ['a', 'b']],
    ['[x](<', ['x']],
  ];
  for (const [input, words] of cases) {
    const shown = visibleText(markdownTree(input).blocks);
    for (const w of words) assert.ok(shown.includes(w), `${JSON.stringify(w)} lost for ${JSON.stringify(input)}; tree shows ${JSON.stringify(shown)}`);
  }
});

test('#1198 D4: a tokenizer that throws degrades to one code block plus a notice', () => {
  const out = markdownTree('# hello', () => { throw new RangeError('boom'); });
  assert.deepEqual(out.blocks, [{ t: 'code', lang: null, text: '# hello' }]);
  assert.equal(out.notices.length, 1);
});

test('#1198 R3 corollary: a 262144-byte table document still returns elements', () => {
  const row = '| a | b |\n';
  const md = '| h | i |\n|---|---|\n' + row.repeat(Math.floor(262144 / row.length));
  assert.equal(markdownTree(md).blocks[0].t, 'table');
});

function realArtifacts() {
  const root = join(HERE, '..', '..', '..', '..', 'openspec', 'changes');
  if (!existsSync(root)) return [];
  const out = [];
  for (const dir of readdirSync(root)) {
    if (dir === 'archive') continue;
    for (const f of ['proposal.md', 'spec.md', 'design.md', 'tasks.md']) {
      const p = join(root, dir, f);
      if (existsSync(p)) out.push(readFileSync(p, 'utf8'));
    }
  }
  return out;
}

test('#1198 determinism: the same text gives a deep-equal tree, across calls and a fresh import', async () => {
  const fresh = await import(`./markdown.mjs?fresh=${Date.now()}`);
  const docs = realArtifacts();
  assert.ok(docs.length > 0, 'the repo carries at least this change’s own artifacts');
  for (const text of docs) {
    const a = markdownTree(text);
    assert.deepEqual(markdownTree(text), a);
    assert.deepEqual(fresh.markdownTree(text), a);
  }
});

test('#1198 determinism: the adapter source reads no clock, randomness or environment', () => {
  const src = readFileSync(join(HERE, 'markdown.mjs'), 'utf8');
  for (const needle of ['Date', 'Math.random', 'performance.now', 'process.env']) {
    assert.ok(!src.includes(needle), `markdown.mjs mentions ${needle}`);
  }
});

// ── the hostile fixture, asserted on the tree (R7 to R10) ───────────────────

test('#1198 XSS fixture: no node carries an href but an http(s) one, and the script text survives as text', () => {
  const fixture = readFileSync(join(HERE, '..', 'test-support', 'fixtures', 'markdown-xss.txt'), 'utf8');
  const tree = markdownTree(fixture);
  const hrefs = [];
  const texts = [];
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if ('href' in n) hrefs.push(n.href);
    if (typeof n.text === 'string') texts.push(n.text);
    for (const v of Object.values(n)) walk(v);
  };
  walk(tree.blocks);
  assert.ok(hrefs.length >= 2, 'the fixture really contains live links');
  for (const h of hrefs) assert.match(h, /^https?:\/\//);
  const all = texts.join('\n');
  assert.ok(all.includes('<script>alert(\'raw-script\')</script>'));
  assert.ok(all.includes('<img src=x onerror=alert(1)>'));
  assert.ok(all.includes('<!-- <script>alert(\'commented\')</script> -->'));
  assert.ok(all.includes('<style>'));
  assert.ok(!JSON.stringify(tree).includes('"t":"image"'));
  assert.ok(!hrefs.some((h) => /evil\.example/.test(h)), 'credentials and protocol-relative links are never live');
});

// ── #1218 pre-scan: pathological inline spans degrade to announced plain text ──

import { prescan } from './markdown.mjs';
import { Lexer } from '../vendor/marked.esm.js';

const NOTICE = (n) => `a passage with ${n} formatting marks is shown as plain text`;
const degradedBlocks = (tree) => tree.blocks.filter((b) => b.t === 'degraded');
const timed = (fn) => {
  const t0 = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t0 };
};

// The pre-scan degrades a hazard by substituting same-length placeholders, and the document is then lexed
// ONCE so its neighbours render intact (cold-2). That lex is linear but not free:
// about 100 ms locally and about 230 ms on a CI runner for 200 KB. The bound sits
// at half the 1500 ms worker budget, 15x under the 11 s freeze it replaced.
const PRESCAN_BOUND_MS = 750;

test(`#1218 R1218-1: a 200 KB emphasis run degrades to one passage carrying the N-marks notice, in under ${PRESCAN_BOUND_MS} ms`, () => {
  const input = '*'.repeat(1e5) + 'a' + '*'.repeat(1e5);
  const { value, ms } = timed(() => markdownTree(input));
  const degraded = degradedBlocks(value);
  assert.equal(degraded.length, 1);
  assert.equal(degraded[0].notice, NOTICE(2e5));
  assert.ok(ms < PRESCAN_BOUND_MS, `took ${ms} ms`);
});

test(`#1218 R1218-1: every known pathological class degrades in under ${PRESCAN_BOUND_MS} ms`, () => {
  const inputs = {
    underscores: `${'_'.repeat(2e5)}x`,
    'bold openers': '**a '.repeat(5000),
    'em openers': '_a '.repeat(5000),
    'mixed delimiters': '*a_b~'.repeat(4e4),
    'link openers': '[a]('.repeat(5e4),
  };
  for (const [name, input] of Object.entries(inputs)) {
    const { value, ms } = timed(() => markdownTree(input));
    assert.equal(degradedBlocks(value).length, 1, `${name} not degraded`);
    assert.ok(ms < PRESCAN_BOUND_MS, `${name} took ${ms} ms`);
  }
});

test('#1218 R1218-1: 601 delimiters degrade, exactly 600 do not', () => {
  assert.equal(degradedBlocks(markdownTree('a*'.repeat(601))).length, 1);
  assert.equal(degradedBlocks(markdownTree('a*'.repeat(600))).length, 0);
});

test('#1218 R1218-1: a run of 51 degrades, a run of exactly 50 does not', () => {
  assert.equal(degradedBlocks(markdownTree(`${'*'.repeat(51)}word${'*'.repeat(51)}`)).length, 1);
  assert.equal(degradedBlocks(markdownTree(`${'*'.repeat(50)}word`)).length, 0);
});

test('#1218 R1218-1: only * _ ~ [ ] are counted', () => {
  const input = 'x' + '`()<>'.repeat(140);
  assert.equal(degradedBlocks(markdownTree(input)).length, 0);
  assert.equal(prescan(input).filter((s) => s.degraded).length, 0);
});

test('#1218 R1218-1: prescan classifies a 200 KB run on its own, and the tokenizer sees it substituted, once', () => {
  const input = `${'*'.repeat(2e5)}x`;
  const spans = prescan(input);
  assert.equal(spans.length, 1);
  assert.equal(spans[0].degraded, true);
  assert.equal(spans[0].marks, 2e5);
  assert.equal(spans[0].longestRun, 2e5);
  const seen = [];
  const out = markdownTree(input, (text, options) => {
    seen.push(text);
    return Lexer.lex(text, options);
  });
  assert.equal(seen.length, 1, 'one lex for the whole document');
  assert.equal(seen[0].length, input.length, 'every delimiter reaches the tokenizer as a same-length placeholder');
  assert.ok(!seen[0].includes('*'));
  assert.equal(degradedBlocks(out).length, 1);
  assert.deepEqual(out.notices, []);
});

test('#1218 R1218-1: the counter resets per list item and per table row', () => {
  const cell = 'a*'.repeat(300);
  const list = Array.from({ length: 10 }, () => `- ${cell}`).join('\n');
  assert.equal(degradedBlocks(markdownTree(list)).length, 0);
  const table = ['| h | i |', '|---|---|', ...Array.from({ length: 10 }, () => `| ${cell} | x |`)].join('\n');
  const out = markdownTree(table);
  assert.equal(degradedBlocks(out).length, 0);
  assert.equal(out.blocks[0].t, 'table');
});

test('#1218 R1218-1: a blank line, a heading and a quote marker each reset the counter', () => {
  const part = 'a*'.repeat(400);
  assert.equal(degradedBlocks(markdownTree(`${part}\n\n${part}`)).length, 0);
  assert.equal(degradedBlocks(markdownTree(`${part}\n# h\n${part}`)).length, 0);
  assert.equal(degradedBlocks(markdownTree(`> ${part}\n>\n> ${part}`)).length, 0);
  assert.equal(degradedBlocks(markdownTree(`${part}\n${part}`)).length, 1);
});

test('#1218 R1218-1: fenced code is skipped, closed or not, and the closer must match', () => {
  const stars = `${'*'.repeat(700)}x`; // a bare run of stars is an hr in marked, not a hazard
  const closed = markdownTree(`\`\`\`\n${stars}\n\`\`\``);
  assert.equal(degradedBlocks(closed).length, 0);
  assert.equal(closed.blocks[0].t, 'code');
  assert.equal(degradedBlocks(markdownTree(`\`\`\`\n${stars}`)).length, 0);
  assert.equal(degradedBlocks(markdownTree(`\`\`\`\n${stars}\n~~~\n${stars}\n\`\`\``)).length, 0);
  assert.equal(degradedBlocks(markdownTree(`\`\`\`\`\n${stars}\n\`\`\`\n${stars}\n\`\`\`\``)).length, 0);
  assert.equal(degradedBlocks(markdownTree(`\`\`\`\nx\n\`\`\`\n${stars}`)).length, 1);
});

const flat = (nodes) => nodes.map((n) => (n.t === 'text' ? n.text : n.children ? flat(n.children) : '')).join('');

test('#1218 R1218-2: the notice states N, and the passage is shown as its own text', () => {
  const src = 'a*'.repeat(350);
  const out = markdownTree(src);
  assert.deepEqual(degradedBlocks(out), []);
  const big = `${'*'.repeat(100)}x${'*'.repeat(600)}`;
  const tree = markdownTree(big);
  assert.equal(degradedBlocks(tree).length, 1);
  assert.equal(degradedBlocks(tree)[0].notice, NOTICE(700));
  assert.equal(tree.blocks[0].t, 'degraded');
  assert.equal(tree.blocks[1].t, 'paragraph');
  assert.ok(tree.blocks[1].children.every((n) => n.t === 'text'), 'only literal text, no emphasis nodes');
  assert.ok(tree.blocks[1].children.length <= 3, 'a run of placeholders is one node');
  assert.equal(flat(tree.blocks[1].children), big);
});

test('#1218 cold-2: a reference definition after a degraded passage still resolves its link', () => {
  const out = markdownTree(`see [docs][r]\n\n${'*'.repeat(60)}x\n\n[r]: https://example.com/x`);
  const link = JSON.stringify(out.blocks).match(/"t":"link","href":"([^"]+)"/);
  assert.equal(link?.[1], 'https://example.com/x');
  assert.deepEqual(degradedBlocks(out).map((b) => b.notice), [NOTICE(60)]);
});

test('#1218 cold-2: a degraded passage inside a list item leaves one list, and its notice precedes that list', () => {
  const out = markdownTree(`1. one\n2. two\n\n   ${'*'.repeat(60)}x\n\n3. three`);
  assert.deepEqual(out.blocks.map((b) => b.t), ['degraded', 'list']);
  assert.equal(out.blocks[0].notice, NOTICE(60));
  assert.equal(out.blocks[1].items.length, 3);
  const inItem = out.blocks[1].items[1].blocks.map((b) => (b.t === 'paragraph' ? flat(b.children) : b.t));
  assert.deepEqual(inItem, ['two', `${'*'.repeat(60)}x`]);
});

test('#1218 cold-2: the notice sits before the block holding the passage, and only there', () => {
  const bad = 'a*'.repeat(700);
  const out = markdownTree(`# Title\n\nfirst **bold**\n\n${bad}\n\nlast`);
  assert.deepEqual(out.blocks.map((b) => b.t), ['heading', 'paragraph', 'degraded', 'paragraph', 'paragraph']);
  assert.equal(flat(out.blocks[3].children), bad);
});

test('#1218 cold-2: a backslash and every delimiter in a degraded passage come out as typed', () => {
  const src = `\\*x ${'*_~[]'.repeat(130)}\\`;
  const out = markdownTree(src);
  assert.equal(flat(out.blocks.find((b) => b.t === 'paragraph').children), src);
});

test('#1218 cold-2: a degraded quote keeps its quote, a degraded bullet keeps its bullet', () => {
  const bad = 'a*'.repeat(700);
  const q = markdownTree(`> ${bad}`);
  assert.deepEqual(q.blocks.map((b) => b.t), ['degraded', 'blockquote']);
  const l = markdownTree(`- ${bad}\n- fine`);
  assert.deepEqual(l.blocks.map((b) => b.t), ['degraded', 'list']);
  assert.equal(l.blocks[1].items.length, 2);
});

test(`#1218 cold-2: a substituted 200 KB delimiter run lexes in under ${PRESCAN_BOUND_MS} ms`, () => {
  const { ms } = timed(() => Lexer.lex('\uE001'.repeat(2e5), { gfm: true }));
  assert.ok(ms < PRESCAN_BOUND_MS, `took ${ms} ms`);
});

test('#1218 R1218-2: the rest of the document still renders, one notice per degraded passage', () => {
  const bad = 'a*'.repeat(700);
  const out = markdownTree(`# Title\n\n${bad}\n\nlater **bold** text\n\n${bad}`);
  assert.equal(out.blocks[0].t, 'heading');
  assert.equal(degradedBlocks(out).length, 2);
  assert.ok(JSON.stringify(out.blocks).includes('"strong"'));
});

test('#1218 R1218-2: the tree stays plain data', () => {
  const out = markdownTree(`# t\n\n${'a*'.repeat(700)}`);
  assert.deepEqual(structuredClone(out), out);
});

function allChangeArtifacts() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.md')) out.push({ name: p, text: readFileSync(p, 'utf8') });
    }
  };
  const root = join(HERE, '..', '..', '..', '..', 'openspec', 'changes');
  if (existsSync(root)) walk(root);
  return out;
}

function assertNoDegradation(files, t) {
  let max = 0;
  const hits = [];
  for (const { name, text } of files) {
    const spans = prescan(text.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, ''));
    for (const s of spans) {
      max = Math.max(max, s.marks);
      if (s.degraded) hits.push(name);
    }
  }
  t?.diagnostic(`largest real span: ${max} marks over ${files.length} files`);
  assert.deepEqual(hits, [], `degraded: ${hits.join(', ')}`);
}

test('#1218 R1218-3: no real artifact under openspec/changes is degraded', (t) => {
  const files = allChangeArtifacts();
  assert.ok(files.length > 4, 'the tree carries artifacts');
  assertNoDegradation(files, t);
});

test('#1218 R1218-3: the zero-degradation assertion is a real detector and names the fixture', () => {
  const files = [...allChangeArtifacts(), { name: 'fixture-601', text: 'a*'.repeat(601) }];
  assert.throws(() => assertNoDegradation(files), /fixture-601/);
});

// ── #1218 cold-1: the pre-scan's fence rule is marked's, so a non-fence line cannot blind it ──

const HAZARD = '*a '.repeat(6000);

test('#1218 cold-1: a one-line ```x``` is not a fence, so the hazard after it degrades in under ' + PRESCAN_BOUND_MS + ' ms', () => {
  const { value, ms } = timed(() => markdownTree(`\`\`\`x\`\`\`\n${HAZARD}`));
  assert.equal(degradedBlocks(value).length, 1);
  assert.ok(ms < PRESCAN_BOUND_MS, `took ${ms} ms`);
});

test('#1218 cold-1: a four-space indented ``` is code, not a fence, so the hazard after it degrades in under ' + PRESCAN_BOUND_MS + ' ms', () => {
  const { value, ms } = timed(() => markdownTree(`    \`\`\`\n${HAZARD}`));
  assert.equal(degradedBlocks(value).length, 1);
  assert.ok(ms < PRESCAN_BOUND_MS, `took ${ms} ms`);
});

test('#1218 cold-1: a backtick fence whose info string holds a backtick is not a fence', () => {
  assert.equal(prescan(`\`\`\`a\`b\n${HAZARD}`).filter((s) => s.degraded).length, 1);
  assert.equal(prescan(`~~~a\`b\n${HAZARD}`).filter((s) => s.degraded).length, 0);
});

test('#1218 cold-1: up to three leading spaces still open a fence; a closer needs the opener, at most three spaces, and only blanks after it', () => {
  const stars = `${'*'.repeat(700)}x`; // a bare run of stars is an hr in marked, not a hazard
  const degraded = (src) => prescan(src).filter((s) => s.degraded).length;
  assert.equal(degraded(`   \`\`\`\n${stars}\n   \`\`\``), 0);
  // four spaces: not a closer, the fence stays open
  assert.equal(degraded(`\`\`\`\n${stars}\n    \`\`\`\n${stars}`), 0);
  // text after the closer: not a closer
  assert.equal(degraded(`\`\`\`\n${stars}\n\`\`\` x\n${stars}`), 0);
  // a shorter closer does not close
  assert.equal(degraded(`\`\`\`\`\n${stars}\n\`\`\`\n${stars}`), 0);
  // a longer closer closes
  assert.equal(degraded(`\`\`\`\n${stars}\n\`\`\`\`\n${stars}`), 1);
  // trailing spaces after the closer are fine
  assert.equal(degraded(`\`\`\`\n${stars}\n\`\`\`  \n${stars}`), 1);
});

// ── #1218 cold-3: a multi-line quote paragraph is one span, as it is to marked ──

const degradedCount = (src) => prescan(src).filter((s) => s.degraded).length;

test('#1218 cold-3: 20 quote lines of one paragraph are one span and degrade in under ' + PRESCAN_BOUND_MS + ' ms', () => {
  const input = Array.from({ length: 20 }, () => `> ${'*a '.repeat(290)}`).join('\n');
  const { value, ms } = timed(() => markdownTree(input));
  assert.equal(degradedBlocks(value).length, 1);
  assert.ok(ms < PRESCAN_BOUND_MS, `took ${ms} ms`);
});

test('#1218 cold-3: a quote paragraph continues lazily, and ends at a blank, an empty quote line, or a block of its own', () => {
  const part = 'a*'.repeat(400);
  assert.equal(degradedCount(`> ${part}\n${part}`), 1, 'lazy continuation joins');
  assert.equal(degradedCount(`> ${part}\n> ${part}`), 1);
  assert.equal(degradedCount(`> ${part}\n>\n> ${part}`), 0, 'an empty quote line ends it');
  assert.equal(degradedCount(`> ${part}\n\n> ${part}`), 0, 'a blank line ends it');
  assert.equal(degradedCount(`> ${part}\n> # h\n> ${part}`), 0);
  assert.equal(degradedCount(`> ${part}\n> - ${part}`), 0, 'a list inside the quote is its own span');
  assert.equal(degradedCount(`${part}\n> ${part}`), 0, 'a quote interrupts a plain paragraph');
  assert.equal(degradedCount(`>> ${part}\n> ${part}`), 1, 'marked joins a shallower lazy line');
  assert.equal(degradedCount(`> ${part}\n>> ${part}`), 0, 'a deeper quote is a new block');
});

test('#1218 cold-3: a list item and its continuation lines are one span', () => {
  const part = 'a*'.repeat(400);
  assert.equal(degradedCount(`- ${part}\n  ${part}`), 1);
  assert.equal(degradedCount(`- ${part}\n${part}`), 1);
  assert.equal(degradedCount(`- ${part}\n- ${part}`), 0);
});

test('#1218 cold-3: marked itself joins what the span rule joins', () => {
  const kinds = (src) => Lexer.lex(src, { gfm: true }).map((t) => t.type);
  assert.deepEqual(kinds('> a\n> b'), ['blockquote']);
  const quote = Lexer.lex('> a\nb', { gfm: true })[0];
  assert.equal(quote.tokens.length, 1);
  const item = Lexer.lex('- a\n  b\nc', { gfm: true })[0].items[0];
  assert.equal(item.tokens.length, 1);
});

test('#1218 cold-3: a 262000-character quote prefix is scanned in linear time', () => {
  const { ms } = timed(() => prescan('>'.repeat(262000)));
  assert.ok(ms < 200, `took ${ms} ms`);
});

// ── #1218 cold review round 2, cold-2: marked's hr and setext rules end a span ──

test('#1218 cold-2 (r2): a thematic break after a degraded paragraph survives as an hr, with the text after it', () => {
  const out = markdownTree('para' + ' a*b'.repeat(700) + '\n***\nafter');
  assert.deepEqual(out.blocks.map((b) => b.t), ['degraded', 'paragraph', 'hr', 'paragraph']);
  assert.equal(flat(out.blocks[3].children), 'after');
});

test('#1218 cold-2 (r2): a setext underline after a degraded paragraph makes it a heading, as marked does', () => {
  for (const underline of ['---', '===']) {
    const out = markdownTree('para' + ' a*b'.repeat(700) + `\n${underline}\nafter`);
    assert.deepEqual(out.blocks.map((b) => b.t), ['degraded', 'heading', 'paragraph'], underline);
    assert.ok(flat(out.blocks[1].children).startsWith('para a*b a*b'), underline);
    assert.equal(flat(out.blocks[2].children), 'after', underline);
  }
});

test('#1218 cold-2 (r2): every spelling of marked\'s hr ends a span, and the underline ends it inclusively', () => {
  const part = 'a*'.repeat(400);
  for (const hr of ['***', '* * *', '___', '- - -', '  ***', '***   ']) {
    assert.equal(degradedCount(`${part}\n${hr}\n${part}`), 0, `hr ${JSON.stringify(hr)}`);
  }
  for (const underline of ['---', '===', '-', '=', '--  ']) {
    assert.equal(degradedCount(`${part}\n${underline}\n${part}`), 0, `underline ${JSON.stringify(underline)}`);
  }
  const [span] = prescan(`${part}\n${part}\n===\nnext`);
  assert.equal(span.to, 3, 'the underline line belongs to the span it closes');
  assert.equal(degradedCount(`${part}\n    ***\n${part}`), 1, 'four spaces is not an hr');
  assert.equal(degradedCount(`${part}\n--x\n${part}`), 1, 'not an underline');
});

test('#1218 cold-2 (r2): marked agrees with the rules the pre-scan mirrors', () => {
  const kinds = (src) => Lexer.lex(src, { gfm: true }).map((t) => t.type);
  assert.deepEqual(kinds('p\n***\nq'), ['paragraph', 'hr', 'paragraph']);
  assert.deepEqual(kinds('p\n---\nq'), ['heading', 'paragraph']);
  assert.deepEqual(kinds('p\n===\nq'), ['heading', 'paragraph']);
});

test('#1218 cold-2 (r2): a line of nothing but delimiters is marked\'s thematic break, not a passage', () => {
  for (const line of ['*'.repeat(2e5), '_'.repeat(2e5), '-'.repeat(2e5)]) {
    const out = markdownTree(line);
    assert.deepEqual(out.blocks.map((b) => b.t), ['hr'], line.slice(0, 3));
  }
});

// ── #1218 cold review round 2, cold-3: same-length placeholders, not backslashes ──
// Backslash escapes are context-sensitive in CommonMark: they are literal inside a
// code span and inside an autolink, so an escaped `x_y` there shows its backslash.

const HAZARD_LINE = (head) => head + ' a*b'.repeat(700); // 704 delimiters or more, one line
const nodesOf = (tree) => {
  const out = [];
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    out.push(n);
    for (const key of ['children', 'blocks', 'items']) if (n[key]) walk(n[key]);
  };
  walk(tree.blocks);
  return out;
};

test('#1218 cold-3 (r2): a code span inside a degraded passage keeps exactly what was typed', () => {
  const out = markdownTree(HAZARD_LINE('Use `x_y*z[0]` here.'));
  assert.equal(degradedBlocks(out).length, 1);
  const spans = nodesOf(out).filter((n) => n.t === 'codespan');
  assert.deepEqual(spans.map((n) => n.text), ['x_y*z[0]']);
});

test('#1218 cold-3 (r2): an autolink inside a degraded passage keeps its text and its href', () => {
  const out = markdownTree(HAZARD_LINE('<https://example.com/a_b>'));
  assert.equal(degradedBlocks(out).length, 1);
  const links = nodesOf(out).filter((n) => n.t === 'link');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, 'https://example.com/a_b');
  assert.equal(flat(links[0].children), 'https://example.com/a_b');
});

test('#1218 cold-3 (r2): a bare url, an image alt and an inert link target keep their characters', () => {
  const out = markdownTree(HAZARD_LINE('see https://example.com/a_b_c and ![a_b](x_y.png) and [t_u](rel_path.md)'));
  const nodes = nodesOf(out);
  assert.ok(nodes.some((n) => n.t === 'link' && n.href === 'https://example.com/a_b_c'));
  assert.ok(JSON.stringify(out.blocks).includes('https://example.com/a_b_c'));
  assert.ok(!/[-\\]/.test(JSON.stringify(out.blocks.filter((b) => b.t !== 'degraded'))), 'no placeholder and no backslash reaches the tree');
});

test('#1218 cold-3 (r2): the tokenizer sees a same-length, delimiter-free passage, and the tree is restored', () => {
  const input = `${'*'.repeat(2e5)}x`;
  const seen = [];
  const out = markdownTree(input, (text, options) => {
    seen.push(text);
    return Lexer.lex(text, options);
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].length, input.length, 'substitution keeps the length');
  assert.ok(!/[*_~[\]\\]/.test(seen[0]), 'no delimiter reaches the tokenizer');
  assert.equal(flat(out.blocks.find((b) => b.t === 'paragraph').children), input);
});

test('#1218 cold-3 (r2): a document that already uses private-use characters is restored byte for byte', () => {
  const head = ' keep ';
  const out = markdownTree(HAZARD_LINE(head));
  assert.equal(flat(out.blocks.find((b) => b.t === 'paragraph').children).startsWith(head), true);
  assert.equal(flat(out.blocks.find((b) => b.t === 'paragraph').children), HAZARD_LINE(head));
});

test('#1218 cold-3 (r2): when the whole private-use block is taken, the passage is shown as written under its notice', () => {
  let pua = '';
  for (let c = 0xe000; c <= 0xf8ff; c++) pua += String.fromCharCode(c);
  const src = `${pua}\n\n${HAZARD_LINE('tail')}`;
  const out = markdownTree(src);
  assert.equal(out.blocks[0].t, 'degraded');
  assert.equal(out.blocks.at(-1).t, 'literal');
  assert.equal(out.blocks.at(-1).text, src);
});

test(`#1218 cold-3 (r2): a 200 KB delimiter run is substituted, lexed and restored in under ${PRESCAN_BOUND_MS} ms`, () => {
  const { value, ms } = timed(() => markdownTree(`${'*'.repeat(2e5)}x`));
  assert.equal(degradedBlocks(value).length, 1);
  assert.ok(ms < PRESCAN_BOUND_MS, `took ${ms} ms`);
});
// ── cold-4: adjacent text merges ──

test('#1218 cold-4 (r2): a degraded line is a handful of text nodes, not one per mark', () => {
  for (const unit of [' a*b', ' a*<b>', ' a*<!-- c -->', ' a\\*b']) {
    const out = markdownTree('x' + unit.repeat(700));
    const p = out.blocks.find((b) => b.t === 'paragraph');
    assert.ok(p.children.length <= 3, `${JSON.stringify(unit)}: ${p.children.length} nodes`);
    assert.equal(flat(p.children).length > 1000, true);
  }
});
