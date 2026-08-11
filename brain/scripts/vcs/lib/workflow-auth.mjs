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
// ── RESOLUTION IS PER INVOCATION, NOT PER FILE (issue #535) ──────────────────
//
// An import closure alone answers "can this ENTRY POINT reach the port", which
// is exact for a single-purpose script (`brain-audit.mjs`, `actor-check.mjs`)
// and was coarse for a MULTIPLEXER: `governance/run-check.mjs` dispatches
// issue-link, diff-size, memory-gate, decision-gate and more, but only the
// issue-link branch calls `getVcs` — the closure of the FILE used to include
// the port for every subcommand regardless, which is why this guard was kept
// off `governance.yml` (T2).
//
// `requirementFor` now resolves per (entry point, subcommand) pair. A
// multiplexer DECLARES ITSELF by exporting a `SUBCOMMAND_PORT_REACH` object
// literal in its own source — recognized by presence, never by path spelling,
// so a rename or a second multiplexer costs nothing (T4). The manifest is read
// as TEXT, never imported: importing it would make this guard the first
// violator of "`run-check.mjs` is an entry point, never a library"
// (Requirement 6, T6), and would drag `cli.mjs` into this file's own closure.
// An unknown subcommand, a missing one, or a manifest that fails to parse is
// `unresolvable` — a violation, never a silent pass (T3).
//
// Separately, `importClosure` stops at `vcs/ci-context.mjs` (a cut vertex,
// T5): an entry point that reaches the port ONLY through that shared bootstrap
// requires `VCS_TOKEN` if and only if the step's own `env:` declares
// `PR_NUMBER` — key PRESENCE, value ignored (T2). This is sound only because
// `ci-context.mjs` calls `getVcs` exactly once, itself gated on
// `prNumber != null` — pinned as its own canary in
// `ci-context-drift-guard.test.mjs` (T8), which names this rule if that ever
// stops being true.
//
// A job-level or workflow-level `env:` stays a KNOWN, asserted limitation
// (this guard reads the step block, never a parent scope) — see the test at
// line ~99 below, not denied by this comment.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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
 *  matched case-insensitively so `brain-audit.MJS` resolves too (#480 A6).
 *  Each entry also captures its trailing `subcommand` (issue #535, Requirement
 *  3) — the first non-flag token immediately following the entry point path in
 *  the SAME `node <path> <subcommand>` invocation, or `null` when absent. An
 *  `npm run <verb>` recursion does NOT thread trailing args through (design's
 *  own named limitation): an npm-wrapped multiplexer's subcommand is always
 *  `null`, which is fail-closed (unresolvable), never a silent pass. */
function entryPoints(script, repoRoot) {
  const out = [];
  const nodeInvocationRe = /\bnode\s+(?:--\S+\s+)*([^\s"';|&]+\.mjs)/gi;
  for (const m of script.matchAll(nodeInvocationRe)) {
    const rest = script.slice(m.index + m[0].length);
    const nextTokenMatch = rest.match(/^\s+(\S+)/);
    const subcommand =
      nextTokenMatch && !nextTokenMatch[1].startsWith('-')
        ? nextTokenMatch[1].replace(/^["']|["']$/g, '')
        : null;
    out.push({ raw: m[1], path: resolve(repoRoot, m[1].replace(/^\.\//, '')), subcommand });
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

/**
 * Reads a multiplexer's self-declared per-subcommand port-reach manifest out of
 * its SOURCE TEXT — never `import`ed (issue #535, D3): importing it would make
 * this guard the first violator of "entry point, never a library" (Requirement
 * 6) and would drag `cli.mjs` into workflow-auth.mjs's own closure. A file is
 * recognized as a multiplexer by the PRESENCE of an exported
 * `SUBCOMMAND_PORT_REACH` object literal, never by path spelling (D2) — an
 * unrecognized multiplexer is safe by construction: `requirementFor` falls
 * back to the whole-file closure rule, which over-approximates (false alarm),
 * never under-approximates (a miss).
 *
 * @param {string} src
 * @returns {{ [subcommand: string]: boolean } | null} `null` when the const is
 *   absent, or when it parses to zero pairs (D8 — a corrupted manifest must
 *   never silently resolve as "nothing to declare").
 */
export function parseSubcommandManifest(src) {
  if (typeof src !== 'string') return null;
  const start = src.indexOf('SUBCOMMAND_PORT_REACH = {');
  if (start === -1) return null;
  const end = src.indexOf('\n};', start);
  if (end === -1) return null;
  const block = src.slice(start, end);
  const manifest = {};
  for (const m of block.matchAll(/'([\w-]+)':\s*(true|false)/g)) {
    manifest[m[1]] = m[2] === 'true';
  }
  return Object.keys(manifest).length ? manifest : null;
}

/** True when an absolute path IS `vcs/ci-context.mjs`, regardless of repoRoot prefix. */
function isCiContext(path) {
  return path.endsWith(join('vcs', 'ci-context.mjs'));
}

/** True when an absolute path IS `vcs/cli.mjs`, regardless of repoRoot prefix. */
function isCliPort(path) {
  return path.endsWith(join('vcs', 'cli.mjs'));
}

/**
 * Transitive relative-import closure of an .mjs entry point. Relative
 * specifiers only — a bare specifier is a node builtin or a dependency, and
 * neither reaches this repo's port. Cycles terminate on the visited set.
 *
 * CUT VERTEX (issue #535, D1): traversal STOPS at `vcs/ci-context.mjs` — the
 * file is added to the returned set, but its OWN imports are never walked.
 * This separates "reaches the port directly" (`vcs/cli.mjs` in the pruned
 * set) from "reaches the port only through the shared CI bootstrap"
 * (`vcs/ci-context.mjs` in the pruned set) with a SINGLE walk, rather than a
 * second traversal or a hand-written exemption. Sound only because
 * `ci-context.mjs` has exactly one port call site, itself gated on
 * `prNumber != null` (ci-context-drift-guard.test.mjs's T8 canary).
 */
function importClosure(entry, seen = new Set()) {
  if (!entry || seen.has(entry) || !existsSync(entry)) return seen;
  seen.add(entry);
  if (isCiContext(entry)) return seen; // cut vertex — added, not traversed
  let src;
  try { src = readFileSync(entry, 'utf8'); } catch { return seen; }
  for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    importClosure(resolve(dirname(entry), m[1]), seen);
  }
  return seen;
}

/** Which uppercase env-like keys a step declares ANYWHERE in its own block,
 *  value ignored (issue #535, D6) — over-reading (e.g. a key mentioned inside
 *  a `run:` heredoc) demands MORE credential, which is the safe side; the one
 *  under-reading this cannot see is a job-level `env:` block, a known,
 *  asserted limitation (workflow-auth.test.mjs:99-123), not a denied one. */
function declaredEnvKeys(block) {
  const keys = new Set();
  for (const m of block.matchAll(/^\s*([A-Z][A-Z0-9_]*):/gm)) keys.add(m[1]);
  return keys;
}

/**
 * What a step needs, derived from what its scripts can actually reach —
 * resolved PER INVOCATION (issue #535, Requirement 3), not per file.
 *
 * For each entry point: the import closure is pruned at `ci-context.mjs`
 * (D1), splitting `directPort` (`vcs/cli.mjs` in the pruned set) from
 * `contextPort` (`vcs/ci-context.mjs` in the pruned set). If the entry's OWN
 * source declares a `SUBCOMMAND_PORT_REACH` manifest (D2 — recognized by
 * presence, never by path), the entry is a multiplexer: its subcommand MUST
 * be present and MUST be a manifest key, or the step is `unresolvable`
 * (Requirement 4); when resolvable, the manifest's OWN verdict replaces the
 * closure-derived `directPort` and the closure gh/glab scan for that entry
 * (D4 — both discarded together, never just one). Absent a manifest, the
 * entry falls back to the whole-file closure rule (D2's safe over-
 * approximation). `contextPort` is always source-derived, manifest or not.
 *
 * A `VCS_TOKEN` is required when any entry directly reaches the port, OR when
 * any entry reaches it only through `ci-context.mjs` AND the step's own
 * `env:` declares `PR_NUMBER` (Requirement 5, D6 — key presence, value
 * ignored).
 *
 * @param {string} script
 * @param {string} repoRoot
 * @param {Set<string>} envKeys  Uppercase keys declared anywhere in the step block.
 */
function requirementFor(script, repoRoot, envKeys = new Set()) {
  const entries = entryPoints(script, repoRoot);
  if (entries.some(e => e.unresolved)) return { need: 'unresolvable' };

  let directPort = false;
  let contextPort = false;
  let cli = PROVIDER_CLI.test(script);           // the shell itself calls gh/glab (#480 A4, A7)
  const missing = [];
  const unresolvableSubcommands = [];

  for (const e of entries) {
    if (!existsSync(e.path)) { missing.push(e.raw); continue; }
    const closure = importClosure(e.path);
    if ([...closure].some(isCiContext)) contextPort = true;

    let entrySrc;
    try { entrySrc = readFileSync(e.path, 'utf8'); } catch { entrySrc = ''; }
    const manifest = parseSubcommandManifest(entrySrc);

    if (manifest != null) {
      // Multiplexer, recognized by the manifest's presence (D2). Resolution is
      // PER SUBCOMMAND (Requirement 3) — an absent or unknown subcommand is a
      // violation (Requirement 4), never a silent pass.
      if (e.subcommand == null || !Object.prototype.hasOwnProperty.call(manifest, e.subcommand)) {
        unresolvableSubcommands.push(`${e.raw} ${e.subcommand ?? '(no subcommand)'}`);
        continue;
      }
      if (manifest[e.subcommand]) directPort = true;
      // The closure-derived port flag AND the closure gh/glab scan are BOTH
      // discarded for this entry (D4) — the manifest's self-declaration wins.
      continue;
    }

    // Not manifest-bearing: the whole-file over-approximation (D2's safe
    // fallback) — exact for a single-purpose script, coarse (never a miss)
    // for an unrecognized multiplexer.
    if ([...closure].some(isCliPort)) directPort = true;
    for (const f of closure) {
      if (/(['"])(gh|glab)\1/.test(readFileSync(f, 'utf8'))) cli = true;
    }
  }
  if (missing.length) return { need: 'unresolvable', missing };
  if (unresolvableSubcommands.length) return { need: 'unresolvable', missing: unresolvableSubcommands };

  if (directPort || (contextPort && envKeys.has('PR_NUMBER'))) return { need: 'VCS_TOKEN' };
  if (cli) return { need: 'credential' };

  // Nothing invoked reaches a server. Only then may the step declare nothing — and
  // only if every command in it is on the inert list, so an unrecognised binary is
  // still treated as reaching.
  const words = script.split(/[\s|;&()]+/).filter(Boolean);
  const cmds = words.filter((w, i) => i === 0 || /^[|;&]|\bthen\b|\bdo\b/.test(words[i - 1] ?? ''));
  const unknown = cmds.filter(c => /^[a-z][\w.-]*$/i.test(c) && !INERT.has(c) && !/^(node|npm|npx)$/.test(c));
  return unknown.length ? { need: 'credential', because: unknown } : { need: null };
}

/**
 * The text of a top-level `permissions:` block's scope declarations, in
 * EITHER YAML shape — flow (`permissions: { contents: write }`) or block
 * (`permissions:\n  contents: write\n  ...`, governance.yml's own shape,
 * issue #535 D9). `null` when no `permissions:` key exists at all (the
 * default-token-carries-read-scope case, where the rule is intentionally
 * silent — see the caller).
 */
function permissionsScopes(yamlText) {
  const flow = yamlText.match(/^permissions:\s*\{([^}]*)\}/m);
  if (flow) return flow[1];

  const blockHeader = yamlText.match(/^permissions:\s*$/m);
  if (!blockHeader) return null;
  const lines = yamlText.slice(blockHeader.index + blockHeader[0].length).split('\n');
  const scopeLines = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    if (/^\s*#/.test(line)) continue;                       // comment — not a terminator (issue #535)
    if (/^\s{2,}[\w-]+:\s*\S/.test(line)) { scopeLines.push(line); continue; }
    break; // dedent — the block ended
  }
  return scopeLines.length ? scopeLines.join('\n') : null;
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
    const { need, missing, because } = requirementFor(script, repoRoot, declaredEnvKeys(block));
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
  // read scope, so the rule would be noise there and is not applied. Recognizes
  // BOTH flow style and block style (issue #535 D9) — governance.yml is block
  // style, and the flow-only regex silently left it unevaluated.
  const scopes = permissionsScopes(yamlText);
  if (reachesServer && scopes !== null && !/pull-requests:\s*(read|write)/.test(scopes)) {
    violations.push(
      `${file}: declares permissions without pull-requests — every omitted scope ` +
      `is 'none', so the credential cannot read PRs and the gate passes while blind`);
  }
  return violations;
}
