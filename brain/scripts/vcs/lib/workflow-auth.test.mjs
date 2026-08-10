// workflow-auth.test.mjs — #480's acceptance suite: the ten shapes that defeated
// (or falsely tripped) the guard from PR #476.
//
// The ticket names them A1–A10 and states the bar directly: A1–A7 must be CAUGHT,
// A9 must NOT be flagged. They are driven here as one table rather than ten prose
// tests, because the property under test is "no spelling of a command changes the
// answer" — and a table is the only shape in which adding the eleventh spelling is
// a one-line change instead of a new test nobody writes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditWorkflowAuth, stepBlocks } from './workflow-auth.mjs';

// brain/scripts/vcs/lib → the repository root is FOUR levels up, not three. Three
// lands on `brain/`, where no entry point resolves, and every fixture then reports
// "unresolvable" — a suite that would have looked like a working guard flagging
// everything, rather than a broken path.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const audit = (yaml) => auditWorkflowAuth(yaml, { file: 'probe', repoRoot: REPO_ROOT });

/** A compliant workflow with one extra step spliced in — so every fixture differs
 *  from the last ONLY in the shape under test. */
const wrap = (step) => [
  'permissions: { contents: write, pull-requests: read }',
  'jobs:',
  '  g:',
  '    steps:',
  '      - name: benign',
  '        run: echo hi',
  step,
].join('\n');

// The ten shapes, verbatim from #480's attack matrix.
const SHAPES = [
  ['A1', 'folded scalar (run: >), no credential', true,
    '      - name: evil\n        run: >\n          node brain/scripts/brain-audit.mjs "a..b"'],
  ['A2', 'single-line run:, no credential', true,
    '      - name: evil\n        run: node brain/scripts/brain-audit.mjs "a..b"'],
  ['A3', 'step whose FIRST key is run: (no id/name/uses)', true,
    '      - run: node brain/scripts/brain-audit.mjs "a..b"'],
  ['A4', 'a gh verb outside (api|issue|label|pr|auth)', true,
    '      - name: evil\n        run: gh release list'],
  ['A5', 'the audit reached through npm run', true,
    '      - name: evil\n        run: npm run brain:audit -- "a..b"'],
  ['A6', 'the path spelled .MJS', true,
    '      - name: evil\n        run: node ./brain/scripts/brain-audit.MJS "a..b"'],
  ['A7', 'the binary reached through a shell variable', true,
    '      - name: evil\n        run: |\n          GH=gh\n          "$GH" api repos/o/r/pulls/1'],
  ['A8', 'env: present but EMPTY', true,
    '      - name: evil\n        env:\n        run: node brain/scripts/brain-audit.mjs "a..b"'],
  ['A9', 'the credential from secrets.GITHUB_TOKEN — legitimate, must NOT flag', false,
    '      - name: fine\n        env:\n          VCS_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n        run: node brain/scripts/brain-audit.mjs "a..b"'],
  ['A10', 'the credential named only inside a comment', true,
    '      - name: evil\n        # VCS_TOKEN: ${{ github.token }}\n        run: node brain/scripts/brain-audit.mjs "a..b"'],
];

for (const [id, why, mustFlag, step] of SHAPES) {
  test(`#480 ${id}: ${why}`, () => {
    const v = audit(wrap(step));
    assert.equal(v.length > 0, mustFlag, `${id} — violations were:\n${v.join('\n') || '(none)'}`);
  });
}

test('#480: the ten shapes as ONE property — no spelling changes the answer', () => {
  // The per-shape tests above locate a regression; this one states the invariant.
  // A guard that passes nine and fails one is still defeated, and a summary
  // assertion is what makes that visible as a single red line.
  const escapes = SHAPES
    .filter(([, , mustFlag, step]) => (audit(wrap(step)).length > 0) !== mustFlag)
    .map(([id]) => id);
  assert.deepEqual(escapes, []);
});

// ── the false-positive class the previous guard created ─────────────────────

