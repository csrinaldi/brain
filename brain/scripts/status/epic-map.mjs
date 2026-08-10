#!/usr/bin/env node
// epic-map.mjs — `brain:epic:map` (issue #459).
//
// Read-only reporting, `brain:metrics`' character (M9): zero new gates, nothing it
// emits can block a merge. The one write it performs is bounded by markers in the
// epic's body, and everything outside them is byte-identical afterwards.
//
// SLICE 1 (#533 carries slice 2). What lands: dependencies as DECLARED DATA, the graph, the mermaid block,
// the idempotent write. What does NOT: the "who is executing" half. `issueList`
// normalises assignees away and `issueView` never carried them, so surfacing them is
// a change to the port's return CONTRACT — a `decision`-labelled change with an ADR,
// by the port's own rule. Reporting an empty assignee list would be worse than
// reporting none: it reads as "nobody is on this" when the truth is "brain cannot
// see". The map says so out loud instead.
//
// Usage: npm run brain:epic:map -- <issue-number> [--dry-run]

import { fileURLToPath } from 'node:url';

import { getVcs } from '../vcs/cli.mjs';
import { originIdentity } from '../vcs/lib/repo.mjs';
import { loadBrainConfig } from '../lib/brain-config.mjs';
import { buildGraph } from './epic-graph.mjs';
import { renderMermaid, renderSummary, replaceMapRegion } from './epic-render.mjs';

/** @returns {{ok:true,number:number,dryRun:boolean}|{ok:false,error:string}} */
export function parseArgs(argv = []) {
  let number = null;
  let dryRun = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (/^\d+$/.test(a)) number = Number(a);
    else return { ok: false, error: `unknown argument: ${a}` };
  }
  if (number == null) return { ok: false, error: 'an issue number is required' };
  return { ok: true, number, dryRun };
}

/**
 * Composes the map region. Exported so a test asserts the SAME text the CLI writes.
 * @param {{nodes:Array,edges:Array,tracks:Map}} graph
 * @returns {string}
 */
export function composeMap(graph) {
  return [
    renderMermaid(graph),
    '',
    renderSummary(graph),
    '',
    '_El «quién lo ejecuta» todavía no aparece: el puerto normaliza los assignees '
    + 'afuera, y exponerlos cambia el contrato de retorno — un cambio con ADR (#533, slice 2)._',
  ].join('\n');
}

/** @returns {Promise<number>} exit code */
export async function main(argv = [], deps = {}) {
  const say = deps.say ?? console.log;
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    say(`✗ ${parsed.error}`);
    say('  Usage: npm run brain:epic:map -- <issue-number> [--dry-run]');
    return 2;
  }

  const config = deps.config ?? loadBrainConfig();
  const { project } = deps.origin ?? originIdentity();
  if (!project) { say('✗ could not resolve the project from the git remote.'); return 2; }

  const vcs = deps.vcs ?? await getVcs({ config });

  let listed;
  try {
    listed = await vcs.issueList({ project, state: 'open' });
  } catch (err) {
    // A partial read would draw a graph missing nodes and say nothing about it —
    // exactly the silence #518 records. Refuse instead.
    say(`✗ could not read the issue list: ${err.message}`);
    return 1;
  }

  // Bodies come one at a time; `issueList` does not carry them.
  const issues = [];
  for (const i of listed) {
    let full;
    try {
      full = await vcs.issueView({ project, number: i.number });
    } catch {
      // Unreadable body ⇒ undeclared, never silently dropped. It lands in the
      // "sin declarar" count, which is visible in the summary.
      full = { body: '' };
    }
    issues.push({ number: i.number, title: i.title, labels: i.labels ?? [], state: 'open', body: full.body ?? '' });
  }

  const graph = buildGraph(issues);
  const content = composeMap(graph);

  if (parsed.dryRun) {
    say(content);
    return 0;
  }

  let epic;
  try {
    epic = await vcs.issueView({ project, number: parsed.number });
  } catch (err) {
    say(`✗ could not read issue #${parsed.number}: ${err.message}`);
    return 1;
  }

  const body = replaceMapRegion(epic.body ?? '', content);
  if (body === (epic.body ?? '')) {
    say(`✓ #${parsed.number} already up to date — nothing written.`);
    return 0;
  }

  if (typeof vcs.issueUpdate !== 'function') {
    // No body-write verb exists on the port yet. Print the region rather than
    // pretending: an operator can paste it, and the map is still derived.
    say('! the port has no issue-body write verb — printing the region instead (#533, slice 2).');
    say('');
    say(content);
    return 0;
  }

  await vcs.issueUpdate({ project, number: parsed.number, body });
  say(`✓ #${parsed.number} map regenerated over ${graph.nodes.length} issues.`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => process.exit(code));
}
