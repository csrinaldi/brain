// reviewer-protocol.citations.test.mjs — issue #586.
//
// `reviewer-protocol.md` is signed Tier 2 doctrine, and twice in two days its
// line-number citations rotted into pointing at unrelated text: #580 found
// `brain-writes-reviewed.mjs:99` had become a JSDoc block, and the fix for it
// shipped four NEW rotted citations into §6.2 because #483 had moved
// `verdict.mjs` in the same session.
//
// This guard is deliberately narrow. It does NOT try to verify that every
// backticked identifier in the document names a live symbol — the file is full
// of backticked things that are not symbols (`status:approved`, `brain-review/2`,
// `override:*`), so that check would be mostly false positives, and a guard that
// cries wolf gets deleted.
//
// It enforces one mechanical rule instead, which is the rule the two incidents
// actually broke:
//
//   A `file.mjs:<line>` citation may appear ONLY inside a blockquote.
//
// Body text cites SYMBOLS, which move with their code and are found by grep.
// A blockquote is an aside — the one legitimate use is recording that a citation
// USED to point somewhere, which §2's own note does. The rule is verifiable by
// reading one character at the start of a line, so it cannot itself rot.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const DOC = 'brain/core/methodology/reviewer-protocol.md';

const LINE_CITATION_RE = /[\w-]+\.mjs:\d+/;

test('#586: reviewer-protocol.md cites symbols in body text — line numbers only inside a blockquote', () => {
  const lines = readFileSync(join(repoRoot, DOC), 'utf8').split(/\r?\n/);

  const offenders = lines
    .map((text, i) => ({ text, n: i + 1 }))
    .filter(({ text }) => LINE_CITATION_RE.test(text))
    .filter(({ text }) => !text.trimStart().startsWith('>'));

  assert.deepEqual(offenders, [],
    `${DOC} cites a source line number in body text. Line numbers move; symbols do not, and a ` +
    `doctrine that points at a moving target sends its own verifier to the wrong text (#580, #586). ` +
    `Cite the enclosing function or exported constant instead. If the citation is deliberately ` +
    `HISTORICAL — recording where something used to be — put it in a blockquote, which is what ` +
    `§2's note does.\nOffending lines:\n` +
    offenders.map(o => `  ${DOC}:${o.n}  ${o.text.trim()}`).join('\n'));
});

test('#586: the guard is a real detector — it fires on a body-text line citation', () => {
  // A negative control. Without this, deleting the filter above or narrowing the
  // regex would leave the test green over any document, which is the
  // `green in test, inert in production` class (#335) applied to a doc guard.
  const poisoned = [
    '## 2. Some section',
    'The approver set is built in (`brain-writes-reviewed.mjs:99`).',
    '> An earlier revision cited `verdict.mjs:65-66` — historical, allowed.',
  ];

  const offenders = poisoned
    .map((text, i) => ({ text, n: i + 1 }))
    .filter(({ text }) => LINE_CITATION_RE.test(text))
    .filter(({ text }) => !text.trimStart().startsWith('>'));

  assert.deepEqual(offenders.map(o => o.n), [2],
    'the body-text citation must be caught and the blockquoted one must not');
});
