// cold-review-prompt.test.mjs — the prompt is checked BY THE READER, not by
// string-matching against a second copy of the contract (#682 slice 3, B.4).
//
// The central oracle here is not an assertion about the prompt's text. It is
// `readFindingsArtifact` — the real reader, unmocked — run over THE WHOLE
// PROMPT. The prompt embeds a worked example in the artifact's shape, so if the
// example shows the engine something the reader would refuse, silently drop a
// field from, or fail to find at all, this file goes red.
//
// That matters because the failure it guards is invisible in production: an
// engine told to emit the wrong shape writes a file, exits 0, and the reader
// reports findings the verdict then renders. Nothing throws. The review is
// simply quieter than it should be, and the only way to notice is to have
// checked the instruction against the parser before shipping either.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildColdReviewPrompt, ROLE_DEBT_TICKET } from './cold-review-prompt.mjs';
import {
  readFindingsArtifact,
  artifactPathFor,
  CARRIED_FIELDS,
} from './findings-artifact.mjs';
import {
  ALLOWED_EVIDENCE_CLASSES,
  ALLOWED_CAUSAL_DISPOSITIONS,
} from './schema-v2.mjs';

const PR = 765;

test('the prompt itself parses as an artifact — the reader is the oracle', () => {
  const result = readFindingsArtifact(buildColdReviewPrompt({ prNumber: PR }));

  assert.equal(
    result.ok,
    true,
    `the worked example inside the prompt must parse through the real reader — ${result.reason ?? ''}`
  );
  assert.equal(result.findings.length, 2, 'the example shows both an anchored and an un-anchored finding');

  // This also covers the posted-family refusal without a second assertion: the
  // reader checks `protocol: brain-review/...` BEFORE it selects a block, so a
  // prompt carrying that shape at line start could not have reached ok:true.
});

test("the example's fields ARE the carried fields — no drift in either direction", () => {
  const [anchored] = readFindingsArtifact(buildColdReviewPrompt({ prNumber: PR })).findings;

  // Post-`sanitiseFinding`, so a field the example spells wrong has already been
  // dropped and shows up here as missing. Both directions are asserted on
  // purpose: a MISSING field means the engine is never shown how to emit it, and
  // an EXTRA one cannot survive the projection, so its absence proves the
  // example was written against the real list rather than beside it.
  assert.deepEqual(
    Object.keys(anchored).sort(),
    [...CARRIED_FIELDS].sort(),
    'the anchored example must exercise every carried field — when CARRIED_FIELDS grows, ' +
      'this dies until the example grows with it, which is the review the boundary wants to force'
  );
});

test('the un-anchored example carries no anchor — the two cases are distinct', () => {
  const [, unanchored] = readFindingsArtifact(buildColdReviewPrompt({ prNumber: PR })).findings;

  assert.equal(unanchored.file, undefined, 'the second example must not anchor');
  assert.equal(unanchored.line, undefined, 'the second example must not anchor');
  assert.ok(unanchored.evidence, 'and it is still a real finding, not a placeholder');
});

test('the field list handed to the engine is DERIVED from CARRIED_FIELDS', () => {
  const prompt = buildColdReviewPrompt({ prNumber: PR });

  // Parsed back out of the prompt rather than asserted member-by-member. A
  // membership loop over CARRIED_FIELDS would compare the list to itself and
  // survive the mutation that matters — replacing the interpolation with a
  // literal that has since gone stale. Reading the rendered list back does not:
  // a stale literal parses to a set that is no longer CARRIED_FIELDS.
  const rendered = [...prompt.matchAll(/^ {2}- ([a-z_]+)$/gm)].map((m) => m[1]);

  assert.deepEqual(
    rendered,
    [...CARRIED_FIELDS],
    'the enumerated field list must be interpolated from CARRIED_FIELDS, in its order'
  );
});

/** Reads one `· `<name>` … one of: a | b | c` line back out of the prompt. */
function renderedVocabulary(prompt, name) {
  const line = prompt.split('\n').find((l) => l.startsWith(`  \u00b7 \`${name}\``));
  assert.ok(line, `the prompt must render a vocabulary line for \`${name}\``);
  const [, values] = line.match(/ one of: (.+)$/) ?? [];
  assert.ok(values, `\`${name}\`'s line must end in its value set`);
  return values.split(' | ');
}

test('the vocabularies are derived from schema-v2, not restated', () => {
  const prompt = buildColdReviewPrompt({ prNumber: PR });

  // Read back and compared as a SET, both directions. The first cut of this test
  // asserted `prompt.includes(CONSTANT.join(' | '))`, and that is blind in one
  // direction: a hardcoded string listing today's values plus a fourth the
  // validator rejects contains the derived substring and passes. The engine would
  // then be told about a class every finding using it gets marked `schema_invalid`
  // for. Reading the rendered set back cannot miss it.
  assert.deepEqual(
    renderedVocabulary(prompt, 'evidence_class'),
    [...ALLOWED_EVIDENCE_CLASSES],
    'the evidence classes are ALLOWED_EVIDENCE_CLASSES exactly — no more, no fewer'
  );
  assert.deepEqual(
    renderedVocabulary(prompt, 'causal_disposition'),
    [...ALLOWED_CAUSAL_DISPOSITIONS],
    'the dispositions are ALLOWED_CAUSAL_DISPOSITIONS exactly — no more, no fewer'
  );
});

