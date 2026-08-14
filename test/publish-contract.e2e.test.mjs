// publish-contract.e2e.test.mjs — the four things that decide whether a publish
// reaches anyone (issue #655, ADR-0030 + Amendment 2 #653).
//
// WHY EACH ONE IS HERE. None of these fails loudly on its own:
//
//   · a scoped package with no `publishConfig.access` publishes **restricted** —
//     `npm publish` succeeds, the tarball exists, and nobody can install it.
//     That is the failure that looks like success, and it is unfixable after the
//     fact for that version number;
//   · `private: true` makes npm refuse, which IS loud — and is the line that
//     held #607's gap closed, so it must not come off before the allowlist test
//     is green;
//   · `PACKAGE_NAME` and `package.json`'s `name` are now TWO declarations of one
//     fact. #623 collapsed nine literals into one constant; publishing adds a
//     second authority, and a drift between them means `installedPackageRoot`
//     resolves a directory npm never created;
//   · the workflow is the only thing that will ever run `npm publish`, so its
//     credential name and its dry-run are contract, not style.
//
// IT LIVES IN `test/`, NOT `brain/scripts/`. It asserts facts about THIS
// package. Vendored into a consumer it would check their package.json against
// brain's name — #397's shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACKAGE_NAME } from '../brain/scripts/lib/installer.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = '.github/workflows/publish.yml';

/** Throws rather than returning `{}` — an unreadable manifest must not read as a compliant one. */
function pkg() {
  const raw = readFileSync(join(REPO_ROOT, 'package.json'), 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed.name !== 'string') throw new Error('package.json parsed without a `name` — the read failed, not the contract');
  return parsed;
}

/** Same reasoning: an absent workflow is a distinct fact from a workflow missing a line. */
function workflow() {
  const text = readFileSync(join(REPO_ROOT, WORKFLOW), 'utf8');
  if (text.trim().length < 200) throw new Error(`${WORKFLOW} is ${text.length} bytes — that is not a workflow`);
  return text;
}

const P = pkg();

test('#655: the package is scoped, and the two declarations of its name agree', () => {
  assert.match(P.name, /^@[a-z0-9-]+\/[a-z0-9-]+$/, `package.json name is "${P.name}" — ADR-0030 requires a scope`);
  assert.equal(
    PACKAGE_NAME, P.name,
    'installer.mjs\'s PACKAGE_NAME and package.json\'s name disagree. They are two declarations of one fact, '
      + 'and a drift means installedPackageRoot() resolves a directory npm never created.',
  );
});

test('#655: a scoped package must declare `access: public` or it publishes PRIVATE', () => {
  assert.equal(
    P.publishConfig?.access, 'public',
    'publishConfig.access is not "public". A scoped package defaults to `restricted`: npm publish SUCCEEDS, '
      + 'the version is burned, and nobody can install it. The workflow flag alone does not cover a manual '
      + 'publish from a laptop, which is why this lives in the manifest too.',
  );
});

test('#655: `private` is off — and this is the line #607 held', () => {
  assert.notEqual(P.private, true, 'package.json is still `private: true`; npm would refuse to publish');
  // Not "private is gone therefore fine": the allowlist is what makes publishing safe.
  assert.ok(Array.isArray(P.files) && P.files.length >= 5,
    '`private` came off while `files` is missing or short — that is exactly the state #607 exists to prevent');
});

test('#655: the publish workflow reads the credential it was given, and rehearses first', () => {
  const yml = workflow();
  assert.match(yml, /NPM_BRAIN_TOKEN/, `${WORKFLOW} does not reference NPM_BRAIN_TOKEN — that is the secret that exists`);
  assert.doesNotMatch(yml, /secrets\.NPM_TOKEN\b/, 'references secrets.NPM_TOKEN, which is not the secret this repository has');
  assert.match(yml, /--dry-run/, 'no `npm publish --dry-run` rehearsal — an under-scoped token would fail half-way instead of before');
  const dryRunAt = yml.indexOf('--dry-run');
  const publishAt = yml.lastIndexOf('npm publish');
  assert.ok(dryRunAt < publishAt, 'the dry-run must come BEFORE the real publish, or it rehearses nothing');
  assert.match(yml, /--access[= ]public/, 'the real publish does not pass --access public');
});

test('#655: the workflow refuses a version that already names a different tree', () => {
  // npm versions are immutable. `v1.0.0` was cut against the git-tag mechanism
  // and hundreds of commits ago; publishing `1.0.0` from today's tree would put
  // these bytes behind a number that already means something else, permanently.
  const yml = workflow();
  assert.match(yml, /refs\/tags\/v/, 'nothing compares the version against an existing tag');
  assert.match(yml, /Bump the version/, 'the refusal does not tell the operator what to do about it');
});

test('#655: the version has not already been cut as a tag pointing elsewhere', () => {
  // The same rule, applied to the tree the suite is running on, so it is caught
  // locally rather than in the workflow. Skips when the tag does not exist —
  // publishing before tagging is normal.
  const v = P.version;
  let tagged;
  try {
    tagged = execFileSync('git', ['rev-parse', `refs/tags/v${v}^{commit}`], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return; // no such tag — nothing to compare
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  assert.equal(
    tagged, head,
    `package.json says ${v}, and tag v${v} points at ${tagged.slice(0, 8)} while HEAD is ${head.slice(0, 8)}. `
      + 'Publishing this version would put different bytes behind a number that already exists, and npm versions '
      + 'are immutable. Bump the version before the first publish.',
  );
});

test('#655: brain\'s own release machinery is not shipped to consumers', () => {
  assert.ok(
    !P.files.includes(WORKFLOW),
    `${WORKFLOW} is in \`files\` — a consumer needs governance, not brain's release machinery (#607)`,
  );
  // The governance workflows DO ship; this is not "no workflows ship".
  assert.ok(P.files.some((f) => f.includes('governance')), 'the governance workflows stopped shipping — that is a different regression');
});
