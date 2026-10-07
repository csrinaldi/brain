// table-cells.test.mjs — #1310 R1310-1..3: a class applied to a <td>/<th>/<tr>
// must not set a non-table `display`. `inline-block`/`block` on a cell takes it
// out of the table layout, so every later cell slides one column left. Chip
// styling belongs on an inner element. No DOM harness exists in this repo
// (sdd-view.test.mjs, design D9), so both rules are scans of the page's own
// source text.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_JS = readFileSync(join(HERE, 'app.js'), 'utf8');
const APP_CSS = readFileSync(join(HERE, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every literal class token given to a table element by `el('td'|'th'|'tr', <class>, ...)`. */
function tableElementClasses(text) {
  const found = new Map();
  for (const m of text.matchAll(/\bel\(\s*'(td|th|tr)'\s*,\s*(?:'([^']*)'|`([^`]*)`)/g)) {
    const raw = (m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, ' ');
    for (const token of raw.split(/\s+/).filter(Boolean)) found.set(token, m[1]);
  }
  return found;
}

/** [{ selector, body }] for every flat rule in the stylesheet (media blocks flattened). */
function rules(css) {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ selector: m[1].trim(), body: m[2] });
  return out;
}

/** True when the LAST compound of any selector in the list names `.cls`. */
function targetsClass(selector, cls) {
  return selector.split(',').some((s) => {
    const last = s.trim().split(/[\s>+~]+/).pop() ?? '';
    return new RegExp(`\\.${cls}(?![\\w-])`).test(last);
  });
}

test('#1310 R1310-1: the scan finds the table-element classes it is meant to guard', () => {
  const classes = tableElementClasses(APP_JS);
  for (const c of ['decision-title', 'anti-pattern-title', 'queue-pr', 'memory-when']) {
    assert.ok(classes.has(c), `${c} is applied to a table element and must be seen by the scan`);
  }
});

test('#1310 R1310-1: no rule for a class applied to a td/th/tr sets display', () => {
  const offenders = [];
  for (const [cls, tag] of tableElementClasses(APP_JS)) {
    for (const rule of rules(APP_CSS)) {
      if (targetsClass(rule.selector, cls) && /(^|[;\s])display\s*:/.test(rule.body)) {
        offenders.push(`.${cls} (on <${tag}>) in "${rule.selector}"`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'a display on a table cell breaks the table layout');
});

function functionBody(name) {
  const start = APP_JS.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  return APP_JS.slice(start, APP_JS.indexOf('\n}\n', start) + 3);
}

test('#1310 R1310-2: the status and scope chips are inner elements of their cell, never the cell', () => {
  const dec = functionBody('renderDecisionRow');
  assert.doesNotMatch(dec, /el\('td',\s*`?'?decision-status(?![\w-])/, 'the status chip must not be the <td>');
  assert.match(dec, /el\('span',\s*`decision-status /, 'the status chip is a <span>');
  const anti = functionBody('renderAntiPatternRow');
  assert.doesNotMatch(anti, /el\('td',\s*'anti-pattern-scope'/, 'the scope chip must not be the <td>');
  assert.match(anti, /el\('span',\s*'anti-pattern-scope'/, 'the scope chip is a <span>');
});

test('#1310 R1310-1: the memory actor stack is an inner element, not the <td>', () => {
  assert.match(APP_JS, /el\('td', 'memory-actor-cell'\)/);
  assert.match(APP_JS, /el\('div', 'memory-actor'\)/);
});

test('#1310 R1310-3: a readable Decisions row has five cells and an Anti-patterns row four, matching their headers', () => {
  const tds = (name) => [...functionBody(name).matchAll(/el\('td'/g)].length;
  // one unreadable spanning cell + N readable cells
  assert.equal(tds('renderDecisionRow'), 1 + 5);
  assert.equal(tds('renderAntiPatternRow'), 1 + 4);
});
