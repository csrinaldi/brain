// marked-usage-guard.test.mjs — the vendored tokenizer is reachable through
// ONE door: `lib/markdown.mjs` importing exactly `{ Lexer }` and making exactly
// two calls on it: `Lexer.lex(` (static) and `.blockTokens(` on a `new Lexer(...)`
// instance (#1198, R1198-11, R1198-17; #1218, R1218-4). marked's own renderer and
// `marked.parse` emit HTML strings; the page never assigns markup, so the
// only safe use is the tokenizer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const UI_DIR = dirname(fileURLToPath(import.meta.url));
const DOOR = 'lib/markdown.mjs';

function sourcesUnder(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name !== 'vendor' && ent.name !== 'node_modules') sourcesUnder(full, out);
    } else if (/\.(mjs|js)$/.test(ent.name) && !ent.name.endsWith('.test.mjs')) {
      out.push(full);
    }
  }
  return out;
}

/** Blank comments and string bodies so prose never reads as code. */
function codeOnly(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1 '))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** Returns the list of violations for one file's text. Exported shape: a
 *  function, so the self-tests can feed it injected sources. */
export function markedViolations(rel, text) {
  const bad = [];
  const code = codeOnly(text);
  const isDoor = rel === DOOR;
  // An IMPORT of the vendored file: `from '…marked.esm.js'` or `import('…marked.esm.js')`.
  // A path string elsewhere (server.mjs's allow-list entry) is not an import.
  const importsVendor = /\bfrom\s*['"][^'"]*marked\.esm\.js['"]|\bimport\s*\(?\s*['"][^'"]*marked\.esm\.js['"]/.test(code);

  if (importsVendor && !isDoor) bad.push(`${rel}: imports the vendored marked file, only ${DOOR} may`);
  if (isDoor) {
    for (const m of code.matchAll(/\bimport\s+([^;]*?)\bfrom\s*['"]([^'"]*marked[^'"]*)['"]/g)) {
      if (m[1].replace(/\s+/g, '') !== '{Lexer}') bad.push(`${rel}: imports "${m[1].trim()}" from marked, exactly { Lexer } is allowed`);
    }
    if (/\bimport\s*\(/.test(code)) bad.push(`${rel}: dynamic import`);
  }
  if (/\bmarked\s*\(/.test(code) || /\bmarked\./.test(code.replace(/marked\.esm\.js/g, ''))) bad.push(`${rel}: uses marked(...) or marked.*`);
  if (/\bparseInline\b/.test(code)) bad.push(`${rel}: parseInline`);
  for (const m of code.matchAll(/\bimport\s+[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) {
    if (/\bParser\b/.test(m[0])) bad.push(`${rel}: Parser in an import`);
    if (/^marked(\/|$)/.test(m[1])) bad.push(`${rel}: bare specifier "${m[1]}"`);
  }
  for (const m of code.matchAll(/\bLexer\.(\w*)/g)) {
    if (m[1] !== 'lex') bad.push(`${rel}: Lexer.${m[1]} — only Lexer.lex( is allowed`);
  }
  // The inline phase, in any case, anywhere in the ui sources; `.inline(` only as a member call.
  for (const m of code.matchAll(/\b(inlineTokens|lexInline)\b|\.\s*(inline)\s*\(/gi)) {
    bad.push(`${rel}: ${m[1] ?? m[2]} — the inline phase is off limits`);
  }
  if (isDoor) {
    for (const m of code.matchAll(/\b(Parser|Renderer|TextRenderer|Hooks)\b/g)) bad.push(`${rel}: ${m[1]} — the HTML emitters are off limits`);
  }
  if (isDoor) {
    // Every other mention of the class, so an alias cannot dodge the member checks.
    const noImport = code.replace(/\bimport\s+[^;]*?\bfrom\s*['"][^'"]*['"]\s*;?/g, ' ');
    const mentions = [...noImport.matchAll(/\bLexer\b/g)].length;
    const allowed = [...noImport.matchAll(/\bLexer\.lex\s*\(|\bnew\s+Lexer\s*\(/g)].length;
    if (mentions !== allowed) bad.push(`${rel}: Lexer used other than as Lexer.lex( or new Lexer(`);
    const instances = new Set([...noImport.matchAll(/([\w$]+)\s*=\s*new\s+Lexer\s*\(/g)].map((m) => m[1]));
    const members = [
      ...noImport.matchAll(/\bnew\s+Lexer\s*\((?:[^()]|\([^()]*\))*\)\s*\.\s*([\w$]*)\s*(\(?)/g),
      ...[...instances].flatMap((name) => [...noImport.matchAll(new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}\\s*\\.\\s*([\\w$]*)\\s*(\\(?)`, 'g'))]),
    ];
    for (const m of members) {
      if (m[1] !== 'blockTokens' || m[2] !== '(') bad.push(`${rel}: a Lexer instance's .${m[1]} — only .blockTokens( is allowed`);
    }
    for (const name of instances) {
      if (new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}\\s*\\[`).test(noImport)) bad.push(`${rel}: computed member access on the Lexer instance ${name}`);
    }
  }
  for (const m of code.matchAll(/([\w$.]*)\.parse\s*\(/g)) {
    if (m[1] !== 'JSON' && m[1] !== 'Date') bad.push(`${rel}: ${m[1] || '(no receiver)'}.parse( — only JSON.parse and Date.parse`);
  }
  return bad;
}

test('#1198: no ui source (outside vendor/ and tests) misuses the vendored tokenizer', () => {
  const files = sourcesUnder(UI_DIR);
  assert.ok(files.length > 10, 'the scan must actually see the ui sources');
  const bad = files.flatMap((f) => markedViolations(relative(UI_DIR, f), readFileSync(f, 'utf8')));
  assert.deepEqual(bad, []);
});

test('#1198 self-test: marked.parse(text) and a bare marked import are violations', () => {
  assert.notDeepEqual(markedViolations('lib/x.mjs', 'const h = marked.parse(text);'), []);
  assert.notDeepEqual(markedViolations('lib/x.mjs', "import { marked } from 'marked';"), []);
  assert.notDeepEqual(markedViolations('lib/x.mjs', "import { Lexer } from '../vendor/marked.esm.js';"), [], 'a non-door file');
});

test('#1198 self-test: the door itself is held to { Lexer } and Lexer.lex(', () => {
  const ok = "import { Lexer } from '../vendor/marked.esm.js';\nconst t = Lexer.lex(s, {});";
  assert.deepEqual(markedViolations(DOOR, ok), []);
  assert.notDeepEqual(markedViolations(DOOR, "import { Lexer, Parser } from '../vendor/marked.esm.js';"), []);
  assert.notDeepEqual(markedViolations(DOOR, "import * as m from '../vendor/marked.esm.js';"), []);
  assert.notDeepEqual(markedViolations(DOOR, ok + '\nLexer.lexInline(s);'), []);
  assert.notDeepEqual(markedViolations(DOOR, ok + "\nawait import('../vendor/marked.esm.js');"), []);
  assert.notDeepEqual(markedViolations(DOOR, ok + '\nthing.parse(x);'), []);
  assert.deepEqual(markedViolations(DOOR, ok + '\nJSON.parse(x); Date.parse(y);'), []);
});

// ── #1218 cold review round 5: instance calls are held to the same rule ──
// The door may call exactly two things on the tokenizer: `Lexer.lex(` (static) and
// `.blockTokens(` on a `new Lexer(...)` instance. `inlineTokens`, `lexInline`, an
// instance `lex`, `Parser`, `Renderer` and `marked(` all run the inline phase or
// emit HTML, which the pre-scan exists to keep off hostile input.

test('#1218 cold-2 (r5) self-test: the two permitted calls pass', () => {
  const ok = "import { Lexer } from '../vendor/marked.esm.js';\nconst a = Lexer.lex(s, {});\nconst lexer = new Lexer(opts());\nconst b = lexer.blockTokens(s, []);";
  assert.deepEqual(markedViolations(DOOR, ok), []);
  assert.deepEqual(markedViolations(DOOR, ok.replace('const lexer = new Lexer(opts());\nconst b = lexer.blockTokens', 'const b = new Lexer(opts()).blockTokens')), []);
});

test('#1218 cold-2 (r5) self-test: any other call on a Lexer instance or the class fails the guard', () => {
  const head = "import { Lexer } from '../vendor/marked.esm.js';\n";
  const bad = [
    'new Lexer(o).inlineTokens(x);',
    'const l = new Lexer(o); l.inlineTokens(x);',
    'const l = new Lexer(o); l.lex(x);',
    'const l = new Lexer(o); l.lexInline(x);',
    'const l = new Lexer(o); l.inline(x);',
    'const l = new Lexer(o); l.BlockTokens(x);',
    'const l = new Lexer(o); l["inlineTokens"](x);',
    'new Lexer(o).lex(x);',
    'Lexer.lexInline(x);',
    'Lexer.Lex(x);',
    'const L = Lexer; L.lexInline(x);',
    'const p = new Parser(); p.parse(t);',
    'const r = new Renderer();',
    'marked(x);',
  ];
  for (const snippet of bad) {
    assert.notDeepEqual(markedViolations(DOOR, head + snippet), [], snippet);
  }
});

test('#1218 cold-2 (r5): the real door passes, and it makes exactly the two permitted calls', () => {
  const door = readFileSync(join(UI_DIR, DOOR), 'utf8');
  assert.deepEqual(markedViolations(DOOR, door), []);
  const code = codeOnly(door);
  assert.ok(/\bLexer\.lex\s*\(/.test(code) && /\bnew\s+Lexer\s*\(/.test(code) && /\.blockTokens\s*\(/.test(code));
});

test('#1198 R1198-11/17: the real door imports the vendored file by a path that resolves to ui/vendor/marked.esm.js, and app.js imports nothing named marked', () => {
  const door = readFileSync(join(UI_DIR, DOOR), 'utf8');
  const spec = /from\s*['"]([^'"]*marked[^'"]*)['"]/.exec(door)?.[1];
  assert.equal(spec, '../vendor/marked.esm.js');
  // Resolved the way the browser does it: /lib/markdown.mjs + ../vendor/... = /vendor/marked.esm.js,
  // which server.mjs serves from ui/vendor/.
  assert.equal(new URL(spec, 'http://x/lib/markdown.mjs').pathname, '/vendor/marked.esm.js');
  assert.ok(existsSync(join(UI_DIR, 'lib', spec)), 'and node resolves it to a real file');
  const app = readFileSync(join(UI_DIR, 'static', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /from\s*['"][^'"]*marked[^'"]*['"]/, 'app.js imports no tokenizer');
});

// ── #1218: the tokenizer runs only in the worker, never on the main thread ──
// `markdownTree` is imported by exactly one module outside tests, and that
// module imports nothing but `./markdown.mjs`. `app.js` imports neither the
// adapter nor the worker file: it reaches the worker only as a URL.

const WORKER = 'lib/markdown-worker.mjs';

/** Violations of the worker-only rule for one file's text (injectable, so the self-tests can feed it). */
export function mainThreadTokenizerViolations(rel, text) {
  const bad = [];
  const code = codeOnly(text);
  const importsAdapter = /\bimport\s*\{[^}]*\bmarkdownTree\b[^}]*\}\s*from\s*['"][^'"]*markdown\.mjs['"]/.test(code);
  const importsWorkerFile = /\bimport\b[^;]*['"][^'"]*markdown-worker\.mjs['"]/.test(code);
  if (rel !== WORKER && importsAdapter) bad.push(`${rel}: imports markdownTree, only ${WORKER} may`);
  if (rel === 'static/app.js' && importsWorkerFile) bad.push(`${rel}: imports the worker file instead of spawning it`);
  if (rel === WORKER) {
    const specs = [...code.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    if (specs.length !== 1 || specs[0] !== './markdown.mjs') bad.push(`${rel}: imports ${JSON.stringify(specs)}, only ./markdown.mjs is allowed`);
  }
  return bad;
}

test('#1218 R1218-4: only the worker imports markdownTree, and the worker imports only the adapter', () => {
  const files = sourcesUnder(UI_DIR);
  const bad = files.flatMap((f) => mainThreadTokenizerViolations(relative(UI_DIR, f), readFileSync(f, 'utf8')));
  assert.deepEqual(bad, []);
  assert.ok(files.some((f) => relative(UI_DIR, f) === WORKER), 'the scan sees the worker file');
});

test('#1218 R1218-4 self-test: the main-thread rule fails on injected violations', () => {
  const adapter = "import { markdownTree } from './lib/markdown.mjs';";
  assert.notDeepEqual(mainThreadTokenizerViolations('static/app.js', adapter), []);
  assert.notDeepEqual(mainThreadTokenizerViolations('lib/other.mjs', "import { markdownTree } from './markdown.mjs';"), []);
  assert.notDeepEqual(mainThreadTokenizerViolations('static/app.js', "import { reply } from './lib/markdown-worker.mjs';"), []);
  assert.notDeepEqual(mainThreadTokenizerViolations(WORKER, "import { markdownTree } from './markdown.mjs';\nimport { Lexer } from '../vendor/marked.esm.js';"), []);
  assert.deepEqual(mainThreadTokenizerViolations(WORKER, "import { markdownTree } from './markdown.mjs';"), []);
});

test('#1218 R1218-4: the worker file reaches the tokenizer only through the adapter, so it resolves to ui/vendor/marked.esm.js and calls no marked.parse', () => {
  const worker = readFileSync(join(UI_DIR, WORKER), 'utf8');
  assert.deepEqual(markedViolations(WORKER, worker), []);
  assert.doesNotMatch(worker, /marked/);
  assert.equal(new URL('../vendor/marked.esm.js', 'http://x/lib/markdown.mjs').pathname, '/vendor/marked.esm.js');
});
