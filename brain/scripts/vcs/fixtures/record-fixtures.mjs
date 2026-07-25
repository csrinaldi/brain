#!/usr/bin/env node
// record-fixtures.mjs — committed, re-runnable script that hits the real VCS
// APIs to refresh the fixture JSON files consumed by
// `../providers/vcs.contract.test.mjs` (issue #239 A3 Phase 3, REQ-A3-6).
//
// NOT run by `npm test` — the contract suite reads the already-written JSON
// files, never the network (A2/A3's no-live-network discipline). Run this
// manually to REFRESH a recorded fixture without touching the suite:
//
//   node brain/scripts/vcs/fixtures/record-fixtures.mjs github labelEvents <project> <issueNumber>
//   node brain/scripts/vcs/fixtures/record-fixtures.mjs github prView <project> <prNumber>
//
// Endpoints hit (documented per REQ-A3-6 — "documents which real endpoints it
// hits"):
//   - github labelEvents → `gh api --paginate repos/<project>/issues/<n>/events`
//   - github prView      → `gh pr view <n> --json number,labels,body,author`
//
// Deliberately NOT auto-recorded by this script, ever:
//   - github mrCreate  → `gh pr create` is a MUTATING write (creates a real PR
//     in the target repo). Recording a "happy path" response would require
//     actually opening a live pull request as a side effect of fixture
//     maintenance — refused by design. `github-mrCreate-happy.json` is
//     authored (DERIVED) from `gh pr create`'s documented stdout contract
//     (a bare URL string) instead.
//   - every `gitlab-*` fixture → this script has no live GitLab mirror to
//     reach from a CI/sandboxed environment (no `glab`/GitLab session here).
//     GitLab fixtures are authored (DERIVED) from the documented GitLab REST
//     API v4 response shapes (resource_label_events, merge_requests show,
//     merge_requests create). CP-A3b (live GitLab round-trip) is deferred to
//     the SCIT phase — see tasks.md Open Questions. When a live mirror is
//     available, extend this script with a `gitlab` case here rather than
//     hand-authoring a new "recorded" gitlab-*.json.
//
// Every fixture this script writes is stamped `_provenance: { endpoint, date,
// recorded: true }`. Fixtures this script does NOT (and by design, for
// mrCreate/gitlab, never will) produce are hand-authored elsewhere with
// `_provenance.derived: true` — recorded-vs-derived is always visible
// (lesson #12); this script only ever writes `recorded: true` fixtures.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { run, runJson } from '../lib/exec.mjs';

const FIXTURES_DIR = fileURLToPath(new URL('.', import.meta.url));

function writeFixture(name, provenance, data) {
  const payload = { _provenance: provenance, data };
  writeFileSync(`${FIXTURES_DIR}${name}`, JSON.stringify(payload, null, 2) + '\n');
  console.log(`wrote ${name} (${provenance.endpoint})`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function recordGithubLabelEvents(project, number) {
  const endpoint = `GET repos/${project}/issues/${number}/events`;
  const events = runJson('gh', ['api', '--paginate', `repos/${project}/issues/${number}/events`]);
  writeFixture(
    'github-labelEvents-happy.json',
    {
      endpoint,
      date: today(),
      recorded: true,
      note:
        'Trimmed to the fields github.mjs#labelEvents actually consumes (event, actor.login, ' +
        'label.name, created_at) via a jq-equivalent projection of the real response — values ' +
        'are unmodified from the live API, only unused per-actor GitHub metadata is dropped ' +
        'to keep the fixture reviewable.',
    },
    events.map(e => ({
      event: e.event,
      actor: e.actor ? { login: e.actor.login } : null,
      label: e.label ? { name: e.label.name } : undefined,
      created_at: e.created_at,
    })),
  );
}

async function recordGithubPrView(project, number) {
  const endpoint = `gh pr view ${number} --json number,labels,body,author (repo: ${project})`;
  const r = run('gh', ['pr', 'view', String(number), '--repo', project, '--json', 'number,labels,body,author']);
  if (!r.ok) throw new Error(`gh pr view ${number} failed: ${r.stderr}`);
  writeFixture(
    'github-prView-happy.json',
    { endpoint, date: today(), recorded: true },
    JSON.parse(r.stdout),
  );
}

const CASES = {
  labelEvents: recordGithubLabelEvents,
  prView: recordGithubPrView,
};

async function main() {
  const [provider, verb, project, number] = process.argv.slice(2);
  if (provider !== 'github' || !CASES[verb]) {
    console.error(
      'usage: node record-fixtures.mjs github <labelEvents|prView> <project> <number>\n' +
      '  (mrCreate and every gitlab-* fixture are deliberately NOT recordable by this script — see header comment)',
    );
    process.exit(1);
  }
  await CASES[verb](project, Number(number));
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch(err => {
    console.error(`record-fixtures: ${err.message}`);
    process.exit(1);
  });
}
