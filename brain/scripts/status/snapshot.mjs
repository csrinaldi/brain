// snapshot.mjs — the Brain UI read model: one object, computed on every call
// from the tree and the forge (#879, slice 2 of #878).
//
// RULE ZERO (#878): every fact the UI shows is reconstructible from the
// repository plus the tickets. So every row here names its source — a `path`,
// a `file`, a PR number, an issue number — and nothing here is ever written:
// no cache, no store, no file. A snapshot that persisted would be the second
// source of truth the epic forbids.
//
// SINGLE ACCESSOR RULE (RFC §2.1): this module IMPORTS brain's pure functions —
// `buildGraph`, the `sdd-layout` accessors, `deriveTasks`, `parseVerdict`,
// `readRecords`, `releaseDebt` — and the two readers this slice adds. It parses
// no CLI stdout and invents no path.
//
// EVERY SECTION SAYS WHETHER IT COULD BE READ. `{ok: true, value}` or
// `{ok: false, reason}`, built with `report.mjs`'s `field`/`uncomputable`, the
// vocabulary `brain:status` prints. A section never collapses "could not read"
// into `[]`: a missing records dir is a reason, not an empty list
// (`brain/core/anti-patterns/evidence-reader-empty-on-failure.md`).
//
// PURE CORE, INJECTED EDGES. `buildSnapshot` reads through seams; the
// derivations below it take facts. The verb (`snapshot-cli.mjs`) prints what
// this returns and adds nothing.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { field, uncomputable } from './report.mjs';
import { deriveTasks } from './derive.mjs';
import { buildGraph } from './epic-graph.mjs';
import { gatherReleaseFacts, releaseDebt } from './release-debt.mjs';
import { readAdrIndex, homeAdrList, adrDrift } from './adr-index.mjs';
import { readAntiPatterns } from './anti-patterns.mjs';
import { CHANGES_ROOT, changeDir, parseChangeId, isGrandfathered, missingRequiredArtifacts, parseSliceScopes } from '../lib/sdd-layout.mjs';
import { requiredArtifactsFor, resolveTier } from '../vcs/governance-tiers.mjs';
import { parseVerdict } from '../review/lib/parse-verdict.mjs';
import { readRecords, recordFilename } from '../memory/lib/store.mjs';
import { ISSUE_BRANCH_RE } from '../memory/lib/capture-provenance.mjs';

export const SNAPSHOT_TIER = 'committed';
export const RECORDS_DIR = '.memory/records';
export const HOME_PATH = 'brain/HOME.md';

export const PLANNED = 'planned';
export const IN_FLIGHT = 'in-flight';
export const DONE = 'done';

// ── derivations: facts in, rows out ─────────────────────────────────────────

/** The issue a PR head branch names under the one grammar `brain:ticket:start` writes, or `null`. */
export function issueOfBranch(headBranch) {
  const m = typeof headBranch === 'string' ? headBranch.match(ISSUE_BRANCH_RE) : null;
  return m ? Number(m[1]) : null;
}

/**
 * roadmapState() — `planned | in-flight | done` for one graph node (R879-5).
 *
 * `done` is the ticket's state and needs no PR. `in-flight` needs an open PR
 * naming the issue. `planned` is the ABSENCE of such a PR, which is only a
 * fact when the list was read: with `prs` unreadable an open node is
 * uncomputable, never "planned".
 *
 * @param {{number:number,state:string}} node
 * @param {{ok:boolean,value?:Array<{number:number,headBranch:string}>,reason?:string}} prs
 * @param {{ok:boolean,value?:Array<{pr:number,ok:boolean,latest?:object|null}>}} reviews
 */
export function roadmapState(node, prs, reviews) {
  if (node.state !== 'open') return field({ state: DONE, evidence: { issueState: node.state } });
  if (!prs.ok) return uncomputable(`the PR list could not be read (${prs.reason}), so "planned" cannot be asserted`);
  const mine = prs.value.filter((p) => issueOfBranch(p.headBranch) === node.number);
  if (mine.length === 0) return field({ state: PLANNED, evidence: { prs: [] } });
  const latest = reviews.ok
    ? reviews.value.filter((r) => r.ok && mine.some((p) => p.number === r.pr)).map((r) => r.latest).filter(Boolean).at(-1) ?? null
    : null;
  return field({
    state: IN_FLIGHT,
    evidence: { prs: mine.map((p) => p.number), verdict: latest ? { pr: latest.pr, rev: latest.rev, verdict: latest.verdict } : null },
  });
}

