// remote-source-guard.test.mjs — #1201 R1201-1/9 and AC3 (D43), held by scan.
// A test can prove the code did not fetch on the paths it ran; only a scan
// proves no other path CAN. Three claims:
//   · the snapshot side (remote-changes.mjs, snapshot.mjs) names no network or
//     ref-writing git verb — it reads `refs/remotes/origin/*` and nothing else;
//   · `fetch` is a git argv in exactly ONE place, server.mjs (its two callers
//     are the poller's timer and the POST route, pinned by their own tests);
//   · nothing the remote feature ships says "session".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(SCRIPTS, rel), 'utf8');

/** Source with comments removed: a header that SAYS "never runs git fetch" is not a call. */
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((line) => line.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');

const NETWORK_OR_WRITE = /['"`](fetch|pull|ls-remote|push|update-ref|checkout|switch|reset|merge|rebase|stash|clone)['"`]/;
const REMOTE_UPDATE = /['"`]remote['"`]\s*,\s*['"`]update['"`]/;

function sources(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) { if (!['vendor', 'node_modules', 'test-support', '__fixtures__'].includes(ent.name)) sources(full, out); }
    else if (/\.mjs$/.test(ent.name) && !ent.name.endsWith('.test.mjs')) out.push(full);
  }
  return out;
}

test('#1201 R1201-1: remote-changes.mjs and snapshot.mjs name no network or ref-writing git verb', () => {
  for (const file of ['status/remote-changes.mjs', 'status/snapshot.mjs']) {
    const code = codeOnly(read(file));
    assert.doesNotMatch(code, NETWORK_OR_WRITE, `${file} names a verb that touches the network or a ref`);
    assert.doesNotMatch(code, REMOTE_UPDATE, `${file} runs git remote update`);
  }
});

test('#1201 R1201-9: `fetch` is a git argv in exactly one source file — ui/server.mjs', () => {
  const holders = sources(join(SCRIPTS, 'status')).concat(sources(join(SCRIPTS, 'ui')))
    .filter((file) => /['"`]fetch['"`]/.test(codeOnly(readFileSync(file, 'utf8'))))
    .map((file) => relative(SCRIPTS, file));
  assert.deepEqual(holders, ['ui/server.mjs']);
});

test('#1201 R1201-9: server.mjs pins the fetch argv, with --no-write-fetch-head, and no other write verb', () => {
  const code = codeOnly(read('ui/server.mjs'));
  assert.match(code, /FETCH_ARGV = Object\.freeze\(\['fetch', 'origin', '--no-tags', '--prune', '--no-write-fetch-head'\]\)/);
  assert.doesNotMatch(code, /['"`](pull|ls-remote|checkout|switch|reset|merge|rebase|stash|push)['"`]/);
});

test('#1201 AC3 D43: no module the remote feature ships says "session"', () => {
  for (const file of ['status/remote-changes.mjs', 'lib/git-tree.mjs', 'ui/lib/remote-model.mjs', 'ui/lib/resume-view.mjs', 'ui/lib/banners.mjs', 'ui/change-route.mjs', 'ui/poller.mjs', 'ui/git-run.mjs']) {
    assert.doesNotMatch(codeOnly(read(file)), /session/i, file);
  }
  const app = codeOnly(read('ui/static/app.js'));
  for (const fn of ['renderNodeRemote', 'renderRemotePanel', 'renderRemoteBlock']) {
    const start = app.indexOf(`function ${fn}(`);
    assert.ok(start >= 0, `${fn} exists`);
    assert.doesNotMatch(app.slice(start, app.indexOf('\n}\n', start)), /session/i, fn);
  }
});

test('#1201 R1201-2: app.js builds remote text only with el()/textContent — the remote renderers never assign markup', () => {
  const app = readFileSync(join(SCRIPTS, 'ui/static/app.js'), 'utf8');
  for (const fn of ['renderNodeRemote', 'renderRemotePanel', 'renderRemoteBlock', 'renderRemoteBlocks']) {
    const start = app.indexOf(`function ${fn}(`);
    const body = app.slice(start, app.indexOf('\n}\n', start));
    assert.doesNotMatch(body, /\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/, fn);
  }
});
