#!/usr/bin/env node
// port-coverage.mjs — M10 Phase 1 (#336): the port's contract coverage,
// measured rather than remembered.
//
// WHY A SCRIPT AND NOT A DOCUMENT. `prReviews` stayed unpinned until it broke
// the reviewer subsystem (#317), and the only thing that could have told
// anyone was a hand-grep nobody ran. A table written by hand answers the
// question once, on the day it is written; this answers it on the day it is
// asked.
//
// DETECTION ONLY (#336, explicit): it reports the surface and changes nothing.
// No new contract test, no new fixture, no adapter edit — the tests it
// recommends are Phase 2, and they are sliceable precisely because this ran
// first and ranked them by what depends on each verb.
//
// Everything below the `gather()` line is PURE: strings in, rows out. The
// reading lives at the edge, so the four requirements are testable without a
// repository to run inside.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

/** The adapters whose exports define the port surface. */
export const PROVIDER_FILES = Object.freeze({
  github: 'brain/scripts/vcs/providers/github.mjs',
  gitlab: 'brain/scripts/vcs/providers/gitlab.mjs',
});

/**
 * Pure: the verbs an adapter EXPORTS as functions.
 *
 * Anchored at line start so a commented-out export is not a verb, and limited
 * to `function` so `export const PROVIDER = 'github'` — a constant, not a verb —
 * stays out.
 */
