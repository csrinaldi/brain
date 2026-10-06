// REQ-1129-8 — the review-engine parity test. ONE body (`__fixtures__/engine-parity.mjs`)
// runs over every stage runtime the registry declares. A new engine joins by shipping its
// descriptor; nothing here lists it. Precedent: axes/vcs/contract.test.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { RUNTIME_REGISTRY } from '../lib/runtime-registry.mjs';
import { harnessAdapterUrl } from '../lib/harness-adapter-url.mjs';
import { engineParity } from '../../__fixtures__/engine-parity.mjs';

// What differs per engine is test knowledge: how to make a success reachable on a bare temp box.
const SEAMS = {
  claude: () => ({}),
  codex: (root) => {
    const home = join(root, 'home');
    mkdirSync(join(home, '.codex'), { recursive: true });
    writeFileSync(join(home, '.codex', 'auth.json'), '{"access_token":"x"}\n', { mode: 0o600 });
    return { env: { HOME: home } };
  },
  gemini: () => ({ args: { _commandExists: () => true, _hasAgyAuth: () => true } }),
};

for (const name of RUNTIME_REGISTRY.stageRuntimes) {
  engineParity(name, {
    descriptor: RUNTIME_REGISTRY.descriptor(name),
    load: () => import(harnessAdapterUrl(name).href),
    seams: SEAMS[name],
    readinessDir: RUNTIME_REGISTRY.dirs[name],
  });
}
