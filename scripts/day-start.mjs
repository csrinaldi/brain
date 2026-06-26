#!/usr/bin/env node
// day-start.mjs — Daily startup sequence: VCS auth → updates → memory → board.
// Usage: npm run day:start
//
// For humans: run this at the start of the workday, on any branch.
// For AI agents: run this when resuming a session — sets context before working.

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadBrainConfig } from './lib/brain-config.mjs';
import { highestTag, readInstalledVersion, compareSemver } from './lib/installer.mjs';
import { getVcs, resolveProviderName } from './vcs/cli.mjs';
import { originIdentity } from './vcs/lib/repo.mjs';
import { vcsToken } from './vcs/lib/token.mjs';

const ROOT = process.cwd();
const NODE = process.execPath;
const TOTAL = 6;
let step = 0;

const config = loadBrainConfig();
const { host: VCS_HOST, project: VCS_PROJECT } = originIdentity();
let vcsProvider = null;
let vcs = null;
try {
  vcsProvider = resolveProviderName({ config });
  vcs = await getVcs({ config });
} catch { /* provider not configured — the VCS steps degrade with a warning */ }

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  bCyan:  '\x1b[1;36m',
  bGreen: '\x1b[1;32m',
};

const ok   = (msg) => console.log(`  ${C.green}✓${C.reset} ${msg}`);
const warn = (msg) => console.warn(`  ${C.yellow}⚠${C.reset} ${msg}`);
const info = (msg) => console.log(`  ${C.blue}ℹ${C.reset}  ${msg}`);

const sep = (label) => {
  step++;
  const tag = `${step}/${TOTAL}  ${label}`;
  const pad = '─'.repeat(Math.max(0, 58 - tag.length));
  console.log(`\n${C.bCyan}── ${tag} ${pad}${C.reset}`);
};

const run = (cmd, args = [], opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
  if (r.status !== 0) {
    console.warn(`  ↳ salió con código ${r.status ?? 'señal'} (no bloqueante).`);
  }
};

const capture = (cmd, args = []) =>
  spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', cwd: ROOT });

const readEnvVar = (key) => {
  try {
    const line = readFileSync(join(ROOT, '.env'), 'utf8')
      .split('\n')
      .find(l => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).trim();
  } catch { /* no .env — fall through */ }
  return process.env[key] ?? null;
};

// Propagate NO_PROXY from .env so Go binaries (gh/glab) bypass the internal proxy.
const noProxy = readEnvVar('NO_PROXY') ?? readEnvVar('no_proxy');
if (noProxy) {
  process.env.NO_PROXY = noProxy;
  process.env.no_proxy = noProxy;
}

// ── 1. VCS authentication ────────────────────────────────────────────────────
sep('Autenticación del VCS');
if (!vcs) {
  info(`Provider de VCS no configurado — seteá ${C.bold}vcs.provider${C.reset} en brain.config.json.`);
} else {
  let authed = false;
  try { authed = await vcs.authCheck({ host: VCS_HOST }); } catch { authed = false; }
  if (authed) {
    try {
      const { username } = await vcs.whoami();
      ok(`Autenticado como ${C.cyan}@${username}${C.reset} (${vcsProvider}).`);
    } catch {
      ok(`Autenticado (${vcsProvider}).`);
    }
  } else {
    console.log('  Sesión no iniciada o vencida — reautenticando desde .env...');
    const token = vcsToken(vcsProvider, ROOT);
    if (!token) {
      warn(`Token no encontrado en .env — corré ${C.bold}npm run env:init${C.reset}`);
    } else {
      let loggedIn = false;
      try { loggedIn = await vcs.authLogin({ host: VCS_HOST, token }); } catch { loggedIn = false; }
      if (loggedIn) {
        ok(`Autenticado (${vcsProvider}).`);
      } else {
        warn(`Auth falló — verificá el token o que el CLI del provider esté instalado. ${C.bold}npm run env:init${C.reset}`);
      }
    }
  }
}

