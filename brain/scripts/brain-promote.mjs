#!/usr/bin/env node
// brain-promote.mjs — read-confirm-stage promotion of a Tier 2 draft (issue #378).
//
// Usage: npm run brain:promote -- <path/to/brain-drafts/adr-NNNN-slug.md>
//
//   1. Renders the draft in full, so the human reads what they are signing.
//   2. Shows the exact plan: destination, header before/after, the brain/HOME.md
//      line and the line it follows, and the AGENTS.md regeneration.
//   3. Requires a TYPED confirmation — the literal word, never a single letter.
//   4. On accept: writes the three files, stages them, and STOPS.
//   5. Prints the git commit command. Running it is the human's signature.
//
// ─────────────────────────────────────────────────────────────────────────────
// This verb automates precisely the action two anti-patterns forbid
// (brain/core/anti-patterns/ia-escribe-brain-sin-gate.md and
// ia-promueve-sus-propios-artefactos.md). It is NOT a convenience feature, and
// it adds NO enforcement. The real enforcement is unchanged and lives at the PR
// level: brain-writes-reviewed (L6) and CODEOWNERS. See the ADR draft in
// openspec/changes/issue-378-brain-promote/brain-drafts/ for the honest limits.
//
// Four structural locks, drift-guarded by brain-promote.locks.test.mjs:
//   1. Refuses on a non-TTY, before anything is read or written.
//   2. No auto-accept option and no environment read exists — there is no branch
//      to reach. Every option-shaped token is a hard abort, not a silent no-op.
//      Adding one is a doctrine change and needs an ADR.
//   3. Stages. Never commits, never pushes: the single git helper below enforces
//      an allowlist that does not contain those subcommands.
//   4. The confirmation is one exact literal word.
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { insertAdrLink } from './lib/home-index.mjs';
import { SOURCE_DOCS, AGENTS_EMIT_PATH, compileAgentsMd } from './harness/backends/antigravity.mjs';

// ── Frozen contract ──────────────────────────────────────────────────────────

/** The literal word the human must type. Lock 4. */
export const CONFIRMATION_WORD = 'PROMOTE';

/**
 * The ONLY git subcommands this verb may run. Lock 3, expressed as data rather
 * than as a source scan: the verb PRINTS a commit command, so the string
 * "git commit" is in this file by design and a text scan for it can never work.
 */
export const ALLOWED_GIT_SUBCOMMANDS = Object.freeze(['add', 'config']);

/** Draft basename shape. Anchored so the destination satisfies adrPresence's regex. */
export const DRAFT_BASENAME_RE = /^adr-(\d{4})-([a-z0-9][a-z0-9-]*)\.md$/;

/** ADR H1 shape, accepting an em dash, an en dash or a hyphen as the separator. */
const H1_RE = /^#\s+ADR-(\d{4})\s*[—–-]\s*(.+?)\s*$/;

const DECISIONS_DIR = 'brain/project/decisions';
const HOME_PATH = 'brain/HOME.md';

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Removes `//` line comments and block comments. Used by the lock drift-guard
 * so a comment that DESCRIBES a forbidden construct is not mistaken for one.
 * Proven by its own tests before anything is asserted over its output.
 *
 * @param {string} src
 * @returns {string}
 */
