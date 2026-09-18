// views-owned.test.mjs — R998-2's absence proof, replacing
// no-management-views.test.mjs (#998 PR 2).
//
// That file's name and its `\bnav\b` prohibition described a page with no
// nav: #881 PR 4 drew one canvas and a four-tab drawer, nothing else. #998
// PR 2 adds a real `<nav id="modes">` with four mode buttons, so a
// prohibition on the word "nav" would now fail on the page's own, intended
// markup — the claim it protected ("we did not build the management views
// of #882") still holds, but the ABSENCE it needs to enumerate has grown:
// this PR owns four modes, not one canvas. Same rule (#881's evidence-reader
// discipline: "we built exactly this, and named what we didn't"), rewritten
// for the surface this PR actually draws.
//
// Test-only; no production code belongs to this task.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TAB_IDS } from '../lib/drawer-model.mjs';
import { MODE_IDS, PLACEHOLDERS } from '../lib/view-model.mjs';

const STATIC_DIR = dirname(fileURLToPath(import.meta.url));
const APP_JS = readFileSync(join(STATIC_DIR, 'app.js'), 'utf8');
const INDEX_HTML = readFileSync(join(STATIC_DIR, 'index.html'), 'utf8');

/** Every endpoint the page can reach, quoted literally in `app.js`. */
function endpoints(text) {
  const found = [];
  for (const m of text.matchAll(/(?:fetch|new EventSource)\(\s*([`'"])([^`'"]*)\1/g)) found.push(m[2]);
  return [...new Set(found)].sort();
}

test('#998 R998-2: the page reaches exactly the endpoints this slice owns — no management view, no MCP, no pulse', () => {
  assert.deepEqual(endpoints(APP_JS), [
    '/api/change/${issue}',
    '/api/poll/${action}',
    '/api/snapshot',
    '/api/stream',
  ]);
});

test('#998 R998-6: the drawer now has six tabs, in the design\'s order', () => {
  assert.deepEqual(TAB_IDS, ['spec', 'sdd', 'tasks', 'workingMemory', 'reviews', 'records']);
});

test('#998 R998-2/R998-4/R998-5/#882 R882-1: this PR owns exactly four modes; map, sdd, reviews and governance all have real content — governance mounts its own sub-nav and sub-router from #882 PR 1 on', () => {
  assert.deepEqual(MODE_IDS, ['map', 'sdd', 'reviews', 'governance']);
  for (const mode of ['map', 'sdd', 'reviews', 'governance']) assert.equal(PLACEHOLDERS[mode], null, `mode "${mode}" has real content, not a placeholder`);
});

test('#882 R882-1/R882-2: the governance surface exists — the sub-nav is mounted, Roadmap draws real content', () => {
  assert.match(INDEX_HTML, /<nav id="governance-nav"/, 'R882-1: the governance sub-nav mount must exist');
  assert.match(APP_JS, /function renderRoadmap\(/, 'R882-2: Roadmap must render real content, not a placeholder');
  assert.match(APP_JS, /GOVERNANCE_PLACEHOLDERS\[/, 'the four sub-views not yet built must still say their own placeholder, never an empty area');
});

test('#882 cold review of PR 1 (blocker): a roadmap row applies the same sourceStamp helper the door uses — R882-1\'s row() is not a dead export', () => {
  const fnMatch = APP_JS.match(/function renderRoadmapRow\([^)]*\) \{[\s\S]*?\n}\n/);
  assert.ok(fnMatch, 'renderRoadmapRow function must exist in app.js');
  assert.match(fnMatch[0], /renderSourceStamp\(row\.sourceStamp\)/, 'renderRoadmapRow must render row.sourceStamp through renderSourceStamp, never a bare #N with no stamp and no link');
});

test('#882 cold review of PR #1037 (correction 1): a roadmap row says its own stateReason when the state could not be read — the model\'s said value is not silently dropped on screen', () => {
  const fnMatch = APP_JS.match(/function renderRoadmapRow\([^)]*\) \{[\s\S]*?\n}\n/);
  assert.ok(fnMatch, 'renderRoadmapRow function must exist in app.js');
  assert.match(fnMatch[0], /row\.stateReason/, 'renderRoadmapRow must read row.stateReason, so roadmap-model.mjs\'s said reason for an unknown state actually reaches the screen');
});

test('#882: this PR does not draw them yet — decisions, anti-patterns, history and by-actor identifiers still do not exist in the page', () => {
  for (const [name, text] of [['app.js', APP_JS], ['index.html', INDEX_HTML]]) {
    for (const forbidden of [/\bdecisionsview\b/i, /\badrs?\b/i, /anti-?pattern/i, /\bby-?actor\b/i, /\bhistoryview\b/i]) {
      assert.ok(!forbidden.test(text), `${name} matched ${forbidden} — those views are #882's later PRs, not PR 1's`);
    }
  }
});

test('#998 R998-2: nav, modes and Governance are allowed labels — this PR draws them on purpose', () => {
  assert.match(INDEX_HTML, /<nav id="modes"/, 'the modes nav must exist: R998-2 adds it');
});

test('#881 R881-10 S1: nothing on the page reads a worktree path — the committed tier is the only tier this slice knows', () => {
  for (const endpoint of endpoints(APP_JS)) {
    assert.ok(!/worktree|uncommitted|working-tree/i.test(endpoint), `the page reaches "${endpoint}"`);
  }
  assert.ok(!/file:\/\//.test(APP_JS), 'the page reads nothing from the filesystem directly');
});

test('#998 R998-2/#882 R882-1: the shell mounts exactly six regions — status, modes, banners, governance-nav, canvas, drawer', () => {
  const ids = [...INDEX_HTML.matchAll(/id="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(ids, ['banners', 'canvas', 'drawer', 'governance-nav', 'modes', 'status']);
});

test('#998 R998-5: a finding\'s own source goes through the same sourceStamp helper the door uses, never a second copy of that logic', () => {
  assert.match(APP_JS, /renderSourceStamp\(sourceStamp\(f\.source\)\)/, 'renderReviewRound must apply sourceStamp to each finding\'s own source (file:line when present)');
});

test('#1009 cold review finding 1: renderReviewRound checks round.malformed before the empty-findings case, so a malformed round is never rendered as "no findings"', () => {
  const fnMatch = APP_JS.match(/function renderReviewRound\([^)]*\) \{[\s\S]*?\n}\n/);
  assert.ok(fnMatch, 'renderReviewRound function must exist in app.js');
  const body = fnMatch[0];
  const malformedIdx = body.indexOf('round.malformed');
  const emptyIdx = body.indexOf('round.findings.length === 0');
  assert.ok(malformedIdx !== -1, 'renderReviewRound must check round.malformed');
  assert.ok(emptyIdx !== -1, 'renderReviewRound must still check the empty-findings case');
  assert.ok(malformedIdx < emptyIdx, 'the malformed check must come before the empty-findings case, so a malformed round is never read as "no findings"');
});

test('#1009 cold review round 2: renderReviewRound gives a STOP verdict its own mark and the "human escalation" word, distinct from the ✓/✕ marks', () => {
  const fnMatch = APP_JS.match(/function renderReviewRound\([^)]*\) \{[\s\S]*?\n}\n/);
  assert.ok(fnMatch, 'renderReviewRound function must exist in app.js');
  const body = fnMatch[0];
  assert.match(body, /'STOP'/, 'renderReviewRound must branch on the STOP verdict literal, not fold it into the REVISE/unknown ✕ mark');
  assert.match(body, /human escalation/, 'a STOP round must say the escalation as text, not colour alone');
});

test("#1009 cold review round 3: renderReviewRound reads round.unknownVerdict, so a verdict word outside the enum never renders byte-identical to a REVISE", () => {
  const fnMatch = APP_JS.match(/function renderReviewRound\([^)]*\) \{[\s\S]*?\n}\n/);
  assert.ok(fnMatch, 'renderReviewRound function must exist in app.js');
  const body = fnMatch[0];
  // The MARK itself must branch on the flag: a scan that merely finds the
  // flag mentioned somewhere in the function passes even when the mark is
  // decided without it, which is the defect this test exists to catch.
  assert.match(body, /const mark = round\.unknownVerdict/, 'the mark must be decided by the flag review-timeline.mjs sets, not merely mention it');
  assert.match(body, /unrecognised verdict/, 'an unknown verdict word must be called out as text, not only by a mark');
});

// ── #998 R998-6: the served branch and the poll countdown ───────────────────

test('#998 R998-6 T3: the status bar names the served branch through the same sourceStamp helper the door uses', () => {
  assert.match(APP_JS, /renderServedBranch\(state\.meta\?\.servedBranch/, 'renderStatus must read servedBranch off meta, the same way it already reads poller/watcher');
  assert.match(APP_JS, /renderSourceStamp\(sourceStamp\(servedBranch\.source\)\)/, 'the served branch must carry its own source stamp, never a bare string');
});

test('#998 R998-6 T4/T6: the status bar shows the poll countdown from pollIndicator, never a second Date.now() clock read', () => {
  assert.match(APP_JS, /indicator\.countdown/, 'renderStatus must render pollIndicator\'s own countdown field');
  const dateNowCalls = [...APP_JS.matchAll(/Date\.now\(\)/g)].length;
  assert.equal(dateNowCalls, 1, 'app.js reads Date.now() exactly once (renderStatus\'s own nowMs) — every clock decision beyond that lives in lib/, driven by the injected now');
});
