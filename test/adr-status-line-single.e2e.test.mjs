// adr-status-line-single.e2e.test.mjs — every signed ADR already on disk
// carries exactly one `**Status**:` line, §1c act 1 (issue #676 point 2).
//
// WHY THIS EXISTS. #675 was the write path landing a corrupt signed ADR with
// TWO `**Status**:` lines — one a stripped-preamble survivor, one the header
// rewrite's own — and staging it. `applyStatusAct` already refuses to *touch*
// a file in that state, but nothing on the READ side ever asked the tree
// itself whether the invariant holds for files that got there some other way.
// Point 1 (PR #692) repaired the one violation that existed; this suite is
// what keeps asking, at every run, rather than trusting that one repair held.
//
// WHAT IT IS NOT. This does not re-derive the rule. It calls
// `checkSingleStatusLine`, the same function `applyStatusAct` and
// `promote-guards.mjs`'s write-path guard already call, so the read half and
// the write half of this verb cannot disagree the way #675's two halves did.
//
// A GREEN NEVER WATCHED TO FAIL PROVES NOTHING. This file is born green on
// 30/30 real ADRs. The vacuity guard below and the fixture arms (A: a
// synthetic dir; B: real bytes mutated only in memory) exercise the red path
// automatically, on every run. A third arm — mutating one real file in the
// working tree and reverting it — is Tier 2 (`agent-authorities.md:36`) and is
// NOT performed here; it is a human, one-time round (REQ-676-6, tracked
// separately from this file's own green).
//
// ── ONE LIMIT, DECLARED ──────────────────────────────────────────────────
//
// This suite's subject is brain's own `brain/project/decisions/`. `test/`
// ships to no consumer (absent from `package.json` `files` and from
// `brain/core/managed-paths.mjs`), so a vendoring consumer's own
// `brain/project/` gets no on-disk check from this file — that gap is a
// separate ticket, not a silent one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADR_TARGET_RE, checkSingleStatusLine } from '../brain/scripts/lib/amendment-draft.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DECISIONS_DIR = 'brain/project/decisions';

// ── Fixture bodies for arm A ────────────────────────────────────────────────
// Named for the shape they carry, matching design D5's four-file set. The
// canonical membership predicate (`ADR_TARGET_RE` against the FIXED
// `brain/project/decisions/${name}` prefix) is what makes these count as ADRs
// regardless of the directory they actually sit in.

const TWO_STATUS_PREAMBLE = [
  '# ADR-0001: Example Decision',
  '',
  '**Status**: Accepted',
  '**Date**: 2020-01-01',
  '',
  '## Context',
  '',
  'Some context prose that has nothing to do with the invariant under test.',
  '',
  '## Decision',
  '',
  'The decision text goes here.',
  '',
  '**Status**: Accepted',
].join('\n');

const TWO_STATUS_BODY = [
  '# ADR-0002: Example Decision',
  '',
  '**Date**: 2020-01-02',
  '',
  '## Context',
  '',
  '**Status**: Proposed',
  '',
  '## Decision',
  '',
  '**Status**: Accepted',
].join('\n');

const ZERO_STATUS = [
  '# ADR-0003: Example Decision',
  '',
  '**Date**: 2020-01-03',
  '',
  '## Context',
  '',
  'No Status line anywhere in this file.',
  '',
  '## Decision',
  '',
  'Text without the marker.',
].join('\n');

const ONE_STATUS_CONTROL = [
  '# ADR-0004: Example Decision',
  '',
  '**Status**: Accepted',
  '**Date**: 2020-01-04',
  '',
  '## Context',
  '',
  'A well-formed ADR. Must never be named as an offender.',
].join('\n');

// ── The three functions under test (interfaces per design.md) ──────────────

/**
 * `dir` may be repo-relative or absolute — `resolve` (not `join`) honours an
 * absolute argument, which is what lets arm A's `mkdtempSync` dir work
 * unmodified. Membership stays the canonical predicate regardless of which
 * dir was actually read: `ADR_TARGET_RE` against the FIXED
 * `brain/project/decisions/${name}` prefix, never against `dir` itself.
 *
 * @param {string} [dir] repo-relative OR absolute. Throws on an empty enumeration.
 * @returns {{name:string, path:string, text:string}[]}
 */
function readSignedAdrs(dir = DECISIONS_DIR) {
  const absDir = resolve(REPO_ROOT, dir);
  const names = readdirSync(absDir).filter((name) => ADR_TARGET_RE.test(`brain/project/decisions/${name}`));
  if (names.length === 0) throw new Error(`${dir} holds no ADR — the sweep cannot run`);
  return names.map((name) => ({
    name,
    path: join(dir, name),
    text: readFileSync(join(absDir, name), 'utf8'),
  }));
}

/**
 * Delegates the verdict entirely to `checkSingleStatusLine` — no second
 * `**Status**:` counter lives in this file.
 *
 * @param {{name:string, path:string, text:string}[]} adrs
 * @returns {{path:string, count:number, lines:number[]}[]} offenders only
 */
function auditAdrs(adrs) {
  const offenders = [];
  for (const adr of adrs) {
    const verdict = checkSingleStatusLine(adr.text);
    if (!verdict.ok) offenders.push({ path: adr.path, count: verdict.count, lines: verdict.indices });
  }
  return offenders;
}

/**
 * One sweep, not a subtest per ADR (design D4) — a broken enumerator
 * registers zero tests, and `node --test` reports zero tests as a pass, so
 * the precise-failure-names shape has to live in the render, not in test
 * count.
 *
 * @param {{path:string, count:number, lines:number[]}[]} offenders
 * @returns {string}
 */
