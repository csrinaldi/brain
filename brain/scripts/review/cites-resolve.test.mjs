// cites-resolve.test.mjs — issue #555 round 2.
//
// A `cites:` on a `severity: blocker` finding is the reviewer's answer to "what
// doctrine forbids this". reviewer-protocol.md §6.1 makes it mandatory precisely
// so a blocker cannot be an opinion. A citation naming a symbol that does not
// exist in the file it names is therefore worse than a missing one: it reads as
// verified and sends the reader to the wrong file.
//
// This has now happened three times in one week:
//   · #580 — §2 cited `brain-writes-reviewed.mjs:99` for a mechanism at :167
//   · #586 — 14 line citations across reviewer-protocol.md, every one rotted
//   · #555 round 2 — `sdd-layout.mjs requiredArtifactsFor`, a symbol that lives
//     in governance-tiers.mjs. That one was introduced BY the commit fixing the
//     previous instance, converting a citation that was true into one that was not.
//
// Each was repaired by hand and each repair was itself unguarded. This is the
// mechanism: every `<file>.mjs <symbol>` pair a shipped `cites:` names must
// resolve. It reads the evaluator sources rather than running them, because the
// strings are template literals whose values depend on a live review.
//
// SCOPE, stated rather than implied: this checks the `file.mjs symbol` shape only.
// A `cites:` naming an ADR, a REQ id or a protocol section is not verified here —
// those have no single mechanical resolution, and a guard that pretended to check
// them would be the apparent protection this file exists to prevent (#499).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every `.mjs` under brain/scripts, indexed by basename. */
function indexModules(dir, acc = new Map()) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules' && entry !== '__fixtures__') indexModules(full, acc);
    } else if (entry.endsWith('.mjs') && !entry.includes('.test.')) {
      if (!acc.has(entry)) acc.set(entry, []);
      acc.get(entry).push(full);
    }
  }
  return acc;
}

/** Source files whose `cites:` strings ship on real findings. */
function evaluatorSources() {
  const dir = join(scriptsRoot, 'review', 'evaluators');
  return readdirSync(dir)
    .filter(f => f.endsWith('.mjs') && !f.includes('.test.'))
    .map(f => ({ name: f, path: join(dir, f), text: readFileSync(join(dir, f), 'utf8') }));
}

// `foo.mjs bar` — a module basename followed by an identifier. The identifier may
// be followed by `(`, `.`, whitespace or the end of the citation.
const FILE_SYMBOL_RE = /([A-Za-z0-9_-]+\.mjs)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;

test('#555: every `<file>.mjs <symbol>` a shipped cites: names actually resolves', () => {
  const modules = indexModules(scriptsRoot);
  const offenders = [];

  for (const src of evaluatorSources()) {
    const lines = src.text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/\bcites:/.test(line)) return;
      for (const [, file, symbol] of line.matchAll(FILE_SYMBOL_RE)) {
        const candidates = modules.get(file);
        if (!candidates) {
          offenders.push(`${src.name}:${i + 1} cites "${file}", which is not a module under brain/scripts/`);
          continue;
        }
        const defined = candidates.some((p) => {
          const body = readFileSync(p, 'utf8');
          // A definition, not a mention: the symbol declared or exported here.
          return new RegExp(
            `(export\\s+(async\\s+)?function\\s+${symbol}\\b` +
            `|export\\s+(const|let)\\s+${symbol}\\b` +
            `|^(async\\s+)?function\\s+${symbol}\\b` +
            `|export\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\})`,
            'm',
          ).test(body);
        });
        if (!defined) {
          offenders.push(
            `${src.name}:${i + 1} cites "${file} ${symbol}" — ${file} does not define ${symbol}`);
        }
      }
    });
  }

  assert.deepEqual(offenders, [],
    'A blocker\'s cites: must resolve. A citation naming a symbol the file does not define reads as\n' +
    'verified and sends the reader to the wrong place — worse than no citation at all\n' +
    '(reviewer-protocol.md §6.1, §2; #580, #586).\n' +
    offenders.map(o => `  ${o}`).join('\n'));
});

test('#555: the guard is a real detector — a symbol in the wrong file is caught', () => {
  // Negative control over the exact defect this file was written for: the round-2
  // citation `sdd-layout.mjs requiredArtifactsFor`, where the symbol lives in
  // governance-tiers.mjs. Built as a fixture rather than by mutating the tree, so
  // the control runs on every invocation instead of only during a sweep.
  const modules = indexModules(scriptsRoot);
  const probe = (file, symbol) => {
    const candidates = modules.get(file) ?? [];
    return candidates.some(p => new RegExp(
      `export\\s+(async\\s+)?function\\s+${symbol}\\b|export\\s+(const|let)\\s+${symbol}\\b`, 'm',
    ).test(readFileSync(p, 'utf8')));
  };

  assert.equal(probe('governance-tiers.mjs', 'requiredArtifactsFor'), true,
    'the symbol really does live here');
  assert.equal(probe('sdd-layout.mjs', 'requiredArtifactsFor'), false,
    'and really does not live here — the guard must be able to tell them apart');
  assert.equal(probe('sdd-layout.mjs', 'REQUIRED_ARTIFACTS'), true,
    'while the constant the citation should name does');
});
