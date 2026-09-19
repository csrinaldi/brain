// tokens.test.mjs — R998-1: the token block. Every state has a fg/bg token
// pair on bare `:root` (the light palette, the base); the dark palette lives
// under `prefers-color-scheme: dark` and redefines only tokens the base
// already defines; the font stacks are system stacks; no external resource.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { STATE_CODES } from '../lib/state-vocab.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, 'app.css'), 'utf8');
const html = readFileSync(join(HERE, 'index.html'), 'utf8');

function block(text, opener) {
  const i = text.indexOf(opener);
  assert.ok(i >= 0, `${opener} not found`);
  const open = text.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < text.length; j++) {
    if (text[j] === '{') depth++;
    if (text[j] === '}' && --depth === 0) return text.slice(open + 1, j);
  }
  assert.fail(`${opener} never closes`);
}
const tokensIn = (body) => [...body.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]);

test('#998: every state has a --state-<code>-fg and -bg token on bare :root', () => {
  const root = block(css, ':root');
  const names = new Set(tokensIn(root));
  for (const code of STATE_CODES) {
    assert.ok(names.has(`state-${code}-fg`), `--state-${code}-fg missing on :root`);
    assert.ok(names.has(`state-${code}-bg`), `--state-${code}-bg missing on :root`);
  }
});

test('#998: the dark palette redefines only tokens the light base already defines — light is the base', () => {
  const light = new Set(tokensIn(block(css, ':root')));
  const dark = tokensIn(block(css, '@media (prefers-color-scheme: dark)'));
  assert.ok(dark.length >= STATE_CODES.length * 2, 'the dark block redefines the state tokens');
  for (const name of dark) assert.ok(light.has(name), `--${name} is defined only in the dark block`);
  assert.ok(!/prefers-color-scheme:\s*light/.test(css), 'no light-only block: light is the default');
});

test('#998: system font stacks, no downloadable face, no external resource in the stylesheet or the shell', () => {
  assert.match(css, /--font-sans:\s*ui-sans-serif/);
  assert.match(css, /--font-mono:\s*ui-monospace/);
  assert.ok(!/@font-face|@import|url\(/.test(css), 'no font file, no import, no url()');
  assert.ok(!/https?:\/\//.test(css), 'no external resource in app.css');
  const external = [...html.matchAll(/https?:\/\/[^"'\s>]+/g)].map((m) => m[0]);
  assert.deepEqual(external, [], 'no external resource in index.html');
});

test('#998: no surface is hard-coded white outside the token block — the drawer follows the dark palette too (cold review of PR 1, correction)', () => {
  // Comments are not colours (an issue reference like #998 is not a hex), and the token blocks are where literals belong.
  // `white` as a COLOUR is forbidden; `white-space` is a property name and was
  // a false positive the moment a rule outside the token block needed it
  // (#1059 region 04, the batch's tiles), so the match stops at a hyphen.
  const withoutTokens = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/:root\s*\{[^}]*\}/g, '').replace(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{[^}]*\}\s*\}/g, '');
  const literals = [...withoutTokens.matchAll(/#[0-9a-fA-F]{3,8}\b|\bwhite\b(?!-)/g)].map((m) => m[0]);
  assert.deepEqual(literals, [], 'a colour outside the token block must read a token, never a literal (cold review of PR 2: a hard-coded light hex on the active mode button was illegible in dark)');
});