/**
 * aggregateActors() — one row per `actor` over records, humans and agents in
 * one shape (R879-6). Sorted by actor; `byType` keys sorted too, so two runs
 * on one store are byte-identical.
 */
export function aggregateActors(records = []) {
  const rows = new Map();
  for (const r of records) {
    const actor = typeof r.actor === 'string' ? r.actor : '(no actor)';
    const row = rows.get(actor) ?? { actor, actorKind: r.actorKind ?? null, records: 0, byType: {}, first: null, last: null };
    row.records += 1;
    const type = typeof r.type === 'string' ? r.type : '(no type)';
    row.byType[type] = (row.byType[type] ?? 0) + 1;
    if (typeof r.ts === 'string') {
      if (row.first === null || r.ts < row.first) row.first = r.ts;
      if (row.last === null || r.ts > row.last) row.last = r.ts;
    }
    rows.set(actor, row);
  }
  return [...rows.values()]
    .map((row) => ({ ...row, byType: Object.fromEntries(Object.entries(row.byType).sort(([a], [b]) => a.localeCompare(b))) }))
    .sort((a, b) => a.actor.localeCompare(b.actor));
}

/**
 * projectRecord() — a record's index metadata plus the file it lives in (D3).
 * `content` stays in the file; `file` is the pointer. A record whose id or ts
 * cannot name a file is kept with `file: null` rather than dropped.
 */
export function projectRecord(r) {
  let file;
  try { file = `${RECORDS_DIR}/${recordFilename(r)}`; } catch { file = null; }
  const row = { id: r.id ?? null, ts: r.ts ?? null, actor: r.actor ?? null, actorKind: r.actorKind ?? null, type: r.type ?? null };
  if (r.issue !== undefined) row.issue = r.issue;
  if (r.supersedes !== undefined) row.supersedes = r.supersedes;
  if (typeof r.title === 'string') row.title = r.title;
  row.file = file;
  return row;
}

/** The verdicts a PR thread carries, oldest first, plus the latest one. */
export function reviewRows(prNumber, reviews) {
  const verdicts = [];
  for (const rv of reviews) {
    const v = parseVerdict({ body: rv?.body, author: rv?.author ?? null });
    if (!v) continue;
    verdicts.push({
      pr: prNumber, head_sha: v.head_sha, rev: v.rev, verdict: v.verdict, author: v.author,
      findings: Array.isArray(v.findings) ? v.findings.length : null,
      malformed: v.malformed ?? [],
    });
  }
  return { pr: prNumber, ok: true, verdicts, latest: verdicts.at(-1) ?? null };
}

// ── readers: the edges, each degrading on its own ───────────────────────────

/** Every non-archived change dir, read through the layout accessor (R879-8). */
export function readChanges({ root, tier, _read, _list, _exists } = {}) {
  const read = _read ?? ((p) => readFileSync(join(root, p), 'utf8'));
  const list = _list ?? ((p) => readdirSync(join(root, p)));
  const exists = _exists ?? ((p) => existsSync(join(root, p)));
  let names;
  try {
    names = list(CHANGES_ROOT).filter((n) => parseChangeId(n) !== null).sort();
  } catch (err) {
    return uncomputable(`${CHANGES_ROOT} could not be listed: ${err?.message ?? err}`);
  }
  let artefacts = null;
  try { artefacts = requiredArtifactsFor(tier); } catch (err) { artefacts = { reason: err.message }; }

  const value = names.map((id) => {
    const { iid, slug } = parseChangeId(id);
    const dir = changeDir(id);
    let tasksText = null;
    try { tasksText = read(`${dir}/tasks.md`); } catch { tasksText = null; }
    const tasks = deriveTasks({ tasksText, reason: `${dir}/tasks.md could not be read` });
    const scopes = parseSliceScopes(tasksText ?? '');
    return {
      id, issue: Number(iid), slug, dir,
      grandfathered: isGrandfathered(id),
      missing: Array.isArray(artefacts)
        ? field(missingRequiredArtifacts(id, { artefacts, exists, listDir: list }))
        : uncomputable(`the required artefact set could not be resolved: ${artefacts.reason}`),
      tasks: Object.fromEntries(tasks.fields),
      sliceScopes: scopes.refusal ? uncomputable(scopes.refusal) : field(scopes.scopes),
    };
  });
  return field(value);
}

