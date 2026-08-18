// epic-map.test.mjs — issue #459.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseGraphBlock, buildGraph, filesOverlap, READY, BLOCKED, AWAITING_HUMAN, UNCLASSIFIED } from './epic-graph.mjs';
import { renderMermaid, renderSummary, replaceMapRegion, outsideRegion, BEGIN, END } from './epic-render.mjs';
import { parseArgs, composeMap, main } from './epic-map.mjs';

// #709: the declaration is the fence TAG, not an interior `protocol:` scalar — so
// the fixture no longer writes one. Every existing test below reuses this builder
// and therefore exercises the new shape without being individually rewritten.
const block = ({ track = 'A', needs = [], blocks = [], files = [] } = {}) =>
  ['```brain-graph/1', `track: ${track}`,
    `needs: ${JSON.stringify(needs)}`, `blocks: ${JSON.stringify(blocks)}`,
    `files: ${JSON.stringify(files)}`, '```'].join('\n');

/** The pre-#709 shape: ```yaml + `protocol: brain-graph/1` inside. Used only by
 * the tests below that specifically pin its refusal (D7) — it must not become the
 * default fixture, or the suite would stop exercising the tag-based selector. */
const legacyBlock = ({ track = 'A', needs = [], blocks = [], files = [] } = {}) =>
  ['```yaml', 'protocol: brain-graph/1', `track: ${track}`,
    `needs: ${JSON.stringify(needs)}`, `blocks: ${JSON.stringify(blocks)}`,
    `files: ${JSON.stringify(files)}`, '```'].join('\n');

const issue = (number, o = {}) => ({
  number, title: o.title ?? `t${number}`, labels: o.labels ?? ['status:approved'],
  state: o.state ?? 'open', body: o.body ?? block(o),
  ...(o.assignees !== undefined ? { assignees: o.assignees } : {}),
  ...(o.relations !== undefined ? { relations: o.relations } : {}),
});

/** A successful native read that found nothing — distinct from `null`. */
const noRelations = { blocks: [], needs: [], foreign: 0 };

// ── the declared block ──────────────────────────────────────────────────────

test('#459: the block is read from the body as DATA', () => {
  const g = parseGraphBlock(block({ track: 'B', needs: [1], blocks: [2, 3], files: ['a/**'] }));
  assert.deepEqual(g, { track: 'B', needs: [1], blocks: [2, 3], files: ['a/**'] });
});

test('#459: a body with no block yields null — absent is not empty', () => {
  assert.equal(parseGraphBlock('just prose'), null);
  assert.equal(parseGraphBlock(''), null);
  assert.equal(parseGraphBlock(undefined), null);
});

test('#459: a fenced block of a DIFFERENT protocol is not read as a graph block', () => {
  const other = '```yaml\nprotocol: brain-review/1\nverdict: APPROVE\nhead_sha: abc\n```';
  assert.equal(parseGraphBlock(other), null, 'three protocols share the fence primitives; only one owns this shape');
});

test('#612: track: (whitespace-only) reads as null, not the empty string', () => {
  const g = parseGraphBlock(['```brain-graph/1', 'track: ', 'needs: []', 'blocks: []', 'files: []', '```'].join('\n'));
  assert.equal(g.track, null);
});

test('#612: blocks: (whitespace-only) reads as [] — same as an empty declared list', () => {
  const g = parseGraphBlock(['```brain-graph/1', 'track: A', 'needs: []', 'blocks: ', 'files: []', '```'].join('\n'));
  assert.deepEqual(g.blocks, []);
});

test('#612: a node with track: (whitespace-only) groups under the SAME tracks-map key ("?") as an undeclared node, not its own "" group', () => {
  const withBlankTrack = issue(1, { body: ['```brain-graph/1', 'track: ', 'needs: []', 'blocks: []', 'files: []', '```'].join('\n') });
  const undeclared = issue(2, { body: 'just prose, no block at all' });
  const { tracks, nodes } = buildGraph([withBlankTrack, undeclared]);
  assert.equal(nodes[0].track, null);
  assert.equal(nodes[1].track, null);
  assert.ok(tracks.has('?'));
  assert.equal(tracks.get('?').length, 2, 'both nodes land in the SAME fallback group');
  assert.equal(tracks.has(''), false, 'the pre-repair "" group no longer exists');
});

// ── the locator: the `protocol:` scalar, not the position (#639) ────────────
//
// WHAT WAS MEASURED, because the ticket's stated repro is not the defect. Its
// headline fixture — a ```js snippet above the block — was ALREADY GREEN, and by
// accident rather than by design: `FENCE_RE` only opens on ``` or ```yaml, so it
// skips the tagged foreign OPENER, latches onto that block's CLOSING fence, and
// swallows through to the graph block, where `scalar`'s `^protocol:` anchor still
// finds the key. It is pinned below so that accident cannot silently become a
// regression, and it is labelled as what it is.
//
// The shapes that were RED are the ones the locator cannot skip: an UNTAGGED
// fence (a log excerpt — the most ordinary thing an issue body opens with) and a
// ```yaml fence carrying another protocol.

