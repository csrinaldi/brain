// git-tree.test.mjs — #1201 D35: the one parser of `ls-tree -z` output and the
// one pick of "which change dir carries this issue", shared by the drawer
// reader and the remote-changes reader.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { changeDirNames, parseTreeListing, pickChangeDir } from './git-tree.mjs';

const SHA = 'a'.repeat(40);

test('parseTreeListing reads `ls-tree -l -z`: mode, type, sha, size, and a path with spaces', () => {
  const out = `100644 blob ${SHA}     123\tdir/with space/a.md\u0000040000 tree ${SHA}      -\tdir/sub\u0000`;
  const listing = parseTreeListing(out);
  assert.deepEqual([...listing.keys()], ['dir/with space/a.md', 'dir/sub']);
  assert.deepEqual(listing.get('dir/with space/a.md'), { mode: '100644', type: 'blob', sha: SHA, size: 123 });
  assert.deepEqual(listing.get('dir/sub'), { mode: '040000', type: 'tree', sha: SHA, size: null });
});

test('parseTreeListing reads `ls-tree -z` (no size column) with a null size, never NaN', () => {
  const listing = parseTreeListing(`040000 tree ${SHA}\topenspec/changes/issue-7-x\u0000`);
  assert.deepEqual(listing.get('openspec/changes/issue-7-x'), { mode: '040000', type: 'tree', sha: SHA, size: null });
});

test('parseTreeListing: empty or absent output is an empty map', () => {
  assert.equal(parseTreeListing('').size, 0);
  assert.equal(parseTreeListing(undefined).size, 0);
});

test('pickChangeDir: exactly one dir carrying the issue is picked', () => {
  assert.deepEqual(pickChangeDir(['issue-7-x', 'issue-8-y', 'README.md'], 7), { ok: true, dir: 'issue-7-x' });
});

test('pickChangeDir: no match is missing', () => {
  const r = pickChangeDir(['issue-8-y'], 7);
  assert.equal(r.ok, false);
  assert.equal(r.state, 'missing');
});

test('pickChangeDir: an ambiguous issue is unreadable and names the dirs', () => {
  const r = pickChangeDir(['issue-7-x', 'issue-7-y'], 7);
  assert.equal(r.ok, false);
  assert.equal(r.state, 'unreadable');
  assert.match(r.reason, /issue-7-x, issue-7-y/);
});

test('pickChangeDir accepts the issue as a string or a number', () => {
  assert.deepEqual(pickChangeDir(['issue-7-x'], '7'), { ok: true, dir: 'issue-7-x' });
});

test('#1243 R1243-6: changeDirNames keeps tree entries as bare names and drops a blob that parses as a change id', () => {
  const out = `040000 tree ${SHA}\topenspec/changes/issue-5-x\u0000100644 blob ${SHA}\topenspec/changes/issue-5-notes.md\u0000`;
  assert.deepEqual(changeDirNames(parseTreeListing(out)), ['issue-5-x']);
  assert.deepEqual(changeDirNames(new Map()), []);
});
