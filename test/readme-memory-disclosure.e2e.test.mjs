// readme-memory-disclosure.e2e.test.mjs — the README owns the public session
// record (issue #651, §2b of the #610 pre-flight).
//
// WHY A TEST FOR A PARAGRAPH. §2b's whole finding was that `.memory/` was public
// **by omission** — 2,000+ session summaries in a public repository with nothing
// anywhere saying that was a choice. #435 put it as *"a choice to make
// deliberately, not by omission"*. The decision was "keep and own it", and the
// only thing that materially changed is that the README says so.
//
// A decision whose entire artifact is one prose section reverts the moment that
// section is tidied away, and it reverts SILENTLY — back to exactly the state
// the pre-flight objected to. So the section is checked: not its wording, which
// should be free to improve, but the four things it has to carry.
//
// IT LIVES IN `test/`, NOT `brain/scripts/`. It is about THIS repository's
// README. Vendored into a consumer it would assert facts about the wrong
// project — #397's shape, and the same reason `AGENTS.md` is `regenerate` and
// brain's own never ships.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The README, read from disk.
 *
 * Throws rather than returning `''`: an unreadable README would satisfy no
 * assertion below by looking like a README that says nothing, which is the same
 * verdict as one that was emptied on purpose.
 */
function readme() {
  const text = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
  if (text.trim().length < 500) throw new Error(`README.md is ${text.length} bytes — the read failed, or the file was gutted`);
  return text;
}

const README = readme();

/**
 * What the section must carry, and why each one. Not the wording — the claims.
 * A rewrite that keeps all four is welcome; one that drops any of them puts the
 * decision back to "by omission".
 */
const MUST_CARRY = Object.freeze([
  {
    what: 'names `.memory/` as the public session record',
    re: /\.memory\//,
    why: 'a reader has to know which directory this is about',
  },
  {
    what: 'says it is deliberate',
    re: /\b(on purpose|deliberate|deliberately)\b/i,
    why: '§2b\'s entire finding was that it was public BY OMISSION',
  },
  {
    what: 'admits the unflattering half',
    re: /\b(went wrong|mistakes?|failures?|got it wrong|defects?)\b/i,
    why: 'the first record anyone opens contradicts a README that only claims the wins',
  },
  {
    what: 'cites the audit',
    re: /pre-?flight/i,
    why: '"there are no credentials in here" is a measurement, and it has a record (#435)',
  },
  {
    what: 'says the records do not ship',
    re: /(does not ship|do not ship|excluded from the published)/i,
    why: 'a consumer installs the harness, not this project\'s history (#607)',
  },
]);

test('#651: the README owns the public session record', () => {
  const missing = MUST_CARRY.filter((c) => !c.re.test(README));
  assert.deepEqual(
    missing.map((c) => c.what), [],
    'the README no longer carries these, so `.memory/` is public by omission again — the exact state §2b objected to:\n'
      + missing.map((c) => `  ${c.what}\n    — ${c.why}`).join('\n'),
  );
});

test('#651: the check read a real README (a vacuous pass is a failure)', () => {
  assert.ok(README.length > 2000, `README.md is only ${README.length} bytes — the reader, not the content, is what to look at`);
  assert.ok(MUST_CARRY.length >= 5, 'the claim list was emptied — every README would then pass');
  assert.match(README, /^# brain/m, 'this is not brain\'s README');
});
