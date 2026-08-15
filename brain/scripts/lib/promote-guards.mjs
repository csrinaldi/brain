// promote-guards.mjs — "is the artefact I am about to sign well formed?",
// asked BEFORE brain:promote writes anything (issues #675 and #674).
//
// TWO FINDINGS, ONE SLOT. Both were found on the same promotion (ADR-0031,
// PR #672), both are the same defect at different layers, and both are cured by
// asking one question one step earlier:
//
//  1. **#675 — the verb wrote a corrupt signed ADR and staged it.** The draft
//     carried a bare `**Status**:` line where the house shape puts it inside the
//     stripped preamble blockquote, `transformDraft` prepended its own header,
//     and the result carried TWO. The maintainer typed `PROMOTE`, ran the
//     printed commit and pushed. The rule was already written next door —
//     `applyStatusAct` refuses to *touch* a file with two Status lines — so the
//     two halves of one verb disagreed about whether that artefact may exist.
//     This one fails OPEN, which is why it outranks its siblings.
//
//  2. **#674 — a guard whose surface excludes its subject.** `brain/**` ships;
//     drafts live in `openspec/changes/**/brain-drafts/**` and do not. So
//     `shipped-hostnames` could not see the file until promotion had already
//     put it there — after the signature. The DESTINATION is what makes a file
//     shipped, so the check belongs at the moment the destination is chosen.
//
// NOT A THIRD IMPLEMENTATION. Every guard below DELEGATES to the module that
// already owns its rule (`amendment-draft.mjs`, `shipped-hostnames.mjs`). What
// is new here is the registry and the call site, not the rules — copying either
// one would be #130/#340/#555 exactly where two of them were just found.
//
// PURE. Text in, verdict out; no disk, no spawn. The I/O, the confirmation and
// the git seam stay in brain-promote.mjs, so ADR-0028's four locks keep one
// implementation each.

import { ADR_TARGET_RE, checkSingleStatusLine } from './amendment-draft.mjs';
import { TEXT, foreignHostsIn } from './shipped-hostnames.mjs';

/** The package `files` allowlist entry that makes a path reach consumers' disks. */
export const SHIPPED_PREFIX = 'brain/';

/**
 * The guards, in the order they run. Each declares WHICH destination paths it
 * is about — a rule that applied to every write would fire `single-status-line`
 * on `brain/HOME.md`, which correctly has none.
 *
 * `applies` keys on the DESTINATION path, never on the draft path. That is the
 * whole of #674 in one line: the draft path is outside the shipped surface, so
 * asking about it is asking the wrong question.
 */
export const GUARDS = Object.freeze([
  Object.freeze({
    name: 'single-status-line',
    rule: 'brain/scripts/lib/amendment-draft.mjs — checkSingleStatusLine (§1c act 1)',
    applies: (relPath) => ADR_TARGET_RE.test(relPath),
    check(text, relPath) {
      const single = checkSingleStatusLine(text);
      if (single.ok) return { ok: true };
      return {
        ok: false,
        lines: [
          `✗ single-status-line — the artefact this run would write is malformed:`,
          `    ${relPath}`,
          `    ${single.error}`,
          '',
          '  brain:promote prepends the signature header itself (`**Status**: Accepted`),',
          '  so the DRAFT must not carry a `**Status**:` line of its own as ordinary text.',
          '  The house shape puts it in the preamble blockquote, which this verb strips:',
          '',
          '      > **status:** proposed — pending human promotion | **date:** <date> | **owner:** <handle>',
          '',
          '  The amendment path already refuses to touch a file with two of them, so a',
          '  promote that produced one could not be repaired by the sanctioned route —',
          '  only by reverting the signing commit (#675).',
        ],
      };
    },
  }),
  Object.freeze({
    name: 'shipped-hostnames',
    rule: 'brain/scripts/lib/shipped-hostnames.mjs — foreignHostsIn (#648)',
    applies: (relPath) => relPath.startsWith(SHIPPED_PREFIX) && TEXT.test(relPath),
    check(text, relPath) {
      const hosts = [...new Set(foreignHostsIn(text))];
      if (hosts.length === 0) return { ok: true };
      return {
        ok: false,
        lines: [
          '✗ shipped-hostnames — the artefact this run would write names a host that is',
          '  neither reserved (RFC 2606/6761) nor on brain\'s allowlist:',
          ...hosts.map((h) => `    ${h}  @ ${relPath}`),
          '',
          '  The DESTINATION is what makes a file shipped: `brain/**` is in the package',
          '  `files` allowlist, so this text lands on every consumer\'s disk. The draft path',
          '  is outside that surface, which is why every check up to now was green (#674).',
          '',
          '  Use a reserved name (example.com, *.test, *.invalid), describe the host instead',
          '  of quoting it, or — if brain genuinely integrates with it — add it to',
          '  ALLOWED_REAL in brain/scripts/lib/shipped-hostnames.mjs with the reason.',
        ],
      };
    },
  }),
]);

/**
 * Runs every applicable guard over the content each write would produce.
 *
 * "COULD NOT CHECK" IS NOT "CHECKED CLEAN" (#674 req 5, and the
 * `evidence-reader-empty-on-failure` family). Two consequences, both deliberate:
 *
 *  - A guard that THROWS is a refusal, not a skip. A reader that reports nothing
 *    when it failed is indistinguishable from one that found nothing, and that
 *    is the shape this repository keeps closing.
 *  - The summary states how many guard/file pairs actually ran, and says so
 *    explicitly when the answer is zero. A silent clean run and a run where
 *    nothing was applicable must not look the same to the human about to sign.
 *
 * @param {{writes: {relPath:string, text:string}[], guards?: typeof GUARDS}} ctx
 * @returns {{ok:true, ran:{guard:string, relPath:string}[], summary:string}
 *          |{ok:false, lines:string[]}}
 */
export function checkShippedContent({ writes, guards = GUARDS }) {
  const ran = [];
  for (const { relPath, text } of writes) {
    for (const guard of guards) {
      if (!guard.applies(relPath)) continue;
      let verdict;
      try {
        verdict = guard.check(text, relPath);
      } catch (error) {
        return {
          ok: false,
          lines: [
            `✗ the ${guard.name} guard FAILED to run against ${relPath}:`,
            `    ${error.message}`,
            '',
            '  Refusing rather than proceeding. A guard that could not answer has not',
            '  answered "clean", and this run would sign the file it could not read.',
          ],
        };
      }
      if (!verdict.ok) {
        return { ok: false, lines: [...verdict.lines, '', '  Nothing was written and nothing was staged.'] };
      }
      ran.push({ guard: guard.name, relPath });
    }
  }
  return { ok: true, ran, summary: renderGuardSummary(ran, writes.length) };
}

/**
 * The positive report. Shown next to the plan, so the human signing knows which
 * questions were asked about the bytes rather than inferring it from silence.
 *
 * @param {{guard:string, relPath:string}[]} ran
 * @param {number} writeCount
 * @returns {string}
 */
export function renderGuardSummary(ran, writeCount) {
  if (ran.length === 0) {
    return [
      `  guards — NONE applied to the ${writeCount} file(s) this run writes.`,
      '           That is "not checked", not "checked clean".',
      '',
    ].join('\n');
  }
  const width = Math.max(...ran.map((r) => r.guard.length));
  return [
    '  guards — ran against the DESTINATION content, before this plan:',
    ...ran.map((r) => `      ${r.guard.padEnd(width)}  ${r.relPath}`),
    '',
  ].join('\n');
}
