// axis-port.guard.test.mjs — slice S1 of #1114: selection outside the port is a
// defect, and this guard makes every instance visible and frozen.
//
// ADR-0024: each axis (memory backend, agent platform, SDD engine, VCS provider,
// review engine) is selected by configuration and callers use the axis, never a
// concrete implementation. #123 closed without meeting that rule and nothing
// noticed. This meta-test is the thing that notices.
//
// WHAT IT SCANS. Production `.mjs` under `brain/scripts/**`, excluding tests,
// `axes/*/adapters/**` (the one place allowed to name a concrete
// implementation), i18n catalogs and fixtures. Three rules:
//   spawn-concrete:<tool>  a call whose first argument is a concrete tool
//                   (engram, gentle-ai, gh, glab, codex, gemini);
//   adapter-import  a static or dynamic import of `axes/<axis>/adapters/<x>`
//                   from a file outside that axis' directory;
//   axis-branch     a comparison, `case` or `.includes()` against a concrete
//                   axis value (github, engram, codex, claude, ...).
//
// HOW. Same method as test-spawn-hygiene.test.mjs: `maskNonCode` blanks
// comments, strings, templates and regex bodies, so a match is only ever real
// syntax. Because the literal itself is masked, each rule finds the CODE half
// in the masked text and reads the LITERAL half from the original at the same
// offset. Axis value sets are NOT retyped: they come from the adapter
// directories (the closed set the layout guard already pins) and are
// cross-checked against the exported closed sets where those exist.
//
// THE ALLOWLIST (axis-port.allowlist.mjs) is keyed by file + rule, never by
// line (lines drift), and freezes a per-entry hit count `max`. The guard fails
// on: an uncovered hit, a count above `max`, a stale entry (zero hits), a count
// below `max` (shrink the entry — debt only goes down), an empty/placeholder
// reason, and a debt owner that is not an issue reference. S1 fixes no
// offender; every entry is either debt owned by an issue or `legitimate`.
//
// KNOWN LIMITS OF THE MASKER (documented, not hidden). `maskNonCode` ends a
// template literal at its first unescaped backtick (so a template nested inside
// `${...}` desyncs it, and the code inside `${...}` is blanked and invisible).
// The scan therefore ALWAYS uses `maskNonCodeNested`, a local template-aware
// masker that keeps `${...}` code visible. A desync leaves the masked text
// unbalanced, which `maskIsInSync` detects; the scan then FAILS NAMING THE FILE
// rather than trust a bad mask. The shared `maskNonCode` is untouched.
// Not detected: whatever hides behind a variable (`const T = 'gh'; spawn(T)`)
// and `['github'].includes(x)` literal-array membership; the guard is a net
// for the idiomatic spellings, not a type checker.
//
// Set AXIS_PORT_DUMP=<file> to write the measured hits as JSON (that is how
// the allowlist was populated from the guard's own output, not by hand).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, globSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maskNonCode } from '../lib/mask-non-code.mjs';
import { SDD_ENGINES, AGENT_PLATFORMS } from '../harness/platform.mjs';
import { MEMORY_BACKENDS } from '../memory/lib/backend-resolve.mjs';
import { ALLOWLIST } from './axis-port.allowlist.mjs';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');
const AXES = join(SCRIPTS, 'axes');

/** Concrete CLIs whose direct invocation outside an adapter is a leak. */
const CONCRETE_TOOLS = ['engram', 'gentle-ai', 'gh', 'glab', 'codex', 'gemini'];

/** Callees that launch a process (own helpers `run`/`capture` included). */
const SPAWN_CALLEES = [
  'spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork', 'run', 'capture',
];

/** `plain` is an axis value that collides with non-axis words ("plain" output). */
const NOISY_VALUES = new Set(['plain']);

/** Axis directories whose adapter dir names ARE the axis value set. */
const AXIS_DIRS = ['memory', 'vcs', 'platform', 'sdd-engine', 'review-engine'];

// An adapter name is a basename with no further dot: every helper leaf (`.roles.`, `.descriptor.`,
// `.readiness.`) and every test is excluded (#1128).
function adapterNames(axis) {
  return readdirSync(join(AXES, axis, 'adapters'))
    .filter((f) => f.endsWith('.mjs') && !f.slice(0, -'.mjs'.length).includes('.'))
    .map((f) => f.slice(0, -'.mjs'.length));
}