test('#480: the credential is matched by KEY, never by the expression that fills it', () => {
  // PR #476 pinned `${{ github.token }}` literally, which rejected
  // `${{ secrets.GITHUB_TOKEN }}` — the literal remediation text of #467 — and would
  // reject a PAT or a GitHub App token. Every one of these is a real credential.
  for (const expr of ['${{ github.token }}', '${{ secrets.GITHUB_TOKEN }}', '${{ secrets.BRAIN_PAT }}', '${{ steps.app.outputs.token }}']) {
    const y = wrap(`      - name: fine\n        env:\n          VCS_TOKEN: ${expr}\n        run: node brain/scripts/brain-audit.mjs "a..b"`);
    assert.deepEqual(audit(y), [], `${expr} is a credential and must not be flagged`);
  }
});

test('#480: a style-only key reorder does not change the verdict', () => {
  // `- name: … / id: …` and `- id: … / name: …` are identical YAML. The previous
  // guard's named pin missed the second, so a formatting change broke the check.
  const a = wrap('      - name: evil\n        id: audit\n        run: node brain/scripts/brain-audit.mjs "a..b"');
  const b = wrap('      - id: audit\n        name: evil\n        run: node brain/scripts/brain-audit.mjs "a..b"');
  assert.deepEqual(audit(a).length, audit(b).length);
  assert.ok(audit(a).length > 0, 'both orderings must be caught, not both missed');
});

test('#480: a job-level or workflow-level env: is NOT claimed to be impossible', () => {
  // The old guard's rationale asserted "GitHub Actions does not inherit a token into
  // a step". It does — #476's own harness disproved it. The consequence was worse
  // than a wrong comment: a maintainer consolidating four duplicated bindings into
  // one job-level env: got a working workflow and a red guard.
  //
  // This guard reads the step block, so an inherited credential is not visible to
  // it. That is a KNOWN limitation and it is asserted here rather than denied, so
  // the next reader learns the truth from the test instead of the fiction from a
  // comment. Consolidating to job level is a real refactor this guard would flag —
  // and the honest response is to widen the guard, not to tell people it cannot be
  // done.
  const jobLevel = [
    'permissions: { contents: write, pull-requests: read }',
    'jobs:',
    '  g:',
    '    env:',
    '      VCS_TOKEN: ${{ github.token }}',
    '    steps:',
    '      - name: audit',
    '        run: node brain/scripts/brain-audit.mjs "a..b"',
  ].join('\n');
  assert.ok(audit(jobLevel).length > 0,
    'the step-scoped read cannot see a job-level env: — recorded as a limitation, not denied');
});

// ── the polarity: undecidable is a violation ────────────────────────────────

test('#480: an entry point that cannot be resolved is a VIOLATION, not an empty answer', () => {
  // The defect class in one line: a checker that returns "nothing to report" for
  // input it could not read turns its own blindness into the gate's approval.
  const unknownVerb = wrap('      - name: evil\n        run: npm run this-verb-does-not-exist');
  assert.match(audit(unknownVerb).join('\n'), /cannot resolve|undecidable/);

  const missingScript = wrap('      - name: evil\n        run: node brain/scripts/does-not-exist.mjs');
  assert.match(audit(missingScript).join('\n'), /cannot resolve|undecidable/);
});

test('#480: an unrecognised binary is treated as reaching the server', () => {
  // The inert list is a SAFE-side list: absence from it costs a false alarm, never
  // a miss. `curl` is the obvious next escape and is not enumerated anywhere.
  const y = wrap('      - name: evil\n        run: curl -s https://api.github.com/repos/o/r/pulls/1');
  assert.ok(audit(y).length > 0, 'a command the guard does not recognise must not read as safe');
});