export function stripComments(src) {
  return src
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Parses the verb's arguments. Exactly one positional; EVERY option-shaped
 * token is a hard abort. Lock 2 lives here: an auto-accept option is not
 * ignored, it stops the run.
 *
 * @param {string[]} argv
 * @returns {{ok:true, draftPath:string}|{ok:false, error:string}}
 */
export function parseArgs(argv) {
  const options = argv.filter((a) => a.startsWith('-'));
  if (options.length > 0) {
    return {
      ok: false,
      error:
        `brain:promote takes no options — got ${options.join(', ')}.\n` +
        '  There is deliberately no way to skip the confirmation. The typed word IS the gate;\n' +
        '  an option that bypasses it would be a doctrine change requiring an ADR.',
    };
  }
  const positionals = argv.filter((a) => !a.startsWith('-'));
  if (positionals.length !== 1) {
    return {
      ok: false,
      error:
        'Usage: npm run brain:promote -- <path/to/brain-drafts/adr-NNNN-slug.md>\n' +
        `  Expected exactly one draft path, got ${positionals.length}.`,
    };
  }
  return { ok: true, draftPath: positionals[0] };
}

/**
 * Derives the promotion destination from a draft path.
 * @param {string} draftPath
 * @returns {string|null} repo-relative destination, or null when the basename does not qualify.
 */
export function destinationFor(draftPath) {
  const name = basename(draftPath);
  if (!DRAFT_BASENAME_RE.test(name)) return null;
  return `${DECISIONS_DIR}/${name}`;
}

/** Reads the issue number out of a draft path's `issue-<N>` segment. */
export function issueNumberFor(draftPath) {
  const m = draftPath.match(/(?:^|[/\\])issue-(\d+)/);
  return m ? m[1] : null;
}

/**
 * Wraps a value in single quotes for a shell command, escaping embedded
 * apostrophes. Single quotes, not double: ADR titles contain backticks
 * (ADR-0027), and a double-quoted paste command-substitutes them.
 *
 * @param {string} value
 * @returns {string}
 */
export function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

/**
 * Builds the commit command the human runs. Conventional Commits plus a `#N`
 * reference — both required by the commit-msg hook and by pre-receive on push.
 * English, because the artefacts it touches ship to consumers.
 *
 * @param {{number:string, title:string, issue:string|null}} args
 * @returns {string}
 */
export function buildCommitCommand({ number, title, issue }) {
  const ref = issue ? `#${issue}` : '#<issue-number>';
  return `git commit -m ${shellQuote(`docs(brain): promote ADR-${number} — ${title} (${ref})`)}`;
}

/**
 * Rewrites a draft into the house ADR shape. Pure.
 *
 * The blockquote strip is BOUNDED to the preamble (between the H1 and the first
 * `## ` heading), which is where the drafts' `> **status:**` line and
 * `> **Tier 2 draft.**` banner live. A whole-file strip would eat body content.
 *
 * @param {string} draftText
 * @param {{gitUserName:string, today:string}} ctx
 * @returns {{ok:true, text:string, number:string, title:string, removed:string}|{ok:false, error:string}}
 */
export function transformDraft(draftText, { gitUserName, today }) {
  const eol = draftText.includes('\r\n') ? '\r\n' : '\n';
  const lines = draftText.split(/\r?\n/);

  let h1Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    h1Idx = i;
    break;
  }
  if (h1Idx === -1) return { ok: false, error: 'draft is empty' };

  const h1 = lines[h1Idx].match(H1_RE);
  if (!h1) {
    return {
      ok: false,
      error:
        `the draft's first content line must be an ADR H1 (\`# ADR-NNNN — Title\`), got:\n  ${lines[h1Idx]}`,
    };
  }
  const [, number, title] = h1;

  let preambleEnd = lines.length;
  for (let i = h1Idx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      preambleEnd = i;
      break;
    }
  }

  const preamble = lines.slice(h1Idx + 1, preambleEnd);
  const removed = preamble.filter((l) => l.trimStart().startsWith('>'));
  const kept = [];
  for (const line of preamble) {
    if (line.trimStart().startsWith('>')) continue;
    if (line.trim() === '' && (kept.length === 0 || kept[kept.length - 1].trim() === '')) continue;
    kept.push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop();

  const header = [
    lines[h1Idx],
    '',
    '**Status**: Accepted',
    `**Date**: ${today} — ${gitUserName}`,
    '',
  ];
  const body = [...kept, ...(kept.length > 0 ? [''] : []), ...lines.slice(preambleEnd)];
  let text = [...header, ...body].join(eol);
  if (!text.endsWith(eol)) text += eol;

  return { ok: true, text, number, title, removed: removed.join(eol) };
}

/**
 * Renders the plan the human reads before typing the word. Pure — the plan
 * shown and the plan applied are one value, not two code paths.
 *
 * @param {object} plan
 * @returns {string}
 */
export function renderPlan(plan) {
  const lines = [
    '',
    '─── PLAN ───────────────────────────────────────────────────────────────────',
    '',
    `  draft        ${plan.draftPath}`,
    `  destination  ${plan.destination}`,
    '',
    '  header — BEFORE (removed):',
    ...(plan.headerBefore ? plan.headerBefore.split('\n').map((l) => `    ${l}`) : ['    (none)']),
    '',
    '  header — AFTER (inserted):',
    ...plan.headerAfter.split('\n').map((l) => `    ${l}`),
    '',
    `  ${HOME_PATH} — insert:`,
    `    ${plan.homeLine}`,
    `  immediately after:`,
    `    ${plan.homeAfterLine ?? '(the section heading)'}`,
    '',
    `  ${plan.agentsPath} — regenerated from the ${SOURCE_DOCS.length} SOURCE_DOCS`,
    `                 (${HOME_PATH} is one of them, so the entry above cascades here)`,
    '',
    '  This verb STAGES the three files. It does not commit and does not push.',
    '',
  ];
  return lines.join('\n');
}

