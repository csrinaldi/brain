// adr-citation-resolves.e2e.test.mjs — every `ADR-NNNN` a live file cites must
// resolve to a file a reader can open (issue #590).
//
// WHY THIS EXISTS. #586 was a doctrine pointer whose target had MOVED. #590 is
// the same class one step worse: `ADR-0018` was cited from four live files —
// the root `.gitlab-ci.yml`, the managed GitLab fragment that ships to
// consumers, a governance test, and `workflow-auth.mjs` — and there was no
// target at all. It stayed that way for months because nothing reads a
// citation and asks whether it resolves. `reviewer-protocol.md`'s citation
// guard covers exactly one file by design, so it could not have caught this.
//
// WHAT IT IS NOT. This is a RESOLUTION check, not a correctness check: it
// proves the reader lands on a file, never that the file says what the citing
// line claims. A pointer aimed at the wrong ADR passes here.
//
// THE TWO REGISTRIES BELOW ARE THE WHOLE HONESTY BUDGET. Both are exact
// (file, number) pairs, never patterns, and both are checked for staleness —
// an entry that no longer matches a real citation FAILS this suite instead of
// rotting in place. A number is exempt at ONE path, not everywhere.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DECISIONS_DIR = 'brain/project/decisions';

/** A citation. The lookahead stops `ADR-00181` from reading as `ADR-0018`. */
const CITATION_RE = /ADR-(\d{4})(?!\d)/g;

/** A signed ADR on disk. Same anchored shape `brain:promote` writes. */
const ADR_FILE_RE = /^adr-(\d{4})-[a-z0-9][a-z0-9-]*\.md$/;

/**
 * Roots that are NOT scanned, each because a citation there is not a pointer a
 * reader follows to live doctrine:
 *
 *   `.memory/`      durable memory records — an append-only log of what was
 *                   observed at the time. Retroactively editing an observation
 *                   to match today's tree is exactly what a memory layer must
 *                   never do.
 *   `openspec/`     in-flight and archived change artifacts. A `brain-drafts/`
 *                   ADR carrying a number that does not resolve yet is not rot
 *                   — that IS a draft. #590's own draft lives here.
 *   `brain-drafts/` the same shape at the repo root.
 *
 * Everything else is scanned: `brain/core`, `brain/project`, `brain/scripts`,
 * `.github/`, the root `.gitlab-ci.yml`, `test/`, `docs/`, `AGENTS.md`.
 */
const UNSCANNED_ROOTS = Object.freeze(['.memory/', 'openspec/', 'brain-drafts/']);

/**
 * This file, and only this file, is excluded from its own scan.
 *
 * Measured before adding it: scanning itself produced 8 self-inflicted
 * findings out of 13 — the registries below must NAME the numbers they exempt,
 * and the failure messages must name the number the ticket is about, so every
 * one of those strings read back as an unresolved citation. That is noise
 * about the checker, not evidence about the tree.
 *
 * The cost is real and stated: a rotted pointer in THIS file's own comments is
 * not caught by this check. The guard below pins the exclusion to this exact
 * path so it can never be widened into a second exempt file.
 */
const SELF = 'test/adr-citation-resolves.e2e.test.mjs';

/**
 * Numbers that are deliberate fakes in test material — a fixture ADR must not
 * name a real decision record, or editing doctrine would break unrelated tests.
 * These are not rot and never resolve.
 */
const FIXTURE_CITATIONS = Object.freeze([
  { file: 'brain/scripts/lib/home-index-nav-integrity.test.mjs', number: '0099',
    why: 'fixture HOME.md entry ("# ADR-0099 — Example: Decision title")' },
  { file: 'brain/scripts/brain-promote.amendment.test.mjs', number: '9999',
    why: 'fixture ADR the amendment promoter is driven against' },
  { file: 'test/upgrade/in-container.sh', number: '9001',
    why: 'fixture consumer decision seeded into a throwaway tree' },
]);

