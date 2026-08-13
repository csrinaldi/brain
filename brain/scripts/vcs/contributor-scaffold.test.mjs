// contributor-scaffold.test.mjs — the drift guards for the contributor-facing
// governance scaffold (issue #570).
//
// Every test here is written to go RED on a specific regression, not to
// describe the current text:
//   · the scaffold offering a `type:*` value that is not in the declared set
//     (this is how `type:breaking-change` survived — a drift between rare edits);
//   · the two providers' texts diverging (two hand-maintained copies is #340);
//   · the emitted files on disk drifting from the one source that renders them;
//   · a provider's consumer receiving no scaffold at all (proved by running the
//     REAL installer over the REAL manifest, never by reading managed-paths.mjs);
//   · the closing-reference form the scaffold prints failing the gate that parses
//     it — proved through `runCheck('issue-link', …)`, the entrypoint both
//     providers' pipelines invoke, once per provider;
//   · any brain-owned file claiming again that the `decision` label arms a gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SCAFFOLD_TEMPLATE,
  SCAFFOLD_PROVIDERS,
  TYPE_LABELS,
  CLOSING_KEYWORDS,
  CHAIN_KEYWORD,
  GATE_SUMMARY,
  scaffoldDelivery,
  renderScaffold,
} from './contributor-scaffold.mjs';
import { GOVERNANCE_JOBS } from './governance-checks.mjs';
import { issueLink } from '../governance/checks/issue-link.mjs';
import { runCheck } from '../governance/run-check.mjs';
import { managed, local, managedStrategy, STRATEGY } from '../../core/managed-paths.mjs';
import { copyManaged, strategyFor } from '../lib/installer.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// ── one source, per-provider emission ───────────────────────────────────────

test('renderScaffold is a pure substitution over the ONE neutral template — the provider texts cannot diverge (#340, #570)', () => {
  for (const provider of SCAFFOLD_PROVIDERS) {
    const d = scaffoldDelivery(provider);
    const rendered = renderScaffold(provider);
    // Reverse the substitution: the rendered text must fold back EXACTLY onto
    // the template. A hand-edit to one provider's emitted text (or a second
    // source of that text) cannot survive this.
    const folded = rendered
      .split(d.path).join('{{path}}')
      .split(d.nounTitle).join('{{Noun}}')
      .split(d.noun).join('{{noun}}')
      .split(d.abbr).join('{{abbr}}');
    assert.equal(folded, SCAFFOLD_TEMPLATE,
      `${provider}'s emitted text is not the neutral template with its vocabulary substituted`);
  }
});

test('the neutral template carries no provider vocabulary of its own (#570)', () => {
  assert.doesNotMatch(SCAFFOLD_TEMPLATE, /pull request|merge request|\bPR\b|\bMR\b/i,
    'the source must be neutral — vocabulary belongs to the provider delivery record');
  assert.doesNotMatch(SCAFFOLD_TEMPLATE, /\.github\/|\.gitlab\//,
    'the source must name no provider path — delivery is the provider-specific half');
});

test('each provider render speaks its OWN vocabulary and never the other\'s (#570)', () => {
  const gh = renderScaffold('github');
  const gl = renderScaffold('gitlab');
  assert.match(gh, /pull request/);
  assert.doesNotMatch(gh, /merge request/);
  assert.match(gl, /merge request/);
  assert.doesNotMatch(gl, /pull request/);
});

test('scaffoldDelivery refuses an unknown provider rather than emitting a GitHub-shaped default (#570)', () => {
  assert.throws(() => scaffoldDelivery('bitbucket'), /bitbucket/);
  assert.throws(() => renderScaffold(undefined), /provider/i);
});

// ── the `type:*` set the scaffold offers ────────────────────────────────────

/** Every `type:*` token the rendered scaffold offers a contributor. */
function offeredTypeLabels(rendered) {
  return [...new Set([...rendered.matchAll(/`(type:[a-z-]+)`/g)].map(m => m[1]))].sort();
}

test('every type:* value the scaffold offers is in the declared label set, and none is missing (#570)', () => {
  const declared = TYPE_LABELS.map(t => t.label).sort();
  assert.ok(declared.length > 0, 'sanity: the declared type:* set must be non-empty');
  for (const provider of SCAFFOLD_PROVIDERS) {
    assert.deepEqual(offeredTypeLabels(renderScaffold(provider)), declared,
      `${provider}'s scaffold must offer EXACTLY the declared type:* labels — no extra, none dropped`);
  }
});

test('the declared type:* set does not contain type:breaking-change (measured 404 on csrinaldi/brain, 2026-08-13, #570)', () => {
  const declared = TYPE_LABELS.map(t => t.label);
  assert.ok(!declared.includes('type:breaking-change'),
    'type:breaking-change is not a label in this repo — offering it makes "exactly one type:*" unsatisfiable');
  for (const provider of SCAFFOLD_PROVIDERS) {
    assert.doesNotMatch(renderScaffold(provider), /type:breaking-change/);
  }
});