test('severity has no constant, so the PROTOCOL DOCUMENT is its reader', () => {
  const prompt = buildColdReviewPrompt({ prNumber: PR });

  // The one vocabulary the prompt states as a literal, because no
  // `ALLOWED_SEVERITIES` exists to derive it from. Rather than leave it
  // unchecked — or invent a constant no validator reads, which is the defect
  // this module exists to avoid — it is compared against the place the
  // vocabulary is actually written down.
  const protocol = readFileSync(
    new URL('../../../core/methodology/reviewer-protocol.md', import.meta.url),
    'utf8'
  );
  const declared = [...protocol.matchAll(/^\s*severity: (blocker.*)$/gm)].map((m) => m[1].trim());
  assert.ok(declared.length > 0, 'reviewer-protocol.md must declare the severity vocabulary');
  assert.ok(
    declared.every((d) => d === declared[0]),
    'and must declare it consistently — a document disagreeing with itself has no answer to give'
  );

  assert.deepEqual(
    renderedVocabulary(prompt, 'severity'),
    declared[0].split(' | '),
    'the prompt\'s severity set must match reviewer-protocol.md\'s'
  );
});

test('the prompt carries no posted-verdict shape — proved, not asserted in a comment', () => {
  // The round-trip test's comment claims this is covered "without a second
  // assertion", because the reader checks the posted family before selecting a
  // block. A coverage claim in a comment is the exact defect class this ticket
  // keeps finding, so it is executed here instead: inject the shape and require
  // the round-trip to refuse.
  const poisoned = buildColdReviewPrompt({ prNumber: PR }).replace(
    '## What you may use',
    'protocol: brain-review/2\n\n## What you may use'
  );
  const result = readFindingsArtifact(poisoned);

  assert.equal(result.ok, false, 'a prompt carrying the posted family must not read as an artifact');
  assert.match(result.reason, /anti-loop lock/, 'and must say why');
});

test('the empty case the prompt describes is one the reader accepts', () => {
  // Not a string match on "write the file with an empty array". The prompt tells
  // the engine what to write when it found nothing; this executes that
  // instruction and requires the result to be the DISTINCT empty state — ok:true
  // with zero findings — rather than a failure.
  //
  // That distinction is the whole of REQ-S3-4 and it is the one a tired engine
  // is most likely to get wrong by omitting the file instead. If the shape the
  // role describes ever stopped parsing as "ran and found nothing", the review
  // would report "never ran" for every clean PR.
  const prompt = buildColdReviewPrompt({ prNumber: PR });
  const emptied = prompt.replace(/(```brain-findings\/1\n)[\s\S]*?(\n```)/, '$1[]$2');
  assert.notEqual(emptied, prompt, 'the example block must be replaceable — otherwise this tests nothing');

  const result = readFindingsArtifact(emptied);
  assert.equal(result.ok, true, `the empty artifact must READ, not fail — ${result.reason ?? ''}`);
  assert.deepEqual(result.findings, [], 'and must be empty rather than absent');
});

test('the artifact path is the one the reader will look at', () => {
  const prompt = buildColdReviewPrompt({ prNumber: PR });

  // The single highest-cost silent failure available here: an engine that writes
  // a perfect artifact to a path nobody reads produces "missing", which renders
  // identically to "the stage never ran".
  assert.ok(
    prompt.includes(artifactPathFor(PR)),
    'the prompt must name artifactPathFor(prNumber) — a hardcoded path sends the run to a file nobody reads'
  );
});

test('a PR number that is not one is refused, not defaulted', () => {
  for (const bad of [0, -1, 'main', '../../etc', null, undefined, 1.5]) {
    assert.throws(
      () => buildColdReviewPrompt({ prNumber: bad }),
      /is not a PR number/,
      `refuses ${JSON.stringify(bad)}`
    );
  }
});

test('base and head refs render a real command, and their absence renders a different one', () => {
  const withRefs = buildColdReviewPrompt({ prNumber: PR, baseRef: 'abc123', headRef: 'def456' });
  const without = buildColdReviewPrompt({ prNumber: PR });

  assert.ok(withRefs.includes('git diff abc123...def456'), 'named refs become the command');
  assert.ok(!without.includes('git diff abc123'), 'and are absent when not given');
  assert.notEqual(
    withRefs,
    without,
    'the two states must not render identically — a prompt that ignores the refs it was ' +
      'handed points the engine at whatever the working tree happens to be'
  );

  // Half-specified is the generic form, not a broken command: `git diff abc123...`
  // resolves to something, which is worse than not naming a command at all.
  const halfBase = buildColdReviewPrompt({ prNumber: PR, baseRef: 'abc123' });
  const halfHead = buildColdReviewPrompt({ prNumber: PR, headRef: 'def456' });
  assert.equal(halfBase, without, 'a base with no head falls back rather than emitting a partial range');
  assert.equal(halfHead, without, 'a head with no base falls back rather than emitting a partial range');
});

test('the engine is told it holds no credential', () => {
  // A PRESENCE CHECK on an instruction, and nothing more — it does not prove the
  // engine obeys. The guarantee that nothing posts is architectural and lives in
  // `runStage`, which holds no VCS credential at all (B.3). This assertion exists
  // so the instruction is not silently deleted from the role while that stays true.
  assert.ok(
    buildColdReviewPrompt({ prNumber: PR }).includes('You hold no credential'),
    'the role must state that it cannot publish'
  );
});

test('the debt names its ticket in code, not only in prose', () => {
  assert.equal(ROLE_DEBT_TICKET, 312, 'the role is on loan from #312 until its port lands');
});