/** Records, projected (D3), with the duplicate accounting the store reports. */
export function readRecordRows({ root, _exists } = {}) {
  const exists = _exists ?? ((p) => existsSync(join(root, p)));
  if (!exists(RECORDS_DIR)) return uncomputable(`${RECORDS_DIR} is absent`);
  const { records, duplicates } = readRecords({ recordsDir: join(root, RECORDS_DIR) });
  return field({ records: records.map(projectRecord), duplicates });
}

async function readForge({ vcs, project }) {
  const noPort = !vcs ? 'no VCS port was supplied' : !project ? 'no project could be resolved for the forge read' : null;
  if (noPort) return { graph: uncomputable(noPort), prs: uncomputable(noPort), reviews: uncomputable(noPort) };

  let graph;
  try {
    const listed = await vcs.issueList({ project, state: 'open' });
    const issues = [];
    for (const i of listed) {
      let full;
      try { full = await vcs.issueView({ project, number: i.number }); } catch { full = { body: '', assignees: null }; }
      issues.push({ number: i.number, title: i.title, labels: i.labels ?? [], state: 'open', body: full?.body ?? '', assignees: i.assignees ?? full?.assignees ?? null });
    }
    const g = buildGraph(issues);
    // `tracks` is a Map, which JSON drops to `{}`; the verb and the module must
    // print one shape, so it is a sorted object of member numbers here.
    graph = field({ ...g, tracks: Object.fromEntries([...g.tracks].sort(([a], [b]) => a.localeCompare(b)).map(([k, ms]) => [k, ms.map((n) => n.number)])) });
  } catch (err) {
    graph = uncomputable(`the issue list could not be read: ${err?.message ?? err}`);
  }

  let prs;
  try {
    const listed = await vcs.mrList({ project, state: 'open' });
    prs = field(listed.map((p) => ({ number: p.number, title: p.title, headBranch: p.headBranch ?? null, issue: issueOfBranch(p.headBranch) })));
  } catch (err) {
    prs = uncomputable(`the PR list could not be read: ${err?.message ?? err}`);
  }

  let reviews;
  if (!prs.ok) {
    reviews = uncomputable(`no PR list to read threads for (${prs.reason})`);
  } else {
    const rows = [];
    for (const p of prs.value) {
      try {
        const list = await vcs.prReviews({ project, number: p.number });
        rows.push(Array.isArray(list) ? reviewRows(p.number, list) : { pr: p.number, ok: false, reason: 'the forge returned no reviews list' });
      } catch (err) {
        rows.push({ pr: p.number, ok: false, reason: err?.message ?? String(err) });
      }
    }
    reviews = field(rows);
  }
  return { graph, prs, reviews };
}

// ── the composition ─────────────────────────────────────────────────────────

/**
 * buildSnapshot() — the one shape every consumer reads (R879-1).
 *
 * @param {{root?: string, now?: string|Date, vcs?: object|null, project?: string|null,
 *   _read?: Function, _list?: Function, _exists?: Function, _run?: Function}} opts
 */