/**
 * Real rot this ticket does not repair. This list may only SHRINK: every entry
 * names the ticket that owns it, and a stale entry fails below rather than
 * silently outliving the defect.
 *
 * `ADR-0018` is deliberately ABSENT. It is #590's subject, and baselining it
 * here would record the defect instead of fixing it. Until the human runs
 * `brain:promote` on the draft this branch carries, that citation is what
 * turns this suite red — by construction, not by accident.
 */
const KNOWN_GAPS = Object.freeze([
  { file: 'docs/inbox/MASTER-PLAN-1.0.md', number: '0023',
    why: 'ADR-0023 (SDD role port) drafted at brain-drafts/adr-0023-sdd-role-port.md, never promoted — same class as #590, own ticket owed' },
  { file: 'docs/inbox/brain-v2-epic-plan.md', number: '0023',
    why: 'as above — the second citation of the same unpromoted draft' },
]);

// ── Readers. Every one of them throws rather than returning empty ────────────
//
// A reader that yields `[]` when it cannot read makes "nothing cited anything"
// indistinguishable from "the scan never ran", and a vacuous green is worse
// than no check. Each of the three below fails loudly, and the vacuity guards
// at the bottom of the file assert the readers actually produced evidence.

/** @returns {string[]} repo-relative paths of every tracked file. Throws if git fails. */
function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8',
  });
  const files = out.split('\0').filter(Boolean);
  if (files.length === 0) throw new Error('git ls-files returned nothing — the scan cannot run');
  return files;
}

/**
 * @param {string} [dir] repo-relative decisions dir; parameterised so the
 *   empty-result branch is drivable by a test rather than merely asserted about.
 * @returns {Set<string>} the four-digit numbers of the ADRs on disk. Throws if the dir is unreadable.
 */
function signedAdrNumbers(dir = DECISIONS_DIR) {
  const numbers = new Set();
  for (const name of readdirSync(join(REPO_ROOT, dir))) {
    const m = name.match(ADR_FILE_RE);
    if (m) numbers.add(m[1]);
  }
  if (numbers.size === 0) throw new Error(`${dir} holds no ADR — the scan cannot run`);
  return numbers;
}

/**
 * Every citation in the scanned surface.
 *
 * A read failure throws. A file holding a NUL byte is binary and is counted as
 * skipped — it cannot carry a citation — so the count stays visible rather
 * than being folded into "no matches".
 *
 * @param {string[]} files
 * @returns {{citations: {file:string, line:number, number:string, text:string}[], scanned:number, binary:number}}
 */
function collectCitations(files) {
  const citations = [];
  let scanned = 0;
  let binary = 0;
  for (const file of files) {
    if (file === SELF) continue;
    if (UNSCANNED_ROOTS.some((root) => file.startsWith(root))) continue;
    const buf = readFileSync(join(REPO_ROOT, file)); // throws — never a silent skip
    if (buf.includes(0)) { binary++; continue; }
    scanned++;
    buf.toString('utf8').split('\n').forEach((text, i) => {
      for (const m of text.matchAll(CITATION_RE)) {
        citations.push({ file, line: i + 1, number: m[1], text: text.trim() });
      }
    });
  }
  return { citations, scanned, binary };
}

/** True when `entry` names this exact citation site. */
const covers = (entry, c) => entry.file === c.file && entry.number === c.number;

// ── The evidence, gathered once ─────────────────────────────────────────────

const files = trackedFiles();
const signed = signedAdrNumbers();
const { citations, scanned, binary } = collectCitations(files);
const unresolved = citations.filter((c) => !signed.has(c.number));
const registry = [...FIXTURE_CITATIONS, ...KNOWN_GAPS];

// ── Vacuity guards — run first, so a broken scan cannot pass as a clean one ──

test('adr-citations: the scan actually read the tree (a vacuous pass is a failure)', () => {
  assert.ok(scanned > 100, `only ${scanned} files scanned — the reader or the exclusions are wrong`);
  assert.ok(citations.length > 100, `only ${citations.length} citations found — the regex is not matching`);
  assert.ok(signed.size >= 25, `only ${signed.size} signed ADRs found — ${DECISIONS_DIR} was misread`);
  assert.ok(binary >= 0 && Number.isInteger(binary), 'binary-file count was not computed');
});

