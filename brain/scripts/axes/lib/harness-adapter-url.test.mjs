// REQ-1128-4 — the adapter directories are injectable (#1128).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { harnessAdapterDir, harnessAdapterUrl } from './harness-adapter-url.mjs';

describe('harness-adapter-url', () => {
  it('defaults to the shipped axes/ tree', () => {
    assert.match(fileURLToPath(harnessAdapterDir('platform')), /axes\/platform\/adapters\/$/);
    assert.match(fileURLToPath(harnessAdapterUrl('claude')), /axes\/platform\/adapters\/claude\.mjs$/);
  });

  it('keeps returning the first-axis candidate for an unknown name', () => {
    assert.match(fileURLToPath(harnessAdapterUrl('no-such-adapter')), /axes\/platform\/adapters\/no-such-adapter\.mjs$/);
  });

  it('resolves under an injected base', () => {
    const dir = mkdtempSync(join(tmpdir(), 'adapter-url-'));
    try {
      mkdirSync(join(dir, 'review-engine/adapters'), { recursive: true });
      writeFileSync(join(dir, 'review-engine/adapters/zed.mjs'), '');
      const base = pathToFileURL(`${dir}/`);
      assert.equal(harnessAdapterDir('platform', { base }).href, new URL('platform/adapters/', base).href);
      assert.equal(harnessAdapterUrl('zed', { base }).href, new URL('review-engine/adapters/zed.mjs', base).href);
      assert.equal(harnessAdapterUrl('claude', { base }).href, new URL('platform/adapters/claude.mjs', base).href, 'a name absent from the base falls back to the first axis under the base');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
