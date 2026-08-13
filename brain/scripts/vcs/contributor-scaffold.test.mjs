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
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
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
  approvedLabelFor,
} from './contributor-scaffold.mjs';
import { GOVERNANCE_JOBS } from './governance-checks.mjs';
import { issueLink } from '../governance/checks/issue-link.mjs';
import { runCheck } from '../governance/run-check.mjs';
import { managed, local, managedStrategy, STRATEGY } from '../../core/managed-paths.mjs';
import { copyManaged, strategyFor } from '../lib/installer.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * These test files travel to every consumer under `brain/scripts/**` (COPY), and a
 * consumer's `npm test` may well glob them the way brain's own package.json does.
 * Three tests below read the TREE rather than pure functions, and their subject is
 * BRAIN'S OWN source tree — asserting brain's bytes are on a consumer's disk turns
 * red for the consumer doing exactly what `STRATEGY.REFUSE` grants them (rewriting
 * their own scaffold), and the tree sweep would police files brain does not own.
 *
 * `.brain-source` is the marker `.github/workflows/governance.yml` already uses for
 * precisely this distinction — present only in brain's source repo, never a managed
 * path, so never vendored. Same idiom, same reason.
 */
const IS_BRAIN_SOURCE = existsSync(join(REPO_ROOT, '.brain-source'));

// ── one source, per-provider emission ───────────────────────────────────────

test('renderScaffold is a pure substitution over the ONE neutral template — the provider texts cannot diverge (#340, #570)', () => {
  for (const provider of SCAFFOLD_PROVIDERS) {
    const d = scaffoldDelivery(provider);
    const rendered = renderScaffold(provider);
    // Reverse the substitution: the rendered text must fold back EXACTLY onto
    // the template. A hand-edit to one provider's emitted text (or a second
    // source of that text) cannot survive this.
    //
    // `abbr` folds on WORD BOUNDARIES. An unanchored split turned any uppercase
    // PR/MR substring — PROCESS, PROVIDER, IMPROVE — into `{{abbr}}OCESS` and
    // reported it as a divergence that did not exist: a guard that cries wolf on
    // ordinary prose gets edited away, and then it guards nothing.
    const folded = rendered
      .split(d.path).join('{{path}}')
      .split(approvedLabelFor(provider)).join('{{approvedLabel}}')
      .split(d.nounTitle).join('{{Noun}}')
      .split(d.noun).join('{{noun}}')
      .replace(new RegExp(`\\b${d.abbr}\\b`, 'g'), '{{abbr}}');
    assert.equal(folded, SCAFFOLD_TEMPLATE,
      `${provider}'s emitted text is not the neutral template with its vocabulary substituted`);
  }
});

test('the fold tolerates ordinary prose containing the abbreviation as a substring (#570)', () => {
  // Pins the fix, not the bug: a template word like PROCESS must not read as `{{abbr}}`.
  for (const provider of SCAFFOLD_PROVIDERS) {
    const d = scaffoldDelivery(provider);
    const sample = `PROCESS ${d.abbr} IMPROVE`;
    assert.equal(sample.replace(new RegExp(`\\b${d.abbr}\\b`, 'g'), '{{abbr}}'), 'PROCESS {{abbr}} IMPROVE');
  }
});

test('the neutral template carries no provider vocabulary of its own (#570)', () => {
  assert.doesNotMatch(SCAFFOLD_TEMPLATE, /pull request|merge request|\bPR\b|\bMR\b/i,
    'the source must be neutral — vocabulary belongs to the provider delivery record');
  assert.doesNotMatch(SCAFFOLD_TEMPLATE, /\.github\/|\.gitlab\//,
    'the source must name no provider path — delivery is the provider-specific half');
  assert.doesNotMatch(SCAFFOLD_TEMPLATE, /status::?approved/,
    'the approved label is per-provider (GitLab scopes it `::`) — it is read from approved-label.mjs, never spelled here');
});