/** The concrete axis values, derived from the adapter directories. */
export function axisValues() {
  const set = new Set();
  for (const axis of AXIS_DIRS) for (const n of adapterNames(axis)) set.add(n);
  for (const n of NOISY_VALUES) set.delete(n);
  return [...set].sort();
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Fallback masker that understands `${ ... }` inside template literals, so a
 * template nested in an interpolation no longer desyncs it (the case
 * `maskNonCode` cannot handle). Interpolation CONTENT stays visible, because a
 * call inside `${ }` is real code. Same-length output, newlines preserved.
 */
export function maskNonCodeNested(src) {
  const n = src.length;
  const out = [];
  const frames = []; // { tpl: true } | { depth: number } (an open `${`)
  const blank = (c) => (c === '\n' ? '\n' : ' ');
  const regexOk = () => {
    const t = out.join('').trimEnd();
    return t === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(t) || /\b(?:return|typeof|case|in|of|void|delete|throw)$/.test(t);
  };
  let i = 0;
  while (i < n) {
    const c = src[i];
    const top = frames[frames.length - 1];
    if (top && top.tpl) {
      if (c === '\\') { out.push(' ', blank(src[i + 1] ?? ' ')); i += 2; continue; }
      if (c === '`') { frames.pop(); out.push(' '); i += 1; continue; }
      if (c === '$' && src[i + 1] === '{') { frames.push({ depth: 0 }); out.push(' ', ' '); i += 2; continue; }
      out.push(blank(c)); i += 1; continue;
    }
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') { out.push(' '); i += 1; } continue; }
    if (c === '/' && c2 === '*') {
      out.push(' ', ' '); i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out.push(blank(src[i])); i += 1; }
      out.push(' ', ' '); i += 2; continue;
    }
    if (c === '/' && regexOk()) {
      let inClass = false; out.push(' '); i += 1;
      while (i < n && src[i] !== '\n' && (inClass || src[i] !== '/')) {
        if (src[i] === '\\') { out.push(' ', ' '); i += 2; continue; }
        if (src[i] === '[') inClass = true; else if (src[i] === ']') inClass = false;
        out.push(' '); i += 1;
      }
      out.push(' '); i += 1; continue;
    }
    if (c === '\'' || c === '"') {
      out.push(' '); i += 1;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') { out.push(' ', ' '); i += 2; continue; }
        out.push(blank(src[i])); i += 1;
      }
      out.push(' '); i += 1; continue;
    }
    if (c === '`') { frames.push({ tpl: true }); out.push(' '); i += 1; continue; }
    if (c === '{' && top) { top.depth += 1; out.push(c); i += 1; continue; }
    if (c === '}' && top) {
      if (top.depth === 0) { frames.pop(); out.push(' '); i += 1; continue; }
      top.depth -= 1; out.push(c); i += 1; continue;
    }
    out.push(c); i += 1;
  }
  return out.join('');
}

/** True when brackets balance in the masked text (cheap desync detector). */
export function maskIsInSync(masked) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const stack = [];
  for (const c of masked) {
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === ')' || c === '}' || c === ']') {
      if (stack.pop() !== c) return false;
    }
  }
  return stack.length === 0;
}

function lineOf(src, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (src.charCodeAt(i) === 10) n += 1;
  return n;
}

/**
 * Scans one source text. `rel` is the path relative to brain/scripts, with `/`.
 * Returns { hits: [{ file, rule, line, text }], desync: boolean }.
 */
