// Fresh-install route fixtures: setup must select Codex only when configured.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkCodexReadiness, resolveCodexRoute } from '../../brain/scripts/harness/codex-readiness.mjs';

test('fresh-install route-negative fixture succeeds without a Codex executable', () => {
  let checked = false;
  const route = resolveCodexRoute({ sdd: { map: { 'cold-review': { engine: 'claude', model: 'sonnet' } } } });
  const result = checkCodexReadiness(route, { commandExists: () => { checked = true; return false; } });
  assert.equal(result.ready, true);
  assert.equal(checked, false);
  assert.doesNotMatch(result.diagnostic, /prerequisite failure/i);
});

test('fresh-install route-positive fixture reaches Codex readiness only with the configured route', () => {
  const route = resolveCodexRoute({ sdd: { map: { 'cold-review': { engine: 'codex', model: 'gpt-5.5' } } } });
  const result = checkCodexReadiness(route, {
    commandExists: () => true,
    run: (bin, args) => args[0] === '--version'
      ? { status: 0, stdout: 'codex-cli 0.154.0' }
      : { status: 0, stdout: 'Logged in' },
  });
  assert.equal(result.ready, true);
  assert.match(result.diagnostic, /cold-review:codex\/gpt-5\.5/);
});