test('each provider prints the approved label in the form ITS OWN gate compares against (#570)', () => {
  assert.equal(approvedLabelFor('github'), 'status:approved');
  assert.equal(approvedLabelFor('gitlab'), 'status::approved');
  assert.match(renderScaffold('github'), /`status:approved`/);
  assert.match(renderScaffold('gitlab'), /`status::approved`/);
  assert.doesNotMatch(renderScaffold('gitlab'), /`status:approved`/,
    'GitLab contributors must not be told to look for a label their gate does not compare against');
});

test('the GitLab scaffold is delivered as Default.md — the only name GitLab auto-applies (#570)', () => {
  // The PR that added this called the name load-bearing; nothing pinned it, so a
  // rename to any other basename shipped "a scaffold that does not scaffold" green.
  assert.equal(scaffoldDelivery('gitlab').path, '.gitlab/merge_request_templates/Default.md');
  assert.equal(scaffoldDelivery('github').path, '.github/PULL_REQUEST_TEMPLATE.md');
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

// ── the gate rows, against the code they describe ───────────────────────────
//
// The first version of this table stated three rows the code does not implement,
// and the only assertion over it was "every job name appears". A row is a CLAIM;
// where the claim is mechanically checkable, it is checked here. The rows that
// remain prose-only (`actor-check`, `phase-order`, `brain-writes-reviewed`,
// `diff-size`) are named as such rather than implied to be covered.

test('the memory-gate row describes BOTH pipeline wirings, because the gate has both (#570)', async () => {
  // runCheck dispatches memory-gate to the ISSUE-SCOPED evaluator whenever the
  // pipeline handed it a description carrying an extractable reference, and to the
  // repo-scoped one when it did not. GitHub's job passes no body; GitLab's context
  // loader always fetches the MR description. A row asserting one of those two is
  // false on the other provider — which is what shipped, on the GitLab file this
  // very change invented.
  const records = [{ type: 'session_summary', issue: 12 }];
  const deps = { readRecords: () => records, readConfig: () => ({}) };
  const filled = renderScaffold('gitlab').replace(/^([A-Za-z]+) #$/m, '$1 #570');

  const withBody = await runCheck('memory-gate', {
    ...deps,
    ctx: { body: filled, provider: 'gitlab', targetBranch: 'main', defaultBranch: 'main' },
  });
  assert.equal(withBody.pass, false,
    'a body-carrying pipeline scopes memory-gate to the linked issue — an unrelated session_summary does not satisfy it');

  const withoutBody = await runCheck('memory-gate', {
    ...deps,
    ctx: { body: null, provider: 'github', targetBranch: 'main', defaultBranch: 'main' },
  });
  assert.equal(withoutBody.pass, true,
    'a pipeline that passes no body degrades to the repo-scoped question');

  for (const provider of SCAFFOLD_PROVIDERS) {
    const row = GATE_SUMMARY['memory-gate'];
    assert.match(row, /scoped to the linked issue/i, 'the row must state the issue-scoped form');
    assert.match(row, /otherwise|degrades/i, 'the row must state the fallback, not just one wiring');
    assert.doesNotMatch(renderScaffold(provider), /memory-gate` does not check this/i,
      `${provider}: the scaffold must not claim the gate ignores this change`);
  }
});

test('the local-checks row does not promise a step a consumer\'s CI skips (#570)', () => {
  // governance.yml runs the internal unit suite only `if hashFiles('.brain-source')`,
  // and the marker is never a managed path — so `npm test` does NOT run in a
  // consumer's governance pipeline. If that condition is ever removed, this test
  // goes red and the row may (and should) be widened again.
  if (!IS_BRAIN_SOURCE) return;
  const workflow = readFileSync(join(REPO_ROOT, '.github', 'workflows', 'governance.yml'), 'utf8');
  const testStep = workflow.slice(workflow.indexOf('run: npm test') - 400, workflow.indexOf('run: npm test'));
  assert.match(testStep, /hashFiles\('\.brain-source'\)/,
    'sanity: the row below is written for a workflow that gates npm test on .brain-source');
  assert.doesNotMatch(GATE_SUMMARY['local-checks'], /npm test/,
    'the local-checks row must not claim the unit suite runs in CI — a consumer pipeline skips it');
});

test('the brain-writes-reviewed row states the tier condition, not only the lightest form (#570)', () => {
  // At `lite` the whole evidence form is "the author is not an agent identity"; at
  // standard/regulated an approving review by a distinct human is ALSO required, and
  // `resolveTier({})` is `standard` — the default consumer. A row describing only
  // `lite` understates the gate for most readers.
  assert.match(GATE_SUMMARY['brain-writes-reviewed'], /lightest tier/i);
  assert.match(GATE_SUMMARY['brain-writes-reviewed'], /review/i);
});

// ── the emitted files on disk ───────────────────────────────────────────────

test('each provider\'s emitted file on disk is byte-identical to what the one source renders (#570)', () => {
  // BRAIN SOURCE ONLY. In a consumer these bytes are theirs to rewrite —
  // `STRATEGY.REFUSE` exists to say so — and a brain-shipped test forbidding the
  // edit brain's own manifest grants is a defect, not a guard.
  if (!IS_BRAIN_SOURCE) return;
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
  // BRAIN SOURCE ONLY, same reason as the on-disk test above: this copies THIS tree
  // as if it were the package being installed, so in a consumer it would assert that
  // the consumer's own (legitimately rewritten) scaffold equals brain's bytes.
  if (!IS_BRAIN_SOURCE) return;
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

test('MEASURED: REFUSE does not protect a path on the release that FIRST ships it (#570)', () => {
  // The classification above is a table lookup. What the upgrade DOES with it is
  // this, and the two are not the same thing on a first ship: `copyManaged` only
  // classifies a path as consumer-modified when the PREVIOUSLY INSTALLED package
  // shipped it (`outgoing.has(rel)`), and a brand-new path is in no prior release.
  // So the guarantee starts one release late, and a GitLab team that already owns
  // `Default.md` — the single most likely filename for them to own — is overwritten
  // rather than named.
  //
  // This test pins the REAL behaviour rather than the wished one, so the day it is
  // fixed this goes red and the manifest comment gets corrected with it.
  const tmp = mkdtempSync(join(tmpdir(), 'brain-570-firstship-'));
  const src = join(tmp, 'src');
  const dest = join(tmp, 'dest');
  const rel = scaffoldDelivery('gitlab').path;
  mkdirSync(dirname(join(src, rel)), { recursive: true });
  mkdirSync(dirname(join(dest, rel)), { recursive: true });
  writeFileSync(join(src, rel), 'BRAIN VERSION\n');
  writeFileSync(join(dest, rel), 'THE CONSUMER OWN TEMPLATE\n');

  const result = copyManaged({
    srcRoot: src,
    destRoot: dest,
    managed: [rel],
    local: [],
    refusePaths: [rel],
    outgoing: new Map(),   // exactly what readOutgoing returns for a first ship
  });

  assert.deepEqual(result.refused, [], 'first ship: nothing is refused, because nothing is known to be modified');
  assert.ok(result.collisions.includes(rel), 'it is reported as a collision — the only signal the operator gets');
  assert.equal(readFileSync(join(dest, rel), 'utf8'), 'BRAIN VERSION\n',
    'and the consumer bytes are gone unless the operator passed --abort-on-collision');
});

// ── the sweep: no brain-owned file re-states the false claim ────────────────

/**
 * Claims that the `decision` LABEL changes what a gate does. `decision-gate`
 * dispatches to `adrPresence`, whose entire input is the changed- and added-file
 * lists — the label changes no verdict, in either direction.
 *
 * The first version of this pattern keyed on the word "enforce" and on four fixed
 * verbs, which is a wording, not a meaning: rewriting the same falsehood as "with
 * it present, decision-gate becomes hard" sailed through. It now keys on the LINK
 * between the label and any statement of gate behaviour, in either order.
 */
const DECISION_LABEL_ENFORCEMENT_CLAIM = new RegExp(
  [
    // "…decision label … <gate behaviour>"
    '`?decision`?\\s+label[^.\\n]{0,90}\\b(?:enforc\\w*|arms?|trigger\\w*|hard|mandator\\w*|required|requires|blocks?|two-step|step 2|heuristic|stricter|MUST)\\b',
    // "<gate behaviour> … decision label"
    '\\b(?:enforc\\w*|hard|mandator\\w*|two-step|step 2|heuristic|stricter)\\b[^.\\n]{0,90}`?decision`?\\s+label',
    // "a PR labeled decision MUST …" — the ADR-0014 phrasing
    'label(?:ed|led)\\s+`?decision`?[^.\\n]{0,90}\\b(?:MUST|hard|required|enforc\\w*)\\b',
    // The label need not be NAMED for the claim to be made: "decision-gate becomes
    // hard", "decision-gate is two-step". This alternative is what catches the
    // anaphoric form, which defeated every label-keyed pattern above.
    '`?decision-gate`?[^.\\n]{0,90}\\b(?:hard|two-step|step 2|heuristic|stricter|label-conditional|conditional on)\\b',
    // "labels that make a gate stricter (`decision`, …)" — the label as a member of
    // a list, with the behaviour claim ahead of it and no "label" word adjacent.
    '\\b(?:stricter|tighten\\w*)\\b[^.\\n]{0,80}`decision`',
  ].join('|'),
  'i',
);

/**
 * Files that carry the claim TODAY, each with the ticket that owns removing it.
 * Frozen and asserted BOTH ways: a new occurrence anywhere else is red, and an
 * entry that no longer matches is also red, so this list cannot quietly become a
 * museum. Three of them are Tier-2 doctrine (`brain/core/**`, an ADR) that an
 * agent may not hand-edit, which is exactly why they are named here instead of
 * being silently excluded — the alternative is a green suite over a tree that
 * still lies. See #570's PR for the measurement.
 */
const KNOWN_CLAIM_SURVIVORS = Object.freeze({
  'brain/core/methodology/workflow-governance.md': 'Tier-2 doctrine: the brain:metrics caveat still justifies label-conditional counting by a "Step 1 hard / Step 2 heuristic" model the same file deletes 190 lines earlier',
  'AGENTS.md': 'generated from the file above — regenerates clean once the doctrine is amended',
  'brain/core/methodology/reviewer-protocol.md': 'Tier-2 doctrine: lists `decision` among labels that "make a gate stricter"',
  'brain/project/decisions/adr-0014-workflow-governance.md': 'Tier-2 decision record: "A PR labeled `decision` MUST … (hard)" — needs a signed amendment, not an edit',
  'brain/project/decisions/adr-0015-governance-v3-substrate-ladder.md': 'Tier-2 decision record: decision-gate described as "ADR ships for a labeled decision"',
  'docs/methodology-map/index.html': 'the two-step/heuristic model, three times — plain docs, no signature needed',
  'openspec/specs/governance/spec.md': 'living spec: still specifies the label-conditional model (and a GitHub-only scaffold requirement)',
  'openspec/specs/governance-v3/spec.md': 'living spec: same model',
  'openspec/specs/governance-metrics/spec.md': 'living spec: same model, in the metrics requirements',
  'brain/scripts/review/deny-set.mjs': 'the CODE side of reviewer-protocol §9 — classifies `decision` as a "tightening" label; the wording follows the doctrine above, so it moves when that amendment does',
});

/**
 * Matches the detector fires on that are NOT the falsehood. Kept separate from the
 * survivors above on purpose: those are things to fix, these are limits of a regex
 * reading prose, and collapsing the two would let a real claim hide behind the word
 * "exempt".
 *
 *   · `brain:metrics` REALLY IS label-conditional — `metrics-aggregate.mjs:175`
 *     skips unlabeled merges when counting. A sentence about COUNTS is true.
 *   · An amendment that QUOTES the wording it repeals has to reproduce it.
 */
const DETECTOR_EXEMPT = Object.freeze({
  'brain/scripts/lib/metrics-aggregate.mjs': 'describes brain:metrics COUNTING, which is genuinely label-conditional',
  'brain/project/decisions/adr-0026-governance-doctrine-tiers.md': 'Amendment 4 quotes the pre-#516 wording in the act of repealing it',
});

/**
 * SDD change artifacts: proposals, designs and drafts record what a change PROPOSED,
 * including the text it was repealing — #516's own proposal has to quote the claim it
 * removes. They are also `local` (consumer-owned) in the manifest, i.e. never brain's
 * description of the system. `openspec/specs/**` is NOT here: those are living specs
 * and are held to the same standard as doctrine.
 */
const HISTORICAL_PATHS = /^openspec\/changes\//;

/** Tracked files that carry the claim, minus fixtures, history and detector exemptions. */
function sweepTree() {
  const tracked = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    // Test files quote the claim as a fixture — including this one.
    .filter(f => !/\.test\.mjs$/.test(f))
    .filter(f => !f.startsWith('.memory/'))
    .filter(f => !HISTORICAL_PATHS.test(f))
    .filter(f => !Object.hasOwn(DETECTOR_EXEMPT, f));

  assert.ok(tracked.length > 300, 'sanity: the sweep must actually be reading the whole tree');
  return tracked.filter(f => {
    let src;
    try { src = readFileSync(join(REPO_ROOT, f), 'utf8'); } catch { return false; }
    return DECISION_LABEL_ENFORCEMENT_CLAIM.test(src);
  });
}

test('no file outside the KNOWN survivors claims the `decision` label changes a gate (#516, #570)', () => {
  // BRAIN SOURCE ONLY: the survivor list and the ownership filter are statements
  // about brain's tree. A consumer's `.github/**` is theirs (ADR-0014's own
  // "never manage .github/**"), and policing it from a vendored test is wrong.
  if (!IS_BRAIN_SOURCE) return;
  const offenders = sweepTree();
  assert.deepEqual(
    offenders.filter(f => !Object.hasOwn(KNOWN_CLAIM_SURVIVORS, f)),
    [],
    'the `decision` label is a human signal — decision-gate reads no labels (ADR-0026 Amendment 4)',
  );
});

test('the KNOWN survivors list is current — an entry that no longer matches must be deleted (#570)', () => {
  if (!IS_BRAIN_SOURCE) return;
  const stale = Object.keys(KNOWN_CLAIM_SURVIVORS).filter(f => {
    let src;
    try { src = readFileSync(join(REPO_ROOT, f), 'utf8'); } catch { return true; }
    return !DECISION_LABEL_ENFORCEMENT_CLAIM.test(src);
  });
  assert.deepEqual(stale, [],
    'these files were fixed (or moved) — drop them from KNOWN_CLAIM_SURVIVORS so the sweep tightens');
});

test('the sweep detects the MEANING, not one wording (#570)', () => {
  // Every string here is a real sentence that was live in this repo, or the exact
  // rewrite that defeated the first version of this pattern.
  for (const claim of [
    'CI will enforce this when the `decision` label is present.',
    'with it present, decision-gate becomes hard and both the ADR and the entry are mandatory',
    'decision-gate is two-step: hard when the decision label is present',
    'A PR labeled `decision` MUST add an `adr-NNNN-*.md`',
    'The reviewer may apply labels that make a gate stricter (`decision`, `seq:*`)',
  ]) {
    assert.match(claim, DECISION_LABEL_ENFORCEMENT_CLAIM, `not detected: ${claim}`);
  }
  for (const honest of [
    'Add the `decision` label to this pull request — no gate reads it.',
    'Step 3 is a human signal that a decision was made.',
    'decision-gate reads no labels and runs on every change.',
  ]) {
    assert.doesNotMatch(honest, DECISION_LABEL_ENFORCEMENT_CLAIM, `false positive: ${honest}`);
  }
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
      assert.match(rendered, /skip:memory-gate[^.]{0,120}(no code|no gate|nothing reads|not implemented|changes nothing|exempts nothing)/i,
        `${provider}: naming the label without saying it is inert re-states an exemption that does not exist`);
    }
  }
});