test('every declared type:* label carries a description the scaffold can print (#570)', () => {
  for (const t of TYPE_LABELS) {
    assert.match(t.label, /^type:[a-z-]+$/);
    assert.ok(typeof t.description === 'string' && t.description.length > 0, `${t.label} needs a description`);
  }
});

// ── the gate table ──────────────────────────────────────────────────────────

test('the scaffold describes EXACTLY the governance jobs that exist (GOVERNANCE_JOBS, #570)', () => {
  assert.deepEqual(Object.keys(GATE_SUMMARY).sort(), [...GOVERNANCE_JOBS].sort(),
    'a gate the scaffold describes but that does not exist (or vice versa) is the same defect class as the label drift');
  for (const provider of SCAFFOLD_PROVIDERS) {
    const rendered = renderScaffold(provider);
    for (const job of GOVERNANCE_JOBS) {
      assert.match(rendered, new RegExp(`\`${job}\``), `${provider}'s scaffold never names the ${job} gate`);
    }
  }
});

// ── the closing reference, proved against the parser, per provider ──────────

/** The fill-in closing-reference line the scaffold gives the contributor. */
function fillInLine(rendered) {
  const line = rendered.split('\n').find(l => /^[A-Za-z]+ #$/.test(l.trim()));
  assert.ok(line, 'the scaffold must give the contributor a fill-in closing-reference line');
  return line.trim();
}

test('the fill-in closing reference the scaffold prints is accepted by the parser (#570)', () => {
  for (const provider of SCAFFOLD_PROVIDERS) {
    const filled = `${fillInLine(renderScaffold(provider))}570`;
    assert.equal(issueLink(filled).pass, true,
      `${provider}: "${filled}" must satisfy checks/issue-link.mjs`);
  }
});

test('every closing keyword the scaffold names is accepted by the parser; a non-keyword is not (#570)', () => {
  for (const keyword of CLOSING_KEYWORDS) {
    assert.equal(issueLink(`${keyword} #570`).pass, true, `${keyword} is printed as accepted but the parser rejects it`);
  }
  assert.equal(issueLink('Addresses #570').pass, false, 'sanity: the parser is not accepting everything');
  assert.equal(issueLink(`${CHAIN_KEYWORD} #570`).pass, true);
});

test('the keyword list the scaffold PRINTS is the list the tests just proved (#570)', () => {
  for (const provider of SCAFFOLD_PROVIDERS) {
    const rendered = renderScaffold(provider);
    const line = rendered.split('\n').find(l => l.includes('Accepted closing keywords'));
    assert.ok(line, `${provider}: the scaffold must print the accepted closing keywords`);
    const printed = [...new Set([...line.matchAll(/`([A-Za-z]+)`/g)].map(m => m[1]))].sort();
    assert.deepEqual(printed, [...CLOSING_KEYWORDS].sort());
  }
});

test('a body made from the scaffold passes the REAL issue-link gate, once per provider (#570)', async () => {
  const approvedLabel = { github: 'status:approved', gitlab: 'status::approved' };
  for (const provider of SCAFFOLD_PROVIDERS) {
    const body = renderScaffold(provider).replace(/^([A-Za-z]+) #$/m, '$1 #570');
    const result = await runCheck('issue-link', {
      ctx: { body, provider, targetBranch: 'main', defaultBranch: 'main' },
      fetchIssue: async (n) => {
        assert.equal(n, 570, `${provider}: the gate must extract the issue number from the filled scaffold`);
        return { labels: [approvedLabel[provider]] };
      },
      readConfig: () => ({}),
    });
    assert.deepEqual(result, { pass: true }, `${provider}: the emitted scaffold does not satisfy its own gate`);
  }
});

test('the scaffold\'s stated slice rule matches the gate: "Part of #N" passes off the default branch and fails on it (#570)', async () => {
  for (const provider of SCAFFOLD_PROVIDERS) {
    const body = renderScaffold(provider).replace(/^[A-Za-z]+ #$/m, `${CHAIN_KEYWORD} #570`);
    const deps = {
      fetchIssue: async () => ({ labels: [provider === 'gitlab' ? 'status::approved' : 'status:approved'] }),
      readConfig: () => ({}),
    };
    const slice = await runCheck('issue-link', {
      ...deps, ctx: { body, provider, targetBranch: 'feature/tracker', defaultBranch: 'main' },
    });
    assert.equal(slice.pass, true, `${provider}: a slice targeting a tracker branch may use the chain form`);
    const integration = await runCheck('issue-link', {
      ...deps, ctx: { body, provider, targetBranch: 'main', defaultBranch: 'main' },
    });
    assert.equal(integration.pass, false, `${provider}: the chain form must NOT satisfy a default-branch target`);
  }
});

// ── the emitted files on disk ───────────────────────────────────────────────

test('each provider\'s emitted file on disk is byte-identical to what the one source renders (#570)', () => {
  for (const provider of SCAFFOLD_PROVIDERS) {
    const { path } = scaffoldDelivery(provider);
    const onDisk = join(REPO_ROOT, path);
    assert.ok(existsSync(onDisk), `${path} must exist — a consumer on ${provider} receives nothing without it`);
    assert.equal(readFileSync(onDisk, 'utf8'), renderScaffold(provider),
      `${path} has been hand-edited — regenerate it from contributor-scaffold.mjs instead`);
  }
});

// ── delivery: a consumer on EITHER provider receives a scaffold ─────────────

test('the REAL installer, over the REAL manifest, delivers a scaffold for EVERY provider (#570)', () => {
  const dest = mkdtempSync(join(tmpdir(), 'brain-570-delivery-'));
  const { copied } = copyManaged({ srcRoot: REPO_ROOT, destRoot: dest, managed, local });
  for (const provider of SCAFFOLD_PROVIDERS) {
    const { path } = scaffoldDelivery(provider);
    assert.ok(copied.includes(path), `brain:upgrade does not ship ${path} — a ${provider} consumer gets no scaffold`);
    assert.equal(readFileSync(join(dest, path), 'utf8'), renderScaffold(provider),
      `the ${provider} consumer received something other than the emitted scaffold`);
  }
});

test('every provider\'s scaffold is REFUSE-classified, as the GitHub one is (design question (c), #570)', () => {
  for (const provider of SCAFFOLD_PROVIDERS) {
    const { path } = scaffoldDelivery(provider);
    assert.ok(managed.includes(path), `${path} must be a managed literal`);
    assert.equal(strategyFor(path, managedStrategy), STRATEGY.REFUSE,
      `${path} is prose a team rewrites wholesale — it must refuse, never clobber`);
  }
});

// ── the sweep: no brain-owned file re-states the false claim ────────────────

/**
 * The exact shape of the claim #516 corrected in the doctrine and that survived
 * in the scaffold for months: CI enforcing something on the `decision` label.
 * Deliberately narrow and deliberately named as narrow — it detects THIS claim
 * coming back, not every possible way to write a falsehood about a gate.
 */
const DECISION_LABEL_ENFORCEMENT_CLAIM =
  /(?:CI|gate|check)[^.\n]{0,60}\benforce[sd]?\b[^.\n]{0,60}`?decision`?\s+label|`?decision`?\s+label[^.\n]{0,60}\b(?:is enforced|arms|triggers|requires CI)\b/i;

test('no brain-owned file claims the `decision` label arms a gate (#516, #570)', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    // Brain-owned surfaces only: the emitted scaffolds, the doctrine, the code,
    // and the compiled agent brief. Consumer-owned trees are not this test's
    // business — this file travels to consumers.
    .filter(f => /^(\.github\/|\.gitlab\/|brain\/core\/|brain\/scripts\/|AGENTS\.md$)/.test(f))
    // Test files quote the claim as a fixture — including this one.
    .filter(f => !/\.test\.mjs$/.test(f));

  assert.ok(tracked.length > 50, 'sanity: the sweep must actually be reading the tree');
  const offenders = tracked.filter(f => {
    let src;
    try { src = readFileSync(join(REPO_ROOT, f), 'utf8'); } catch { return false; }
    return DECISION_LABEL_ENFORCEMENT_CLAIM.test(src);
  });
  assert.deepEqual(offenders, [],
    'the `decision` label is a human signal — decision-gate reads no labels (ADR-0026 Amendment 4)');
});

test('the sweep regex is a real detector, not a description of a clean tree (#570)', () => {
  assert.match('CI will enforce this when the `decision` label is present.', DECISION_LABEL_ENFORCEMENT_CLAIM);
  assert.doesNotMatch('Add the `decision` label to this pull request — no gate reads it.',
    DECISION_LABEL_ENFORCEMENT_CLAIM);
});

test('the scaffold states what the `decision` label actually is, and never that a gate reads it (#570)', () => {
  for (const provider of SCAFFOLD_PROVIDERS) {
    const rendered = renderScaffold(provider);
    assert.doesNotMatch(rendered, DECISION_LABEL_ENFORCEMENT_CLAIM);
    assert.match(rendered, /reads no labels/i, `${provider}: the scaffold must say the gate reads no labels`);
  }
});

test('the scaffold does not promise that `skip:memory-gate` exempts anything (#529, #570)', () => {
  for (const provider of SCAFFOLD_PROVIDERS) {
    const rendered = renderScaffold(provider);
    if (rendered.includes('skip:memory-gate')) {
      assert.match(rendered, /skip:memory-gate[^.]{0,120}(no code|nothing reads|not implemented|changes nothing)/i,
        `${provider}: naming the label without saying it is inert re-states an exemption that does not exist`);
    }
  }
});
