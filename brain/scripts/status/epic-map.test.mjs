// epic-map.test.mjs — issue #459.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseGraphBlock, buildGraph, filesOverlap, READY, BLOCKED, AWAITING_HUMAN, UNCLASSIFIED } from './epic-graph.mjs';
import { renderMermaid, renderSummary, replaceMapRegion, BEGIN, END } from './epic-render.mjs';
import { parseArgs, composeMap, main } from './epic-map.mjs';

const block = ({ track = 'A', needs = [], blocks = [], files = [] } = {}) =>
  ['```yaml', 'protocol: brain-graph/1', `track: ${track}`,
    `needs: ${JSON.stringify(needs)}`, `blocks: ${JSON.stringify(blocks)}`,
    `files: ${JSON.stringify(files)}`, '```'].join('\n');

const issue = (number, o = {}) => ({
  number, title: o.title ?? `t${number}`, labels: o.labels ?? ['status:approved'],
  state: o.state ?? 'open', body: o.body ?? block(o),
});

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
  assert.deepEqual(fromNeeds.edges, [{ from: 1, to: 2 }]);
  assert.deepEqual(fromBlocks.edges, [{ from: 1, to: 2 }]);

  // And declaring BOTH ends does not double it.
  const both = buildGraph([issue(1, { blocks: [2] }), issue(2, { needs: [1] })]);
  assert.deepEqual(both.edges, [{ from: 1, to: 2 }]);
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

test('#459: the summary reports the undeclared COUNT rather than hiding them', () => {
  const s = renderSummary(buildGraph([
    issue(1), { number: 8, title: 'x', labels: [], state: 'open', body: '' },
  ]));
  assert.match(s, /\*\*Sin declarar\*\* \(1\)/);
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
  assert.deepEqual(parseArgs(['313']), { ok: true, number: 313, dryRun: false });
  assert.deepEqual(parseArgs(['313', '--dry-run']), { ok: true, number: 313, dryRun: true });
  assert.equal(parseArgs([]).ok, false);
  assert.match(parseArgs(['--bogus']).error, /unknown argument/);
});

test('#459: the map NAMES what it cannot see — assignees are absent, not empty', () => {
  // Reporting an empty assignee list would read as "nobody is on this" when the truth
  // is "brain cannot see". The port normalises assignees away; slice 2 changes that.
  const text = composeMap(buildGraph([issue(1)]));
  assert.match(text, /quién lo ejecuta/);
  assert.match(text, /slice 2/);
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
