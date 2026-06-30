// brain/scripts/i18n/es.mjs — Partial Spanish catalog.
//
// Only keys that differ from English need to be listed here.
// Any key absent from this file falls back to en.mjs per-key — no whole-file
// replacement. Set docs.language: es in brain.config.json to activate.
//
// Grows as scripts are migrated in PR2 and PR3.
// Templates use the same named {placeholder} slots as en.mjs.
export default {
  // ── Seed keys (PR1) ──────────────────────────────────────────────────────────
  'day.auth.ok':         'Autenticado como @{user} ({provider}).',
  'tracker.yourTickets': 'Tus tickets',
  'common.none':         '(ninguno)',

  // ── Shared ───────────────────────────────────────────────────────────────────
  'common.signal': 'señal',

  // ── day-start.mjs (PR2) ──────────────────────────────────────────────────────
  'day.run.exitCode': '↳ salió con código {code} (no bloqueante).',

  'day.vcs.section':       'Autenticación del VCS',
  'day.main.section':      'Sincronización de main',
  'day.ecosystem.section': 'Actualizaciones del ecosistema',
  'day.brain.section':     'Versión de brain (core)',
  'day.memory.section':    'Memoria de equipo',
  'day.board.section':     'Tablero de tickets',

  'day.vcs.notConfigured':  'Provider de VCS no configurado — seteá vcs.provider en brain.config.json.',
  'day.vcs.authOk':         'Autenticado ({provider}).',
  'day.vcs.sessionExpired': 'Sesión no iniciada o vencida — reautenticando desde .env...',
  'day.vcs.tokenNotFound':  'Token no encontrado en .env — corré npm run env:init',
  'day.vcs.authFailed':     'Auth falló — verificá el token o que el CLI del provider esté instalado. npm run env:init',

  'day.main.noVcs':         'No se puede sincronizar main — provider de VCS o token no disponible.',
  'day.main.fetchFailed':   'Fetch de main falló — verificá conectividad a {host}',
  'day.main.updated':       'main actualizado (fast-forward aplicado).',
  'day.main.pullFailed':    'No se pudo aplicar pull a main — puede haber cambios locales sin commitear.',
  'day.main.remoteUpdated': 'main remoto actualizado (rama activa: {branch}).',
  'day.main.newCommits':    '{count} commit(s) nuevos en main:',
  'day.main.upToDate':      'main ya estaba al día.',

  'day.ecosystem.notAvailable':    'gentle-ai no disponible — skipping actualizaciones.',
  'day.ecosystem.install':         'Instalar: npm run tools:install',
  'day.ecosystem.checking':        'Verificando versiones...',
  'day.ecosystem.allUpToDate':     'Todas las herramientas al día.',
  'day.ecosystem.updatesAvailable':'{count} actualización(es) disponible(s):',
  'day.ecosystem.applying':        'Aplicando actualizaciones...',
  'day.ecosystem.done':            'Listo.',
  'day.ecosystem.skillRegistry':   'Skill registry actualizado.',

  'day.brain.unknownInstalled': 'No se pudo determinar la versión instalada de brain — skipping check.',
  'day.brain.noNetwork':        'No se pudo consultar tags remotos (sin red o sin acceso) — skipping check.',
  'day.brain.noTags':           'El remoto de brain no tiene tags de versión todavía.',
  'day.brain.newVersion':       'Hay una versión nueva de brain: {installed} → {latest}',
  'day.brain.upgrade':          'Actualizá a conciencia: {pm} run brain:upgrade -- {latest}',
  'day.brain.noAutoApply':      '(no se auto-aplica — revisá el changelog del tag antes)',
  'day.brain.upToDate':         'brain al día ({installed}).',

  'day.memory.hookMissing':    'Hook pre-push ausente en {path}/pre-push — la memoria no se materializa en el push.',
  'day.memory.hookActivated':  'Pre-push hook activado (core.hooksPath={hooksPath}).',
  'day.memory.hookFailed':     'No se pudo activar el pre-push hook (core.hooksPath).',
  'day.memory.hookActive':     'Pre-push hook activo — materializa la memoria antes del push.',
  'day.memory.importing':      'Importando chunks de .memory/ al DB local...',
  'day.memory.reprojecting':   'Reproyectando brain/ a engram...',
  'day.memory.exporting':      'Exportando memoria al repo (.memory/)...',
  'day.memory.exported':       'Memoria exportada a .memory/ — lista para commitear con el próximo push.',
  'day.memory.exportFailed':   'Export de engram falló — corré {pm} run memory:share manualmente.',
  'day.memory.notAvailable':   'engram no disponible — skipping memoria compartida.',
  'day.memory.install':        'Instalar: gentle-ai install   o   npm run tools:install',

  'day.done.withTicket':      'Con ticket:',
  'day.done.ticketStart':     'npm run ticket:start -- <iid>   (terminal)',
  'day.done.ticketStartAgent':'/ticket-start <iid>             (Claude / agente IA)',
  'day.done.noTicket':        'Sin ticket — explorá o proponé:',
  'day.done.sddExplore':      '/sdd-explore <idea>             investigar antes de comprometerse',
  'day.done.gitlabIssue':     '/gitlab-issue                   crear un issue desde una idea',
  'day.done.beforePush':      'Antes de pushear:',
  'day.done.checkCmd':        '{pm} run repo:check && {pm} run memory:share',

  // ── tracker-board.mjs (PR2) ───────────────────────────────────────────────────
  'tracker.noRemote':        '⚠ No se pudo detectar el remote de origin.',
  'tracker.vcsNotConfigured':'⚠ Provider de VCS no configurado: {error}',
  'tracker.noSession':       '⚠ Sin sesión de VCS autenticada para {host} — mirá https://{host}/{project}',
  'tracker.noUser':          '⚠ No se pudo obtener el usuario — solo se muestran tickets sin asignar.',
  'tracker.unassigned':      'Sin asignar',

  // ── project-status.mjs (PR2) ──────────────────────────────────────────────────
  'ps.title':             '# Estado del monorepo — proyección generada, NO editar ni guardar',
  'ps.maven.section':     '## Reactor Maven',
  'ps.maven.count':       '{count} módulo(s) en el reactor (incluye agregadores).',
  'ps.maven.orphansTitle':'⚠ Poms trackeados FUERA del reactor (no se construyen con backend:build):',
  'ps.maven.missingPom':  '(pom AUSENTE: {dir})',
  'ps.frontend.section':  '## Frontend (Nx)',
  'ps.frontend.empty':    'Sin proyectos Nx aún (frontend vacío).',
  'ps.frontend.count':    '{count} proyecto(s) Nx.',
  'ps.vcs.section':       '## Trabajo abierto',
  'ps.vcs.noRemote':      '⚠ No se pudo detectar el remote de origin.',
  'ps.vcs.notConfigured': '⚠ Provider de VCS no configurado (vcs.provider en brain.config.json).',
  'ps.vcs.noSession':     '⚠ Sin sesión de VCS autenticada — mirá https://{host}/{repo}',
  'ps.vcs.issues':        'Issues abiertos ({count}):',
  'ps.vcs.prs':           'PRs/MRs abiertos ({count}):',
  'ps.vcs.error':         '⚠ No se pudo consultar el VCS: {message}',
  'ps.footer':            '— Fin de la proyección. Para regenerar: npm run project:status',

  // ── verify-change.mjs ────────────────────────────────────────────────────────
  'verify.error.rerun':   'Corregí y volvé a correr: {pm} run change:verify',

  // ── brain-upgrade.mjs ────────────────────────────────────────────────────────
  'upgrade.error.usage':  'Uso: {pm} run brain:upgrade -- v0.1.0 [--dry-run] [--no-install] [--force]',

  // ── bootstrap.sh (PR3) ───────────────────────────────────────────────────────
  // §1 Base dependencies
  'bootstrap.deps.section': 'Dependencias base',
  'bootstrap.deps.missing': "Falta '{tool}' (requerido). Instalalo y volvé a correr env:init.",
  'bootstrap.deps.ok':      'git, python3 presentes; gestor de paquetes: {pm}',

  // §2 Ecosystem tools
  'bootstrap.ecosystem.section':  'Herramientas del ecosistema',
  'bootstrap.ecosystem.notFound': '{tool} no encontrado — {hint}',

  // §3 Personal access token
  'bootstrap.pat.section':         'Token personal de acceso (.env)',
  'bootstrap.pat.alreadySet':      '{var} ya configurado en .env',
  'bootstrap.pat.noTty':           'sin TTY: agregá {var} a .env y volvé a correr env:init',
  'bootstrap.pat.openPrompt':      '¿Abro el navegador con el formulario pre-llenado? [S/n]: ',
  'bootstrap.pat.manualUrl':       'Crealo a mano en: {url}',
  'bootstrap.pat.browserFallback': 'Si el navegador no se abrió, entrá a: {url}',
  'bootstrap.pat.enterPrompt':     'Pegá tu PAT (no se muestra): ',
  'bootstrap.pat.skipped':         'Sin token: se salta la autenticación del VCS. Volvé a correr env:init cuando lo tengas.',
  'bootstrap.pat.saved':           '{var} guardado en .env (gitignored)',

  // §4 Git credential helper
  'bootstrap.cred.section': 'Credential helper de git (HTTPS)',
  'bootstrap.cred.ok':      'push/pull por HTTPS usan tu PAT personal de .env',

  // §5 VCS authentication
  'bootstrap.auth.section':   'Autenticación del VCS',
  'bootstrap.auth.alreadyOk': 'ya autenticado contra {host}',
  'bootstrap.auth.ok':        'autenticado contra {host}',
  'bootstrap.auth.failed':    'auth falló — verificá el token en .env',
  'bootstrap.auth.noToken':   'Sin token: VCS queda sin autenticar',

  // §6 SDD harness
  'bootstrap.sdd.section':            'Implementación SDD (harness)',
  'bootstrap.sdd.prompt':             '¿Qué implementación SDD usás? [gentle-ai]: ',
  'bootstrap.sdd.ok':                 'harness: {harness} (.env)',
  'bootstrap.sdd.gentleaiMissing':    'gentle-ai ausente — brew install gentle-ai y volvé a correr env:init',
  'bootstrap.sdd.ecosystemOk':        'ecosistema ya inicializado (gentle-ai doctor)',
  'bootstrap.sdd.ecosystemConfigured':'ecosistema configurado (skills, engram, gga)',
  'bootstrap.sdd.ecosystemFailed':    'gentle-ai install falló — corrélo a mano y volvé a correr env:init',
  'bootstrap.sdd.noTty':              "sin TTY: corré 'gentle-ai install' manualmente",
  'bootstrap.sdd.registryOk':         'skill registry actualizado',
  'bootstrap.sdd.registryFailed':     'skill-registry refresh falló (no bloqueante)',
  'bootstrap.sdd.unknownHarness':     "harness '{harness}' sin rutina de init conocida — configurá sus skills a mano",
  'bootstrap.sdd.initFailed':         'init del harness falló (no bloqueante)',
  // ADR gap detection (Step 4 of gentle-ai init)
  'bootstrap.sdd.noProjectAdrs':      'No se encontraron ADRs del proyecto (brain/project/decisions/ está vacío o ausente).',
  'bootstrap.sdd.noProjectAdrsHint':  'Ejecutá /project:bootstrap-adrs en tu agente de IA para generar el conjunto inicial de ADRs (Stack, Testing, Build).',

  // §7 Team memory
  'bootstrap.memory.section':        'Memoria de equipo',
  'bootstrap.memory.prompt':         '¿Qué backend de memoria usás? [engram]: ',
  'bootstrap.memory.backend':        'backend de memoria: {backend} (.env)',
  'bootstrap.memory.hookOk':         'pre-push hook activado (materializa .memory/ antes del push — ADR-0003)',
  'bootstrap.memory.hookFailed':     'no se pudo activar core.hooksPath (pre-push hook)',
  'bootstrap.memory.nodeAbsent':     'node ausente — setup del backend engram salteado',
  'bootstrap.memory.engram.ok':      'backend engram configurado (symlink + merge driver)',
  'bootstrap.memory.engram.failed':  'memory setup falló (no bloqueante)',
  'bootstrap.memory.pull.ok':        'memoria importada (.memory/ → engram)',
  'bootstrap.memory.pull.failed':    'memory:pull falló (no bloqueante)',
  'bootstrap.memory.index.ok':       'índice durable reproyectado (brain/ → engram)',
  'bootstrap.memory.index.failed':   'memory:index falló (no bloqueante)',
  'bootstrap.memory.unknownBackend': "backend '{backend}' sin rutina de init conocida — configuralo a mano",

  // §8 Ticket board
  'bootstrap.board.section': 'Tickets abiertos en {path}',
  'bootstrap.board.failed':  'no se pudo listar tickets — mirá https://{host}/{path}',

  // §9 Done
  'bootstrap.done.section': 'Entorno listo',
  'bootstrap.done.pending': 'Pendiente: {tools}',
  'bootstrap.done.install': 'Corré: npm run tools:install  (instala todo de una)',

  // ── install-tools.sh (PR3) ────────────────────────────────────────────────────
  'tools.require.noApt': 'Este script requiere apt-get (Ubuntu/Debian). Instalá las herramientas manualmente según brain/project/methodology/developer-environment.md.',
  'tools.installed': 'ya instalado',

  'tools.apt.section':    'Paquetes del sistema (apt)',
  'tools.apt.installing': 'Instalando: {pkgs}',
  'tools.apt.ok':         'apt: {pkgs}',
  'tools.apt.allPresent': 'todos los paquetes apt ya presentes',

  'tools.vcs.section':   'CLI del VCS ({cli})',
  'tools.vcs.installed': '{cli} instalado',
  'tools.vcs.notInApt':  '{cli} no está en apt — instalalo a mano:',

  'tools.node.installing': 'Instalando nvm...',
  'tools.node.nvmOk':      'nvm instalado',
  'tools.node.nodeOk':     'node {version} via nvm',
  'tools.node.reloadShell':'Abrí una terminal nueva o ejecutá: source ~/.bashrc',

  'tools.claude.section':   'Claude Code (CLI de Anthropic)',
  'tools.claude.installed': 'claude instalado',

  'tools.gentleai.section':          'gentle-ai + ecosistema (engram, gga)',
  'tools.gentleai.installing':       'Instalando gentle-ai...',
  'tools.gentleai.ok':               'gentle-ai instalado',
  'tools.gentleai.alreadyConfigured':'ecosistema gentle-ai ya configurado',
  'tools.gentleai.configuring':      'Configurando ecosistema (engram, gga, skills)...',
  'tools.gentleai.configured':       'ecosistema configurado',
  'tools.gentleai.configFailed':     'gentle-ai install falló — reintentá a mano',

  'tools.summary.section':       'Instalación completa',
  'tools.summary.nextStep':      'Siguiente paso:',
  'tools.summary.checkVersions': 'Verifica versiones:',
  'tools.summary.notFound':      '{tool}  (no encontrado — reiniciá la terminal)',

  // ── ticket-start.mjs (PR2) ────────────────────────────────────────────────────
  'ticket.error.baseRequiresArg': '✗ --base requiere un nombre de rama. Ej: --base feature/issue-99-mi-historia',
  'ticket.error.usage':           'Uso: npm run ticket:start -- <issue-id> [--worktree] [--base <rama>]',
  'ticket.error.usageExample1':   'Ejemplo: npm run ticket:start -- 42',
  'ticket.error.usageExample2':   '         npm run ticket:start -- 42 --worktree --base feature/issue-99-mi-historia',
  'ticket.error.noRemote':        '✗ No se pudo detectar el remote de origin.',
  'ticket.error.vcsInit':         '✗ No se pudo inicializar el VCS: {message}',
  'ticket.error.tokenNotFound':   '✗ Token del VCS no encontrado en .env — corré npm run env:init',
  'ticket.fetching':              'Buscando issue #{id}...',
  'ticket.error.fetchFailed':     '✗ No se pudo obtener el issue #{id} — verificá la sesión del VCS y el id. {message}',
  'ticket.error.notFound':        '✗ Issue #{id} no encontrado en {project}',
  'ticket.labels':                'Labels: {labels}',
  'ticket.branch':                'Rama: {branch}',
  'ticket.updatingBase':          'Actualizando {base}...',
  'ticket.error.fetchBase':       '✗ No se pudo fetchear la rama base \'{branch}\' del remoto.',
  'ticket.error.fetchBaseHint':   '    ¿Existe y está pusheada? Verificá el nombre.',
  'ticket.error.worktreeExists':  '✗ Ya existe la carpeta del worktree: {path}',
  'ticket.error.worktreeExistsHint': '    Eliminala (git worktree remove) o usá otro issue.',
  'ticket.error.worktreeCreate':  '✗ Error al crear el worktree: {error}',
  'ticket.worktreeCreated':       '✓ Worktree creado en {path}',
  'ticket.envCopied':             '✓ .env copiado al worktree.',
  'ticket.noEnv':                 '→ No hay .env en {root} — saltando copia.',
  'ticket.branchExists':          '→ Rama ya existe — cambiando a ella...',
  'ticket.error.branchCreate':    '✗ Error al crear la rama: {error}',
  'ticket.branchCreated':         '✓ Rama creada y activa.',
  'ticket.nextSteps.header':      'Próximos pasos:',
  'ticket.nextSteps.cd':          '    0. cd {path}   (abrí tu sesión de trabajo acá)',
  'ticket.nextSteps.step1':       '    1. Implementar — usá /sdd-new {id} si el cambio es complejo',
  'ticket.nextSteps.step2':       '    2. {pm} run repo:check antes de cada commit',
  'ticket.nextSteps.step3':       '    3. {pm} run memory:share && git add .memory/ antes de pushear',
  'ticket.nextSteps.step4':       '    4. git push -u origin {branch}',

  // ── ticket-start.mjs — feature working memory (Slice 3) ─────────────────────
  'ticket.resume.noContext': '→ No se encontró contexto de reanudación — continuando.',

  // ── session-start.mjs (issue #138, PR3) ───────────────────────────────────────
  'session.header':             'brain · contexto de sesión',
  'session.branch':             'rama:      {branch}',
  'session.branch.unknown':     '(desconocida)',
  'session.change.one':         'cambio:    {change}',
  'session.change.none':        'cambio:    (sin carpeta de cambio para la rama)',
  'session.change.ambiguous':   'cambio:    ambiguo ({count}): {list}',
  'session.memory.ok':          'memoria:   engram hidratado',
  'session.memory.skip':        'memoria:   engram no disponible (omitido)',
  'session.manifest.restored':  'manifest:  cambios descartados (seguro)',
  'session.ticket.label':       'ticket:',
  'session.ticket.none':        '(sin memoria de ticket activa)',
};
