// epic-graph.mjs — the pure half of `brain:epic:map` (issue #459).
//
// #313's body carries lanes, dependencies and priorities as hand-maintained prose,
// and it has drifted at least once — the 2026-08-02 errata records a planning pass
// misdirected by a stale body proposing closed work. A maintained diagram drifts;
// only a derived one cannot lie more than its source.
//
// THE DESIGN QUESTION THE TICKET ASKS TO SETTLE FIRST: dependencies must become
// DATA, not prose. This module answers it with a DECLARED block in the issue body:
//
//   ```yaml
//   protocol: brain-graph/1
//   track:    A
//   blocks:   [435, 94]
//   needs:    [479]
//   files:    ["brain/scripts/status/**"]
//   ```
//
// Chosen over the alternative — native provider relations (GitHub sub-issues +
// blocked-by via GraphQL, GitLab issue links) — for one reason, and it is a slicing
// reason rather than a preference: those are NEW PORT VERBS, and widening the port
// is a `decision`-labelled change with an ADR behind it (ADR-0020's own rule). The
// declared block needs no new verb, works identically on both providers because it
// is just issue text, and the two are not exclusive: when the relations land, they
// become a second source feeding the same builder.
//
// It reuses the two readers this repo already has rather than growing a third
// (the defect #340 records): `fenced-blocks.mjs` LOCATES the block and
// `yaml-block.mjs`'s `scalar` / `parseJsonScalar` READ it. That is the same split
// `checkpoint-block.mjs` uses, and it is a split by SHAPE OF INPUT.
//
// It used to locate through `extractFencedBlock`, which reads the FIRST fence.
// That is right for a VCS comment our own emitter wrote — one body, one block —
// and wrong here (#639): an issue body is written by a human and routinely opens
// with a snippet, a command, or a log excerpt. The first fence was then handed to
// the protocol check, which answered `null`, and the node read as UNCLASSIFIED
// while declaring a complete block further down. The selector is now the
// `protocol:` scalar, not the position.

import { fencedBlocks } from '../lib/fenced-blocks.mjs';
import { scalar, parseJsonScalar } from '../review/lib/yaml-block.mjs';

export const GRAPH_PROTOCOL = 'brain-graph/1';

/** Node states, in the order a reader cares about them. */
export const READY = 'ready';
export const BLOCKED = 'blocked';
export const AWAITING_HUMAN = 'awaiting-human';
export const UNCLASSIFIED = 'unclassified';

/**
 * Reads the declared graph block from an issue body.
 *
 * THREE ANSWERS, and each is a different sentence for the reader.
 *
 * ABSENT IS NOT EMPTY. An issue with no block yields `null`, and the builder marks
 * it UNCLASSIFIED rather than dropping it or treating it as a free-standing leaf. A
 * node that disappears because it lacks metadata is the same class as a commit the
 * audit never enumerates (#518): the map would report a graph it had not read.
 *
 * MALFORMED IS NOT ABSENT (#639). More than one `brain-graph/1` block in one body
 * is ambiguity, and the answer is `{ ok: false, error }` naming the count — never a
 * silent pick of one of them, the same rule `parseAmendmentDraft` and
 * `parseCheckpointClaim` hold. `buildGraph` carries it out in `blocksUnreadable`
 * and `renderSummary` prints it, exactly as it already does for a native read it
 * could not perform: "could not read what it declared" is not "declared nothing".
 *
 * Success keeps the bare object rather than growing an `ok: true` envelope, because
 * `null`-means-absent is load-bearing here and already distinguishes the case the
 * envelope exists to distinguish elsewhere.
 *
 * @param {string} body
 * @returns {{ track: string|null, blocks: number[], needs: number[], files: string[] }
 *          |{ ok: false, error: string }
 *          |null}
 */
export function parseGraphBlock(body) {
  if (typeof body !== 'string' || !body.includes(GRAPH_PROTOCOL)) return null;

  // Every fence is read and the block is selected by its `protocol:` scalar. The
  // shape stays ```yaml — an issue body IS rendered for a human, and an unknown
  // info-string renders as plain text (#495 design D1) — so the tag cannot be the
  // selector the way it is for `brain-checkpoint/1`.
  const declared = fencedBlocks(body).blocks
    .filter(b => scalar(b.content, 'protocol') === GRAPH_PROTOCOL);

  if (declared.length === 0) return null;
  if (declared.length > 1) {
    return {
      ok: false,
      error: `${declared.length} \`${GRAPH_PROTOCOL}\` blocks found (body lines ${declared.map(b => b.line).join(', ')}) — an issue declares its graph exactly once.`,
    };
  }

  const block = declared[0].content;

  const nums = (key) => {
    const raw = scalar(block, key);
    if (raw === null) return [];
    const parsed = parseJsonScalar(raw);
    return Array.isArray(parsed) ? parsed.filter(n => Number.isInteger(n)) : [];
  };
  const strs = (key) => {
    const raw = scalar(block, key);
    if (raw === null) return [];
    const parsed = parseJsonScalar(raw);
    return Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string') : [];
  };

  const track = scalar(block, 'track');
  return { track: track ?? null, blocks: nums('blocks'), needs: nums('needs'), files: strs('files') };
}