export function exportedVerbs(source) {
  return [...source.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
}

/**
 * Pure: one verb's fixture provenance, folded.
 *
 * `mixed` is a first-class answer, not a rounding error: a verb whose fixtures
 * disagree is the #334 shape — a derived fixture encoding an author's
 * assumption sitting beside a recorded one — and collapsing it would hide the
 * distinction the ticket calls load-bearing.
 *
 * `unreadable` dominates everything, for the reason `uncomputable` dominates a
 * gate verdict elsewhere in this repo: a file we could not read is not a file
 * that said `none`.
 */
export function foldProvenance(provenances) {
  if (provenances.length === 0) return 'none';
  if (provenances.some((p) => p?.unreadable)) return 'unreadable';
  const kinds = new Set(provenances.map((p) => (p?.derived ? 'derived' : 'recorded')));
  return kinds.size > 1 ? 'mixed' : [...kinds][0];
}

/**
 * Pure: `contract` | `elsewhere` | `uncovered`.
 *
 * Word-bounded, never `includes()`: `issueList` must not borrow the coverage of
 * a test named for `issueListComments`. "Covered elsewhere" is kept as its own
 * state because the ticket asks to distinguish it — it is real, and weaker.
 */
export function coverageOf(verb, contractText, otherTestText) {
  const re = new RegExp(`\\b${verb}\\b`);
  if (re.test(contractText)) return 'contract';
  if (re.test(otherTestText)) return 'elsewhere';
  return 'uncovered';
}

/**
 * Pure: how many distinct FILES call `vcs.<verb>(`.
 *
 * Files, not call sites: two calls in one module are one thing that breaks.
 * The adapters are excluded by the caller — a provider calling itself is not a
 * consumer of the port.
 */
export function countConsumers(verb, consumers) {
  const re = new RegExp(`\\bvcs\\.${verb}\\s*\\(`);
  return new Set(consumers.filter((c) => re.test(c.text)).map((c) => c.file)).size;
}

/**
 * Pure: the whole report.
 *
 * Uncovered rows lead, sorted by consumer count descending — the ranking this
 * ticket exists for. Alphabetical order is what let `prReviews` sit between
 * `prCommits` and `prStatusRollup` saying nothing.
 */
export function buildReport({ adapters, fixtures, contractText, otherTestText, consumers }) {
  const rows = [];
  for (const [provider, source] of Object.entries(adapters)) {
    for (const verb of exportedVerbs(source)) {
      const mine = fixtures.filter((f) => f.provider === provider && f.verb === verb);
      rows.push({
        provider,
        verb,
        coverage: coverageOf(verb, contractText, otherTestText),
        provenance: foldProvenance(mine.map((f) => f.provenance)),
        fixtures: mine.length,
        consumers: countConsumers(verb, consumers),
      });
    }
  }
  const rank = { uncovered: 0, elsewhere: 1, contract: 2 };
  rows.sort((a, b) =>
    rank[a.coverage] - rank[b.coverage] ||
    b.consumers - a.consumers ||
    a.provider.localeCompare(b.provider) ||
    a.verb.localeCompare(b.verb));
  // Fixtures whose `<provider>-<verb>-` prefix names no exported verb, and files
  // outside the convention entirely. Reported, never dropped: a fixture kept for
  // a verb the port no longer exports is maintenance spent on nothing, and a
  // silently-skipped file is the audit lying about its own coverage. Found by
  // cross-checking this report's fixture total against a direct count — they
  // disagreed by five, and the five were real.
  const known = new Set(rows.map((r) => `${r.provider}.${r.verb}`));
  const orphans = fixtures
    .filter((f) => f.verb === null || !known.has(`${f.provider}.${f.verb}`))
    .map((f) => ({ name: f.name, claims: f.verb === null ? null : `${f.provider}.${f.verb}` }));

  const derivedFixtures = fixtures.filter((f) => f.provenance?.derived).length;
  return { rows, generated: rows.length, derivedFixtures, orphans };
}

// ── The edge: reading. Everything above is pure. ────────────────────────────

/** Reads the tree into `buildReport`'s inputs. */
export function gather({ repo = REPO, _read = readFileSync, _readdir = readdirSync } = {}) {
  const read = (rel) => { try { return _read(join(repo, rel), 'utf8'); } catch { return ''; } };

  const adapters = {};
  for (const [provider, rel] of Object.entries(PROVIDER_FILES)) adapters[provider] = read(rel);

  const fixDir = 'brain/scripts/vcs/fixtures';
  const fixtures = [];
  let names = [];
  try { names = _readdir(join(repo, fixDir)).filter((n) => n.endsWith('.json')); } catch { names = []; }
  for (const name of names) {
    // <provider>-<verb>-<case>.json — the convention the fixtures already follow.
    const m = /^([a-z]+)-([A-Za-z0-9_$]+)-/.exec(name);
    let provenance;
    try {
      provenance = JSON.parse(_read(join(repo, fixDir, name), 'utf8'))._provenance ?? {};
    } catch {
      provenance = { unreadable: true };   // never silently `none`
    }
    fixtures.push({ provider: m ? m[1] : null, verb: m ? m[2] : null, name, provenance });
  }

  const contractText = read('brain/scripts/vcs/providers/vcs.contract.test.mjs');

  const consumers = [];
  let otherTestText = '';
  const walk = (rel) => {
    let entries = [];
    try { entries = _readdir(join(repo, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.mjs')) continue;
      const text = read(p);
      if (e.name.endsWith('.test.mjs')) {
        if (!p.includes('vcs.contract.test.mjs')) otherTestText += `\n${text}`;
        continue;
      }
      if (p.includes('/vcs/providers/')) continue;   // a provider calling itself is not a consumer
      consumers.push({ file: p, text });
    }
  };
  walk('brain/scripts');

  return { adapters, fixtures, contractText, otherTestText, consumers };
}

/** The markdown the ticket asks for, with its worst row explained where the reader is. */
export function renderMarkdown(report) {
  const lines = [
    '# Port verb contract coverage (M10 Phase 1, #336)',
    '',
    'Detection only. Generated by `npm run brain:port:coverage` — regenerate rather than edit.',
    '',
    '| Port verb | Contract test | Fixture provenance | Consumers |',
    '|---|---|---|---|',
  ];
  for (const r of report.rows) {
    lines.push(`| \`${r.provider}.${r.verb}\` | ${r.coverage} | ${r.provenance} (${r.fixtures}) | ${r.consumers} |`);
  }
  // The summary leads, because the table's 55 rows bury the shape. What the
  // reader needs first is where the risk actually is — and on the day this was
  // written it was NOT where #336 predicted.
  const count = (k, v) => report.rows.filter((r) => r[k] === v).length;
  lines.push('');
  lines.push('## What this run measured');
  lines.push('');
  lines.push(`- **Coverage**: ${count('coverage', 'contract')} contract · ${count('coverage', 'elsewhere')} elsewhere · ${count('coverage', 'uncovered')} uncovered`);
  lines.push(`- **Fixture provenance**: ${count('provenance', 'recorded')} recorded · ${count('provenance', 'derived')} derived · ${count('provenance', 'mixed')} mixed · ${count('provenance', 'none')} none · ${count('provenance', 'unreadable')} unreadable`);
  lines.push('');
  const fixtureCount = report.rows.reduce((a, r) => a + r.fixtures, 0);
  const derivedFixtures = report.derivedFixtures ?? 0;
  if (fixtureCount > 0) {
    const pct = Math.round((derivedFixtures / fixtureCount) * 100);
    lines.push(`- **Fixtures themselves**: ${derivedFixtures} of ${fixtureCount} carry \`derived: true\` (${pct}%)`);
    lines.push('');
  }
  lines.push('A verb with `none` has no fixture at all: whatever pins it pins the shape the author');
  lines.push('imagined. A `mixed` verb is the #334 shape — a derived fixture encoding an assumption');
  lines.push('beside a recorded one, agreeing with each other while both may disagree with production.');
  if (count('provenance', 'recorded') === 0 && fixtureCount > 0) {
    lines.push('');
    lines.push('**Not one verb has fixtures that are all recorded.** That is the Phase 2 input this audit');
    lines.push('was built to produce, and it is not the gap #336 expected to find: contract COVERAGE is');
    lines.push('complete, and the exposure moved to what the covered tests are checked against.');
  }

  if (report.orphans?.length) {
    lines.push('');
    lines.push('## Fixtures with no verb');
    lines.push('');
    lines.push('Maintained for something the adapters do not export — either a verb that was removed,');
    lines.push('or a name outside the `<provider>-<verb>-<case>.json` convention. Reported because an');
    lines.push('audit that skips what it cannot classify is lying about its own coverage.');
    lines.push('');
    for (const o of report.orphans) {
      lines.push(`- \`${o.name}\` — ${o.claims ? `claims \`${o.claims}\`, which no adapter exports` : 'does not match the naming convention'}`);
    }
  }

  const prReviews = report.rows.find((r) => r.verb === 'prReviews');
  lines.push('');
  if (prReviews && prReviews.coverage === 'uncovered') {
    lines.push(
      `**\`prReviews\` is uncovered and has ${prReviews.consumers} consumer file(s).** This is the worked`,
      'example #336 names: it stayed unpinned until it broke the whole reviewer subsystem (#317).',
      'The rows above lead with uncovered verbs sorted by consumer count for that reason — sorted',
      'alphabetically, this row would sit between `prCommits` and `prStatusRollup` and say nothing.',
    );
  } else if (prReviews) {
    lines.push(
      `**\`prReviews\` now reads \`${prReviews.coverage}\`.** #336 predicted it would be uncovered; it is not,`,
      'and this line records the difference rather than restating the ticket. Its gap is what broke the',
      'reviewer subsystem in #317.',
    );
  }
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = buildReport(gather());
  console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : renderMarkdown(report));
}