test('#639: an UNTAGGED fence above the block does not hide it — the locator reads the protocol, not the position', () => {
  const body = ['```', 'some log excerpt', '```', '', block({ track: 'C' })].join('\n');
  assert.deepEqual(parseGraphBlock(body), { track: 'C', needs: [], blocks: [], files: [] });
});

test('#639: a ```yaml fence of ANOTHER protocol above the block does not hide it', () => {
  const other = '```yaml\nprotocol: brain-review/2\nverdict: APPROVE\n```';
  const body = [other, '', block({ track: 'D', needs: [7] })].join('\n');
  assert.deepEqual(parseGraphBlock(body), { track: 'D', needs: [7], blocks: [], files: [] });
});

test('#639: a ```js snippet above the block still parses — pinned, and it was already green', () => {
  const body = ['Here is the failing call:', '', '```js', "requiredArtifactsFor('lite')", '```', '',
    block({ track: 'A', blocks: [435, 94] })].join('\n');
  assert.deepEqual(parseGraphBlock(body), { track: 'A', needs: [], blocks: [435, 94], files: [] });
});

test('#639: TWO graph blocks is an error naming the count, never a silent pick of one', () => {
  // The rule `parseAmendmentDraft` and `parseCheckpointClaim` already hold. The old
  // locator answered with the FIRST one and said nothing — two values for one key is
  // ambiguity, and the reader must stop picking.
  const r = parseGraphBlock([block({ track: 'A' }), '', 'and again', '', block({ track: 'Z' })].join('\n'));
  assert.equal(r.ok, false);
  assert.match(r.error, /2 `brain-graph\/1` blocks found/);
  assert.match(r.error, /exactly once/);
});

test('#639: an unreadable block is carried out and named — it is not an issue that declared nothing', () => {
  const dupes = [block({ track: 'A', needs: [1] }), '', block({ track: 'Z' })].join('\n');
  const g = buildGraph([issue(1), { number: 9, title: 'dos bloques', labels: ['status:approved'], state: 'open', body: dupes }]);
  const n9 = g.nodes.find(n => n.number === 9);

  assert.deepEqual(g.blocksUnreadable.map(b => b.number), [9]);
  assert.match(g.blocksUnreadable[0].error, /2 `brain-graph\/1` blocks found/);
  assert.equal(n9.status, UNCLASSIFIED, 'no source placed it — that part is honest');
  assert.equal(n9.declared, false);
  assert.equal(g.edges.length, 0, 'an unreadable block asserts nothing; it is not half a declaration to salvage');
});

