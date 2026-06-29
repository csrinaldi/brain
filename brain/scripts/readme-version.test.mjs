// readme-version.test.mjs — the README's documented install tag must match the
// current package version, so it never silently drifts on release (#84).
//
// Enforce, don't remember: a version bump that forgets to update README.md fails
// `npm test` → the floor catches the drift before it ships. This is the
// governance principle (ADR-0014) applied to our own docs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('README references the current package version tag (no drift on release)', () => {
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const tag = `#v${version}`;
  assert.ok(
    readme.includes(tag),
    `README.md must reference the current install tag "${tag}" — it drifted from ` +
      `package.json (version ${version}). Update the install/upgrade examples in ` +
      `README.md as part of the release.`,
  );
});
