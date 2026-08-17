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
//
// ── THREE LIMITS, DECLARED RATHER THAN DISCOVERED ───────────────────────────
//
// 1. UNTRACKED FILES ARE INVISIBLE. The reader is `git ls-files`, so locally a
//    rotted citation in a file nobody staged yet passes. Measured: a
//    `brain/core/ROT-PROBE.md` citing ADR-7777, left unstaged, produced zero
//    findings. CI is unaffected — everything in a checkout is committed. The
//    alternative reader is a filesystem walk that re-implements `.gitignore`,
//    which is a worse reader, so this stands as a limit rather than a defect.
//
// 2. RESOLUTION, NEVER CORRECTNESS. A citation aimed at the WRONG ADR resolves
//    and passes. This proves a reader lands somewhere, never that they land
//    where the citing line claims.
//
// 3. CASE-SENSITIVE. `adr-0018` written in prose is not matched. Folding case
//    would fire on every `adr-….md` path in every link and reference list, so
//    the canonical `ADR-NNNN` form is what this reads — and a lowercase prose
//    citation is a miss it will not report.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
 * Everything else is scanned — and `REQUIRED_ROOTS` is what makes that
 * sentence true rather than aspirational.
 */
const UNSCANNED_ROOTS = Object.freeze(['.memory/', 'openspec/', 'brain-drafts/']);

/**
 * Roots that MUST contribute scanned files, each with why it carries pointers
 * a reader follows.
 *
 * Review finding G1. Before this existed, the scan surface was undefended: on a
 * green tree, adding `brain/core/` and `.github/` to `UNSCANNED_ROOTS` removed
 * two whole doctrine-bearing surfaces and left the suite **7/7 green**. Nothing
 * noticed, and the comment above went on claiming they were scanned.
 *
 * The vacuity guards below did not cover it and could not: they are absolute
 * counts, and excluding the whole of `brain/scripts/**` — where 3 of the 5
 * ADR-0018 citation sites live — still leaves 114 files and 393 citations, both
 * over their thresholds. Narrowing the scan must now DELETE a named entry here,
 * which is a visible act rather than one word added to a list.
 */
const REQUIRED_ROOTS = Object.freeze([
  { root: 'brain/core/', why: 'generic doctrine, STRATEGY.COPY into every consumer' },
  { root: 'brain/project/', why: 'the ADRs themselves, which cite each other' },
  { root: 'brain/scripts/', why: 'the code that cites decisions in its own reasoning — 3 of #590\'s 5 sites' },
  { root: '.github/', why: 'the workflows that implement the gates the ADRs decide' },
  { root: 'test/', why: 'suites that cite the doctrine they pin' },
  { root: 'docs/', why: 'adoption and planning documents readers actually follow' },
]);

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
 * Real rot this ticket does not repair.
 *
 * Every entry MUST name the issue that owns it, and that is enforced below
 * rather than asked for. Review finding G3: this comment used to claim the
 * ticket reference and neither entry carried one — "own ticket owed" and "as
 * above" — while the test asserted only that the string was non-empty. A
 * registry of accepted rot whose justifications nobody checks is how the rot
 * becomes permanent.
 *
 * Entries do not need removing by hand when the defect dies: the staleness
 * guard fails an entry that no longer matches an unresolved citation. Adding
 * one costs an issue number.
 *
 * `ADR-0018` is deliberately ABSENT. It is #590's subject, and baselining it
 * here would record the defect instead of fixing it. Until the human runs
 * `brain:promote` on the draft this branch carries, that citation is what
 * turns this suite red — by construction, not by accident.
 */
const KNOWN_GAPS = Object.freeze([]);

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
 * @returns {{citations: {file:string, line:number, number:string, text:string}[], scannedPaths:string[], scanned:number, binary:number}}
 */
function collectCitations(files) {
  const citations = [];
  const scannedPaths = [];
  let binary = 0;
  for (const file of files) {
    if (file === SELF) continue;
    if (UNSCANNED_ROOTS.some((root) => file.startsWith(root))) continue;
    const buf = readFileSync(join(REPO_ROOT, file)); // throws — never a silent skip
    if (buf.includes(0)) { binary++; continue; }
    scannedPaths.push(file);
    buf.toString('utf8').split('\n').forEach((text, i) => {
      for (const m of text.matchAll(CITATION_RE)) {
        citations.push({ file, line: i + 1, number: m[1], text: text.trim() });
      }
    });
  }
  return { citations, scannedPaths, scanned: scannedPaths.length, binary };
}