// ── The single git seam ──────────────────────────────────────────────────────

/**
 * Runs one allow-listed git subcommand. The ONLY place this module spawns
 * anything. Lock 3: a subcommand outside ALLOWED_GIT_SUBCOMMANDS throws before
 * the spawn is reached.
 *
 * @param {string} subcommand
 * @param {string[]} args
 * @param {{cwd:string, spawnFn?:Function}} opts
 * @returns {{ok:boolean, stdout:string, stderr:string}}
 */
export function runGit(subcommand, args, { cwd, spawnFn = spawnSync }) {
  if (!ALLOWED_GIT_SUBCOMMANDS.includes(subcommand)) {
    throw new Error(
      `brain:promote refuses to run "git ${subcommand}". ` +
        `Allowed: ${ALLOWED_GIT_SUBCOMMANDS.join(', ')}. ` +
        'Producing the commit IS the human signature; a tool that produces it has taken it.',
    );
  }
  const r = spawnFn('git', [subcommand, ...args], { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// ── The verb ─────────────────────────────────────────────────────────────────

/**
 * Runs the read-confirm-stage flow.
 *
 * @param {object} ctx
 * @param {string[]} ctx.argv        Arguments after the script name.
 * @param {boolean} ctx.isTTY        Whether stdin is an interactive terminal.
 * @param {string}  ctx.root         Repo root (defaults to the process cwd at the entry point).
 * @param {Function} ctx.readLineFn  async () => string|null — reads the typed confirmation.
 * @param {Function} [ctx.gitUserNameFn]
 * @param {Function} [ctx.todayFn]
 * @param {Function} [ctx.stageFn]   (relPaths) => {ok, stderr}
 * @param {Function} [ctx.write]     (chunk) => void
 * @returns {Promise<{exitCode:number, output:string, wrote:string[], staged:string[]}>}
 */
export async function runPromote({
  argv,
  isTTY,
  root,
  readLineFn,
  gitUserNameFn,
  todayFn = () => new Date().toISOString().slice(0, 10),
  stageFn,
  write = () => {},
}) {
  let output = '';
  const say = (chunk) => {
    output += `${chunk}\n`;
    write(`${chunk}\n`);
  };
  const done = (exitCode, wrote = [], staged = []) => ({ exitCode, output, wrote, staged });

  // ── LOCK 1 — before anything is read, before anything is written ───────────
  // Consulted exactly ONCE, here. A second copy of this predicate is how two
  // rules drift apart; the guarantee that this one cannot be dropped is
  // behavioural (a real non-TTY child process), not a duplicate check.
  if (!isTTY) {
    say('✗ brain:promote requires an interactive terminal (stdin is not a TTY).');
    say('');
    say('  Promotion into brain/ is a human signature. This verb exists to remove the');
    say('  mechanics from that act, never the act itself, so it will not run unattended.');
    say('');
    say('  This is a speed bump, not a wall: a pty defeats it. The enforcement that');
    say('  matters is brain-writes-reviewed (L6) at the PR level, and CODEOWNERS.');
    return done(2);
  }

  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    say(`✗ ${parsed.error}`);
    return done(2);
  }
  const { draftPath } = parsed;

  const destination = destinationFor(draftPath);
  if (destination === null) {
    say(`✗ '${basename(draftPath)}' is not a promotable draft name.`);
    say('');
    say('  This slice promotes NEW ADR files only: adr-NNNN-<lowercase-slug>.md.');
    say('  In-place edits to an already-signed brain/** file are NOT automated yet —');
    say('  see openspec/changes/issue-378-brain-promote/design.md D2 for why.');
    return done(1);
  }

  const draftAbs = join(root, draftPath);
  if (!existsSync(draftAbs)) {
    say(`✗ draft not found: ${draftPath}`);
    return done(1);
  }

  const destAbs = join(root, destination);
  if (existsSync(destAbs)) {
    say(`✗ ${destination} already exists — refusing to overwrite a signed artifact.`);
    say('  Pick a free ADR number and rename the draft.');
    return done(1);
  }

  const gitUserName = (
    gitUserNameFn
      ? gitUserNameFn()
      : runGit('config', ['user.name'], { cwd: root }).stdout
  ).trim();
  if (gitUserName === '') {
    say('✗ git config user.name is empty — refusing to stamp a nameless Date line.');
    say('  Set it first:  git config user.name "Your Name"');
    return done(1);
  }

  const draftText = readFileSync(draftAbs, 'utf8');
  const transformed = transformDraft(draftText, { gitUserName, today: todayFn() });
  if (!transformed.ok) {
    say(`✗ ${transformed.error}`);
    return done(1);
  }

  const filenameNumber = basename(draftPath).match(DRAFT_BASENAME_RE)[1];
  if (filenameNumber !== transformed.number) {
    say(
      `✗ ADR number mismatch: the filename says ${filenameNumber}, the H1 says ${transformed.number}.`,
    );
    say('  adrPresence keys on the path and brain/HOME.md keys on the title — they must agree.');
    return done(1);
  }

  const homeAbs = join(root, HOME_PATH);
  const homeText = readFileSync(homeAbs, 'utf8');
  const slug = basename(draftPath).replace(/\.md$/, '');
  const patched = insertAdrLink(homeText, {
    number: transformed.number,
    slug,
    description: transformed.title,
  });
  if (!patched.inserted) {
    say(`✗ ${HOME_PATH} could not be patched — reason: ${patched.reason}.`);
    if (patched.reason === 'already-present') {
      say(`  ADR-${transformed.number} is already indexed while its file does not exist.`);
      say('  That inconsistency wants a human, not an automatic repair.');
    } else {
      say("  Could not locate an unambiguous '### Architecture decisions' anchor.");
    }
    return done(1);
  }

  const homeLine = patched.text
    .split(/\r?\n/)
    .find((l) => l.includes(`](project/decisions/${slug}.md)`));
  const homeLines = patched.text.split(/\r?\n/);
  const homeAfterLine = homeLines[homeLines.indexOf(homeLine) - 1];

  const docs = {};
  for (const rel of SOURCE_DOCS) {
    docs[rel] = rel === HOME_PATH ? patched.text : readFileSync(join(root, rel), 'utf8');
  }
  const agentsText = compileAgentsMd(docs);

  // ── Step 1: the human reads what they are signing ─────────────────────────
  say('');
  say(`─── DRAFT: ${draftPath} ─────────────────────────────────────────────`);
  say('');
  say(draftText.replace(/\n$/, ''));

  // ── Step 2: the exact plan ────────────────────────────────────────────────
  say(
    renderPlan({
      draftPath,
      destination,
      headerBefore: transformed.removed,
      headerAfter: `**Status**: Accepted\n**Date**: ${todayFn()} — ${gitUserName}`,
      homeLine,
      homeAfterLine,
      agentsPath: AGENTS_EMIT_PATH,
    }).replace(/\n$/, ''),
  );

  // ── Step 3: the typed confirmation ────────────────────────────────────────
  say(`Type ${CONFIRMATION_WORD} to apply this plan. Anything else aborts with no writes.`);
  const answer = await readLineFn();
  if (typeof answer !== 'string' || answer.trim() !== CONFIRMATION_WORD) {
    say('');
    say('✗ aborted — nothing was written.');
    return done(1);
  }

  // ── Step 4: apply, then STOP at the index ─────────────────────────────────
  writeFileSync(destAbs, transformed.text, 'utf8');
  writeFileSync(homeAbs, patched.text, 'utf8');
  writeFileSync(join(root, AGENTS_EMIT_PATH), agentsText, 'utf8');
  const wrote = [destination, HOME_PATH, AGENTS_EMIT_PATH];

  const staged = stageFn
    ? (stageFn(wrote), wrote)
    : (runGit('add', ['--', ...wrote], { cwd: root }).ok ? wrote : []);

  say('');
  say(`✓ staged ${staged.length} file(s):`);
  for (const p of staged) say(`    ${p}`);

  // ── Step 5: print the command and stop. Running it is the signature. ──────
  say('');
  say('Review the staged diff, then commit AS YOURSELF:');
  say('');
  say(`  git diff --cached`);
  say(`  ${buildCommitCommand({ number: transformed.number, title: transformed.title, issue: issueNumberFor(draftPath) })}`);
  if (!issueNumberFor(draftPath)) {
    say('');
    say('  ⚠ the issue number could not be read from the draft path — replace the');
    say('    placeholder above, or commit-msg will reject the message.');
  }
  say('');
  return done(0, wrote, staged);
}

// ── CLI entry point — the only I/O layer ─────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runPromote({
    argv: process.argv.slice(2),
    isTTY: Boolean(process.stdin.isTTY),
    root: process.cwd(),
    readLineFn: async () => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return await new Promise((resolve) => rl.question('> ', resolve));
      } finally {
        rl.close();
      }
    },
    write: (chunk) => process.stdout.write(chunk),
  });
  process.exit(result.exitCode);
}
