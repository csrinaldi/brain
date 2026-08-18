// epic-graph.mjs — the pure half of `brain:epic:map` (issue #459).
//
// #313's body carries lanes, dependencies and priorities as hand-maintained prose,
// and it has drifted at least once — the 2026-08-02 errata records a planning pass
// misdirected by a stale body proposing closed work. A maintained diagram drifts;
// only a derived one cannot lie more than its source.
//
// THE DESIGN QUESTION THE TICKET ASKS TO SETTLE FIRST: dependencies must become
// DATA, not prose. This module answers it with a DECLARED block in the issue body,
// identified by its fence TAG (issue #709; ADR-0032):
//
//   ```brain-graph/1
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
// (the defect #340 records): `fenced-blocks.mjs` LOCATES every fence and
// `yaml-block.mjs`'s `scalar` / `parseJsonScalar` READ the fields inside the one
// selected. That is the same split `checkpoint-block.mjs` uses, and it is a split
// by SHAPE OF INPUT.
//
// It used to locate through `extractFencedBlock`, which reads the FIRST fence.
// That is right for a VCS comment our own emitter wrote — one body, one block —
// and wrong here (#639): an issue body is written by a human and routinely opens
// with a snippet, a command, or a log excerpt. `fenced-blocks.mjs` fixed that by
// reading every fence rather than only the first.
//
// THE SELECTOR IS THE FENCE TAG, NOT AN INTERIOR SCALAR (#709; ADR-0032). Until
// #709, the selector filtered every fence for `scalar(content, 'protocol') ===
// 'brain-graph/1'` — a value an author teaching the shape necessarily reproduces
// verbatim, so a body that ILLUSTRATES the protocol and a body that DECLARES it
// were byte-identical to the reader: no code path could tell them apart. #709
// measured the corpus: zero declarations exist anywhere in this repo, and the one
// column-0 `protocol: brain-graph/1` in the whole tree
// (`openspec/changes/issue-459-epic-map-derived/proposal.md:38`) is exactly that
// illustration, sitting in the very proposal that introduced the protocol.
//
// The tag `​```brain-graph/1` is now the identity, compared against the FIRST WORD
// of the fence's info string, exact case — the same rule `brain-amendment/1` and
// `brain-checkpoint/1` already use for the family they belong to. A `​```yaml`
// fence carrying `protocol: brain-graph/1` inside no longer declares; it is
// refused OUT LOUD, naming the retag, never silently read as absent — see
// `parseGraphBlock` below.
//
// `fenced-blocks.mjs` itself is UNTOUCHED by this half of #709, deliberately: it
// stays backtick-only and column-0-only until the splitter half of #709 lands.
// That ordering is a correctness constraint, not a preference (design.md D0) —
// teaching the splitter to see indented or tilde-fenced openers BEFORE the
// selector stopped trusting the interior scalar would make an indented
// illustration newly readable and mint a fabricated edge from it. The tag-based
// selector below is safe under either version of the splitter, because nothing
// but a fence literally tagged `brain-graph/1` can ever match it.

import { fencedBlocks } from '../lib/fenced-blocks.mjs';
import { scalar, parseJsonScalar } from '../review/lib/yaml-block.mjs';

export const GRAPH_PROTOCOL = 'brain-graph/1';

/**
 * The splitter's `skipped.reason` values, rendered for a human (#723).
 *
 * The refusal must name the reason, not only the line — D6 row 4 says "naming line
 * **and** reason", because "cannot be read at line 3" leaves the author guessing
 * which of three CommonMark rules put it there. Keyed off the splitter's own
 * vocabulary so a new reason surfaces as itself rather than as a missing case.
 */
const REFUSAL_REASON = Object.freeze({
  blockquote: 'a blockquote',
  'indented-code': 'an indented code block (four spaces or more)',
  'html-comment': 'an HTML comment',
});

/**
 * A line that OPENS a fence tagged for this protocol, at a CommonMark-legal indent.
 *
 * Used only to locate a declaration swallowed by an unterminated foreign fence
 * (#710 finding 1), where the splitter never sees it as a fence at all.
 */
