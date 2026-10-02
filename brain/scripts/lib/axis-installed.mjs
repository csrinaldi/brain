// axis-installed.mjs — what is INSTALLED here, per axis provider, for diagnoseAxes (#1114 S3.4).
//
// Deliberately minimal. A probe here answers from a file read and spawns nothing, and the only provider that
// can answer that cheaply is `brain` itself: its version is the package's own. Probes for engram, gh, claude
// and the rest need a spawn, with its own hygiene (timeouts, stdin, a missing binary as a finding rather
// than a crash): that is #1130's work, and the adapters will each export their own `versionProbe()` then.
// Until then an unprobed provider is reported as `version-unverifiable`, never as a guess.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** brain's own version: the installed package's. `null` when it cannot be read (never throws). */
export function versionProbe({ packageJson = join(HERE, '../../../package.json') } = {}) {
  try {
    const v = JSON.parse(readFileSync(packageJson, 'utf8'))?.version;
    return typeof v === 'string' && v !== '' ? v : null;
  } catch {
    return null;
  }
}

/** The `installed` input of `diagnoseAxes`: `{ sdd: { brain } }` today. */
export function detectInstalled(opts) {
  const brain = versionProbe(opts);
  return brain ? { sdd: { brain } } : {};
}