function renderOffenders(offenders) {
  const rows = offenders.map(
    (o) => `  ${o.path} — ${o.count} line(s), at ${o.lines.map((i) => `:${i + 1}`).join(', ') || 'none'}`,
  );
  return [
    `${offenders.length} signed ADR(s) carry ≠ 1 \`**Status**:\` line (§1c act 1):`,
    ...rows,
    '',
    "  brain:promote's amendment path (applyStatusAct) REFUSES a file in this state,",
    '  so it cannot be repaired by the sanctioned route. Repair is by hand, and',
    '  brain/project/decisions/** is Tier 3 for an agent.',
  ].join('\n');
}

// ── Vacuity guard — an empty enumeration must FAIL, never pass quietly ─────

test('adr-status-line-single: an empty decisions dir FAILS the reader, it never returns [] (evidence-reader-empty-on-failure)', () => {
  // A dir this test OWNS, not a borrowed one. Pointing the guard at an
  // unrelated real directory (`test/fixtures`, the package-manager fixtures)
  // makes this assertion depend on that directory's contents: every failure
  // mode is red rather than silently green, but it would go red for a reason
  // that has nothing to do with the invariant, which is its own kind of
  // unreadable refusal.
  const empty = mkdtempSync(join(tmpdir(), 'adr-status-empty-'));
  try {
    assert.throws(
      () => readSignedAdrs(empty),
      /holds no ADR/,
      'readSignedAdrs returned an empty set instead of throwing — an empty enumeration would let the sweep go green vacuously',
    );
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

// ── Arm A — a synthetic fixture dir proves enumerate -> check -> render ────

test('adr-status-line-single: arm A — fixture dir proves the rendered report names each offender path/count/lines and never the control', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adr-status-fixtures-'));
  try {
    writeFileSync(join(dir, 'adr-0001-two-status-preamble.md'), TWO_STATUS_PREAMBLE);
    writeFileSync(join(dir, 'adr-0002-two-status-body.md'), TWO_STATUS_BODY);
    writeFileSync(join(dir, 'adr-0003-zero-status.md'), ZERO_STATUS);
    writeFileSync(join(dir, 'adr-0004-one-status-control.md'), ONE_STATUS_CONTROL);

    const adrs = readSignedAdrs(dir);
    assert.equal(adrs.length, 4, `expected 4 fixtures read, got ${adrs.length}`);

    const offenders = auditAdrs(adrs);
    assert.equal(offenders.length, 3, `expected 3 offenders, got ${offenders.length}`);

    const rendered = renderOffenders(offenders);

    assert.ok(rendered.includes('adr-0001-two-status-preamble.md'), 'rendered output does not name the two-Status-preamble offender');
    assert.ok(rendered.includes('adr-0002-two-status-body.md'), 'rendered output does not name the two-Status-body offender');
    assert.ok(rendered.includes('adr-0003-zero-status.md'), 'rendered output does not name the zero-Status offender');
    assert.ok(!rendered.includes('adr-0004-one-status-control.md'), 'rendered output names the one-Status control, which must never be flagged');

    const preamble = offenders.find((o) => o.path.includes('adr-0001-two-status-preamble.md'));
    const body = offenders.find((o) => o.path.includes('adr-0002-two-status-body.md'));
    const zero = offenders.find((o) => o.path.includes('adr-0003-zero-status.md'));
    assert.equal(preamble.count, 2, 'two-Status-preamble fixture must report count 2');
    assert.equal(body.count, 2, 'two-Status-body fixture must report count 2');
    assert.equal(zero.count, 0, 'zero-Status fixture must report count 0');
    assert.ok(Array.isArray(preamble.lines) && preamble.lines.length === 2, 'two-Status-preamble fixture must report 2 line indices');
    assert.ok(Array.isArray(zero.lines) && zero.lines.length === 0, 'zero-Status fixture must report an empty line-indices array');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── Sanity floor — catches a reader that under-reads rather than empty-reads ─

test('adr-status-line-single: the real decisions dir was not misread (sanity floor)', () => {
  const adrs = readSignedAdrs();
  assert.ok(adrs.length >= 25, `only ${adrs.length} ADRs found under ${DECISIONS_DIR} — the directory was misread`);
});

// ── The sweep itself — born green on 30/30 real ADRs (PR #692 baseline) ────
// No exemption list, allowlist, or skip label exists anywhere in this file
// (REQ-676-5) — there is no legitimate second `**Status**:` line in a signed
// ADR, so there is nothing here for one to legitimately exempt.

test('adr-status-line-single: every signed ADR on disk carries exactly one `**Status**:` line (§1c act 1)', () => {
  const adrs = readSignedAdrs();
  const offenders = auditAdrs(adrs);
  assert.deepEqual(offenders, [], offenders.length > 0 ? renderOffenders(offenders) : undefined);
});

// ── Arm B — real bytes, mutated only in memory, prove the fixtures above are
// shaped like real doctrine, not like a convenient synthetic case ──────────

test('adr-status-line-single: arm B — a real ADR spliced with a second Status line in memory is flagged (no write to brain/**)', () => {
  const [sample] = readSignedAdrs();
  const mutatedText = `${sample.text}\n**Status**: Deprecated\n`;
  const offenders = auditAdrs([{ ...sample, text: mutatedText }]);

  assert.equal(offenders.length, 1, 'the in-memory splice was not flagged');
  assert.equal(offenders[0].path, sample.path, 'the offender path does not name the real ADR that was spliced');
  assert.equal(offenders[0].count, 2, 'the spliced text must report count 2');

  const rendered = renderOffenders(offenders);
  assert.ok(rendered.includes(sample.path), 'rendered output does not name the spliced real ADR');
});
