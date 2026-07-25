// provenance.test.mjs — unit + property tests for the §4 provenance grammar
// (issue #217, C2). Fixtures are anchored to consolidation-protocol.md §4's
// CANONICAL examples — never to real engram chunks (0/278 real observations
// carry §4 prose; this parser/renderer pair is for future records + the C4
// round-trip, not a description of the current store).
//
// RED: these imports fail until provenance.mjs is created.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseProvenance, renderProvenance, ACTOR_MARKER, FUENTE_MARKER, SUPERSEDE_MARKER } from './provenance.mjs';

// ── Markers are shared constants (never duplicated string literals) ─────────

test('the three §4 markers match the consolidation-protocol.md convention', () => {
  assert.equal(ACTOR_MARKER, '**Actor:**');
  assert.equal(FUENTE_MARKER, '**Fuente:**');
  assert.equal(SUPERSEDE_MARKER, '**Supersede:**');
});

// ── parseProvenance — canonical §4 examples ──────────────────────────────────

test('parseProvenance: recovers a human actor from the canonical (humano) example', () => {
  const content = '**Actor:** @crinaldi (humano)\n\nBody text here.';
  const result = parseProvenance(content);
  assert.equal(result.actor, '@crinaldi');
  assert.equal(result.actorKind, 'human');
  assert.equal(result.content, 'Body text here.');
});

test('parseProvenance: recovers an agent actor from the canonical (agente) example', () => {
  const content = '**Actor:** claude-sonnet-4-6 (agente)\n\nBody text here.';
  const result = parseProvenance(content);
  assert.equal(result.actor, 'claude-sonnet-4-6');
  assert.equal(result.actorKind, 'agent');
});

test('parseProvenance: recovers actor + source/issue together (actor+fuente combo)', () => {
  // Per consolidation-protocol.md §4: "Actor: First line of body" — Fuente
  // never appears without a leading Actor line in real prose.
  const content = '**Actor:** @crinaldi (humano)\n**Fuente:** issue #78 / MR !72\n\nBody text.';
  const result = parseProvenance(content);
  assert.equal(result.actor, '@crinaldi');
  assert.equal(result.actorKind, 'human');
  assert.equal(result.source, 'issue #78 / MR !72');
  assert.equal(result.issue, 78);
  assert.equal(result.content, 'Body text.');
});

test('parseProvenance: recovers actor + supersedes together (actor+supersede combo, no fuente)', () => {
  // Per consolidation-protocol.md §4: Actor is always the leading line —
  // Supersede without a preceding Actor line does not round-trip.
  const content = '**Actor:** @crinaldi (humano)\n**Supersede:** observación anterior "Spring prohibido"\n\nBody text.';
  const result = parseProvenance(content);
  assert.equal(result.actor, '@crinaldi');
  assert.equal(result.actorKind, 'human');
  assert.equal(result.supersedes, 'observación anterior "Spring prohibido"');
  assert.equal(result.source, undefined);
  assert.equal(result.content, 'Body text.');
});

test('parseProvenance: recovers all three fields together and strips the block from content', () => {
  const content =
    '**Actor:** @crinaldi (humano)\n**Fuente:** issue #78 / MR !72\n**Supersede:** observación anterior "Spring prohibido"\n\nActual body.\nSecond line.';
  const result = parseProvenance(content);
  assert.equal(result.actor, '@crinaldi');
  assert.equal(result.actorKind, 'human');
  assert.equal(result.source, 'issue #78 / MR !72');
  assert.equal(result.issue, 78);
  assert.equal(result.supersedes, 'observación anterior "Spring prohibido"');
  assert.equal(result.content, 'Actual body.\nSecond line.');
});

test('parseProvenance: content with no §4 prose returns it unchanged, all fields absent', () => {
  const content = 'Just a plain memory, no provenance block.';
  const result = parseProvenance(content);
  assert.equal(result.content, content);
  assert.equal(result.actor, undefined);
  assert.equal(result.actorKind, undefined);
  assert.equal(result.issue, undefined);
  assert.equal(result.supersedes, undefined);
  assert.equal(result.source, undefined);
});

// ── renderProvenance — the inverse ───────────────────────────────────────────

test('renderProvenance: renders the Actor line for a human actor', () => {
  const rendered = renderProvenance({ actor: '@crinaldi', actorKind: 'human', content: 'Body.' });
  assert.equal(rendered, '**Actor:** @crinaldi (humano)\n\nBody.');
});

test('renderProvenance: renders the Actor line for an agent actor', () => {
  const rendered = renderProvenance({ actor: 'claude-sonnet-4-6', actorKind: 'agent', content: 'Body.' });
  assert.equal(rendered, '**Actor:** claude-sonnet-4-6 (agente)\n\nBody.');
});

test('renderProvenance: with no provenance fields, content passes through unchanged', () => {
  const rendered = renderProvenance({ content: 'Just body.' });
  assert.equal(rendered, 'Just body.');
});

