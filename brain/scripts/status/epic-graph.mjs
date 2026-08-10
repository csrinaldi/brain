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
// It reuses `yaml-block.mjs`'s primitives rather than growing a third fenced reader.
// That module's header anticipates exactly this ("shared by every fenced-YAML reader
// in this repo") and its `FENCE_RE` was just hardened so a fence inside a value
// cannot truncate a block (#487). A second parser would be the defect #340 records.

import { extractFencedBlock, scalar, parseJsonScalar } from '../review/lib/yaml-block.mjs';

export const GRAPH_PROTOCOL = 'brain-graph/1';

/** Node states, in the order a reader cares about them. */
export const READY = 'ready';
export const BLOCKED = 'blocked';
export const AWAITING_HUMAN = 'awaiting-human';
export const UNCLASSIFIED = 'unclassified';

/**
 * Reads the declared graph block from an issue body.
 *
 * ABSENT IS NOT EMPTY. An issue with no block yields `null`, and the builder marks
 * it UNCLASSIFIED rather than dropping it or treating it as a free-standing leaf. A
 * node that disappears because it lacks metadata is the same class as a commit the
 * audit never enumerates (#518): the map would report a graph it had not read.
 *
 * @param {string} body
 * @returns {{ track: string|null, blocks: number[], needs: number[], files: string[] }|null}
 */
export function parseGraphBlock(body) {
  if (typeof body !== 'string' || !body.includes(GRAPH_PROTOCOL)) return null;
  const block = extractFencedBlock(body);
  if (!block) return null;
  if (scalar(block, 'protocol') !== GRAPH_PROTOCOL) return null;

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

/**
 * Builds the execution graph from a set of issues.
 *
 * `needs` edges are honoured in BOTH directions: `A needs B` and `B blocks A` are the
 * same edge declared from either end, and a graph that only read one would go quiet
 * the moment someone declared it from the other. Duplicates collapse.
 *
 * An edge to an issue that is CLOSED or absent from the set does not block — the work
 * is done or out of scope. An edge to an OPEN issue does.
 *
 * @param {Array<{number:number,title:string,labels:string[],state:string,body?:string,assignees?:string[]}>} issues
 * @returns {{ nodes: Array, edges: Array<{from:number,to:number}>, tracks: Map }}
 */
export function buildGraph(issues = []) {
  const byNumber = new Map(issues.map(i => [i.number, i]));
  const nodes = [];
  const edgeSet = new Set();

  for (const issue of issues) {
    const g = parseGraphBlock(issue.body ?? '');
    // `needs` → an edge INTO this node. `blocks` → an edge OUT of it. Same relation,
    // two ends; declaring either is enough.
    for (const n of g?.needs ?? []) edgeSet.add(`${n}->${issue.number}`);
    for (const b of g?.blocks ?? []) edgeSet.add(`${issue.number}->${b}`);
    nodes.push({
      number: issue.number,
      title: issue.title,
      labels: issue.labels ?? [],
      state: issue.state,
      track: g?.track ?? null,
      files: g?.files ?? [],
      declared: g !== null,
      assignees: issue.assignees ?? [],
    });
  }

  const edges = [...edgeSet].map(k => {
    const [from, to] = k.split('->').map(Number);
    return { from, to };
  });

  // Classify. An OPEN prerequisite blocks; a closed or unknown one does not.
  const openBlockers = new Map();
  for (const { from, to } of edges) {
    const src = byNumber.get(from);
    if (src && src.state === 'open') openBlockers.set(to, [...(openBlockers.get(to) ?? []), from]);
  }

  for (const node of nodes) {
    const blockers = openBlockers.get(node.number) ?? [];
    node.blockedBy = blockers;
    if (!node.declared) node.status = UNCLASSIFIED;
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
    }
  }

  return { nodes, edges, tracks };
}