/**
 * Do two file claims overlap? The question that decides whether two agents can work
 * at once, and the reason `files` exists at all.
 *
 * Glob-aware only to the depth the claims need: a `**` suffix is a prefix claim.
 * Deliberately NOT a full glob engine — an approximate matcher that silently answers
 * "no overlap" would license two agents onto one file, so anything it cannot decide
 * it must call an OVERLAP. Conservative in the safe direction.
 *
 * @param {string[]} a @param {string[]} b @returns {boolean}
 */
export function filesOverlap(a = [], b = []) {
  const norm = (p) => String(p).replace(/\/?\*\*$/, '/').replace(/\/+$/, '/');
  for (const x of a) {
    for (const y of b) {
      const nx = norm(x);
      const ny = norm(y);
      if (nx === ny) return true;
      if (nx.endsWith('/') && ny.startsWith(nx)) return true;
      if (ny.endsWith('/') && nx.startsWith(ny)) return true;
      // Neither is a prefix of the other AND neither is a bare path we can compare:
      // an unrecognised glob (`*` in the middle, `?`, braces) is UNDECIDABLE, and
      // undecidable must read as overlapping.
      if (/[*?{[]/.test(nx.slice(0, -1)) || /[*?{[]/.test(ny.slice(0, -1))) return true;
    }
  }
  return false;
}

/** The two sources an edge can come from (#533, ADR-0029). */
export const SRC_DECLARED = 'declared';
export const SRC_NATIVE = 'native';

/**
 * Builds the execution graph from a set of issues.
 *
 * `needs` edges are honoured in BOTH directions: `A needs B` and `B blocks A` are the
 * same edge declared from either end, and a graph that only read one would go quiet
 * the moment someone declared it from the other. Duplicates collapse.
 *
 * TWO SOURCES, ONE GRAPH (#533 slice 2, ADR-0029 Decision 2). The declared
 * `brain-graph/1` block and the provider's native relations (`issue.relations`, from
 * the `issueRelations` verb) both assert edges, and the graph takes their UNION —
 * neither overrides the other.
 *
 * Precedence was the open question, and the answer is that precedence is a way of
 * DISCARDING an assertion. An edge either source knows about is a real constraint on
 * start order, and dropping it because the other source is silent makes the map say
 * "there is no dependency" — the stronger and falser statement this whole module
 * refuses (the out-of-scope stub in `renderMermaid`, the pagination fix behind
 * `issueList`, #518's unenumerated commits). Union is also the safe direction: an
 * extra blocker delays one ticket, a missing one licenses two agents onto colliding
 * work.
 *
 * The union is only honest with the DIVERGENCE REPORTED. Every edge present in one
 * source and absent from the other lands in `divergences`, and `renderSummary` prints
 * it. That is what answers the ticket's worry about "a relation someone clicked by
 * accident": a wrong click shows up in a list a human can act on, where a silently
 * overridden one never would. A silent merge of two sources is how a derived artefact
 * starts lying again.
 *
 * `relations === null` means UNCOMPUTABLE — the native side could not be read for that
 * issue — and it is carried through to `relationsUnreadable` rather than being read as
 * "no native relations". `undefined` means the caller did not ask for them at all.
 *
 * The DECLARED side has the same distinction (#639): a body whose graph block could
 * not be read lands in `blocksUnreadable` with the reason, and its node stays
 * UNCLASSIFIED — the honest status, since no source placed it — instead of being
 * counted among the issues that simply never declared one.
 *
 * An edge to an issue that is CLOSED or absent from the set does not block — the work
 * is done or out of scope. An edge to an OPEN issue does.
 *
 * @param {Array<{number:number,title:string,labels:string[],state:string,body?:string,assignees?:string[]|null,relations?:{blocks:number[],needs:number[],foreign?:number}|null}>} issues
 * @returns {{ nodes: Array, edges: Array<{from:number,to:number,sources:string[]}>, tracks: Map, divergences: Array, relationsUnreadable: number[], blocksUnreadable: Array<{number:number,error:string}>, foreignRelations: number }}
 */
export function buildGraph(issues = []) {
  const byNumber = new Map(issues.map(i => [i.number, i]));
  const nodes = [];
  /** @type {Map<string, Set<string>>} edge key → the sources that assert it. */
  const edgeSources = new Map();
  const addEdge = (key, source) => {
    if (!edgeSources.has(key)) edgeSources.set(key, new Set());
    edgeSources.get(key).add(source);
  };
  const relationsUnreadable = [];
  const blocksUnreadable = [];
  let foreignRelations = 0;

  for (const issue of issues) {
    const parsed = parseGraphBlock(issue.body ?? '');
    if (parsed?.ok === false) blocksUnreadable.push({ number: issue.number, error: parsed.error });
    // An unreadable block asserts NOTHING — it is not half a declaration to be
    // salvaged. It places no node and draws no edge; `blocksUnreadable` is what
    // keeps that from reading as "this issue declared nothing".
    const g = parsed?.ok === false ? null : parsed;
    // `needs` → an edge INTO this node. `blocks` → an edge OUT of it. Same relation,
    // two ends; declaring either is enough.
    for (const n of g?.needs ?? []) addEdge(`${n}->${issue.number}`, SRC_DECLARED);
    for (const b of g?.blocks ?? []) addEdge(`${issue.number}->${b}`, SRC_DECLARED);

    const rel = issue.relations;
    if (rel === null) relationsUnreadable.push(issue.number);
    let nativeTouches = false;
    if (rel) {
      foreignRelations += rel.foreign ?? 0;
      for (const n of rel.needs ?? []) { addEdge(`${n}->${issue.number}`, SRC_NATIVE); nativeTouches = true; }
      for (const b of rel.blocks ?? []) { addEdge(`${issue.number}->${b}`, SRC_NATIVE); nativeTouches = true; }
    }

    // `sources` is what PLACES a node in the graph. A repo that never declares a
    // block still gets one when the provider carries the relations, which is the
    // property the ticket asked for; a node no source places stays UNCLASSIFIED
    // rather than silently becoming a free-standing leaf.
    const sources = [];
    if (g !== null) sources.push(SRC_DECLARED);
    if (nativeTouches) sources.push(SRC_NATIVE);

    nodes.push({
      number: issue.number,
      title: issue.title,
      labels: issue.labels ?? [],
      state: issue.state,
      track: g?.track ?? null,
      files: g?.files ?? [],
      declared: g !== null,
      sources,
      // `assignees` passes through UNCHANGED, `null` included (#533): `[]` is
      // "nobody is assigned", `null` is "brain cannot see", and `?? []` here would
      // erase exactly the distinction the port was widened to carry.
      assignees: issue.assignees ?? null,
    });
  }

  const edges = [...edgeSources].map(([k, srcs]) => {
    const [from, to] = k.split('->').map(Number);
    return { from, to, sources: [...srcs].sort() };
  });

  // Only edges whose endpoints BOTH had a native read can diverge: if the native
  // side was unreadable for an endpoint, "absent from native" is not a fact about
  // the relation, it is a fact about the fetch — and reporting it as disagreement
  // would manufacture divergences out of an outage.
  const nativeRead = new Set(
    issues.filter(i => i.relations != null).map(i => i.number),
  );
  const askedNative = nativeRead.size > 0 || relationsUnreadable.length > 0;
  const divergences = !askedNative ? [] : edges
    .filter(e => e.sources.length === 1)
    .filter(e => nativeRead.has(e.from) || nativeRead.has(e.to))
    .map(e => ({ from: e.from, to: e.to, only: e.sources[0] }))
    .sort((a, b) => a.from - b.from || a.to - b.to);

  // Classify. An OPEN prerequisite blocks; a closed or unknown one does not.
  const openBlockers = new Map();
  for (const { from, to } of edges) {
    const src = byNumber.get(from);
    if (src && src.state === 'open') openBlockers.set(to, [...(openBlockers.get(to) ?? []), from]);
  }

  for (const node of nodes) {
    const blockers = openBlockers.get(node.number) ?? [];
    node.blockedBy = blockers;
    if (node.sources.length === 0) node.status = UNCLASSIFIED;
    else if (blockers.length > 0) node.status = BLOCKED;
    else if (!node.labels.includes('status:approved')) node.status = AWAITING_HUMAN;
    else node.status = READY;
  }

  // Parallelisability is COMPUTED from `files`, never taken from a declaration.
  // A declared boolean would be an assertion with no evidence behind it — the shape
  // this repo has paid for repeatedly. Two ready nodes in one track conflict when
  // their file claims overlap.
  const tracks = new Map();
  for (const node of nodes) {
    const key = node.track ?? '?';
    tracks.set(key, [...(tracks.get(key) ?? []), node]);
  }
  for (const [, members] of tracks) {
    const ready = members.filter(n => n.status === READY);
    for (const n of ready) {
      n.conflictsWith = ready
        .filter(o => o.number !== n.number && filesOverlap(n.files, o.files))
        .map(o => o.number);
      // A node with NO file claim yields an empty `conflictsWith`, which reads as
      // "proven parallelisable" when nothing was proven. Native relations make this
      // routine rather than rare — they carry no `files` at all — so the absence is
      // marked instead of being left to look like a clean result (#533).
      n.filesUnknown = n.files.length === 0;
    }
  }

  return { nodes, edges, tracks, divergences, relationsUnreadable, blocksUnreadable, foreignRelations };
}
