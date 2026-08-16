// fenced-blocks.test.mjs — issue #495 task 1.
//
// The three cases below moved VERBATIM out of `amendment-draft.test.mjs` when
// `fencedBlocks` was extracted (design D2). Their bodies are byte-identical to
// the ones that lived there; that identity IS the purity proof for the move, and
// it is checkable rather than asserted — `git log -p` shows a delete and an
// insert of the same text.
//
// They stayed with the function rather than being re-exported from
// `amendment-draft.mjs`, because a re-export would leave two import paths for one
// symbol and the next reader could not tell which is canonical.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fencedBlocks } from './fenced-blocks.mjs';

test('fencedBlocks: reads the info string and the verbatim content of each block', () => {
  const { blocks } = fencedBlocks('text\n```one\na\nb\n```\nmore\n```two\nc\n```\n');
  assert.deepEqual(
    blocks.map((b) => [b.tag, b.content]),
    [
      ['one', 'a\nb'],
      ['two', 'c'],
    ],
  );
});

test('fencedBlocks: a shorter fence inside a longer one is CONTENT, not a block', () => {
  const { blocks } = fencedBlocks('````outer\n```inner\nx\n```\n````\n');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].tag, 'outer');
  assert.equal(blocks[0].content, '```inner\nx\n```');
});

test('fencedBlocks: an unterminated fence yields no block, and REPORTS the line it opened on', () => {
  const { blocks, unterminated } = fencedBlocks('x\n```one\na\n');
  assert.deepEqual(blocks, []);
  assert.deepEqual(unterminated, { tag: 'one', content: 'a\n', line: 2 });
});

test('#702: the unterminated fence reports its CONTENT, so a consumer can attribute it', () => {
  // A consumer whose blocks are ```yaml cannot attribute an open fence from the
  // tag alone — `yaml` says nothing about which protocol was being written. With
  // the partial content it reads the same key it would have read had the fence
  // closed, and stops having to choose between guessing and staying silent.
  const { unterminated } = fencedBlocks('intro\n\n```yaml\nprotocol: brain-graph/1\ntrack: C\n');
  assert.equal(unterminated.tag, 'yaml');
  assert.equal(unterminated.line, 3);
  assert.match(unterminated.content, /^protocol: brain-graph\/1$/m);
  assert.match(unterminated.content, /^track: C$/m);
});