test('#639: the summary prints the unreadable blocks, distinct from the ones that never declared', () => {
  const dupes = [block({ track: 'A' }), '', block({ track: 'Z' })].join('\n');
  const g = buildGraph([
    { number: 9, title: 'dos bloques', labels: [], state: 'open', body: dupes },
    { number: 8, title: 'sin bloque', labels: [], state: 'open', body: 'prosa' },
  ]);
  const out = renderSummary(g);

  const ilegibles = out.match(/^.*ilegibles.*$/m)[0];
  // Both nodes are UNCLASSIFIED, and that is right — no source placed either. What
  // the map must not do is let "could not read what it declared" and "declared
  // nothing" read as the same fact, so only #9 appears on this line.
  assert.ok(ilegibles.includes('#9'));
  assert.ok(!ilegibles.includes('#8'));
  assert.match(out.match(/^.*Sin ubicar.*$/m)[0], /#8/);
});

// ── the selector is the fence TAG, not an interior scalar (#709, ADR-0032) ──

test('#709 REQ-639-1 scenario 1: untagged, foreign- and yaml-tagged fences are skipped — none carries the graph tag', () => {
  const body = ['```', 'log excerpt', '```', '', '```yaml', 'some: config', '```', '',
    '```console', 'x', '```', '', '```js', 'y', '```'].join('\n');
  assert.equal(parseGraphBlock(body), null, 'no fence tag equals brain-graph/1, so nothing is selected');
});

test('#709 D1: the legacy ```yaml + protocol: scalar shape no longer selects the block', () => {
  assert.equal(parseGraphBlock(legacyBlock({ track: 'Z' })).ok, false,
    'refused out loud (D7) below — but definitely not the parsed graph');
});

test('#709 D7: the legacy shape is refused OUT LOUD, naming the retag — never silently read as absent', () => {
  const r = parseGraphBlock(legacyBlock({ track: 'A' }));
  assert.equal(r.ok, false);
  assert.match(r.error, /retag/, 'the reader must be told what to do, not just that reading failed');
  assert.match(r.error, /brain-graph\/1/);
});

test('#709 D1/axis 12: BRAIN-GRAPH/1 and Brain-Graph/1 (wrong case) do not declare — exact case only', () => {
  const upper = '```BRAIN-GRAPH/1\ntrack: A\nneeds: []\nblocks: []\nfiles: []\n```';
  const mixed = '```Brain-Graph/1\ntrack: A\nneeds: []\nblocks: []\nfiles: []\n```';
  assert.equal(parseGraphBlock(upper), null, 'no whitelist of near-misses to forgive (D1)');
  assert.equal(parseGraphBlock(mixed), null);
});

test('#709 D1/axis 11: trailing attributes after the tag still declare — only the first word is compared', () => {
  const withAttrs = '```brain-graph/1 title="x"\ntrack: A\nneeds: []\nblocks: []\nfiles: []\n```';
  assert.deepEqual(parseGraphBlock(withAttrs), { track: 'A', needs: [], blocks: [], files: [] });
});

test('#709 D1/axis 13: one declared block plus a yaml-tagged illustration of the same protocol is NOT ambiguity', () => {
  const illustration = '```yaml\nprotocol: brain-graph/1\ntrack: ignored-because-not-declared\n```';
  const body = [illustration, '', block({ track: 'A', blocks: [5] })].join('\n');
  assert.deepEqual(parseGraphBlock(body), { track: 'A', needs: [], blocks: [5], files: [] },
    'the illustration is not a declaration, so the tagged block reads alone');
});

test('#709 D6: an unterminated brain-graph/1-tagged fence hides the declaration and is reported, never read as absent', () => {
  const body = 'prose above\n```brain-graph/1\ntrack: A\n';
  const r = parseGraphBlock(body);
  assert.equal(r.ok, false);
  assert.match(r.error, /never closed/);
});

// ── the classification ──────────────────────────────────────────────────────

test('#459: an undeclared issue is UNCLASSIFIED, never dropped and never a free leaf', () => {
  // A node that disappears for want of metadata is the same class as a commit the
  // audit never enumerates (#518): the map would report a graph it had not read.
  const g = buildGraph([issue(1), { number: 9, title: 'sin bloque', labels: [], state: 'open', body: 'prosa' }]);
  const n9 = g.nodes.find(n => n.number === 9);
  assert.equal(n9.status, UNCLASSIFIED);
  assert.equal(g.nodes.length, 2, 'it is in the graph, counted, and visible');
});

test('#459: an OPEN prerequisite blocks; a CLOSED one does not', () => {
  const g = buildGraph([
    issue(1, { state: 'closed' }),
    issue(2, { state: 'open' }),
    issue(3, { needs: [1, 2] }),
  ]);
  const n3 = g.nodes.find(n => n.number === 3);
  assert.equal(n3.status, BLOCKED);
  assert.deepEqual(n3.blockedBy, [2], 'finished work does not block — only the open prerequisite does');
});

test('#459: `A needs B` and `B blocks A` are ONE edge, declared from either end', () => {
  const fromNeeds = buildGraph([issue(1), issue(2, { needs: [1] })]);
  const fromBlocks = buildGraph([issue(1, { blocks: [2] }), issue(2)]);
  const edge = [{ from: 1, to: 2, sources: ['declared'] }];
  assert.deepEqual(fromNeeds.edges, edge);
  assert.deepEqual(fromBlocks.edges, edge);

  // And declaring BOTH ends does not double it.
  const both = buildGraph([issue(1, { blocks: [2] }), issue(2, { needs: [1] })]);
  assert.deepEqual(both.edges, edge);
});

test('#459: an unapproved issue waits on a HUMAN, not on code', () => {
  const g = buildGraph([issue(1, { labels: ['type:bug'] })]);
  assert.equal(g.nodes[0].status, AWAITING_HUMAN);
});

test('#459: approved, unblocked and declared is READY', () => {
  assert.equal(buildGraph([issue(1)]).nodes[0].status, READY);
});

// ── parallelisability is COMPUTED ───────────────────────────────────────────

test('#459: overlap is decided from `files`, not from a declared boolean', () => {
  const g = buildGraph([
    issue(1, { files: ['brain/scripts/vcs/**'] }),
    issue(2, { files: ['brain/scripts/vcs/cli.mjs'] }),
    issue(3, { files: ['docs/x.md'] }),
  ]);
  const n = (x) => g.nodes.find(v => v.number === x);
  assert.deepEqual(n(1).conflictsWith, [2], 'a prefix claim covers the file under it');
  assert.deepEqual(n(3).conflictsWith, [], 'disjoint claims parallelise');
});

test('#459: an UNDECIDABLE glob reads as overlapping — conservative in the safe direction', () => {
  // Answering "no overlap" for something it cannot parse would license two agents
  // onto one file. Refusing to decide must cost a lost parallelisation, never a
  // collision.
  assert.equal(filesOverlap(['a/*/c.mjs'], ['totally/unrelated']), true);
  assert.equal(filesOverlap(['a/**'], ['b/**']), false, 'and what it CAN decide, it decides');
});

// ── rendering ───────────────────────────────────────────────────────────────

test('#459: mermaid output is deterministic — two runs are byte-identical', () => {
  const issues = [issue(3, { needs: [1] }), issue(1, { blocks: [3] }), issue(2)];
  const a = renderMermaid(buildGraph(issues));
  const b = renderMermaid(buildGraph([...issues].reverse()));
  assert.equal(a, b, 'input order must not change the output, or the write is not idempotent');
});

test('#459: a title carrying mermaid syntax cannot break the block', () => {
  const out = renderMermaid(buildGraph([issue(1, { title: 'fix: a["b"] | c {d}' })]));
  const node = out.split('\n').find(l => l.includes('N1['));
  // The property, not the golden string: every character that ENDS a mermaid label
  // must be gone from the label's interior, or the node syntax terminates early and
  // the rest of the diagram is read as garbage.
  const inner = node.slice(node.indexOf('["') + 2, node.lastIndexOf('"]'));
  for (const c of '"<>[]{}()|') {
    assert.ok(!inner.includes(c), `the label must not carry ${c} — it breaks the node syntax`);
  }
  // …and the sanitiser must not leave the gaps it opened: replacing each stripped
  // character with a space is only half the job.
  assert.equal(node, '  N1["#1 fix: a b c d"]');
});

test('#459: an edge to an out-of-scope issue is DRAWN, not dropped', () => {
  // Dropping it would make the map claim there is no dependency — a stronger and
  // falser statement than "there is one, and it is not in this set".
  const out = renderMermaid(buildGraph([issue(1, { blocks: [999] })]));
  assert.match(out, /N999\["#999 \(fuera del alcance\)"\]/);
  assert.match(out, /N1 --> N999/);
});

test('#459: the summary reports the unplaced COUNT rather than hiding them', () => {
  const s = renderSummary(buildGraph([
    issue(1), { number: 8, title: 'x', labels: [], state: 'open', body: '' },
  ]));
  assert.match(s, /\*\*Sin ubicar\*\* \(1\)/);
  assert.match(s, /#8/);
  // The count is the point: an undeclared issue must not be quietly absorbed into
  // "Listos ahora", which would make the map overstate what is startable.
  assert.ok(!/Listos ahora:\*\* [^\n]*#8/.test(s));
});

// ── the body write ──────────────────────────────────────────────────────────

test('#459: everything outside the markers is byte-identical afterwards', () => {
  const body = `# Épico\n\nprosa importante\n\n${BEGIN}\nviejo\n${END}\n\nmás prosa al final\n`;
  const out = replaceMapRegion(body, 'nuevo');
  assert.match(out, /nuevo/);
  assert.ok(!out.includes('viejo'));
  assert.ok(out.startsWith('# Épico\n\nprosa importante\n\n'));
  assert.ok(out.endsWith('\n\nmás prosa al final\n'));
});

test('#459: a first run on an untouched epic APPENDS, it does not rewrite', () => {
  const out = replaceMapRegion('# Épico\n\nsolo prosa', 'X');
  assert.ok(out.startsWith('# Épico\n\nsolo prosa'));
  assert.match(out, new RegExp(`${BEGIN}\\nX\\n${END}`));
});

test('#459: writing twice with unchanged input is byte-idempotent', () => {
  const once = replaceMapRegion('prosa', 'X');
  assert.equal(replaceMapRegion(once, 'X'), once);
});

test('#459: a malformed marker region (END before BEGIN) appends rather than corrupting', () => {
  const body = `${END}\ntexto\n${BEGIN}`;
  const out = replaceMapRegion(body, 'X');
  assert.ok(out.includes('texto'), 'nothing is destroyed when the markers make no sense');
});

// ── the CLI ─────────────────────────────────────────────────────────────────

test('#459: parseArgs requires an issue number', () => {
  assert.deepEqual(parseArgs(['313']), { ok: true, number: 313, dryRun: false, relations: true });
  assert.deepEqual(parseArgs(['313', '--dry-run']), { ok: true, number: 313, dryRun: true, relations: true });
  assert.equal(parseArgs([]).ok, false);
  assert.match(parseArgs(['--bogus']).error, /unknown argument/);
});

test('#533: native relations are read BY DEFAULT — the flag turns them OFF, never on', () => {
  // A second source that ships behind an opt-in flag is a source nobody turns on:
  // green in test, inert in production (#335). The flag exists for the cost, not
  // for the feature.
  assert.equal(parseArgs(['313']).relations, true);
  assert.equal(parseArgs(['313', '--no-relations']).relations, false);
});

test('#459: a failed issue list REFUSES rather than drawing a graph with holes', async () => {
  const lines = [];
  const code = await main(['313'], {
    say: (s) => lines.push(String(s)),
    config: {}, origin: { project: 'a/b' },
    vcs: { issueList: async () => { throw new Error('HTTP 500'); } },
  });
  assert.equal(code, 1);
  assert.match(lines.join('\n'), /could not read the issue list/);
});

test('#459: with no body-write verb on the port, it prints the region instead of pretending', async () => {
  const lines = [];
  const code = await main(['313'], {
    say: (s) => lines.push(String(s)),
    config: {}, origin: { project: 'a/b' },
    vcs: {
      issueList: async () => [{ number: 1, title: 't', labels: ['status:approved'] }],
      issueView: async () => ({ body: block({}) }),
    },
  });
  assert.equal(code, 0);
  const out = lines.join('\n');
  assert.match(out, /no issue-body write verb/);
  assert.match(out, /```mermaid/);
});

// ── slice 2: two sources, one graph (#533, ADR-0029 Decision 2) ─────────────

test('#533: an edge only the NATIVE side knows is in the graph', () => {
  // "A repo that never declares a block should still get a graph" — the ticket's
  // own words, and the reason the two sources are not exclusive.
  const g = buildGraph([
    { number: 1, title: 'sin bloque', labels: ['status:approved'], state: 'open', body: 'prosa',
      relations: { blocks: [2], needs: [], foreign: 0 } },
    issue(2, { relations: noRelations }),
  ]);
  assert.deepEqual(g.edges, [{ from: 1, to: 2, sources: ['native'] }]);
  const n1 = g.nodes.find(n => n.number === 1);
  assert.notEqual(n1.status, UNCLASSIFIED, 'a native relation PLACES the node — it is not "sin ubicar"');
  assert.deepEqual(n1.sources, ['native']);
  assert.equal(g.nodes.find(n => n.number === 2).status, BLOCKED);
});

test('#533: when both sources declare the SAME edge it is one edge, and no disagreement', () => {
  const g = buildGraph([
    issue(1, { blocks: [2], relations: { blocks: [2], needs: [], foreign: 0 } }),
    issue(2, { relations: noRelations }),
  ]);
  assert.deepEqual(g.edges, [{ from: 1, to: 2, sources: ['declared', 'native'] }]);
  assert.deepEqual(g.divergences, [], 'agreement is not a divergence');
});

test('#533: the UNION is taken and the disagreement is REPORTED — neither source overrides', () => {
  // Precedence is a way of DISCARDING an assertion. An edge either source knows
  // about is a real constraint; dropping it makes the map say "there is no
  // dependency", the stronger and falser statement. The report is what keeps the
  // union honest — a relation someone clicked by accident shows up in a list a
  // human can act on, where a silently overridden one never would.
  const g = buildGraph([
    issue(1, { blocks: [2], relations: noRelations }),            // declared only
    issue(2, { relations: { blocks: [3], needs: [], foreign: 0 } }), // native only
    issue(3, { relations: noRelations }),
  ]);
  assert.deepEqual(g.edges.map(e => [e.from, e.to, e.sources.join('+')]).sort(),
    [[1, 2, 'declared'], [2, 3, 'native']]);
  assert.deepEqual(g.divergences, [
    { from: 1, to: 2, only: 'declared' },
    { from: 2, to: 3, only: 'native' },
  ]);

  const s = renderSummary(g);
  assert.match(s, /Las dos fuentes no coinciden/);
  assert.match(s, /#1→#2 \(sólo declarado\)/);
  assert.match(s, /#2→#3 \(sólo nativo\)/);
});

test('#533: an UNREADABLE native side is not "no relations", and manufactures no divergence', () => {
  // Reporting "the declared edge is missing from native" when native could not be
  // read charges an outage to the data — the same substitution of absence for
  // emptiness the assignees half of this ticket exists to stop.
  const g = buildGraph([
    issue(1, { blocks: [2], relations: null }),
    issue(2, { relations: null }),
  ]);
  assert.deepEqual(g.relationsUnreadable, [1, 2]);
  assert.deepEqual(g.divergences, [], 'a fetch failure is not a disagreement');
  assert.deepEqual(g.edges, [{ from: 1, to: 2, sources: ['declared'] }], 'and the declared edge survives');
  assert.match(renderSummary(g), /Relaciones nativas ilegibles.*#1 #2/s);
});

test('#533: not ASKING for relations is not the same as asking and failing', () => {
  // `--no-relations` (undefined) must leave slice 1's output untouched: no
  // divergence list, no "ilegibles" line, nothing claiming a source was consulted.
  const g = buildGraph([issue(1, { blocks: [2] }), issue(2)]);
  assert.deepEqual(g.divergences, []);
  assert.deepEqual(g.relationsUnreadable, []);
  const s = renderSummary(g);
  assert.ok(!/Las dos fuentes/.test(s));
  assert.ok(!/ilegibles/.test(s));
});

test('#533: cross-repo relations are counted through to the summary, never silently dropped', () => {
  const g = buildGraph([issue(1, { relations: { blocks: [], needs: [], foreign: 2 } })]);
  assert.equal(g.foreignRelations, 2);
  assert.match(renderSummary(g), /Relaciones cross-repo omitidas:\*\* 2/);
});

test('#533: a node no source places is still UNCLASSIFIED — a successful empty read places nothing', () => {
  const g = buildGraph([
    { number: 9, title: 'x', labels: ['status:approved'], state: 'open', body: 'prosa', relations: noRelations },
  ]);
  assert.equal(g.nodes[0].status, UNCLASSIFIED, 'reading "no relations" is not the same as being placed by one');
});

// ── slice 2: the executor (#533, ADR-0029 Decision 1) ───────────────────────

test('#533: the map shows WHO — and keeps "nobody" and "cannot see" apart', () => {
  const g = buildGraph([
    issue(1, { assignees: ['alice'] }),
    issue(2, { assignees: [] }),
    issue(3, { assignees: null }),
  ]);
  const m = renderMermaid(g);
  assert.match(m, /N1\["#1 t1 · alice"\]/);
  assert.match(m, /N2\["#2 t2 · sin asignar"\]/, 'read, and nobody is on it');
  assert.match(m, /N3\["#3 t3"\]/, 'brain cannot see — it says NOTHING rather than "sin asignar"');

  const s = renderSummary(g);
  assert.match(s, /#1 → alice/);
  assert.match(s, /#2 \(sin asignar\)/);
  assert.match(s, /#3 \(\?\)/);
});

test('#533: buildGraph does not erase `null` assignees into an empty list', () => {
  // `?? []` here would silently undo the whole reason the port was widened.
  const g = buildGraph([issue(1, { assignees: null }), issue(2, { assignees: [] })]);
  assert.equal(g.nodes.find(n => n.number === 1).assignees, null);
  assert.deepEqual(g.nodes.find(n => n.number === 2).assignees, []);
});

test('#533: an assignee name carrying mermaid syntax cannot break the block', () => {
  const node = renderMermaid(buildGraph([issue(1, { assignees: ['a["b"]|c'] })]))
    .split('\n').find(l => l.includes('N1['));
  const inner = node.slice(node.indexOf('["') + 2, node.lastIndexOf('"]'));
  for (const c of '"<>[]{}()|') {
    assert.ok(!inner.includes(c), `the label must not carry ${c} — names are user text too`);
  }
});

test('#533: a READY node with no `files` is reported unverifiable, not silently parallelisable', () => {
  // An empty `conflictsWith` reads as "proven parallelisable". It proved nothing —
  // and native-only nodes carry no `files` at all, so this became routine.
  const g = buildGraph([issue(1, { files: [] }), issue(2, { files: ['a/**'] })]);
  assert.equal(g.nodes.find(n => n.number === 1).filesUnknown, true);
  assert.equal(g.nodes.find(n => n.number === 2).filesUnknown, false);
  assert.match(renderSummary(g), /Paralelización no verificable[^\n]*#1/);
});

// ── slice 2: the body write (#533, ADR-0029 Decision 3) ─────────────────────

test('#533: outsideRegion is blind to the region and exact everywhere else', () => {
  const body = `# Épico\n\nprosa\n\n${BEGIN}\nviejo\n${END}\n\nfinal\n`;
  assert.equal(outsideRegion(replaceMapRegion(body, 'nuevo')), outsideRegion(body),
    'a regeneration changes nothing outside the markers');
  assert.equal(outsideRegion(replaceMapRegion('# Épico\n\nsolo prosa', 'X')), outsideRegion('# Épico\n\nsolo prosa'),
    'and a FIRST run, which appends, is still contained');
  assert.notEqual(outsideRegion(body), outsideRegion(body.replace('prosa', 'prosa.')),
    'one character of surrounding prose is enough to differ — this is not a fuzzy check');
});

test('#533: the map REFUSES to write when the prose outside the markers would change', async () => {
  // A stray BEGIN with no END is the real shape of this: appending a full region
  // leaves the stray marker as the FIRST one, so the next run would swallow the
  // prose between it and the real END. Refuse instead of writing the trap.
  const lines = [];
  let wrote = false;
  const code = await main(['313'], {
    say: (s) => lines.push(String(s)),
    config: {}, origin: { project: 'a/b' },
    vcs: {
      issueList: async () => [{ number: 1, title: 't', labels: ['status:approved'], assignees: [] }],
      issueView: async ({ number }) => (number === 313
        ? { body: `# Épico\n\nprosa\n${BEGIN}\ntexto huérfano` }
        : { body: block({}) }),
      issueRelations: async () => noRelations,
      issueUpdate: async () => { wrote = true; return { ok: true, url: null }; },
    },
  });
  assert.equal(code, 1);
  assert.equal(wrote, false, 'nothing may be written when containment cannot be proven');
  assert.match(lines.join('\n'), /refusing to write/);
});

test('#533: the map WRITES through issueUpdate, with the body it composed', async () => {
  let seen = null;
  const lines = [];
  const code = await main(['313'], {
    say: (s) => lines.push(String(s)),
    config: {}, origin: { project: 'a/b' },
    vcs: {
      issueList: async () => [{ number: 1, title: 't', labels: ['status:approved'], assignees: ['alice'] }],
      issueView: async ({ number }) => (number === 313 ? { body: '# Épico\n\nprosa' } : { body: block({}) }),
      issueRelations: async () => noRelations,
      issueUpdate: async (args) => { seen = args; return { ok: true, url: 'u' }; },
    },
  });
  assert.equal(code, 0);
  assert.equal(seen.number, 313);
  assert.match(seen.body, /```mermaid/);
  assert.match(seen.body, /N1\["#1 t · alice"\]/, 'the executor read from issueList reaches the written body');
  assert.ok(seen.body.startsWith('# Épico\n\nprosa'), 'the prose is intact');
  assert.match(lines.join('\n'), /map regenerated/);
});

test('#533: a refused write is reported as a failure, not as a regenerated map', async () => {
  const lines = [];
  const code = await main(['313'], {
    say: (s) => lines.push(String(s)),
    config: {}, origin: { project: 'a/b' },
    vcs: {
      issueList: async () => [{ number: 1, title: 't', labels: ['status:approved'] }],
      issueView: async () => ({ body: block({}) }),
      issueRelations: async () => noRelations,
      issueUpdate: async () => ({ ok: false, error: 'HTTP 403' }),
    },
  });
  assert.equal(code, 1);
  const out = lines.join('\n');
  assert.match(out, /could not write #313: HTTP 403/);
  assert.ok(!/map regenerated/.test(out), 'a failed write must never print success');
});

test('#533: --no-relations does not call issueRelations at all', async () => {
  let called = 0;
  await main(['313', '--no-relations', '--dry-run'], {
    say: () => {},
    config: {}, origin: { project: 'a/b' },
    vcs: {
      issueList: async () => [{ number: 1, title: 't', labels: [] }],
      issueView: async () => ({ body: block({}) }),
      issueRelations: async () => { called += 1; return noRelations; },
    },
  });
  assert.equal(called, 0);
});

test('#533: a provider WITHOUT issueRelations degrades to the declared block alone', async () => {
  // A third provider that has not implemented the verb must still get slice 1's
  // map, and must not be reported as "unreadable" — it was never asked.
  const lines = [];
  const code = await main(['313', '--dry-run'], {
    say: (s) => lines.push(String(s)),
    config: {}, origin: { project: 'a/b' },
    vcs: {
      issueList: async () => [{ number: 1, title: 't', labels: ['status:approved'] }],
      issueView: async () => ({ body: block({}) }),
    },
  });
  assert.equal(code, 0);
  assert.ok(!/ilegibles/.test(lines.join('\n')));
});

test('#533: the body written is EXACTLY composeMap over the same graph — one composer, not two', () => {
  // `composeMap` is exported so a test can assert the CLI writes the same text a
  // reader can reproduce. Two spellings of one rule is the #340 defect, and here it
  // would mean the region a human reviews is not the region the verb writes.
  const issues = [
    { number: 1, title: 't', labels: ['status:approved'], state: 'open', body: block({}), assignees: ['alice'], relations: noRelations },
  ];
  const region = composeMap(buildGraph(issues));
  const body = replaceMapRegion('# Épico\n\nprosa', region);
  assert.ok(body.includes(`${BEGIN}\n${region}\n${END}`));
  assert.equal(outsideRegion(body), outsideRegion('# Épico\n\nprosa'));
});

test('#533: when NEITHER source carries assignees the map stays silent — it does not invent "sin asignar"', async () => {
  // The CLI-level twin of the port rule. A `?? []` here would undo the whole point
  // one layer above where the port defends it, and the map — the artefact a human
  // actually reads — would say "nobody is on this" about issues it never saw.
  const lines = [];
  await main(['313', '--dry-run'], {
    say: (s) => lines.push(String(s)),
    config: {}, origin: { project: 'a/b' },
    vcs: {
      issueList: async () => [{ number: 1, title: 't', labels: ['status:approved'] }],
      issueView: async () => ({ body: block({}) }),
    },
  });
  const out = lines.join('\n');
  assert.match(out, /N1\["#1 t"\]/);
  assert.ok(!/sin asignar/.test(out), 'absent must not be rendered as empty');
  assert.match(out, /#1 \(\?\)/, 'and the summary says it cannot see, rather than saying nobody');
});

test('#533: an EMPTY list from issueList is an answer — it does not fall through to issueView', async () => {
  // `||` instead of `??` here would treat "read, and nobody is assigned" as a
  // miss and quietly prefer a second, staler source.
  const lines = [];
  await main(['313', '--dry-run'], {
    say: (s) => lines.push(String(s)),
    config: {}, origin: { project: 'a/b' },
    vcs: {
      issueList: async () => [{ number: 1, title: 't', labels: ['status:approved'], assignees: [] }],
      issueView: async () => ({ body: block({}), assignees: ['fantasma'] }),
    },
  });
  const out = lines.join('\n');
  assert.match(out, /N1\["#1 t · sin asignar"\]/);
  assert.ok(!/fantasma/.test(out));
});

test('#533: issueView is the fallback when the LIST endpoint cannot carry assignees', async () => {
  const lines = [];
  await main(['313', '--dry-run'], {
    say: (s) => lines.push(String(s)),
    config: {}, origin: { project: 'a/b' },
    vcs: {
      issueList: async () => [{ number: 1, title: 't', labels: ['status:approved'] }],
      issueView: async () => ({ body: block({}), assignees: ['alice'] }),
    },
  });
  assert.match(lines.join('\n'), /N1\["#1 t · alice"\]/);
});

// ── #723 / #710: D6 row 4 — a HIDDEN declaration is refused, never reported absent ──
//
// `epic-graph.mjs` never destructured `skipped`, so the half of D6 that depends on
// it was never wired. Four shapes that HIDE a complete, well-formed declaration
// answered `null` — the value REQ-639-4 defines as "nobody declared one".
//
// This is the exact conflation #709 shipped to end, surviving inside #709's own
// delivery. Task 2.2 asked for it, but PR #720 (selector) landed BEFORE PR #722
// created `skipped` — D0 sequenced them that way on purpose — and when the field
// arrived nothing came back to wire it. The box was already checked, against the
// half that was buildable at the time.
//
// The suite was green throughout, and said nothing: no test varied this axis.

const hidden = (...lines) => lines.join('\n');
const G = '```brain-graph/1';

test('#723: a BLOCKQUOTED graph fence is refused by reason, not reported absent', () => {
  const r = parseGraphBlock(hidden('> ' + G, '> track: A', '> ```'));
  assert.equal(r?.ok, false, 'answered absent (null) about a body that declares a graph');
  assert.match(r.error, /blockquote/, 'the refusal does not name the reason');
  assert.match(r.error, /line 1\b/, 'the refusal does not name the line');
});

test('#723: an INDENTED-CODE graph fence is refused by reason, not reported absent', () => {
  const r = parseGraphBlock(hidden('    ' + G, '    track: A', '    ```'));
  assert.equal(r?.ok, false);
  assert.match(r.error, /indented/);
  assert.match(r.error, /line 1\b/);
});

test('#723: an HTML-COMMENTED graph fence is refused by reason, not reported absent', () => {
  const r = parseGraphBlock(hidden('<!--', G, 'track: A', '```', '-->'));
  assert.equal(r?.ok, false);
  assert.match(r.error, /comment/);
  assert.match(r.error, /line 2\b/, 'the refusal names the fence line, not the comment opener');
});

test('#710 finding 1 / #723: an unterminated FOREIGN fence that swallows a declaration is refused, not reported absent', () => {
  // The pre-existing branch only fired when the UNTERMINATED fence was itself
  // graph-tagged. A runaway ```console consumes the declaration below it, so the
  // graph fence never becomes a block and the unterminated tag is `console`.
  const r = parseGraphBlock(hidden('```console', '$ gh pr checks', '', G, 'track: A', 'blocks: [7]', '```'));
  assert.equal(r?.ok, false, 'a runaway foreign fence still hides the declaration silently');
  assert.match(r.error, /line 1\b/, 'the refusal does not name the fence that swallowed it');
  assert.match(r.error, /swallow|never closed/i);
});

test('#710 finding 1 / #723: a runaway fence that is NEVER closed hides it too — the other shape', () => {
  // Measured: when nothing closes the foreign fence, `unterminated` is set and
  // `blocks` is EMPTY, so the block-content scan cannot see it. Two shapes, two
  // detections; one of them alone leaves the other silent.
  const r = parseGraphBlock(hidden('```console', '$ gh pr checks', '', G, 'track: A'));
  assert.equal(r?.ok, false);
  assert.match(r.error, /never closed/i);
  assert.match(r.error, /line 1\b/);
});

test('#710 finding 1 / #723: a ~~~ runaway hides it as well — delimiters are peers', () => {
  const r = parseGraphBlock(hidden('~~~console', '$ x', '', G, 'track: A'));
  assert.equal(r?.ok, false);
  assert.match(r.error, /never closed/i);
});

test('#723: a body that merely MENTIONS the protocol in prose is still absent, not a refusal', () => {
  // The boundary. Widening row 4 into "any body containing the string" would
  // turn every issue that discusses the protocol into an unreadable block —
  // trading a silent omission for a fabricated defect, which is the trade
  // ADR-0032 exists to refuse.
  assert.equal(parseGraphBlock('we should adopt brain-graph/1 in the epic bodies'), null);
});

test('#723: an unterminated foreign fence with the protocol only ABOVE it stays absent', () => {
  // The mention is not inside the swallowed region, so nothing is hidden. The
  // refusal must key on position, not on the string appearing anywhere.
  assert.equal(parseGraphBlock(hidden('brain-graph/1 is the tag', '```console', '$ runaway')), null);
});

test('#723: a well-formed declaration is untouched by any of this', () => {
  assert.deepEqual(parseGraphBlock(block({ track: 'B', blocks: [2] })),
    { track: 'B', blocks: [2], needs: [], files: [] });
});