test('#480: a SHELL COMMENT mentioning gh does not require a credential', () => {
  // The mirror of A10, and the half that comment-stripping actually defends. A10 is
  // caught by anchoring the credential read, not by stripping; stripping earns its
  // place here, where a `# we used to shell out to gh` line in an otherwise inert
  // step would otherwise demand a token for nothing.
  //
  // These workflows are heavily commented, so this is the realistic shape — and a
  // guard that flags a comment is a guard that trains people to ignore it.
  const y = wrap([
    '      - name: fine',
    '        run: |',
    '          set -euo pipefail',
    '          # this used to call gh api repos/o/r/pulls/1 — now it is pure git',
    '          git rev-parse HEAD',
  ].join('\n'));
  assert.deepEqual(audit(y), []);
});

test('#480: a genuinely inert step is NOT flagged — the guard must be usable', () => {
  // The counterweight to the rule above. A guard that flags `git config` is a guard
  // that gets switched off, and then none of this matters.
  const y = wrap('      - name: fine\n        run: |\n          set -euo pipefail\n          git config user.name "x"\n          echo done');
  assert.deepEqual(audit(y), []);
});

// ── the scope condition, which a token alone does not satisfy ───────────────

test('#480/#475: a perfectly-formed credential under a narrow permissions block is a violation', () => {
  const y = [
    'permissions: { contents: write }',
    'jobs:', '  g:', '    steps:',
    '      - name: audit',
    '        env:',
    '          VCS_TOKEN: ${{ github.token }}',
    '        run: node brain/scripts/brain-audit.mjs "a..b"',
  ].join('\n');
  assert.match(audit(y).join('\n'), /every omitted scope/);
});

test('#480: with NO permissions block the scope rule stays silent', () => {
  // The default token already carries read scope, so demanding the line there is
  // noise — and noise is how a guard stops being read.
  const y = [
    'jobs:', '  g:', '    steps:',
    '      - name: audit',
    '        env:',
    '          VCS_TOKEN: ${{ github.token }}',
    '        run: node brain/scripts/brain-audit.mjs "a..b"',
  ].join('\n');
  assert.deepEqual(audit(y), []);
});

// ── it covers EVERY workflow that runs the audit, not one of them ───────────

test('#480: both audit workflows are compliant, and both are actually checked', () => {
  const files = [
    '.github/workflows/governance-postmerge.yml',
    '.github/workflows/release.yml',
  ];
  for (const f of files) {
    const text = readFileSync(resolve(REPO_ROOT, f), 'utf8');
    assert.ok(/brain-audit\.mjs/.test(text), `${f} must still be a workflow this guard is responsible for`);
    assert.deepEqual(auditWorkflowAuth(text, { file: f, repoRoot: REPO_ROOT }), []);
  }
});

test('#480: removing the credential from EITHER shipped workflow is caught', () => {
  // Teeth against the real files, not only synthetic ones — the previous guard
  // looked at one workflow and so did not defend the other consumer of the thing it
  // was defending.
  for (const f of ['.github/workflows/governance-postmerge.yml', '.github/workflows/release.yml']) {
    const text = readFileSync(resolve(REPO_ROOT, f), 'utf8');
    const broken = text.replace(/^(\s*)VCS_TOKEN:.*$/m, '$1PLACEHOLDER: x');
    assert.notEqual(broken, text, `the mutation must land in ${f}`);
    assert.ok(auditWorkflowAuth(broken, { file: f, repoRoot: REPO_ROOT }).length > 0, f);
  }
});

// ── the step splitter, driven directly ──────────────────────────────────────

test('#480 A3 at the splitter: a step whose first key is run: is its own step', () => {
  // The worst of the seven: unrecognised as a boundary, it was absorbed into the
  // previous step's block and INHERITED that step's credential for guard purposes.
  const y = [
    '    steps:',
    '      - name: authorised',
    '        env:',
    '          VCS_TOKEN: ${{ github.token }}',
    '        run: echo one',
    '      - run: node brain/scripts/brain-audit.mjs "a..b"',
  ].join('\n');
  const blocks = stepBlocks(y);
  assert.equal(blocks.length, 2, 'two steps, not one absorbing the other');
  assert.ok(!/VCS_TOKEN/.test(blocks[1]), 'the second step must not inherit the first step\'s credential');
});
