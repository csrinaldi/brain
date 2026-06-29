// repo.test.mjs — Unit tests for parseRemote. Run with: npm test (node --test).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRemote } from './repo.mjs';

test('parseRemote: HTTPS with .git', () => {
  assert.deepEqual(parseRemote('https://github.com/csrinaldi/brain.git'),
    { host: 'github.com', project: 'csrinaldi/brain' });
});

test('parseRemote: HTTPS without .git', () => {
  assert.deepEqual(parseRemote('https://github.com/csrinaldi/brain'),
    { host: 'github.com', project: 'csrinaldi/brain' });
});

test('parseRemote: SSH', () => {
  assert.deepEqual(parseRemote('git@github.com:csrinaldi/brain.git'),
    { host: 'github.com', project: 'csrinaldi/brain' });
});

test('parseRemote: GitLab subgroups', () => {
  assert.deepEqual(parseRemote('https://git.santafe.gov.ar/scit/grupo/sub/repo.git'),
    { host: 'git.santafe.gov.ar', project: 'scit/grupo/sub/repo' });
});

test('parseRemote: custom HTTPS port is dropped from host, slug stays clean', () => {
  assert.deepEqual(parseRemote('https://gitlab.example.com:8080/group/repo.git'),
    { host: 'gitlab.example.com', project: 'group/repo' });
});

test('parseRemote: HTTPS with embedded credentials', () => {
  assert.deepEqual(parseRemote('https://oauth2:TOKEN@git.example.com/group/repo.git'),
    { host: 'git.example.com', project: 'group/repo' });
});

test('parseRemote: unrecognized input returns nulls', () => {
  assert.deepEqual(parseRemote('not a url'), { host: null, project: null });
  assert.deepEqual(parseRemote(''), { host: null, project: null });
});
