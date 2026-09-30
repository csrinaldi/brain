// env-init-setup.mjs — what a fresh consumer needs before its first PR and its
// first memory save, done by env:init instead of left to the operator
// (issues #1163, #1164).
//
//   labels  — the labels the gates and verbs READ. Without `status:approved` no
//             issue can be approved, so the first PR fails `issue-link`.
//   actor   — `git config brain.actor`, which `brain:memory:save` refuses to run
//             without. Never guessed from `user.name`.
//
// Both go through the VCS port (`getVcs`), never a raw `gh`/`glab` call, and both
// DEGRADE: an unreachable or unauthenticated VCS is a pending step that names the
// exact command, not a crash and not a silent skip.
//
// Exit codes for the CLI (bootstrap.sh classifies by them): 0 done, 3 pending
// (optional, exit 0 for env:init), anything else is a defect of this script.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { resolveApprovedLabel } from '../governance/approved-label.mjs';
import { TYPE_LABELS } from '../vcs/contributor-scaffold.mjs';
import { HANDLE_RE } from '../memory/lib/format.mjs';
import { gitConfigGet } from './git-config.mjs';
import { loadBrainConfig } from './brain-config.mjs';

/**
 * The `governance:*` labels `.github/workflows/governance-postmerge.yml` files
 * alarm issues under (GitHub only: the GitLab fragment files none). A test reads
 * the workflow and fails when it files a label that is not listed here.
 */
export const ALARM_LABELS = Object.freeze([
  'governance:archive-sweep-failed',
  'governance:audit-uncomputable',
  'governance:audit-unrevertible',
  'governance:cursor-missing',
  'governance:cursor-unknown',
  'governance:postmerge-unreported',
  'governance:revert-blocked',
]);

/** GitLab scoped form (`key::value`), the same mechanical mapping `resolveApprovedLabel` applies. */
const scoped = (name, provider) => (provider === 'gitlab' && !name.includes('::') ? name.replace(':', '::') : name);

/**
 * @param {{ config: object, provider: string }} args
 * @returns {{ name: string, color: string, description: string }[]}
 */
export function desiredLabels({ config, provider }) {
  const out = [{ name: resolveApprovedLabel(config, provider), color: '0E8A16', description: 'Issue approved by a human — the issue-link gate reads this' }];
  for (const { label, description } of TYPE_LABELS) out.push({ name: scoped(label, provider), color: 'ededed', description });
  out.push({ name: 'size:exception', color: 'FBCA04', description: 'Waives the diff-size budget where the tier honors it' });
  out.push({ name: 'skip:memory-gate', color: 'FBCA04', description: 'Waives the memory-gate where the tier honors it' });
  if (provider === 'github') {
    for (const name of ALARM_LABELS) out.push({ name, color: 'B60205', description: 'governance postmerge halt' });
  }
  return out;
}

const HAND_COMMAND = {
  github: (n) => `gh label create "${n}"`,
  gitlab: (n) => `glab label create --name "${n}"`,
};

/**
 * Creates the missing labels. Reads the remote's label set FIRST and only creates
 * what is absent, so a second run makes no write. Never throws.
 *
 * @param {{ config: object, provider: string, project: string, vcs: { labelList: Function, labelCreate: Function } }} args
 * @returns {Promise<{ created: string[], existing: string[], failed: {name:string,error:string}[], pending: null|{reason:string,next:string} }>}
 */
export async function ensureLabels({ config, provider, project, vcs }) {
  const result = { created: [], existing: [], failed: [], pending: null };
  const approved = resolveApprovedLabel(config, provider);
  const handFor = (names) => names.map((n) => (HAND_COMMAND[provider] ?? HAND_COMMAND.github)(n)).join('; ');
  // `npm run brain:env:init` is the one command that creates them all; the hand commands cover what was refused.
  const pending = (reason, names = [approved]) => ({ reason, next: `npm run brain:env:init once the VCS is reachable and authenticated, or by hand: ${handFor(names)}` });
  if (!project) {
    result.pending = pending('project.slug is empty in brain.config.json');
    return result;
  }
  let have;
  try {
    have = new Set(await vcs.labelList({ project }));
  } catch (e) { // surfaced: the cause becomes result.pending.reason, which the CLI prints and env:init lists as a pending step
    result.pending = pending(`could not read the remote's labels — ${e.message}`);
    return result;
  }
  for (const label of desiredLabels({ config, provider })) {
    if (have.has(label.name)) { result.existing.push(label.name); continue; }
    const r = await vcs.labelCreate({ project, ...label });
    if (!r.ok) result.failed.push({ name: label.name, error: r.error });
    else (r.created ? result.created : result.existing).push(label.name);
  }
  if (result.failed.length) {
    result.pending = pending(`the remote refused ${result.failed.map((f) => `${f.name} (${f.error})`).join(', ')}`, result.failed.map((f) => f.name));
  }
  return result;
}

