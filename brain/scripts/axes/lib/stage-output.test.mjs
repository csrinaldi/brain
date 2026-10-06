// REQ-1129-4 / REQ-1129-5 — one redaction contract, one copy of each output helper (#1129).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { engineTail, secretValues, canonicalPath, isWithin, validateFinalMessageOutput } from './stage-output.mjs';

describe('engineTail', () => {
  it('is empty when the engine said nothing', () => {
    assert.equal(engineTail({}, []), '');
    assert.equal(engineTail({ stderr: '  \n', stdout: '' }, []), '');
  });

  it('prefers stderr and falls back to stdout', () => {
    assert.equal(engineTail({ stderr: 'boom', stdout: 'out' }, []), ' — the engine last said: boom');
    assert.equal(engineTail({ stderr: '', stdout: 'out' }, []), ' — the engine last said: out');
  });

  it('redacts a secret, over the FULL text, before the 4 KiB window cuts it', () => {
    const secret = ['ghp', 'SECRETSECRETSECRET'].join('_');
    const text = `${'x'.repeat(4096 - 8)}${secret}\nend`;
    const out = engineTail({ stderr: text }, [secret]);
    assert.ok(!out.includes(secret));
    assert.ok(!out.includes('SECRETSECRET'), 'no suffix of the secret survives the window');
  });

  it('drops control bytes', () => {
    const out = engineTail({ stderr: 'a\u001b[31mred\u0000b' }, []);
    assert.doesNotMatch(out, /[\u0000-\u0008\u000B-\u001F\u007F]/);
    assert.match(out, /a\[31mredb/);
  });

  it('joins the last two lines and caps at 300 characters, prefixed with an ellipsis', () => {
    assert.equal(engineTail({ stderr: 'one\ntwo\nthree' }, []), ' — the engine last said: two / three');
    const out = engineTail({ stderr: 'y'.repeat(900) }, []);
    const said = out.replace(' — the engine last said: ', '');
    assert.equal(said, `…${'y'.repeat(300)}`);
  });

  it('ignores empty secrets', () => {
    assert.equal(engineTail({ stderr: 'ok' }, ['', undefined, null]), ' — the engine last said: ok');
  });
});

describe('secretValues', () => {
  it('returns the non-empty values of the named variables', () => {
    assert.deepEqual(secretValues({ A: 'a', B: '', C: 'c', D: 'd' }, ['A', 'B', 'C', 'Z']), ['a', 'c']);
    assert.deepEqual(secretValues(undefined, ['A']), []);
  });
});

describe('isWithin', () => {
  it('moved from gemini.test.mjs: a filename starting with a double dot is inside the parent', () => {
    assert.equal(isWithin('/candidate', '/candidate/..hacker.tmp'), true);
    assert.equal(isWithin('/candidate', '/candidate/subdir/..file'), true);
    assert.equal(isWithin('/candidate', '/candidate'), true);
    assert.equal(isWithin('/candidate', '/outside/file'), false);
    assert.equal(isWithin('/candidate', '/candidate/../outside'), false);
  });
  it('treats a child named ..x as inside its parent', () => {
    assert.equal(isWithin('/c', '/c/..x'), true);
    assert.equal(isWithin('/c', '/c/..x/f'), true);
    assert.equal(isWithin('/c', '/c'), true);
  });
  it('rejects siblings and parents', () => {
    assert.equal(isWithin('/c', '/other/f'), false);
    assert.equal(isWithin('/c', '/c/../outside'), false);
    assert.equal(isWithin('/c', '/'), false);
  });
});

describe('canonicalPath', () => {
  it('keeps the leading character of a non-existent path directly under the root', () => {
    assert.equal(canonicalPath('/nonexistent_test_dir_123'), '/nonexistent_test_dir_123');
  });
  it('resolves a symlinked parent and appends a non-existent leaf', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stage-output-'));
    try {
      mkdirSync(join(dir, 'real'));
      symlinkSync(join(dir, 'real'), join(dir, 'link'));
      assert.ok(canonicalPath(join(dir, 'link', 'new', 'leaf')).endsWith(join('real', 'new', 'leaf')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('validateFinalMessageOutput', () => {
  const cwd = '/candidate';
  const ok = { mode: 'final-message', tempPath: '/host/t.tmp', artifactPath: '/host/a.md' };
  it('accepts a host-owned descriptor outside the candidate', () => {
    assert.equal(validateFinalMessageOutput(ok, cwd, { engine: 'codex' }), null);
  });
  it('names the passed engine in the messages that named a vendor', () => {
    assert.match(validateFinalMessageOutput(undefined, cwd, { engine: 'zed' }), /the Zed transport needs a host-owned final-message output descriptor/);
    assert.match(validateFinalMessageOutput({ ...ok, tempPath: '/host/a.md' }, cwd, { engine: 'gemini' }), /the Gemini temporary output and final artifact paths must differ/);
  });
  it('refuses relative paths and an output inside the candidate', () => {
    assert.match(validateFinalMessageOutput({ ...ok, tempPath: 'rel' }, cwd, { engine: 'codex' }), /must be absolute/);
    assert.match(validateFinalMessageOutput({ ...ok, tempPath: '/candidate/t.tmp' }, cwd, { engine: 'codex' }), /outside the candidate/);
    assert.match(validateFinalMessageOutput({ ...ok, artifactPath: '/candidate/..x' }, cwd, { engine: 'codex' }), /outside the candidate/);
  });
});