test('renderProvenance: renders all three lines in Actor/Fuente/Supersede order', () => {
  const rendered = renderProvenance({
    actor: '@crinaldi',
    actorKind: 'human',
    source: 'issue #78 / MR !72',
    issue: 78,
    supersedes: 'observación anterior "Spring prohibido"',
    content: 'Actual body.',
  });
  assert.equal(
    rendered,
    '**Actor:** @crinaldi (humano)\n**Fuente:** issue #78 / MR !72\n**Supersede:** observación anterior "Spring prohibido"\n\nActual body.',
  );
});

// ── BLOCKER-1: provenance is ONLY the leading block — body content that ────
// happens to contain marker-shaped lines must never be scraped, and the
// round trip must be byte-lossless. Repro: a record whose BODY contains
// `**Actor:**`/`**Fuente:**`/`**Supersede:**`-shaped lines used to get those
// lines wrongly hoisted into fields and stripped from content.

test('parseProvenance: BLOCKER-1 — marker-shaped lines in the BODY (not the leading block) are never scraped; round-trip is byte-lossless', () => {
  const record = {
    actor: '@x',
    actorKind: 'human',
    content: 'Real body.\n**Actor:** @fake (humano)\n**Fuente:** fake source\n**Supersede:** old\nmore',
  };
  const rendered = renderProvenance(record);
  const recovered = parseProvenance(rendered);
  assert.equal(recovered.content, record.content, 'content must survive round-trip byte-for-byte');
  assert.equal(recovered.actor, record.actor);
  assert.equal(recovered.actorKind, record.actorKind);
  assert.equal(recovered.source, undefined, 'no field may be fabricated from the body');
  assert.equal(recovered.supersedes, undefined, 'no field may be fabricated from the body');
});

// ── Property test (mandatory): parse(render(record)) recovers exact fields ──
// Fixtures anchored to consolidation-protocol.md §4 canonical examples.

const FIXTURES = [
  {
    actor: '@crinaldi',
    actorKind: 'human',
    source: 'issue #78 / MR !72',
    issue: 78,
    supersedes: 'observación anterior "Spring prohibido"',
    content: 'A full record with every provenance field.',
  },
  {
    actor: 'claude-sonnet-4-6',
    actorKind: 'agent',
    source: 'issue #201',
    issue: 201,
    content: 'An agent-authored record with no supersede.',
  },
  {
    actor: '@crinaldi',
    actorKind: 'human',
    content: 'A record with only the actor declared — no Fuente, no Supersede.',
  },
  {
    actor: '@crinaldi',
    actorKind: 'human',
    supersedes: 'observación anterior "Spring prohibido"',
    content: 'A record with actor + supersede declared — no Fuente.',
  },
];

for (const [i, fixture] of FIXTURES.entries()) {
  test(`property: parse(render(record)) recovers exact fields — fixture ${i}`, () => {
    const rendered = renderProvenance(fixture);
    const recovered = parseProvenance(rendered);
    assert.equal(recovered.actor, fixture.actor);
    assert.equal(recovered.actorKind, fixture.actorKind);
    assert.equal(recovered.issue, fixture.issue);
    assert.equal(recovered.supersedes, fixture.supersedes);
    assert.equal(recovered.source, fixture.source);
    assert.equal(recovered.content, fixture.content);
  });
}

// ── Ruling 3b (CP-C2 re-split): malformed / partial §4 prose ────────────────
// PINNED POLICY (see openspec/changes/issue-217.../design.md §"Malformed §4
// prose"): the Actor line is the block ANCHOR and is all-or-nothing — it must
// carry a well-formed `@actor (humano|agente)` pair or NO provenance block is
// recognized (the whole content, malformed prose included, is returned as body
// so the export's @legacy fallback preserves it verbatim, never silently
// dropped). The optional Fuente/Supersede lines are best-effort and
// order-anchored: a malformed one ends the block and stays in content.

test('parseProvenance: Actor line without a (kind) is NOT a block — no recovery, content preserved verbatim', () => {
  const content = `${ACTOR_MARKER} @crinaldi\nbody line`;
  const parsed = parseProvenance(content);
  assert.equal(parsed.actor, undefined, 'a kind-less Actor line must not anchor a block');
  assert.equal(parsed.content, content, 'the malformed prose must remain in content, never dropped');
});

test('parseProvenance: Actor line with an unknown kind (robot) is NOT a block — no recovery, content preserved', () => {
  const content = `${ACTOR_MARKER} @crinaldi (robot)\nbody line`;
  const parsed = parseProvenance(content);
  assert.equal(parsed.actor, undefined, 'an out-of-enum kind must not anchor a block');
  assert.equal(parsed.content, content);
});

test('parseProvenance: valid Actor + malformed Fuente → actor recovered, the malformed Fuente stays in body (partial, best-effort optionals)', () => {
  const content = `${ACTOR_MARKER} @crinaldi (humano)\n${FUENTE_MARKER}\nbody line`;
  const parsed = parseProvenance(content);
  assert.equal(parsed.actor, '@crinaldi', 'the well-formed anchor still recovers');
  assert.equal(parsed.actorKind, 'human');
  assert.equal(parsed.source, undefined, 'an empty Fuente line is not a source');
  assert.equal(parsed.content, `${FUENTE_MARKER}\nbody line`, 'the malformed optional line remains in body');
});
