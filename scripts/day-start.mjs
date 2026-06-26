#!/usr/bin/env node
// day-start.mjs — Secuencia de arranque diario: glab auth → actualizaciones → memoria → tablero.
// Uso: npm run day:start
//
// Para humanos: corre esto al iniciar la jornada, en cualquier rama.
// Para agentes IA: corre esto al retomar sesión — establece el contexto antes de trabajar.

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadBrainConfig } from './lib/brain-config.mjs';
import { highestTag, readInstalledVersion, compareSemver } from './lib/installer.mjs';

const ROOT = process.cwd();
const NODE = process.execPath;
const TOTAL = 6;
let step = 0;

const { project } = loadBrainConfig();
const GITLAB_HOST = project.gitHost;

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

// Propagar NO_PROXY desde .env para que binarios Go (glab) bypaseen el proxy interno.
const noProxy = readEnvVar('NO_PROXY') ?? readEnvVar('no_proxy');
if (noProxy) {
  process.env.NO_PROXY = noProxy;
  process.env.no_proxy = noProxy;
}

// ── 1. Autenticación GitLab (glab) ───────────────────────────────────────────
sep('Autenticación GitLab (glab)');
const glabPresent = capture('glab', ['--version']).status === 0;
if (!glabPresent) {
  info('glab no disponible — tablero de tickets desactivado.');
  console.log(`       Instalar: ${C.bold}sudo apt install glab${C.reset}`);
} else {
  const authCheck = capture('glab', ['api', '/user']);
  const authenticated = authCheck.status === 0 && authCheck.stdout.includes('"username"');
  if (authenticated) {
    const username = JSON.parse(authCheck.stdout).username ?? '?';
    ok(`glab autenticado como ${C.cyan}@${username}${C.reset}.`);
  } else {
    console.log('  Sesión de glab expirada o no iniciada — reautenticando desde .env...');
    const token = readEnvVar('GITLAB_TOKEN');
    if (!token) {
      warn(`GITLAB_TOKEN no encontrado en .env — corré ${C.bold}npm run env:init${C.reset}`);
    } else {
      const login = spawnSync(
        'glab',
        ['auth', 'login', '--hostname', GITLAB_HOST, '--git-protocol', 'https', '--stdin'],
        { input: token, stdio: ['pipe', 'inherit', 'inherit'], encoding: 'utf8', cwd: ROOT },
      );
      if (login.status === 0) {
        ok('glab autenticado.');
      } else {
        warn(`Auth falló — el token puede haber vencido. Corré ${C.bold}npm run env:init${C.reset}`);
      }
    }
  }
}

// ── 2. Sincronización de main ─────────────────────────────────────────────────
sep('Sincronización de main');
{
  // Capturamos el branch local ANTES del fetch/merge — es la referencia correcta
  // para detectar qué llegó nuevo, independientemente de si origin/main ya estaba
  // actualizado en el tracking ref local.
  const prevLocal = capture('git', ['rev-parse', 'main']).stdout.trim();
  const token = readEnvVar('GITLAB_TOKEN');
  const remoteUrl = capture('git', ['remote', 'get-url', 'origin']).stdout.trim();
  const remoteMatch = remoteUrl.match(/https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);

  if (!token || !remoteMatch) {
    warn('No se puede sincronizar main — GITLAB_TOKEN no disponible.');
  } else {
    const [, gitlabHost, projectPath] = remoteMatch;
    const authRemote = `https://oauth2:${token}@${gitlabHost}/${projectPath}.git`;
    const fetchResult = capture('git', ['fetch', authRemote, 'main:refs/remotes/origin/main']);

    if (fetchResult.status !== 0) {
      warn(`Fetch de main falló — verificá conectividad a ${C.cyan}${gitlabHost}${C.reset}`);
    } else {
      const newMain = capture('git', ['rev-parse', 'refs/remotes/origin/main']).stdout.trim();
      const currentBranch = capture('git', ['branch', '--show-current']).stdout.trim();

      if (currentBranch === 'main') {
        let merge = capture('git', ['merge', '--ff-only', 'refs/remotes/origin/main']);
        if (merge.status !== 0) {
          // Si el merge falla por archivos generados que serían sobreescritos, restaurarlos y reintentar.
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
          const encodedProject = encodeURIComponent(projectPath);

          const pipelineStatus = (sha) => {
            const r = capture('curl', [
              '-sf', '-H', `PRIVATE-TOKEN: ${token}`,
              `https://${gitlabHost}/api/v4/projects/${encodedProject}/commits/${sha}/statuses?per_page=1`,
            ]);
            if (r.status !== 0) return null;
            try { return JSON.parse(r.stdout)[0]?.status ?? null; }
            catch { return null; }
          };

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
            const status = pipelineStatus(sha);
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

// ── 3. Actualizaciones del ecosistema ────────────────────────────────────────
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

// ── 4. Versión de brain (core) ───────────────────────────────────────────────
// Check-and-notify (ADR-0006): detecta si hay una versión nueva del core y AVISA.
// NO auto-actualiza — respeta brain/core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md.
// El upgrade es siempre una decisión consciente: npm run brain:upgrade -- <tag>.
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

// ── 5. Memoria de equipo ─────────────────────────────────────────────────────
sep('Memoria de equipo');

// 4a. Auto-instalar/reparar el pre-push hook que materializa la memoria (ADR-0003).
//     No depende de re-correr bootstrap: se asegura en cada arranque, así los devs
//     que ya tienen el sistema andando lo reciben sin acción manual, y se re-instala
//     solo si alguien lo desactiva. El enforcement real es client-side por diseño:
//     el export de ~/.engram solo puede ocurrir en la máquina del dev.
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
  // 4a. Importar memoria del equipo desde .memory/ del repo → ~/.engram local
  console.log(`  ${C.dim}Importando chunks de .memory/ al DB local...${C.reset}`);
  run('engram', ['sync', '--import'], { stdio: ['inherit', 'inherit', 'pipe'] });

  // 4b. Reproyectar brain/ → ~/.engram (ADRs, anti-patterns, dominio)
  console.log(`  ${C.dim}Reproyectando brain/ a engram...${C.reset}`);
  run(NODE, ['scripts/brain-to-engram.mjs']);

  // 4c. Exportar ~/.engram → .memory/ del repo (cierra el ciclo: sin este paso, nada fluye)
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

// ── 6. Tablero de tickets ────────────────────────────────────────────────────
sep('Tablero de tickets');
run(NODE, ['scripts/tracker-board.mjs']);

// ── Listo ────────────────────────────────────────────────────────────────────
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