export async function buildSnapshot({ root = process.cwd(), now, vcs = null, project = null, _read, _list, _exists, _run } = {}) {
  const read = _read ?? ((p) => readFileSync(join(root, p), 'utf8'));
  const list = _list ?? ((p) => readdirSync(join(root, p)));
  const exists = _exists ?? ((p) => existsSync(join(root, p)));
  // stderr is swallowed on purpose: `git describe` on an untagged clone prints
  // "fatal: No names found" and the fact is already carried in band as
  // `tag: null`. A JSON verb must not interleave git chatter with its output.
  const run = _run ?? ((file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  const generatedAt = (now instanceof Date ? now : new Date(now ?? Date.now())).toISOString();

  let tier;
  try { tier = resolveTier(JSON.parse(read('brain.config.json'))); } catch (err) { tier = { reason: `brain.config.json: ${err?.message ?? err}` }; }

  const adrs = readAdrIndex({ root, _read: read, _list: list });
  let home = null;
  let homeReason = null;
  try { home = homeAdrList(read(HOME_PATH)); } catch (err) { homeReason = `${HOME_PATH} could not be read: ${err?.message ?? err}`; }
  const drift = !adrs.ok ? uncomputable(adrs.reason) : homeReason ? uncomputable(homeReason) : field(adrDrift(adrs.value, home));

  const records = readRecordRows({ root, _exists: exists });
  const actors = records.ok ? field(aggregateActors(records.value.records)) : uncomputable(records.reason);

  const forge = await readForge({ vcs, project });
  const graph = forge.graph.ok
    ? field({ ...forge.graph.value, nodes: forge.graph.value.nodes.map((n) => ({ ...n, roadmap: roadmapState(n, forge.prs, forge.reviews) })) })
    : forge.graph;

  return {
    generatedAt,
    tier: SNAPSHOT_TIER,
    governanceTier: typeof tier === 'string' ? field(tier) : uncomputable(tier.reason),
    graph,
    changes: readChanges({ root, tier: typeof tier === 'string' ? tier : null, _read: read, _list: list, _exists: exists }),
    prs: forge.prs,
    reviews: forge.reviews,
    records,
    adrs,
    antiPatterns: readAntiPatterns({ root, _read: read, _list: list }),
    actors,
    releaseDebt: field(releaseDebt(gatherReleaseFacts({ root, _run: run, _read: read }))),
    drift,
  };
}

// ── text mode: the same object, for a terminal ──────────────────────────────

/** @returns {string} one screen over the snapshot; every section prints its count or its reason. */
export function renderSnapshotText(s) {
  const line = (name, sec, count) => (sec.ok ? `${name.padEnd(14)} ${count(sec.value)}` : `${name.padEnd(14)} not computed — ${sec.reason}`);
  const out = [
    `brain snapshot · ${s.generatedAt} · tier ${s.tier}`,
    line('graph', s.graph, (g) => `${g.nodes.length} node(s), ${g.edges.length} edge(s)`),
    line('changes', s.changes, (c) => `${c.length} change dir(s)`),
    line('prs', s.prs, (p) => `${p.length} open`),
    line('reviews', s.reviews, (r) => `${r.filter((x) => x.ok).length} thread(s) read, ${r.filter((x) => !x.ok).length} unreadable`),
    line('records', s.records, (r) => `${r.records.length} record(s), ${r.duplicates.ids} duplicated id(s)`),
    line('adrs', s.adrs, (a) => `${a.filter((x) => x.ok).length} parsed, ${a.filter((x) => !x.ok).length} unreadable`),
    line('anti-patterns', s.antiPatterns, (a) => `${a.entries.length} entr${a.entries.length === 1 ? 'y' : 'ies'}${a.unlistable.length ? `, ${a.unlistable.length} dir(s) unlistable` : ''}`),
    line('actors', s.actors, (a) => `${a.length} actor(s)`),
    line('release debt', s.releaseDebt, (d) => d.severity),
  ];
  if (s.drift.ok) {
    const d = s.drift.value;
    const n = d.homeOnly.length + d.filesOnly.length + d.unreadable.length;
    if (n === 0) out.push('adr drift      none — HOME.md and the parser agree');
    else {
      out.push(`⚠ adr drift — ${n} disagreement(s) between brain/HOME.md and the parser (reported, never a gate):`);
      for (const h of d.homeOnly) out.push(`    listed in HOME.md, not readable: ADR-${String(h.number).padStart(4, '0')} ${h.path ?? ''}`.trimEnd());
      for (const f of d.filesOnly) out.push(`    on disk, not listed in HOME.md: ADR-${String(f.number).padStart(4, '0')} ${f.path}`);
      for (const u of d.unreadable) out.push(`    unreadable: ${u.path} — ${u.reason}`);
    }
  } else {
    out.push(`adr drift      not computed — ${s.drift.reason}`);
  }
  return out.join('\n');
}
