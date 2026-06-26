#!/usr/bin/env node
// ticket-start.mjs — Take an issue and create the working branch.
// Provider-agnostic: fetches the issue and the base branch through the VCS
// adapter (scripts/vcs/cli.mjs), so it works with GitHub, GitLab, or any host
// configured via vcs.provider in brain.config.json.
//
// Usage: npm run ticket:start -- <id>                 (in-place checkout from main)
//        npm run ticket:start -- <id> --worktree      (isolated worktree from main)
//        npm run ticket:start -- <id> --base <branch> (different base, e.g. a story tracker)
//        node scripts/ticket-start.mjs <id> [--worktree] [--base <branch>]

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { loadBrainConfig } from './lib/brain-config.mjs';
import { getVcs, resolveProviderName } from './vcs/cli.mjs';
import { originIdentity } from './vcs/lib/repo.mjs';
import { vcsToken, readEnvVar } from './vcs/lib/token.mjs';

const ROOT = process.cwd();

const argv = process.argv.slice(2);
const useWorktree = argv.includes('--worktree');
const baseIdx = argv.indexOf('--base');
const baseBranch = baseIdx >= 0 ? argv[baseIdx + 1] : 'main';
if (baseIdx >= 0 && !baseBranch) {
  console.error('  ✗ --base requiere un nombre de rama. Ej: --base feature/issue-99-mi-historia');
  process.exit(1);
}
// id = first numeric argument that is NOT the value of --base
const id = argv.find((a, i) => /^\d+$/.test(a) && (baseIdx < 0 || i !== baseIdx + 1));
if (!id) {
  console.error('Uso: npm run ticket:start -- <issue-id> [--worktree] [--base <rama>]');
  console.error('Ejemplo: npm run ticket:start -- 42');
  console.error('         npm run ticket:start -- 42 --worktree --base feature/issue-99-mi-historia');
  process.exit(1);
}

const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: ROOT, stdio: 'pipe', ...opts });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};

// ── Resolve the VCS provider + repo identity ──────────────────────────────────
const { host, project } = originIdentity();
if (!project) {
  console.error('  ✗ No se pudo detectar el remote de origin.');
  process.exit(1);
}

let vcsProvider;
let vcs;
try {
  const config = loadBrainConfig();
  vcsProvider = resolveProviderName({ config });
  vcs = await getVcs({ config });
} catch (e) {
  console.error(`  ✗ No se pudo inicializar el VCS: ${e.message}`);
  process.exit(1);
}

const token = vcsToken(vcsProvider, ROOT);
if (!token) {
  console.error('  ✗ Token del VCS no encontrado en .env — corré npm run env:init');
  process.exit(1);
}

// Propagate NO_PROXY from .env so Go binaries (gh/glab) bypass the internal proxy.
const noProxy = readEnvVar('NO_PROXY', ROOT) ?? readEnvVar('no_proxy', ROOT);
if (noProxy) {
  process.env.NO_PROXY = noProxy;
  process.env.no_proxy = noProxy;
}

// ── Fetch the issue through the adapter ───────────────────────────────────────
console.log(`\n  Buscando issue #${id}...`);
let issue;
try {
  issue = await vcs.issueView({ project, number: id });
} catch (e) {
  console.error(`  ✗ No se pudo obtener el issue #${id} — verificá la sesión del VCS y el id. ${e.message}`);
  process.exit(1);
}
if (!issue?.number) {
  console.error(`  ✗ Issue #${id} no encontrado en ${project}`);
  process.exit(1);
}

// ── Determine the branch type from labels ─────────────────────────────────────
const LABEL_TYPE = {
  feat: 'feat', feature: 'feat',
  fix: 'fix', bug: 'fix',
  chore: 'chore',
  docs: 'docs',
  refactor: 'refactor',
  ci: 'ci',
  build: 'build',
};
const labels = issue.labels ?? [];
const branchType = labels.map(l => LABEL_TYPE[String(l).toLowerCase()]).find(Boolean) ?? 'feat';

// ── Build the slug from the title ─────────────────────────────────────────────
const slug = issue.title
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .slice(0, 40)
  .replace(/-$/, '');