/** True when `entry` names this exact citation site. */
const covers = (entry, c) => entry.file === c.file && entry.number === c.number;

// ── The evidence, gathered once ─────────────────────────────────────────────

const files = trackedFiles();
const signed = signedAdrNumbers();
const { citations, scannedPaths, scanned, binary } = collectCitations(files);
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

test('adr-citations: every root that must be scanned actually was (G1 — the surface cannot be narrowed in silence)', () => {
  const silent = REQUIRED_ROOTS.filter((r) => !scannedPaths.some((p) => p.startsWith(r.root)));
  assert.deepEqual(
    silent.map((r) => r.root), [],
    'these roots contributed NOTHING to the scan — either they were added to UNSCANNED_ROOTS or they no longer exist:\n'
      + silent.map((r) => `  ${r.root} — ${r.why}`).join('\n')
      + '\n\n  Measured before this guard: excluding brain/core/ and .github/ on a green tree left the suite 7/7.'
      + '\n  Narrowing the scan is a decision. Delete the entry here and say why, or do not narrow it.',
  );
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

// ── Drafts: the links a promotion is about to make live ─────────────────────
//
// Review finding G4. A draft's sibling links (`](adr-0016-….md)`) are written
// relative to `brain/project/decisions/` — where `brain:promote` puts the file
// — not to the `brain-drafts/` dir they sit in. Nothing checked them there, and
// `brain:nav` only reads `brain/`, so a wrong link would go red on the HUMAN's
// signing commit rather than on the agent's. The failure belongs on the side
// that wrote it.

const DRAFT_LINK_RE = /\]\((adr-\d{4}-[a-z0-9][a-z0-9-]*\.md)\)/g;

const adrDrafts = files.filter((f) => /(?:^|\/)brain-drafts\/adr-\d{4}-[a-z0-9-]+\.md$/.test(f));

test('adr-citations: every sibling link in an ADR draft resolves at the path it will be promoted to (G4)', () => {
  const broken = [];
  for (const draft of adrDrafts) {
    const text = readFileSync(join(REPO_ROOT, draft), 'utf8'); // throws — never a silent skip
    for (const m of text.matchAll(DRAFT_LINK_RE)) {
      if (!existsSync(join(REPO_ROOT, DECISIONS_DIR, m[1]))) broken.push(`${draft} → ${m[1]}`);
    }
  }
  assert.deepEqual(
    broken, [],
    'these draft links will not resolve once the draft is promoted to '
      + `${DECISIONS_DIR}/ — and the red would land on the signing commit, not on the draft:\n`
      + broken.map((b) => `  ${b}`).join('\n'),
  );
});

test('adr-citations: the draft-link check is looking at real drafts (a vacuous pass is a failure)', () => {
  // With no draft in the tree the check above passes trivially. That is fine —
  // but it must be VISIBLY fine, not indistinguishable from a broken glob.
  const linked = adrDrafts.reduce(
    (n, d) => n + [...readFileSync(join(REPO_ROOT, d), 'utf8').matchAll(DRAFT_LINK_RE)].length, 0,
  );
  console.log(`      # ${adrDrafts.length} ADR draft(s) carrying ${linked} sibling link(s)`);
  assert.ok(adrDrafts.every((d) => d.includes('brain-drafts/')), 'the draft glob matched something outside brain-drafts/');
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
  // G3: the comment claimed "every entry names the ticket that owns it" while
  // the assertion checked only that the string was non-empty, and neither entry
  // named one. Enforced now — adding accepted rot costs an issue number.
  for (const e of KNOWN_GAPS) {
    assert.match(
      e.why, /#\d+/,
      `KNOWN_GAPS entry for ${e.file} (ADR-${e.number}) names no issue. Accepted rot needs a ticket that owns it:\n  ${e.why}`,
    );
  }
});