const GRAPH_FENCE_OPENER = new RegExp(`^ {0,3}(\`{3,}|~{3,})\\s*${GRAPH_PROTOCOL.replace('/', '\\/')}(\\s|$)`);

/**
 * The fence's DECLARED identity: the first whitespace-delimited word of its info
 * string. `fencedBlocks` still returns `tag` as the WHOLE trimmed info string,
 * unchanged (#495 D1 — `amendment-draft.mjs`/`checkpoint-block.mjs` compare it with
 * `===`, and redefining it here would silently widen both). This derivation stays
 * local to the selector rather than moving into `fenced-blocks.mjs` until the
 * splitter half of #709 lands (D0) — the selector needs nothing from the splitter
 * that is not already there.
 *
 * @param {string} tag
 * @returns {string}
 */
function firstWord(tag) {
  return tag.split(/\s+/)[0];
}

/** Node states, in the order a reader cares about them. */
export const READY = 'ready';
export const BLOCKED = 'blocked';
export const AWAITING_HUMAN = 'awaiting-human';
export const UNCLASSIFIED = 'unclassified';

/**
 * Reads the declared graph block from an issue body.
 *
 * THE BLOCK IS SELECTED BY ITS FENCE TAG (#709; ADR-0032), never by an interior
 * scalar and never by position: every fence in the body is read via
 * `fencedBlocks`, and the one whose info-string's FIRST WORD, compared exact-case,
 * equals `GRAPH_PROTOCOL` is the declaration. Trailing attributes
 * (`​```brain-graph/1 title="x"`) do not block a match on the first word, and case
 * is exact — `BRAIN-GRAPH/1` is not a match; there is no whitelist of near-misses
 * to forgive.
 *
 * FOUR ANSWERS, and each is a different sentence for the reader:
 *
 * ABSENT IS NOT EMPTY. A body with no `brain-graph/1`-tagged fence, and no mention
 * of the protocol at all, yields `null`, and the builder marks the issue
 * UNCLASSIFIED rather than dropping it or treating it as a free-standing leaf. A
 * node that disappears because it lacks metadata is the same class as a commit the
 * audit never enumerates (#518): the map would report a graph it had not read.
 *
 * MALFORMED IS NOT ABSENT (#639). More than one `brain-graph/1`-tagged fence in one
 * body is ambiguity, and the answer is `{ ok: false, error }` naming the count —
 * never a silent pick of one of them, the same rule `parseAmendmentDraft` and
 * `parseCheckpointClaim` hold. `buildGraph` carries it out in `blocksUnreadable`
 * and `renderSummary` prints it, exactly as it already does for a native read it
 * could not perform: "could not read what it declared" is not "declared nothing".
 *
 * HIDDEN IS NOT ABSENT (design.md D6). A `brain-graph/1`-tagged fence that never
 * closes is not a missing declaration — `fencedBlocks` reports it as
 * `unterminated`, and that is carried out here as `{ ok: false, error }` naming
 * the line, unconditionally, regardless of any other fence's tag. #710 finding 1's
 * attribution ambiguity (whose unterminated fence was it?) is deleted by
 * construction: the caller never asks.
 *
 * THE LEGACY SHAPE IS REFUSED OUT LOUD (design.md D7). Zero tagged fences, but some
 * fence's CONTENT still carries the pre-#709 `protocol: brain-graph/1` scalar — the
 * shape this module used to teach — returns `{ ok: false, error }` naming the
 * retag. "No longer declares" must not silently read as "stopped working". A
 * tagged declaration standing beside a `​```yaml` illustration of the same
 * protocol is NOT this case, and is not ambiguity either: the illustration is not
 * a declaration, so it is ignored and the tagged block reads alone.
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

  const { blocks, unterminated, skipped } = fencedBlocks(body);
  const declared = blocks.filter(b => firstWord(b.tag) === GRAPH_PROTOCOL);

  if (declared.length > 1) {
    return {
      ok: false,
      error: `${declared.length} \`${GRAPH_PROTOCOL}\` blocks found (body lines ${declared.map(b => b.line).join(', ')}) — an issue declares its graph exactly once.`,
    };
  }

  if (declared.length === 0) {
    // D6: an unterminated fence that WAS tagged for this protocol hides a
    // declaration — it is not the same fact as "no fence declared one".
    if (unterminated && firstWord(unterminated.tag) === GRAPH_PROTOCOL) {
      return {
        ok: false,
        error: `a \`${GRAPH_PROTOCOL}\` fence opened at body line ${unterminated.line} is never closed — its declaration cannot be read.`,
      };
    }

    // D6 row 4, the half that was never wired (#723). The splitter records every
    // delimiter-shaped line it deliberately refused; `skipped` is that channel,
    // and until now nothing read it. A blockquoted, four-space-indented or
    // HTML-commented graph fence is CONTENT by CommonMark — correctly so — but a
    // reader that answers `null` about it is saying "nobody declared a graph"
    // when it means "one is there and I would not read it".
    //
    // It shipped half-built because task 2.2 was checked against the half that
    // existed: PR #720 landed the selector, `skipped` arrived with PR #722, and
    // D0 sequenced them in that order on purpose. Nothing came back.
    const hiddenBySkip = skipped.find(s => firstWord(s.tag) === GRAPH_PROTOCOL);
    if (hiddenBySkip) {
      return {
        ok: false,
        error: `a \`${GRAPH_PROTOCOL}\` fence at body line ${hiddenBySkip.line} is inside ${REFUSAL_REASON[hiddenBySkip.reason] ?? hiddenBySkip.reason}, so it is content and its declaration cannot be read.`,
      };
    }

    // D6 row 4, second half (#710 finding 1). A runaway fence of ANOTHER tag
    // consumes everything below it, so a well-formed graph fence inside that
    // region never becomes a block at all — and `unterminated.tag` names the
    // foreign fence, not this protocol, which is why the branch above misses it.
    //
    // Keyed on POSITION, not on the protocol appearing anywhere in the body: a
    // mention above the runaway fence is not hidden by it, and widening this to
    // "the string is present" would turn every issue that merely discusses the
    // protocol into an unreadable block — trading a silent omission for a
    // fabricated defect, the exact trade ADR-0032 exists to refuse.
    // A runaway fence reaches the reader in THREE shapes, measured — and only the
    // last two leave `unterminated` set, which is why one detection is not enough:
    //
    //   ```console … ```brain-graph/1 … ```   the graph block's OWN closer closes
    //                                          the foreign fence → one `console`
    //                                          block, `unterminated: null`, the
    //                                          declaration sitting in its content
    //   ```console … ```brain-graph/1         nothing closes it → `unterminated`,
    //   ~~~console … ```brain-graph/1         `blocks: []`, content never exposed
    //
    // Shape 1 is the common one in practice, because an author who forgets a
    // closer usually has a well-formed block below to donate one.
    for (const b of blocks) {
      const at = b.content.split(/\r?\n/).findIndex(l => GRAPH_FENCE_OPENER.test(l));
      if (at === -1) continue;
      return {
        ok: false,
        error: `a \`${b.tag || 'plain'}\` fence opened at body line ${b.line} swallowed the \`${GRAPH_PROTOCOL}\` fence at body line ${b.line + 1 + at} as its content — the declaration cannot be read. Close the \`${b.tag || 'plain'}\` block above it.`,
      };
    }
    if (unterminated) {
      const after = body.split(/\r?\n/).slice(unterminated.line);
      const at = after.findIndex(l => GRAPH_FENCE_OPENER.test(l));
      if (at !== -1) {
        return {
          ok: false,
          error: `a \`${unterminated.tag || 'plain'}\` fence opened at body line ${unterminated.line} is never closed, so the \`${GRAPH_PROTOCOL}\` fence at body line ${unterminated.line + at + 1} is swallowed as its content and cannot be read.`,
        };
      }
    }
    // D7: the pre-#709 shape (```yaml + an interior `protocol:` scalar) is
    // refused out loud, not read as absent — this is the entire migration net.
    const legacy = blocks.find(b => scalar(b.content, 'protocol') === GRAPH_PROTOCOL);
    if (legacy) {
      return {
        ok: false,
        error: `the declaration is the fence tag since #709, not a \`protocol:\` scalar — retag the block at body line ${legacy.line} as \`\`\`${GRAPH_PROTOCOL}\`.`,
      };
    }
    return null;
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
