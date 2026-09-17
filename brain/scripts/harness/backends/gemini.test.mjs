import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runStage, GEMINI_MODEL } from './gemini.mjs';

function makePaths(t) {
  const root = mkdtempSync(join(tmpdir(), 'gemini-backend-'));
  const candidate = join(root, 'candidate');
  const outputDir = join(root, 'host-output');
  mkdirSync(candidate);
  mkdirSync(outputDir);
  t.after(() => import('../../__fixtures__/tmp-tree.mjs').then(({ removeTempTree }) => removeTempTree(root)));
  return {
    root,
    candidate,
    tempPath: join(outputDir, 'last-message.md'),
    artifactPath: join(outputDir, 'cold-review.md'),
  };
}

function output(paths) {
  return { mode: 'final-message', tempPath: paths.tempPath, artifactPath: paths.artifactPath };
}

const FAKE_KEY = ['gemini', 'fixture', 'value'].join('-');
const BASE_ENV = {
  PATH: process.env.PATH ?? '',
  SAFE_VALUE: 'kept',
  BRAIN_REVIEWER_TOKEN: 'secret',
  GH_TOKEN: 'secret',
  GEMINI_API_KEY: FAKE_KEY,
};

test('runs exact gemini argv with scrubbed environment and final-message output', async (t) => {
  const paths = makePaths(t);
  let seen;
  const result = await runStage({
    stage: 'cold-review',
    prompt: 'return the review artifact',
    model: 'gemini-2.5-pro',
    cwd: paths.candidate,
    credentialEnv: ['BRAIN_REVIEWER_TOKEN'],
    forgeConfigDir: join(paths.root, 'forge-shadow'),
    output: output(paths),
    _env: { ...BASE_ENV },
    _run: (bin, args, opts) => {
      seen = { bin, args, opts };
      writeFileSync(paths.tempPath, '```brain-findings/1\n[]\n```\n');
      return { status: 0 };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(seen.bin, 'gemini');
  assert.deepEqual(seen.args, [
    '--model', 'gemini-2.5-pro',
    '--output', paths.tempPath,
    'return the review artifact',
  ]);
  assert.equal(seen.opts.cwd, paths.candidate);
  assert.equal(seen.opts.env.SAFE_VALUE, 'kept');
  assert.equal(seen.opts.env.GEMINI_API_KEY, FAKE_KEY);
  assert.equal(seen.opts.env.BRAIN_REVIEWER_TOKEN, undefined);
  assert.equal(seen.opts.env.GH_TOKEN, undefined);
  assert.equal(seen.opts.env.GH_CONFIG_DIR, join(paths.root, 'forge-shadow'));
  assert.equal(seen.opts.env.GLAB_CONFIG_DIR, join(paths.root, 'forge-shadow'));
});

test('refuses before spawning when neither GEMINI_API_KEY nor GOOGLE_APPLICATION_CREDENTIALS is set', async (t) => {
  const paths = makePaths(t);
  let spawned = false;
  const envWithoutKey = { ...BASE_ENV };
  delete envWithoutKey.GEMINI_API_KEY;

  const result = await runStage({
    stage: 'cold-review',
    prompt: 'p',
    model: 'gemini-2.5-pro',
    cwd: paths.candidate,
    output: output(paths),
    _env: envWithoutKey,
    _run: () => { spawned = true; return { status: 0 }; },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /Gemini authentication is unavailable/i);
  assert.match(result.reason, /GEMINI_API_KEY.*GOOGLE_APPLICATION_CREDENTIALS/i);
  assert.equal(spawned, false);
});

test('refuses unsafe output paths inside the candidate before spawning', async (t) => {
  const paths = makePaths(t);
  let spawned = false;
  const result = await runStage({
    stage: 'cold-review',
    prompt: 'p',
    model: 'gemini-2.5-pro',
    cwd: paths.candidate,
    output: { mode: 'final-message', tempPath: join(paths.candidate, 'result.md'), artifactPath: paths.artifactPath },
    _env: { ...BASE_ENV },
    _run: () => { spawned = true; return { status: 0 }; },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /outside the candidate/i);
  assert.equal(spawned, false);
});

test('fails closed for timeout, non-zero exit, and missing final-message output', async (t) => {
  const paths = makePaths(t);
  const cases = [
    { name: 'timeout', run: () => ({ error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }) }), expected: /did not finish/i },
    { name: 'non-zero', run: () => ({ status: 2, stderr: 'API quota exceeded' }), expected: /exited with status 2/i },
    { name: 'missing output', run: () => ({ status: 0 }), expected: /wrote no final message/i },
  ];

  for (const entry of cases) {
    const result = await runStage({
      stage: 'cold-review',
      prompt: 'p',
      model: 'gemini-2.5-pro',
      cwd: paths.candidate,
      output: output(paths),
      _env: { ...BASE_ENV },
      _run: entry.run,
    });
    assert.equal(result.ok, false, entry.name);
    assert.match(result.reason, entry.expected, entry.name);
  }
});