export function scanSource(rel, src, values = axisValues()) {
  // Always the template-aware masker: the shared `maskNonCode` blanks the code
  // inside `${ }` too, which hid real calls and branches (#1114 review).
  const masked = maskNonCodeNested(src);
  const hits = [];
  const push = (rule, idx, text) => hits.push({ file: rel, rule, line: lineOf(src, idx), text });
  const codeAt = (i) => masked[i] !== undefined && masked[i] !== ' ' && masked[i] !== '\n';

  const toolAlt = CONCRETE_TOOLS.map(esc).join('|');
  const callAlt = SPAWN_CALLEES.join('|');
  const valAlt = values.map(esc).join('|');

  // 1. spawn-concrete: callee(<quote>tool<end-or-space>...
  const spawnRe = new RegExp(
    `\\b(?:[A-Za-z_$][\\w$]*\\.)?(?:${callAlt})\\s*\\(\\s*(['"\`])(${toolAlt})(?=[\\s'"\`])`, 'g',
  );
  for (const m of src.matchAll(spawnRe)) if (codeAt(m.index)) push(`spawn-concrete:${m[2]}`, m.index, m[0]);

  // 2. adapter-import: from '<spec>' / import('<spec>') naming axes/<axis>/adapters/<x>
  const importRe = /\b(?:from|import\s*\(|import)\s*(['"])([^'"\n]*\/adapters\/[^'"\n]*)\1/g;
  const own = rel.startsWith('axes/') ? rel.split('/')[1] : null;
  for (const m of src.matchAll(importRe)) {
    if (!codeAt(m.index)) continue;
    const axisInSpec = /axes\/([\w-]+)\/adapters\//.exec(m[2]);
    if (axisInSpec) {
      if (axisInSpec[1] === own) continue;
    } else if (own === null) {
      // legacy-shaped specifier (`./adapters/x`) from outside axes/: still a leak
    } else continue;
    push('adapter-import', m.index, m[0]);
  }

  // 3. axis-branch: `=== 'v'`, `'v' ===`, `case 'v'`, `includes('v')`
  const right = new RegExp(`(?:[!=]==?|\\bcase\\b|\\bincludes\\s*\\()\\s*(['"])(?:${valAlt})\\1`, 'g');
  for (const m of src.matchAll(right)) if (codeAt(m.index)) push('axis-branch', m.index, m[0]);
  const left = new RegExp(`(['"])(?:${valAlt})\\1\\s*([!=]==?)`, 'g');
  for (const m of src.matchAll(left)) {
    const opIdx = m.index + m[0].length - m[2].length;
    if (codeAt(opIdx)) push('axis-branch', m.index, m[0]);
  }

  return { hits, desync: !maskIsInSync(masked) };
}

/** Production files in scope, as brain/scripts-relative `/` paths. */
export function inScopeFiles() {
  return globSync('**/*.mjs', { cwd: SCRIPTS })
    .map((p) => p.split(sep).join('/'))
    .filter((p) => !p.endsWith('.test.mjs'))
    .filter((p) => !/^axes\/[^/]+\/adapters\//.test(p))
    .filter((p) => !p.startsWith('i18n/') && !p.includes('/i18n/'))
    .filter((p) => !p.startsWith('node_modules/') && !p.includes('/fixtures/') && !p.includes('__fixtures__/'))
    .sort();
}

export function scanTree() {
  const hits = [];
  const desync = [];
  for (const rel of inScopeFiles()) {
    const r = scanSource(rel, readFileSync(join(SCRIPTS, rel), 'utf8'));
    hits.push(...r.hits);
    if (r.desync) desync.push(rel);
  }
  return { hits, desync };
}

const PLACEHOLDER_RE = /^(tbd|todo|fixme|n\/a|na|none|legacy|pending|wip|\?+|\.+|-+)$/i;

/** Validates allowlist entries; returns a list of problems (empty = fine). */
export function validateAllowlist(entries) {
  const problems = [];
  const seen = new Set();
  for (const e of entries) {
    const key = `${e.file} ${e.rule}`;
    if (seen.has(key)) problems.push(`duplicate entry: ${key}`);
    seen.add(key);
    const reason = typeof e.reason === 'string' ? e.reason.trim() : '';
    if (reason.length < 25 || PLACEHOLDER_RE.test(reason)) {
      problems.push(`${key}: reason is empty or a placeholder — write one specific sentence`);
    }
    if (e.owner !== 'legitimate' && !/^#\d+$/.test(String(e.owner))) {
      problems.push(`${key}: owner must be an issue reference like '#1115' or 'legitimate', got ${JSON.stringify(e.owner)}`);
    }
    if (!Number.isInteger(e.max) || e.max < 1) problems.push(`${key}: max must be a positive integer`);
  }
  return problems;
}

/** Compares measured hits against the allowlist; returns a list of problems. */
export function reconcile(hits, entries) {
  const problems = [];
  const counts = new Map();
  for (const h of hits) {
    const k = `${h.file} ${h.rule}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const byKey = new Map(entries.map((e) => [`${e.file} ${e.rule}`, e]));
  for (const [k, n] of counts) {
    const e = byKey.get(k);
    const lines = hits.filter((h) => `${h.file} ${h.rule}` === k).map((h) => `L${h.line}`).join(',');
    if (!e) problems.push(`UNCOVERED ${k} (${n} hit(s) at ${lines}) — fix it, or allowlist it with a reason and an owner`);
    else if (n > e.max) problems.push(`GREW ${k}: ${n} hits > max ${e.max} (at ${lines}) — a new leak in an allowlisted file`);
    else if (n < e.max) problems.push(`SHRANK ${k}: ${n} hits < max ${e.max} — lower max to ${n} (debt only goes down)`);
  }
  for (const e of entries) {
    if (!counts.has(`${e.file} ${e.rule}`)) problems.push(`STALE ${e.file} ${e.rule} — no longer hits, remove the entry`);
  }
  return problems;
}

// ── scanner unit tests (fixtures are plain strings, masked like real source) ──

const rulesOf = (src, rel = 'foo/bar.mjs') => scanSource(rel, src).hits.map((h) => h.rule);

test('#1128: axisValues() is unchanged by helper leaves (descriptors, readiness, roles)', () => {
  assert.deepEqual(axisValues(), ['antigravity', 'claude', 'codex', 'engram', 'gemini', 'gentle-ai', 'github', 'gitlab', 'plainfiles']);
});

test('#1114 S1: spawn of a concrete tool is a hit; the same text in a comment or string is not', () => {
  assert.deepEqual(rulesOf("spawnSync('gh', ['api'])"), ['spawn-concrete:gh']);
  assert.deepEqual(rulesOf("const r = capture('gentle-ai --version')"), ['spawn-concrete:gentle-ai']);
  assert.deepEqual(rulesOf("cp.execFileSync(\n  'engram', ['x'])"), ['spawn-concrete:engram']);
  assert.deepEqual(rulesOf("// spawnSync('gh', [])\nconst s = \"spawnSync('gh')\";"), []);
  assert.deepEqual(rulesOf("spawnSync('git', ['status'])"), []);
  assert.deepEqual(rulesOf("log('gh pr create failed')"), []);
});

test('#1114 S1: branching on a concrete axis value is a hit in every spelling', () => {
  assert.deepEqual(rulesOf("if (p === 'github') {}"), ['axis-branch']);
  assert.deepEqual(rulesOf("if ('gitlab' !== p) {}"), ['axis-branch']);
  assert.deepEqual(rulesOf("switch (p) { case 'engram': break; }"), ['axis-branch']);
  assert.deepEqual(rulesOf("if (list.includes('codex')) {}"), ['axis-branch']);
  assert.deepEqual(rulesOf("// p === 'github'\nconst s = \"x === 'github'\";"), []);
  assert.deepEqual(rulesOf("if (kind === 'plain') {}"), []);
  assert.deepEqual(rulesOf("if (kind === 'other') {}"), []);
});

test('#1114 S1: importing a concrete adapter from outside its axis is a hit', () => {
  assert.deepEqual(rulesOf("import gh from '../axes/vcs/adapters/github.mjs';"), ['adapter-import']);
  assert.deepEqual(rulesOf("const m = await import('../axes/memory/adapters/engram.mjs');"), ['adapter-import']);
  assert.deepEqual(rulesOf("import x from './adapters/github.mjs';", 'vcs/x.mjs'), ['adapter-import']);
  assert.deepEqual(rulesOf("import x from './adapters/github.mjs';", 'axes/vcs/x.mjs'), []);
  assert.deepEqual(rulesOf("import x from './adapters/github.mjs';", 'axes/vcs/x.mjs'), []);
  assert.deepEqual(rulesOf("import x from '../vcs/adapters/github.mjs';", 'axes/vcs/x.mjs'), []);
});

test('#1114 S1: side-effect and re-export imports of a concrete adapter are hits', () => {
  assert.deepEqual(rulesOf("import '../axes/vcs/adapters/github.mjs';\n"), ['adapter-import']);
  assert.deepEqual(rulesOf("import\"../axes/vcs/adapters/github.mjs\";\n"), ['adapter-import']);
  assert.deepEqual(rulesOf("export * from '../axes/vcs/adapters/github.mjs';\n"), ['adapter-import']);
  assert.deepEqual(rulesOf("export { a } from '../axes/memory/adapters/engram.mjs';\n"), ['adapter-import']);
  assert.deepEqual(rulesOf("import '../axes/vcs/adapters/github.mjs';\n", 'axes/vcs/x.mjs'), []);
  assert.deepEqual(rulesOf("// import '../axes/vcs/adapters/github.mjs';\n"), []);
});

test('#1114 S1: code inside a template interpolation is scanned, the literal text around it is not', () => {
  assert.deepEqual(rulesOf("const x = `${ capture('gh', []) }`;"), ['spawn-concrete:gh']);
  assert.deepEqual(rulesOf("const x = `a ${ provider === 'gitlab' } b`;"), ['axis-branch']);
  assert.deepEqual(rulesOf("const x = `a ${ y ? `n ${ p === 'github' }` : '' } b`;"), ['axis-branch']);
  assert.deepEqual(rulesOf("const x = `text capture('gh', []) and p === 'gitlab'`;"), []);
});

test('#1114 S1: an escaped quote inside a template literal does not desync the mask', () => {
  const src = "const t = `say \\`hi\\` and 'x' === 'github'`;\nif (p === 'gitlab') {}\n";
  const r = scanSource('foo/bar.mjs', src);
  assert.equal(r.desync, false);
  assert.deepEqual(r.hits.map((h) => h.line), [2]);
});

test('#1114 S1: a template nested in ${} desyncs maskNonCode; the template-aware masker the scan always uses recovers and sees code in ${}', () => {
  const src = "const a = `x ${ t ? ` (\\`${t}\\`)` : '' } y`;\nconst b = `p ${ capture('gh', []) } q`;\nif (p === 'gitlab') {}\n";
  assert.equal(maskIsInSync(maskNonCode(src)), false, 'precondition: the shared masker loses sync here');
  const r = scanSource('foo/bar.mjs', src);
  assert.equal(r.desync, false);
  assert.deepEqual(r.hits.map((h) => [h.rule, h.line]), [['spawn-concrete:gh', 2], ['axis-branch', 3]]);
});

test('#1114 S1: a file neither masker can balance is reported, never silently trusted', () => {
  const r = scanSource('foo/bar.mjs', 'if (a) {\n  x();\n');
  assert.equal(r.desync, true);
});

test('#1114 S1: axis values come from the adapter directories and cover the exported closed sets', () => {
  const values = axisValues();
  for (const v of [...MEMORY_BACKENDS, ...SDD_ENGINES, ...AGENT_PLATFORMS]) {
    if (NOISY_VALUES.has(v)) continue;
    assert.ok(values.includes(v), `closed-set member '${v}' is missing from the adapter-derived values`);
  }
  for (const v of ['github', 'gitlab', 'codex', 'gemini']) assert.ok(values.includes(v), v);
});

// ── allowlist validation unit tests ──

test('#1114 S1: allowlist validation refuses an empty reason, a placeholder and a non-issue owner', () => {
  const ok = { file: 'a.mjs', rule: 'axis-branch', max: 1, owner: '#1115', reason: 'Names the engram probe until #1115 routes it through the port.' };
  assert.deepEqual(validateAllowlist([ok]), []);
  assert.deepEqual(validateAllowlist([{ ...ok, owner: 'legitimate' }]), []);
  assert.equal(validateAllowlist([{ ...ok, reason: '' }]).length, 1);
  assert.equal(validateAllowlist([{ ...ok, reason: 'TODO' }]).length, 1);
  assert.equal(validateAllowlist([{ ...ok, reason: undefined }]).length, 1);
  assert.equal(validateAllowlist([{ ...ok, owner: 'later' }]).length, 1);
  assert.equal(validateAllowlist([{ ...ok, owner: '1115' }]).length, 1);
  assert.equal(validateAllowlist([{ ...ok, max: 0 }]).length, 1);
  assert.equal(validateAllowlist([ok, ok]).length, 1);
});

test('#1114 S1: reconcile reports uncovered, grown, shrunk and stale', () => {
  const e = (file, max) => ({ file, rule: 'axis-branch', max });
  const h = (file, line) => ({ file, rule: 'axis-branch', line });
  assert.match(reconcile([h('a', 1)], []).join('\n'), /UNCOVERED a axis-branch/);
  assert.match(reconcile([h('a', 1), h('a', 2)], [e('a', 1)]).join('\n'), /GREW/);
  assert.match(reconcile([h('a', 1)], [e('a', 2)]).join('\n'), /SHRANK/);
  assert.match(reconcile([], [e('a', 1)]).join('\n'), /STALE a axis-branch/);
  assert.deepEqual(reconcile([h('a', 1)], [e('a', 1)]), []);
});

// ── the guard itself ──

test('#1114 S1: the allowlist is well-formed (reasons, owners, counts)', () => {
  assert.deepEqual(validateAllowlist(ALLOWLIST), []);
});

test('#1114 S1: every axis-port leak in brain/scripts is either absent or allowlisted with a reason', () => {
  const { hits, desync } = scanTree();
  if (process.env.AXIS_PORT_DUMP) writeFileSync(process.env.AXIS_PORT_DUMP, JSON.stringify(hits, null, 1));
  assert.deepEqual(desync, [], `maskNonCode lost sync on: ${desync.join(', ')} — the scan of those files cannot be trusted`);
  const problems = reconcile(hits, ALLOWLIST);
  assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`);
});

test('#1114 S1: every allowlisted file still exists', () => {
  const files = new Set(inScopeFiles());
  const missing = ALLOWLIST.filter((e) => !files.has(e.file)).map((e) => e.file);
  assert.deepEqual(missing, [], `allowlist names files that are not in scope (moved, deleted or excluded): ${missing.join(', ')}`);
});