const ACTOR_NEXT = 'git config --local brain.actor @<handle>';

/**
 * Resolves `brain.actor`. An existing valid value is KEPT (a human's choice is
 * never overwritten); otherwise the authenticated VCS identity is written to the
 * LOCAL git config; otherwise it is pending. Never derived from `user.name`.
 *
 * @param {{ vcs: { whoami: Function }, gitGet: () => string|null, gitSet: (v: string) => void }} args
 * @returns {Promise<{ status: 'kept'|'set'|'pending', actor?: string, reason?: string, next?: string }>}
 */
export async function resolveBrainActor({ vcs, gitGet, gitSet }) {
  const existing = gitGet();
  if (existing && HANDLE_RE.test(existing.trim()) && existing.trim() !== '@legacy') return { status: 'kept', actor: existing.trim() };
  let username;
  try {
    ({ username } = await vcs.whoami());
  } catch (e) { // surfaced: the cause becomes the returned pending reason, which the CLI prints and env:init lists as a pending step
    return { status: 'pending', reason: `no authenticated VCS identity — ${e.message}`, next: ACTOR_NEXT };
  }
  const handle = `@${username}`;
  if (!username || !HANDLE_RE.test(handle)) {
    return { status: 'pending', reason: `the VCS identity "${username}" is not a handle`, next: ACTOR_NEXT };
  }
  gitSet(handle);
  return { status: 'set', actor: handle };
}

// ── CLI ────────────────────────────────────────────────────────────────────────

const say = (s) => console.log(s);

async function runLabels() {
  const config = loadBrainConfig();
  const provider = process.env.VCS_PROVIDER || config?.vcs?.provider || '';
  let vcs;
  try {
    const { getVcs } = await import('../vcs/cli.mjs');
    vcs = await getVcs();
  } catch (e) { // surfaced: the cause becomes the pending reason, which the CLI prints and env:init lists as a pending step
    return report({ pending: { reason: e.message, next: 'npm run brain:env:init once vcs.provider is configured' }, created: [], existing: [], failed: [] });
  }
  return report(await ensureLabels({ config, provider, project: config?.project?.slug ?? '', vcs }));
}

function report(r) {
  if (r.created.length) say(`  ✓ governance labels created: ${r.created.join(', ')}`);
  if (r.existing.length && !r.created.length && !r.pending) say(`  ✓ governance labels: all ${r.existing.length} already exist`);
  else if (r.existing.length && r.pending) say(`  ✓ governance labels already existing: ${r.existing.join(', ')}`);
  if (r.failed.length) say(`  ✗ governance labels refused: ${r.failed.map((f) => `${f.name} (${f.error})`).join(', ')}`);
  if (r.pending) {
    say(`  ⚠ governance labels not fully created — ${r.pending.reason}`);
    say(`NEXT: governance labels (next: ${r.pending.next})`);
    return 3;
  }
  return 0;
}

async function runActor() {
  const cwd = process.cwd();
  let vcs = { whoami: async () => { throw new Error('the VCS port could not be loaded'); } };
  try {
    const { getVcs } = await import('../vcs/cli.mjs');
    vcs = await getVcs();
  } catch { /* surfaced: the double above throws on use, and resolveBrainActor turns that into the pending step naming the cause */ }
  const r = await resolveBrainActor({
    vcs,
    gitGet: () => gitConfigGet('brain.actor', cwd),
    gitSet: (v) => {
      const w = spawnSync('git', ['config', '--local', 'brain.actor', v], { cwd, encoding: 'utf8' });
      if (w.status !== 0) throw new Error(`git config --local brain.actor failed: ${w.stderr}`);
    },
  });
  if (r.status === 'kept') say(`  ✓ brain.actor: ${r.actor} (already configured; left unchanged)`);
  else if (r.status === 'set') say(`  ✓ brain.actor: ${r.actor} (from your authenticated VCS identity, written to the local git config)`);
  else {
    say(`  ⚠ brain.actor is not configured — ${r.reason}`);
    say(`NEXT: brain.actor (next: ${r.next})`);
    return 3;
  }
  return 0;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  const sub = process.argv[2];
  const run = { labels: runLabels, actor: runActor }[sub];
  if (!run) {
    console.error(`env-init-setup: unknown step '${sub}'. One of: labels, actor`);
    process.exit(2);
  }
  process.exitCode = await run();
}