const branchName = `${branchType}/issue-${issue.number}-${slug}`;

// ── Show the issue context ────────────────────────────────────────────────────
console.log('');
console.log(`  #${issue.number}  ${issue.title}`);
if (labels.length > 0) console.log(`  Labels: ${labels.join(', ')}`);
if (issue.body?.trim()) {
  const preview = issue.body.trim().split('\n').slice(0, 6).join('\n');
  console.log('\n' + preview.split('\n').map(l => `  ${l}`).join('\n'));
}
console.log(`\n  Rama: \x1b[1m${branchName}\x1b[0m`);

// ── Update the base branch ────────────────────────────────────────────────────
console.log(`\n  Actualizando ${baseBranch}...`);
const authenticatedRemote = await vcs.repoCloneUrl({ host, project, token });
const fetchRes = spawnSync('git',
  ['fetch', authenticatedRemote, `${baseBranch}:refs/remotes/origin/${baseBranch}`],
  { cwd: ROOT, encoding: 'utf8' });
if (fetchRes.status !== 0) {
  console.error(`  ✗ No se pudo fetchear la rama base '${baseBranch}' del remoto.`);
  console.error('    ¿Existe y está pusheada? Verificá el nombre.');
  process.exit(1);
}
const startPoint = `origin/${baseBranch}`;

// ── Create the branch ─────────────────────────────────────────────────────────
// Two modes: in-place (checkout on the current working tree) or an isolated
// worktree (sibling folder with its own branch, for parallel work without clashes).
const branchExists = sh('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branchName}`]).ok;
let worktreePath = null;

if (useWorktree) {
  worktreePath = join(dirname(ROOT), `${basename(ROOT)}-issue-${id}`);

  if (existsSync(worktreePath)) {
    console.error(`  ✗ Ya existe la carpeta del worktree: ${worktreePath}`);
    console.error('    Eliminala (git worktree remove) o usá otro issue.');
    process.exit(1);
  }

  // If the branch already exists, attach it to the worktree; otherwise create it from the base.
  const wtArgs = branchExists
    ? ['worktree', 'add', worktreePath, branchName]
    : ['worktree', 'add', worktreePath, '-b', branchName, startPoint];
  const wt = sh('git', wtArgs);
  if (!wt.ok) {
    console.error(`  ✗ Error al crear el worktree: ${wt.err}`);
    process.exit(1);
  }
  console.log(`  \x1b[32m✓\x1b[0m Worktree creado en ${worktreePath}`);

  // Gotcha: the worktree does NOT inherit untracked/ignored files like .env (which
  // holds the VCS token, needed by this script and the adapter). Copy it over.
  const srcEnv = join(ROOT, '.env');
  if (existsSync(srcEnv)) {
    copyFileSync(srcEnv, join(worktreePath, '.env'));
    console.log(`  \x1b[32m✓\x1b[0m .env copiado al worktree.`);
  } else {
    console.log(`  → No hay .env en ${ROOT} — saltando copia.`);
  }
} else {
  const create = sh('git', ['checkout', '-b', branchName, startPoint]);
  if (!create.ok) {
    if (branchExists || create.err.includes('already exists')) {
      console.log('  → Rama ya existe — cambiando a ella...');
      spawnSync('git', ['checkout', branchName], { stdio: 'inherit', cwd: ROOT });
    } else {
      console.error(`  ✗ Error al crear la rama: ${create.err}`);
      process.exit(1);
    }
  } else {
    console.log(`  \x1b[32m✓\x1b[0m Rama creada y activa.`);
  }
}

// ── Next steps ────────────────────────────────────────────────────────────────
const cdStep = useWorktree ? `\n    0. cd ${worktreePath}   (abrí tu sesión de trabajo acá)` : '';
console.log(`
  Próximos pasos:${cdStep}
    1. Implementar — usá /sdd-new ${id} si el cambio es complejo
    2. npm run repo:check antes de cada commit
    3. npm run memory:share && git add .memory/ antes de pushear
    4. git push -u origin ${branchName}
`);
