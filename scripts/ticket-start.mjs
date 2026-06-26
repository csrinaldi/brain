#!/usr/bin/env node
// ticket-start.mjs — Toma un issue de GitLab y crea la rama de trabajo.
// Uso: npm run ticket:start -- <iid>                (checkout in-place desde main)
//      npm run ticket:start -- <iid> --worktree     (worktree aislado desde main)
//      npm run ticket:start -- <iid> --base <rama>  (base distinta, ej. un tracker de historia)
//      node scripts/ticket-start.mjs <iid> [--worktree] [--base <rama>]

import { spawnSync } from 'node:child_process';
import { readFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

const ROOT = process.cwd();

const argv = process.argv.slice(2);
const useWorktree = argv.includes('--worktree');
const baseIdx = argv.indexOf('--base');
const baseBranch = baseIdx >= 0 ? argv[baseIdx + 1] : 'main';
if (baseIdx >= 0 && !baseBranch) {
  console.error('  ✗ --base requiere un nombre de rama. Ej: --base feature/issue-99-mi-historia');
  process.exit(1);
}
// iid = primer argumento numérico que NO sea el valor de --base
const iid = argv.find((a, i) => /^\d+$/.test(a) && (baseIdx < 0 || i !== baseIdx + 1));
if (!iid) {
  console.error('Uso: npm run ticket:start -- <issue-iid> [--worktree] [--base <rama>]');
  console.error('Ejemplo: npm run ticket:start -- 42');
  console.error('         npm run ticket:start -- 42 --worktree --base feature/issue-99-mi-historia');
  process.exit(1);
}

const readEnvVar = (key) => {
  try {
    const line = readFileSync(join(ROOT, '.env'), 'utf8')
      .split('\n')
      .find(l => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).trim();
  } catch { /* no .env — fall through */ }
  return process.env[key] ?? null;
};

const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: ROOT, stdio: 'pipe', ...opts });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};

// ── Detectar remote GitLab ────────────────────────────────────────────────────
const remoteResult = sh('git', ['remote', 'get-url', 'origin']);
const remoteMatch = remoteResult.out.match(/https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
if (!remoteMatch) {
  console.error('  ✗ No se pudo detectar el remote GitLab desde origin');
  process.exit(1);
}
const gitlabHost = remoteMatch[1];
const projectPath = remoteMatch[2];
const encodedPath = encodeURIComponent(projectPath);

// ── Verificar token ───────────────────────────────────────────────────────────
const token = readEnvVar('GITLAB_TOKEN');
if (!token) {
  console.error('  ✗ GITLAB_TOKEN no encontrado en .env — corré npm run env:init');
  process.exit(1);
}

// ── Propagar NO_PROXY si está en .env ─────────────────────────────────────────
const noProxy = readEnvVar('NO_PROXY') ?? readEnvVar('no_proxy');
if (noProxy) {
  process.env.NO_PROXY = noProxy;
  process.env.no_proxy = noProxy;
}

// ── Fetch issue desde la API ──────────────────────────────────────────────────
console.log(`\n  Buscando issue #${iid}...`);
const apiResult = sh('curl', [
  '-s', '-f',
  '-H', `PRIVATE-TOKEN: ${token}`,
  `https://${gitlabHost}/api/v4/projects/${encodedPath}/issues/${iid}`,
]);
if (!apiResult.ok) {
  console.error(`  ✗ No se pudo obtener el issue #${iid} — verificá el token y la red`);
  process.exit(1);
}

let issue;
try { issue = JSON.parse(apiResult.out); }
catch { console.error('  ✗ Respuesta inesperada de la API'); process.exit(1); }

if (!issue?.iid) {
  console.error(`  ✗ Issue #${iid} no encontrado en ${projectPath}`);
  process.exit(1);
}

// ── Determinar tipo de rama por labels ────────────────────────────────────────
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
const branchType = labels.map(l => LABEL_TYPE[l.toLowerCase()]).find(Boolean) ?? 'feat';

// ── Generar slug desde el título ──────────────────────────────────────────────
const slug = issue.title
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .slice(0, 40)
  .replace(/-$/, '');

const branchName = `${branchType}/issue-${iid}-${slug}`;

// ── Mostrar contexto del issue ────────────────────────────────────────────────
console.log('');
console.log(`  #${issue.iid}  ${issue.title}`);
if (labels.length > 0) console.log(`  Labels: ${labels.join(', ')}`);
if (issue.description?.trim()) {
  const preview = issue.description.trim().split('\n').slice(0, 6).join('\n');
  console.log('\n' + preview.split('\n').map(l => `  ${l}`).join('\n'));
}
console.log(`\n  Rama: \x1b[1m${branchName}\x1b[0m`);

// ── Actualizar la rama base ───────────────────────────────────────────────────
console.log(`\n  Actualizando ${baseBranch}...`);
const authenticatedRemote = `https://oauth2:${token}@${gitlabHost}/${projectPath}.git`;
const fetchRes = spawnSync('git',
  ['fetch', authenticatedRemote, `${baseBranch}:refs/remotes/origin/${baseBranch}`],
  { cwd: ROOT, encoding: 'utf8' });
if (fetchRes.status !== 0) {
  console.error(`  ✗ No se pudo fetchear la rama base '${baseBranch}' del remoto.`);
  console.error('    ¿Existe y está pusheada? Verificá el nombre.');
  process.exit(1);
}
const startPoint = `origin/${baseBranch}`;

// ── Crear la rama ─────────────────────────────────────────────────────────────
// Dos modos: in-place (checkout sobre el working tree actual) o worktree aislado
// (carpeta hermana con su propia rama, para trabajo en paralelo sin colisiones).
const branchExists = sh('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branchName}`]).ok;
let worktreePath = null;

if (useWorktree) {
  worktreePath = join(dirname(ROOT), `${basename(ROOT)}-issue-${iid}`);

  if (existsSync(worktreePath)) {
    console.error(`  ✗ Ya existe la carpeta del worktree: ${worktreePath}`);
    console.error('    Eliminala (git worktree remove) o usá otro issue.');
    process.exit(1);
  }

  // Si la rama ya existe, adjuntarla al worktree; si no, crearla desde la base.
  const wtArgs = branchExists
    ? ['worktree', 'add', worktreePath, branchName]
    : ['worktree', 'add', worktreePath, '-b', branchName, startPoint];
  const wt = sh('git', wtArgs);
  if (!wt.ok) {
    console.error(`  ✗ Error al crear el worktree: ${wt.err}`);
    process.exit(1);
  }
  console.log(`  \x1b[32m✓\x1b[0m Worktree creado en ${worktreePath}`);

  // Gotcha: el worktree NO hereda archivos untracked/ignored como .env (tiene
  // GITLAB_TOKEN, necesario para este script y la API de GitLab). Lo copiamos.
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

// ── Próximos pasos ────────────────────────────────────────────────────────────
const cdStep = useWorktree ? `\n    0. cd ${worktreePath}   (abrí tu sesión de trabajo acá)` : '';
console.log(`
  Próximos pasos:${cdStep}
    1. Implementar — usá /sdd-new ${iid} si el cambio es complejo
    2. npm run repo:check antes de cada commit
    3. npm run memory:share && git add .memory/ antes de pushear
    4. git push -u origin ${branchName}
`);
