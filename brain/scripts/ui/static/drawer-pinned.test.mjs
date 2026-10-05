// drawer-pinned.test.mjs — #1307 R1307-1, R1307-3: the drawer is pinned to the
// viewport and scrolls on its own; the tab bar stays visible while the body
// scrolls. Scans of the stylesheet, in the style of table-cells.test.mjs (a
// computed layout needs a real browser; the structure is tested in
// app-smoke.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of every rule whose selector list contains exactly `selector`, outside a media block. */
function declarationsFor(selector) {
  const top = CSS.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const out = [];
  for (const m of top.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].split(',').some((s) => s.trim() === selector)) out.push(m[2]);
  }
  return out.join(';');
}

test('R1307-1: the drawer is sticky, viewport-bounded and does not stretch to the page height', () => {
  const body = declarationsFor('.drawer');
  assert.match(body, /position:\s*sticky/);
  assert.match(body, /top:\s*0/);
  assert.match(body, /align-self:\s*flex-start/, 'align-items: stretch on .workspace would otherwise make it page-tall');
  assert.match(body, /max-height:\s*100vh/);
  assert.match(body, /overflow:\s*hidden/, 'the body scrolls, not the drawer as a whole');
});

test('R1307-2: the drawer body is the scroller', () => {
  const body = declarationsFor('.drawer-body');
  assert.match(body, /overflow:\s*auto/);
  assert.match(body, /flex:\s*1/);
  assert.match(body, /min-height:\s*0/, 'without it a flex child never shrinks below its content and never scrolls');
});

test('R1307-3: the tab bar lives in the head, a full-width line that does not scroll', () => {
  const head = declarationsFor('.drawer-head');
  assert.match(head, /flex:\s*none/, 'the head keeps its height; only the body shrinks');
  assert.match(head, /flex-wrap:\s*wrap/);
  assert.doesNotMatch(head, /position:\s*sticky/, 'it is outside the scroller, so it needs no sticky');
  assert.match(declarationsFor('.drawer .drawer-head .tabs'), /flex:\s*1 0 100%/);
});

test('R1307-4: the phone layout keeps a full-width, non-sticky drawer', () => {
  const media = CSS.match(/@media \(max-width: 760px\)\s*\{([\s\S]*?\n\})/)?.[1] ?? '';
  assert.match(media, /\.drawer\s*\{[^}]*position:\s*static/);
});

test('R1307-3: the head tab bar\'s zero padding and margin win the cascade over every later .tabs rule', () => {
  const top = CSS.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  // Selectors that match the tab bar inside the head: `.drawer` is its ancestor, `.drawer-head` its parent.
  const MATCHES = new Set(['.tabs', '.drawer .tabs', '.drawer-head .tabs', '.drawer .drawer-head .tabs']);
  const sides = { padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'], margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] };
  const winner = {};
  let order = 0;
  for (const m of top.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const sel of m[1].split(',').map((s) => s.trim())) {
      if (!MATCHES.has(sel)) continue;
      const specificity = (sel.match(/\./g) ?? []).length;
      for (const decl of m[2].split(';')) {
        const [prop, ...rest] = decl.split(':');
        const name = prop?.trim();
        if (!name) continue;
        const value = rest.join(':').trim();
        for (const longhand of sides[name] ?? [name]) {
          const rank = specificity * 1e6 + order++;
          if (!(longhand in winner) || rank > winner[longhand].rank) winner[longhand] = { rank, value, sel };
        }
      }
    }
  }
  for (const side of [...sides.padding, ...sides.margin]) {
    assert.match(winner[side]?.value ?? '', /^0(px)?$/, `${side} on the head tab bar resolves to ${winner[side]?.value} via "${winner[side]?.sel}", not 0`);
  }
});