// ── 2. Main sync ─────────────────────────────────────────────────────────────
sep('Sincronización de main');
{
  // Capture the local branch BEFORE fetch/merge — this is the correct reference
  // to detect what arrived new, regardless of whether origin/main was already
  // updated in the local tracking ref.
  const prevLocal = capture('git', ['rev-parse', 'main']).stdout.trim();
  const token = vcs ? vcsToken(vcsProvider, ROOT) : null;

  if (!vcs || !token || !VCS_PROJECT || !VCS_HOST) {
    warn('No se puede sincronizar main — provider de VCS o token no disponible.');
  } else {
    const authRemote = await vcs.repoCloneUrl({ host: VCS_HOST, project: VCS_PROJECT, token });
    const fetchResult = capture('git', ['fetch', authRemote, 'main:refs/remotes/origin/main']);

    if (fetchResult.status !== 0) {
      warn(`Fetch de main falló — verificá conectividad a ${C.cyan}${VCS_HOST}${C.reset}`);
    } else {
      const newMain = capture('git', ['rev-parse', 'refs/remotes/origin/main']).stdout.trim();
      const currentBranch = capture('git', ['branch', '--show-current']).stdout.trim();

      if (currentBranch === 'main') {
        let merge = capture('git', ['merge', '--ff-only', 'refs/remotes/origin/main']);
        if (merge.status !== 0) {
          // If the merge fails due to generated files that would be overwritten, restore them and retry.
          const wouldOverwrite = /serán sobrescritos al fusionar|would be overwritten by merge/;
          if (wouldOverwrite.test(merge.stderr)) {
            const blocked = merge.stderr.split('\n')
              .filter(l => /^\s+\S/.test(l) && !/Por favor|Please|confirma|commit or stash/.test(l))
              .map(l => l.trim()).filter(Boolean);
            for (const f of blocked) capture('git', ['restore', f]);
            merge = capture('git', ['merge', '--ff-only', 'refs/remotes/origin/main']);
          }
        }
        if (merge.status === 0) {
          ok(`${C.cyan}main${C.reset} actualizado (fast-forward aplicado).`);
        } else {
          warn('No se pudo aplicar pull a main — puede haber cambios locales sin commitear.');
        }
      } else {
        ok(`${C.cyan}main${C.reset} remoto actualizado (rama activa: ${C.yellow}${currentBranch}${C.reset}).`);
      }

      if (prevLocal && prevLocal !== newMain) {
        const log = capture('git', [
          'log', '--no-merges',
          '--pretty=format:%H\x1f%h\x1f%aN\x1f%s',
          `${prevLocal}..refs/remotes/origin/main`,
        ]);
        const commits = log.stdout.trim().split('\n').filter(Boolean)
          .map(l => { const [sha, short, author, subject] = l.split('\x1f'); return { sha, short, author, subject }; });

        if (commits.length > 0) {
          // CI status per commit via the VCS adapter (normalized enum).
          const badge = (status) => {
            switch (status) {
              case 'success':  return `${C.green}✓${C.reset}`;
              case 'failed':   return `${C.red}✗${C.reset}`;
              case 'running':
              case 'pending':  return `${C.yellow}~${C.reset}`;
              case 'canceled': return `${C.dim}–${C.reset}`;
              default:         return `${C.dim}·${C.reset}`;
            }
          };

          console.log(`\n  ${C.bold}${commits.length} commit(s) nuevos en main:${C.reset}\n`);
          for (const { sha, short, author, subject } of commits) {
            let status = null;
            try { status = await vcs.commitStatus({ project: VCS_PROJECT, sha }); } catch { status = null; }
            console.log(`    [${badge(status)}] ${C.dim}${short}${C.reset}  ${C.cyan}${author}${C.reset} — ${subject}`);
          }
          console.log('');
        }
      } else {
        ok(`${C.cyan}main${C.reset} ya estaba al día.`);
      }
    }
  }
}

// ── 3. Ecosystem updates ─────────────────────────────────────────────────────
sep('Actualizaciones del ecosistema');
const gaCheck = capture('gentle-ai', ['--version']);
if (gaCheck.status !== 0) {
  info('gentle-ai no disponible — skipping actualizaciones.');
  console.log(`       Instalar: ${C.bold}npm run tools:install${C.reset}`);
} else {
  console.log(`  ${C.dim}Verificando versiones...${C.reset}`);
  const check = capture('gentle-ai', ['update']);
  if (check.status === 0) {
    const updates = (check.stdout ?? '')
      .split('\n')
      .filter(l => l.includes('[UP]'));

    if (updates.length === 0) {
      ok('Todas las herramientas al día.');
    } else {
      console.log(`  ${C.yellow}${updates.length} actualización(es) disponible(s):${C.reset}\n`);
      for (const line of updates) {
        const m = line.match(/\[UP\]\s+(\S+)\s+installed:\s+(\S+)\s+latest:\s+(\S+)/);
        if (m) {
          console.log(`    ${C.cyan}%-20s${C.reset}  ${C.dim}%s${C.reset} → ${C.green}%s${C.reset}`, m[1], m[2], m[3]);
        } else {
          console.log(`   ${line.trim()}`);
        }
      }
      console.log('\n  Aplicando actualizaciones...');
      run('gentle-ai', ['upgrade']);
      ok('Listo.');
    }
  }
  capture('gentle-ai', ['skill-registry', 'refresh']);
  ok('Skill registry actualizado.');
}

