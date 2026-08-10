// workflow-auth.mjs — does every workflow step that can reach the server declare a
// credential, and does the workflow grant it a scope that works? (issue #480)
//
// ── WHY THIS IS NOT A PATTERN MATCH OVER YAML ────────────────────────────────
//
// The guard this replaces (PR #476, closed as a duplicate of #470, so it never
// reached main) was written as a property — "any step whose `run:` reaches the API
// must declare GH_TOKEN" — and implemented as an allowlist of literal command
// spellings. #480 measured seven escapes. Every one of them is the same mistake:
// a spelling outside the list read as "this step does not reach the API", so the
// checker's inability to recognise the command became the gate's approval. That is
// `evidence-reader-empty-on-failure` one layer up.
//
// #480 asks for the design call to be made and recorded. It is neither "regex over
// text" nor "parse the YAML properly", because YAML parsing does not answer the
// question either: `run: node brain/scripts/cursor.mjs` and
// `run: node brain/scripts/brain-audit.mjs` are the same shape and have opposite
// answers. `cursor.mjs` only touches git; `brain-audit.mjs` reaches the port.
//
// So the requirement is DERIVED FROM THE CODE the step invokes. The YAML says which
// script runs; the script's own import closure says whether it can reach a server.
// A guard built that way cannot be defeated by how the command is spelled, because
// the spelling is only used to find the entry point — and when it CANNOT find one,
// it says so loudly instead of answering "nothing to report".
//
// ── POLARITY ─────────────────────────────────────────────────────────────────
//
// Undecidable is a VIOLATION, never a pass — the same rule `filesOverlap` follows
// in `status/epic-graph.mjs`, for the same reason: an approximate checker that
// resolves ambiguity toward "fine" grants exactly the permission it exists to
// withhold.
//
// ── THE ONE PLACE THIS OVER-APPROXIMATES, MEASURED ───────────────────────────
//
// An import closure answers "can this ENTRY POINT reach the port", which is exact
// for a single-purpose script (`brain-audit.mjs`, `actor-check.mjs`) and coarse for
// a MULTIPLEXER. `governance/run-check.mjs` dispatches issue-link, diff-size,
// memory-gate, decision-gate and more; only the issue-link branch calls `getVcs`,
// yet the closure of the file includes the port for every subcommand. Pointed at
// `governance.yml`, this guard therefore flags `memory-gate` and `decision-gate`,
// which reach nothing and are correctly credential-free today.
//
// So it is applied to the workflows that run the audit — #480's stated scope —
// where the entry points are single-purpose and the answer is exact. Widening it to
// the PR-time gate needs per-subcommand resolution, and shipping false alarms there
// would be worse than not covering it: a guard that cries wolf is a guard someone
// switches off. That remaining coupling is tracked separately rather than papered
// over here.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

/** Commands that cannot reach a server, so a step made only of them needs nothing.
 *  Deliberately tiny and deliberately a SAFE-side list: anything absent from it is
 *  treated as reaching, so forgetting an entry costs a false alarm, never a miss. */
const INERT = new Set([
  'set', 'echo', 'printf', 'cd', 'exit', 'if', 'then', 'else', 'elif', 'fi', 'for',
  'while', 'do', 'done', 'case', 'esac', 'test', 'true', 'false', 'cat', 'head',
  'tail', 'cut', 'grep', 'sed', 'awk', 'tr', 'wc', 'sort', 'uniq', 'mkdir', 'rm',
  'cp', 'mv', 'touch', 'git', 'date', 'basename', 'dirname', 'sleep', 'jq',
]);

/** The provider CLIs. A step shelling one of these reaches the server directly,
 *  outside the port — legitimate for GitHub-only workflow glue, but it still needs
 *  a credential. Matched as a WORD so `GH=gh; "$GH" api` is caught (#480 A7). */
const PROVIDER_CLI = /(^|[^\w./-])(gh|glab)([^\w./-]|$)/;