test('adr-citations: a reader that cannot read FAILS — it never reports an empty scan (evidence-reader-empty-on-failure)', () => {
  // The class this guards against: a reader that swallows its error and returns
  // `[]` makes "nothing cited anything" indistinguishable from "the scan never
  // ran", and this suite's whole verdict is the emptiness of a list.
  assert.throws(
    () => collectCitations(['brain/project/decisions/adr-0000-does-not-exist.md']),
    /ENOENT/,
    'collectCitations swallowed a read failure — an unreadable file must abort the scan, not vanish from it',
  );
  assert.throws(
    () => signedAdrNumbers('test/fixtures'),
    /holds no ADR/,
    'signedAdrNumbers returned an empty set instead of failing — every citation would then read as unresolved-or-fine depending on nothing',
  );
});

test('adr-citations: the self-exclusion covers exactly this file and nothing else', () => {
  // Derived from the module's own URL, so SELF cannot be re-pointed at another
  // file to quiet a finding: the constant and the running file must agree.
  const actual = fileURLToPath(import.meta.url).slice(REPO_ROOT.length + 1).split('\\').join('/');
  assert.equal(SELF, actual, `SELF names ${SELF} but this file is ${actual} — the exclusion moved`);
  assert.equal(files.includes(SELF), true, `${SELF} is not tracked — the exclusion exempts nothing`);
});

test('adr-citations: a citation that DOES resolve is reached by the scan (the check can say yes)', () => {
  // ADR-0016 is cited from the same GitLab fragment ADR-0018 is, and it exists.
  // If this stops holding, the scan stopped reaching the surface #590 is about.
  const resolvable = citations.filter((c) => c.number === '0016' && signed.has(c.number));
  assert.ok(
    resolvable.some((c) => c.file === 'brain/scripts/ci/gitlab-governance.yml'),
    'gitlab-governance.yml no longer contributes a resolving ADR-0016 citation — the scan surface moved',
  );
});

// ── The check ───────────────────────────────────────────────────────────────

test('adr-citations: every cited ADR-NNNN resolves to a file in brain/project/decisions/', () => {
  const rot = unresolved.filter((c) => !registry.some((e) => covers(e, c)));
  const report = rot
    .map((c) => `  ${c.file}:${c.line}  cites ADR-${c.number} — no ${DECISIONS_DIR}/adr-${c.number}-*.md\n      ${c.text}`)
    .join('\n');
  assert.equal(
    rot.length, 0,
    `${rot.length} citation(s) point at a decision record that cannot be opened:\n${report}\n\n` +
      '  A reader who follows one of these lands on nothing.\n' +
      '  Fix it by promoting the ADR (npm run brain:promote -- <draft path>) or by\n' +
      '  re-pointing the citation at the ADR that actually holds the reasoning.\n' +
      `  Do NOT add it to KNOWN_GAPS in ${'test/adr-citation-resolves.e2e.test.mjs'} without a ticket.`,
  );
});

test('adr-citations: no registry entry outlives the citation it exempts', () => {
  const stale = registry.filter((e) => !unresolved.some((c) => covers(e, c)));
  assert.equal(
    stale.length, 0,
    'these entries no longer match an unresolved citation — delete them:\n' +
      stale.map((e) => `  ${e.file} → ADR-${e.number} (${e.why})`).join('\n'),
  );
});

test('adr-citations: KNOWN_GAPS only shrinks — ADR-0018 is never baselined (#590)', () => {
  // The defect this ticket exists to fix must never be recordable as accepted.
  assert.equal(
    KNOWN_GAPS.some((e) => e.number === '0018'), false,
    'ADR-0018 was added to KNOWN_GAPS. #590 is the ticket to WRITE it or re-point its ' +
      'citations — baselining it records the rot as acceptable.',
  );
  for (const e of KNOWN_GAPS) {
    assert.match(e.why, /\S/, `KNOWN_GAPS entry for ${e.file} carries no reason`);
  }
});