// ── 4. brain (core) version ──────────────────────────────────────────────────
// Check-and-notify (ADR-0006): detects if there is a new core version and WARNS.
// Does NOT auto-update — respects brain/core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md.
// Upgrade is always a conscious decision: npm run brain:upgrade -- <tag>.
sep('Versión de brain (core)');
{
  const BRAIN_REMOTE = 'https://github.com/csrinaldi/brain.git';
  const installed = readInstalledVersion(ROOT);
  if (!installed) {
    info('No se pudo determinar la versión instalada de brain — skipping check.');
  } else {
    const ls = capture('git', ['ls-remote', '--tags', BRAIN_REMOTE]);
    if (ls.status !== 0) {
      info('No se pudo consultar tags remotos (sin red o sin acceso) — skipping check.');
    } else {
      const latest = highestTag(ls.stdout);
      if (!latest) {
        info('El remoto de brain no tiene tags de versión todavía.');
      } else if (compareSemver(latest, installed) > 0) {
        warn(`Hay una versión nueva de brain: ${C.dim}${installed}${C.reset} → ${C.green}${latest}${C.reset}`);
        console.log(`       Actualizá a conciencia: ${C.bold}npm run brain:upgrade -- ${latest}${C.reset}`);
        console.log(`       ${C.dim}(no se auto-aplica — revisá el changelog del tag antes)${C.reset}`);
      } else {
        ok(`brain al día (${C.cyan}${installed}${C.reset}).`);
      }
    }
  }
}

// ── 5. Team memory ───────────────────────────────────────────────────────────
sep('Memoria de equipo');

// 4a. Auto-install/repair the pre-push hook that materializes memory (ADR-0003).
//     Does not depend on re-running bootstrap: ensured on every startup, so devs
//     who already have the system running receive it without manual action, and it
//     re-installs itself if someone disables it. Real enforcement is client-side by design:
//     the ~/.engram export can only happen on the dev's machine.
const HOOKS_PATH = 'scripts/hooks';
const hookFile = join(ROOT, HOOKS_PATH, 'pre-push');
if (!existsSync(hookFile)) {
  warn(`Hook pre-push ausente en ${C.cyan}${HOOKS_PATH}/pre-push${C.reset} — la memoria no se materializa en el push.`);
} else {
  const currentHooks = capture('git', ['config', '--get', 'core.hooksPath']).stdout?.trim();
  if (currentHooks !== HOOKS_PATH) {
    const r = capture('git', ['config', 'core.hooksPath', HOOKS_PATH]);
    if (r.status === 0) ok(`Pre-push hook activado (${C.cyan}core.hooksPath=${HOOKS_PATH}${C.reset}).`);
    else warn('No se pudo activar el pre-push hook (core.hooksPath).');
  } else {
    ok('Pre-push hook activo — materializa la memoria antes del push.');
  }
}

const engram = capture('engram', ['--version']);
if (engram.status === 0) {
  // 4a. Import team memory from .memory/ in the repo → ~/.engram local
  console.log(`  ${C.dim}Importando chunks de .memory/ al DB local...${C.reset}`);
  run('engram', ['sync', '--import'], { stdio: ['inherit', 'inherit', 'pipe'] });

  // 4b. Re-project brain/ → ~/.engram (ADRs, anti-patterns, domain)
  console.log(`  ${C.dim}Reproyectando brain/ a engram...${C.reset}`);
  run(NODE, ['scripts/brain-to-engram.mjs']);

  // 4c. Export ~/.engram → .memory/ in the repo (closes the loop: without this step, nothing flows)
  console.log(`  ${C.dim}Exportando memoria al repo (.memory/)...${C.reset}`);
  const exportResult = capture('engram', ['sync', '--export']);
  if (exportResult.status === 0) {
    ok(`Memoria exportada a ${C.cyan}.memory/${C.reset} — lista para commitear con el próximo push.`);
  } else {
    warn('Export de engram falló — corré ' + C.bold + 'npm run memory:share' + C.reset + ' manualmente.');
  }
} else {
  info('engram no disponible — skipping memoria compartida.');
  console.log(`       Instalar: ${C.bold}gentle-ai install${C.reset}   o   ${C.bold}npm run tools:install${C.reset}`);
}

// ── 6. Ticket board ──────────────────────────────────────────────────────────
sep('Tablero de tickets');
run(NODE, ['scripts/tracker-board.mjs']);

// ── Done ─────────────────────────────────────────────────────────────────────
const div = `${C.dim}${'─'.repeat(62)}${C.reset}`;
console.log('\n' + div);
console.log(`  ${C.bGreen}Con ticket:${C.reset}`);
console.log(`    ${C.bold}npm run ticket:start -- <iid>${C.reset}   ${C.dim}(terminal)${C.reset}`);
console.log(`    ${C.bold}/ticket-start <iid>${C.reset}             ${C.dim}(Claude / agente IA)${C.reset}`);
console.log('');
console.log(`  ${C.bCyan}Sin ticket — explorá o proponé:${C.reset}`);
console.log(`    ${C.bold}/sdd-explore <idea>${C.reset}             ${C.dim}investigar antes de comprometerse${C.reset}`);
console.log(`    ${C.bold}/gitlab-issue${C.reset}                   ${C.dim}crear un issue desde una idea${C.reset}`);
console.log('');
console.log(`  ${C.dim}Antes de pushear:${C.reset}`);
console.log(`    ${C.bold}npm run repo:check && npm run memory:share${C.reset}`);
console.log(div + '\n');
