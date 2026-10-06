// REQ-1128-7 — the agent-platform parity test. ONE body (`__fixtures__/platform-parity.mjs`)
// runs over every orchestrating platform the registry declares. A new platform joins by
// shipping its descriptor; nothing here lists it. Precedent: axes/vcs/contract.test.mjs.
import { RUNTIME_REGISTRY } from '../lib/runtime-registry.mjs';
import { harnessAdapterUrl } from '../lib/harness-adapter-url.mjs';
import { dispatch } from '../../harness/cli.mjs';
import { platformParity } from '../../__fixtures__/platform-parity.mjs';

for (const name of RUNTIME_REGISTRY.orchestrators) {
  platformParity(name, {
    descriptor: RUNTIME_REGISTRY.descriptor(name),
    load: () => import(harnessAdapterUrl(name).href),
    dispatch,
  });
}
