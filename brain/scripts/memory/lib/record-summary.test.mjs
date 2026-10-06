// record-summary.test.mjs — a record's title and bounded excerpt, derived from its own content (#1313).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { summarizeContent, TITLE_MAX, EXCERPT_MAX, SCAN_MAX, NO_TEXT, EMPTY_TEXT } from './record-summary.mjs';

test('#1313 R1313-1 S1: the title is the text of the bold lead line, the excerpt is the body after it', () => {
  const s = summarizeContent('**Poller holds one timer**\n\nWhat: arm()/disarm() keep one handle');
  assert.deepEqual(s, { ok: true, title: 'Poller holds one timer', excerpt: 'What: arm()/disarm() keep one handle', truncated: false });
});

test('#1313 R1313-1: a bold lead is recognised after leading blank lines, and its inner text is plain', () => {
  const s = summarizeContent('\n\n**sdd/feature/verify-report**\nbody');
  assert.equal(s.title, 'sdd/feature/verify-report');
  assert.equal(s.excerpt, 'body');
});

test('#1313 R1313-1: a line with two bold runs is not a bold lead and reads as plain text', () => {
  const s = summarizeContent('**a** and **b**\nrest');
  assert.equal(s.title, 'a and b');
  assert.equal(s.excerpt, 'rest');
});

test('#1313 R1313-1 S3: with no bold lead the title is the first non-empty line, markers stripped', () => {
  const s = summarizeContent('## Goal\n- ship **it** [now](https://x)');
  assert.deepEqual(s, { ok: true, title: 'Goal', excerpt: 'ship it now', truncated: false });
});

test('#1313 R1313-1: a raw `title` field is not consulted', () => {
  const s = summarizeContent('**From content**');
  assert.equal(s.title, 'From content');
});

test('#1313 R1313-2: markers are stripped, a link keeps its text, an image its alt, code its text, and whitespace collapses', () => {
  const s = summarizeContent('**T**\n\n> quoted  `code`   and *em* ~~gone~~\n1. one\n2) two\n![alt](u.png) and [l](http://x/y?z=(1))\n```js\nlet a = 1;\n```');
  assert.equal(s.excerpt, 'quoted code and em gone one two alt and l let a = 1;');
});

test('#1313 R1313-2: underscores inside identifiers are left alone', () => {
  assert.equal(summarizeContent('**T**\nuse snake_case_name here').excerpt, 'use snake_case_name here');
});

test('#1313 S6: markup in content is kept as literal characters, never interpreted', () => {
  const s = summarizeContent('**T**\n<script>alert(1)</script>');
  assert.equal(s.excerpt, '<script>alert(1)</script>');
});

test('#1313 S2: an excerpt longer than EXCERPT_MAX is cut to exactly EXCERPT_MAX characters ending in an ellipsis', () => {
  assert.equal(EXCERPT_MAX, 120);
  const s = summarizeContent(`**T**\n\n${'word '.repeat(100)}`);
  assert.equal(Array.from(s.excerpt).length, EXCERPT_MAX);
  assert.ok(s.excerpt.endsWith('…'));
  assert.equal(s.truncated, true);
});

test('#1313 R1313-2: an excerpt of exactly EXCERPT_MAX characters is not truncated', () => {
  const s = summarizeContent(`**T**\n${'x'.repeat(EXCERPT_MAX)}`);
  assert.equal(s.excerpt, 'x'.repeat(EXCERPT_MAX));
  assert.equal(s.truncated, false);
});

test('#1313 R1313-2: the cut falls on a code-point boundary, never inside a surrogate pair', () => {
  const s = summarizeContent(`**T**\n${'😀'.repeat(300)}`);
  assert.equal(Array.from(s.excerpt).length, EXCERPT_MAX);
  assert.equal(s.excerpt, `${'😀'.repeat(EXCERPT_MAX - 1)}…`);
  assert.doesNotMatch(s.excerpt, /[\ud800-\udbff](?![\udc00-\udfff])/);
});

test('#1313 R1313-2: the title is capped at TITLE_MAX the same way', () => {
  assert.equal(TITLE_MAX, 200);
  const s = summarizeContent(`**${'t'.repeat(500)}**\nbody`);
  assert.equal(Array.from(s.title).length, TITLE_MAX);
  assert.ok(s.title.endsWith('…'));
});

test('#1313 S7: a huge content is examined only up to SCAN_MAX characters', () => {
  assert.equal(SCAN_MAX, 2000);
  // A marker placed past the window must never reach the excerpt; one inside it does.
  const body = `${'a '.repeat(SCAN_MAX)}ZZZ-PAST-THE-WINDOW`;
  const s = summarizeContent(`**T**\n${body}`);
  assert.doesNotMatch(s.excerpt, /ZZZ/);
  assert.equal(s.truncated, true);
  const big = `**T**\n${'x'.repeat(1_000_000)}`;
  const started = performance.now();
  summarizeContent(big);
  assert.ok(performance.now() - started < 200, 'a 1 MB content must not be scanned whole');
});

test('#1313 S7: a window with no text in it reads as EMPTY_TEXT; nothing past the window is examined to say otherwise', () => {
  assert.deepEqual(summarizeContent(`${' '.repeat(SCAN_MAX)}x`), { ok: false, reason: EMPTY_TEXT });
});

test('#1313 R1313-3 S4: absent or non-string content is NO_TEXT', () => {
  for (const content of [undefined, null, 42, {}, ['a']]) {
    assert.deepEqual(summarizeContent(content), { ok: false, reason: NO_TEXT });
  }
});

test('#1313 R1313-3 S5: empty or whitespace-only content is EMPTY_TEXT, a different fact from NO_TEXT', () => {
  for (const content of ['', '   \n  ', '\t\r\n']) {
    assert.deepEqual(summarizeContent(content), { ok: false, reason: EMPTY_TEXT });
  }
  assert.notEqual(NO_TEXT, EMPTY_TEXT);
});

test('#1313 R1313-3: neither absence sentence says "unreadable", the record was read', () => {
  assert.doesNotMatch(NO_TEXT, /unreadable/i);
  assert.doesNotMatch(EMPTY_TEXT, /unreadable/i);
});

test('#1313 R1313-1: a title-only content has an empty excerpt, still ok', () => {
  assert.deepEqual(summarizeContent('**Only a title**'), { ok: true, title: 'Only a title', excerpt: '', truncated: false });
});

test('#1313 R1313-1: a lead line with no text left after stripping gives the title to the next line of text, never a blank title', () => {
  assert.deepEqual(summarizeContent('**![](x.png)**\nreal first words\nmore'), { ok: true, title: 'real first words', excerpt: 'more', truncated: false });
  assert.deepEqual(summarizeContent('**![](x.png)**\n\n```\n```'), { ok: false, reason: EMPTY_TEXT });
});

test('#1313 R1313-2: a table separator row carries no text and is dropped from the excerpt', () => {
  assert.equal(summarizeContent('**T**\n| a | b |\n|---|:-:|\n| 1 | 2 |').excerpt, '| a | b | | 1 | 2 |');
});