/** Split a workflow into per-step blocks, comments removed.
 *
 *  Slices on step bullets at a common indent and returns each slice WHOLE, so it is
 *  independent of key order, of `run:` scalar style (`|`, `>`, inline), and of
 *  whether the step leads with `name:`, `id:`, `uses:` or `run:` itself — #480 A3
 *  is precisely a step whose first key is `run:`, which the previous guard did not
 *  recognise as a boundary at all, silently absorbing it into its predecessor.
 *  Comments are stripped first so a step cannot comply by MENTIONING a credential.
 */
export function stepBlocks(yamlText) {
  const lines = yamlText.split('\n').filter(l => !/^\s*#/.test(l));
  const starts = [];
  lines.forEach((l, i) => { if (/^\s*- /.test(l)) starts.push([i, l.indexOf('- ')]); });
  return starts.map(([i, indent], n) => {
    let end = lines.length;
    for (let j = n + 1; j < starts.length; j++) {
      if (starts[j][1] <= indent) { end = starts[j][0]; break; }
    }
    const body = lines.slice(i, end);
    // The bullet carries the step's FIRST key on the same line (`- run: …`), so it
    // is rewritten to plain indentation. Without this every key-anchored read below
    // misses that key entirely — which is #480 A3 surviving in a second form: the
    // step is recognised as a step and then read as if it had no `run:` at all.
    body[0] = body[0].replace(/^(\s*)- /, '$1  ');
    return body.join('\n');
  });
}

/** The `run:` script of a step, or null for a `uses:` step. */
function runScript(block) {
  const m = block.match(/^\s*run:\s*(\||>|.*)$/m);
  if (!m) return null;
  if (m[1] !== '|' && m[1] !== '>') return m[1];        // inline (#480 A2)
  const lines = block.split('\n');
  const at = lines.findIndex(l => /^\s*run:\s*(\||>)\s*$/.test(l));
  const indent = lines[at].search(/\S/);
  const body = [];
  for (let j = at + 1; j < lines.length; j++) {
    if (lines[j].trim() === '') { body.push(''); continue; }
    if (lines[j].search(/\S/) <= indent) break;
    body.push(lines[j]);
  }
  return body.join('\n');                                // folded or literal (#480 A1)
}

/** Entry points a script invokes: `node <path>` and `npm run <verb>` (#480 A5),
 *  matched case-insensitively so `brain-audit.MJS` resolves too (#480 A6). */
function entryPoints(script, repoRoot) {
  const out = [];
  for (const m of script.matchAll(/\bnode\s+(?:--\S+\s+)*([^\s"';|&]+\.mjs)/gi)) {
    out.push({ raw: m[1], path: resolve(repoRoot, m[1].replace(/^\.\//, '')) });
  }
  for (const m of script.matchAll(/\bnpm\s+run\s+([\w:.-]+)/gi)) {
    const pkgPath = join(repoRoot, 'package.json');
    const cmd = existsSync(pkgPath)
      ? (JSON.parse(readFileSync(pkgPath, 'utf8')).scripts ?? {})[m[1]]
      : undefined;
    if (cmd === undefined) { out.push({ raw: m[0], path: null, unresolved: true }); continue; }
    for (const e of entryPoints(cmd, repoRoot)) out.push(e);
  }
  return out;
}

/** Transitive relative-import closure of an .mjs entry point. Relative specifiers
 *  only — a bare specifier is a node builtin or a dependency, and neither reaches
 *  this repo's port. Cycles terminate on the visited set. */
function importClosure(entry, seen = new Set()) {
  if (!entry || seen.has(entry) || !existsSync(entry)) return seen;
  seen.add(entry);
  let src;
  try { src = readFileSync(entry, 'utf8'); } catch { return seen; }
  for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    importClosure(resolve(dirname(entry), m[1]), seen);
  }
  return seen;
}

/** What a step needs, derived from what its scripts can actually reach. */
function requirementFor(script, repoRoot) {
  const entries = entryPoints(script, repoRoot);
  if (entries.some(e => e.unresolved)) return { need: 'unresolvable' };

  let port = false;
  let cli = PROVIDER_CLI.test(script);           // the shell itself calls gh/glab (#480 A4, A7)
  const missing = [];
  for (const e of entries) {
    if (!existsSync(e.path)) { missing.push(e.raw); continue; }
    const closure = importClosure(e.path);
    for (const f of closure) {
      const rel = relative(repoRoot, f);
      if (rel.endsWith(join('vcs', 'cli.mjs'))) port = true;
      // A script that spawns a provider CLI itself, outside the port (alarm.mjs).
      if (/(['"])(gh|glab)\1/.test(readFileSync(f, 'utf8'))) cli = true;
    }
  }
  if (missing.length) return { need: 'unresolvable', missing };
  if (port) return { need: 'VCS_TOKEN' };
  if (cli) return { need: 'credential' };

  // Nothing invoked reaches a server. Only then may the step declare nothing — and
  // only if every command in it is on the inert list, so an unrecognised binary is
  // still treated as reaching.
  const words = script.split(/[\s|;&()]+/).filter(Boolean);
  const cmds = words.filter((w, i) => i === 0 || /^[|;&]|\bthen\b|\bdo\b/.test(words[i - 1] ?? ''));
  const unknown = cmds.filter(c => /^[a-z][\w.-]*$/i.test(c) && !INERT.has(c) && !/^(node|npm|npx)$/.test(c));
  return unknown.length ? { need: 'credential', because: unknown } : { need: null };
}

/** Which credential keys a step declares in its own `env:` (empty value = absent). */
function declared(block) {
  const keys = new Set();
  for (const m of block.matchAll(/^\s*(VCS_TOKEN|GH_TOKEN|GITLAB_TOKEN):\s*(\S.*)$/gm)) keys.add(m[1]);
  return keys;
}

/**
 * Audits one workflow. Returns a list of human-readable violations — empty means
 * compliant. Never returns empty because it failed to understand something: an
 * unresolvable entry point is itself a violation.
 *
 * @param {string} yamlText @param {{file?: string, repoRoot?: string}} [opts]
 * @returns {string[]}
 */
export function auditWorkflowAuth(yamlText, { file = 'workflow', repoRoot = process.cwd() } = {}) {
  const violations = [];
  let reachesServer = false;

  for (const block of stepBlocks(yamlText)) {
    const script = runScript(block);
    if (script === null) continue;                       // a `uses:` step
    const name = (block.match(/name:\s*(.+)/) ?? [, '(unnamed)'])[1].trim();
    const { need, missing, because } = requirementFor(script, repoRoot);
    if (need === null) continue;
    reachesServer = true;

    if (need === 'unresolvable') {
      violations.push(
        `${file}: step '${name}' invokes something this guard cannot resolve` +
        `${missing ? ` (${missing.join(', ')})` : ''} — undecidable is a violation, ` +
        `never a pass: a checker that answers "nothing to report" for input it cannot ` +
        `read grants the permission it exists to withhold`);
      continue;
    }
    const has = declared(block);
    if (need === 'VCS_TOKEN' && !has.has('VCS_TOKEN')) {
      violations.push(`${file}: step '${name}' reaches the VCS PORT and does not declare VCS_TOKEN (#479)`);
    } else if (need === 'credential' && has.size === 0) {
      violations.push(
        `${file}: step '${name}' reaches the server${because ? ` (unrecognised command: ${because.join(', ')})` : ''}` +
        ` and declares no credential`);
    }
  }

  // A token is necessary and NOT sufficient (#475/#480): a `permissions:` block sets
  // every scope it omits to `none`, so a perfectly-formed credential under
  // `permissions: { contents: write }` reads nothing from the pulls API — the gate
  // green, the reads blind. With no block at all the default token already carries
  // read scope, so the rule would be noise there and is not applied.
  const perms = yamlText.match(/^permissions:\s*\{([^}]*)\}/m);
  if (reachesServer && perms && !/pull-requests:\s*(read|write)/.test(perms[1])) {
    violations.push(
      `${file}: declares permissions: {…} without pull-requests — every omitted scope ` +
      `is 'none', so the credential cannot read PRs and the gate passes while blind`);
  }
  return violations;
}
