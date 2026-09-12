// managed-script-keys-doctrine.test.mjs — issue #922: MANAGED_SCRIPT_KEYS must
// contain every brain:*/memory:* npm script the doctrine tells an agent to run
// via a literal `npm run <script>` mention, so brain:upgrade actually installs
// the script into a consumer's package.json before the doctrine tells anyone
// to run it. Mirrors the existing `.gitattributes` drift guard in
// managed-paths.test.mjs (same file, "drift guard" pattern).
//
// EXPECTED RED until the brain-draft under
// openspec/changes/issue-922-managed-scripts/brain-drafts/ is PROMOTED by a
// maintainer into brain/core/managed-paths.mjs. `brain/core/**` is Tier 2 —
// this repo's own doctrine (agent-authorities.md Tier 2/3,
// consolidation-protocol.md §2) forbids an agent from committing there
// directly, so the fix cannot land through this PR. Do NOT weaken this
// assertion to pass against the pre-promotion catalog: the gap it reports is
// real and measured (see openspec/changes/issue-922-managed-scripts/proposal.md).
// It turns green on its own once the draft is promoted — no test edit needed.
//
// Data-driven ON PURPOSE (issue #922 acceptance criteria: "full set reconciled
// against every doctrine `npm run …` mention"): the expected set is EXTRACTED
// from doctrine text at test time, not hardcoded, so a future doctrine edit
// that tells an agent to run a new script re-triggers this guard automatically
// instead of drifting silently again the way `memory:save`/`memory:ship`/
// `memory:audit`/`brain:config` did.
//
// Not a novel pattern: `sdd-layout-doc-promotion-tripwire.test.mjs` (#253) is
// an existing, already-merged test of the same "EXPECTED RED until promotion"
// shape, currently green on `main` because its target doc was promoted. `npm
// test` on THIS branch will report one new failing test by design — that is
// the tracked defect, not a CI regression to silence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MANAGED_SCRIPT_KEYS } from '../../core/managed-paths.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// The doctrine surfaces issue #922 names: brain/core/**, brain/project/**,
// AGENTS.md, CLAUDE.md (checked, absent from this repo today), docs/**.
const DOCTRINE_ROOTS = ['brain/core', 'brain/project', 'AGENTS.md', 'CLAUDE.md', 'docs'];

// EXCEPT docs/inbox/**: `docs/inbox/AGENT-REVIEW-HANDOFF.md` states explicitly
// "`docs/inbox/**` is a capture zone (issue #327) — not a source of truth,
// never governed." A script mentioned only there is a PROPOSAL, not doctrine
// telling an agent to run something today (measured: `brain:snapshot`,
// `brain:ui`, `brain:credentials`, `brain:status`, `brain:review:queue`,
// `brain:protect-server` appear only under docs/inbox/** and do not exist as
// real npm scripts yet — a different bug than #922, out of scope here).
const EXCLUDED_DIR_PREFIXES = [join('docs', 'inbox')];

const SCAN_EXTENSIONS = new Set(['.md', '.html', '.mjs', '.js']);

function walk(root) {
  const abs = join(REPO_ROOT, root);
  let st;
  try {
    st = statSync(abs);
  } catch {
    return []; // e.g. CLAUDE.md does not exist in this repo — that is fine, not a defect this test reports.
  }
  if (st.isFile()) return [abs];
  const out = [];
  const stack = [abs];
  while (stack.length) {
    const dir = stack.pop();
    const rel = dir.slice(REPO_ROOT.length + 1);
    if (EXCLUDED_DIR_PREFIXES.some((p) => rel === p || rel.startsWith(p + '/'))) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
        out.push(full);
      }
    }
  }
  return out;
}

// Real npm scripts, read from package.json — the filter that keeps this test
// data-driven instead of a hand-maintained allowlist. It also naturally drops
// prose that quotes a placeholder or an unshipped proposal without a real
// script behind it (e.g. `npm run backend:build` in AGENTS.md/
// agent-authorities.md is an illustrative example of a CONSUMER's own build
// script, never a brain/memory verb — it has no entry in this repo's
// package.json and is not brain:*/memory:* namespaced either).
const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
const REAL_SCRIPTS = new Set(Object.keys(pkg.scripts));

const NPM_RUN_RE = /npm run ([a-zA-Z0-9:_-]+)/g;

/**
 * @returns {Set<string>} every brain: or memory: prefixed script doctrine
 *   tells an agent to `npm run`, restricted to scripts that actually exist in
 *   package.json.
 */
function extractRecommendedScripts() {
  const found = new Set();
  for (const root of DOCTRINE_ROOTS) {
    for (const file of walk(root)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(NPM_RUN_RE)) {
        const key = m[1];
        if ((key.startsWith('brain:') || key.startsWith('memory:')) && REAL_SCRIPTS.has(key)) {
          found.add(key);
        }
      }
    }
  }
  return found;
}

test('every brain:*/memory:* script doctrine tells an agent to `npm run` is in MANAGED_SCRIPT_KEYS (#922)', () => {
  const recommended = extractRecommendedScripts();
  const managed = new Set(MANAGED_SCRIPT_KEYS);
  const missing = [...recommended].filter((k) => !managed.has(k)).sort();

  assert.deepEqual(
    missing,
    [],
    `MANAGED_SCRIPT_KEYS is missing ${missing.length} script(s) the doctrine tells an agent to ` +
      `\`npm run\`: ${missing.join(', ')}.\n` +
      'EXPECTED RED until openspec/changes/issue-922-managed-scripts/brain-drafts/ is promoted ' +
      '(#922) — brain/core/** is Tier 2, this repo cannot edit it directly. ' +
      'See openspec/changes/issue-922-managed-scripts/proposal.md for the full measurement.',
  );
});

// Companion assertion: guards the OTHER direction so a future promotion that
// adds a key no doctrine mentions (dead weight injected into every
// consumer's package.json) is visible too — not just missing keys.
test('every MANAGED_SCRIPT_KEYS entry is a real npm script (sanity, #922)', () => {
  const unreal = MANAGED_SCRIPT_KEYS.filter((k) => !REAL_SCRIPTS.has(k));
  assert.deepEqual(unreal, [], `MANAGED_SCRIPT_KEYS names script(s) absent from package.json: ${unreal.join(', ')}`);
});
