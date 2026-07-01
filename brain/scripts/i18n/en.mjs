// brain/scripts/i18n/en.mjs — Canonical English catalog.
//
// Every key used by any brain script must live here. Other locale catalogs
// (e.g. es.mjs) are partial; any key they omit falls back to this file
// per-key. Templates use named {placeholder} slots for dynamic values.
//
// Keys are dotted, grouped by script: <script>.<section>.<name>
// e.g. 'day.auth.ok', 'tracker.yourTickets', 'common.none'
//
// Grows as scripts are migrated in PR2 and PR3.
export default {
  // ── Seed keys (PR1) ──────────────────────────────────────────────────────────
  'day.auth.ok':        'Authenticated as @{user} ({provider}).',
  'tracker.yourTickets': 'Your tickets',
  'common.none':        '(none)',

  // ── Shared ───────────────────────────────────────────────────────────────────
  'common.signal': 'signal',

  // ── day-start.mjs (PR2) ──────────────────────────────────────────────────────
  // run() utility
  'day.run.exitCode': '↳ exited with code {code} (non-blocking).',

  // Section headers
  'day.vcs.section':       'VCS authentication',
  'day.main.section':      'Main branch sync',
  'day.ecosystem.section': 'Ecosystem updates',
  'day.brain.section':     'brain version (core)',
  'day.memory.section':    'Team memory',
  'day.board.section':     'Ticket board',

  // VCS authentication
  'day.vcs.notConfigured':  'VCS provider not configured — set vcs.provider in brain.config.json.',
  'day.vcs.authOk':         'Authenticated ({provider}).',
  'day.vcs.sessionExpired': 'Session not started or expired — re-authenticating from .env...',
  'day.vcs.tokenNotFound':  'Token not found in .env — run brain:env:init',
  'day.vcs.authFailed':     'Auth failed — check the token or that the provider CLI is installed. brain:env:init',

  // Main sync
  'day.main.noVcs':         'Cannot sync main — VCS provider or token not available.',
  'day.main.fetchFailed':   'Fetch of main failed — check connectivity to {host}',
  'day.main.updated':       'main updated (fast-forward applied).',
  'day.main.pullFailed':    'Could not pull main — there may be uncommitted local changes.',
  'day.main.remoteUpdated': 'Remote main updated (active branch: {branch}).',
  'day.main.newCommits':    '{count} new commit(s) in main:',
  'day.main.upToDate':      'main was already up to date.',

  // Ecosystem updates
  'day.ecosystem.notAvailable':    'gentle-ai not available — skipping updates.',
  'day.ecosystem.install':         'Install: npm run tools:install',
  'day.ecosystem.checking':        'Checking versions...',
  'day.ecosystem.allUpToDate':     'All tools up to date.',
  'day.ecosystem.updatesAvailable':'{count} update(s) available:',
  'day.ecosystem.applying':        'Applying updates...',
  'day.ecosystem.done':            'Done.',
  'day.ecosystem.skillRegistry':   'Skill registry updated.',

  // brain version
  'day.brain.unknownInstalled': 'Could not determine installed brain version — skipping check.',
  'day.brain.noNetwork':        'Could not query remote tags (no network or access) — skipping check.',
  'day.brain.noTags':           'The brain remote has no version tags yet.',
  'day.brain.newVersion':       'New brain version available: {installed} → {latest}',
  'day.brain.upgrade':          'Upgrade consciously: {pm} run brain:upgrade -- {latest}',
  'day.brain.noAutoApply':      '(not auto-applied — review the tag changelog first)',
  'day.brain.upToDate':         'brain up to date ({installed}).',

  // Team memory
  'day.memory.hookMissing':    'Pre-push hook missing at {path}/pre-push — memory will not materialize on push.',
  'day.memory.hookActivated':  'Pre-push hook activated (core.hooksPath={hooksPath}).',
  'day.memory.hookFailed':     'Could not activate the pre-push hook (core.hooksPath).',
  'day.memory.hookActive':     'Pre-push hook active — materializes memory before push.',
  'day.memory.importing':      'Importing chunks from .memory/ to local DB...',
  'day.memory.reprojecting':   'Reprojecting brain/ to engram...',
  'day.memory.exporting':      'Exporting memory to repo (.memory/)...',
  'day.memory.exported':       'Memory exported to .memory/ — ready to commit with the next push.',
  'day.memory.exportFailed':   'engram export failed — run {pm} run memory:share manually.',
  'day.memory.notAvailable':   'engram not available — skipping shared memory.',
  'day.memory.install':        'Install: gentle-ai install   or   npm run tools:install',

  // Done footer
  'day.done.withTicket':      'With a ticket:',
  'day.done.ticketStart':     'brain:ticket:start -- <iid>   (terminal)',
  'day.done.ticketStartAgent':'/ticket-start <iid>             (Claude / AI agent)',
  'day.done.noTicket':        'No ticket — explore or propose:',
  'day.done.sddExplore':      '/sdd-explore <idea>             explore before committing',
  'day.done.gitlabIssue':     '/gitlab-issue                   create an issue from an idea',
  'day.done.beforePush':      'Before pushing:',
  'day.done.checkCmd':        '{pm} run brain:repo:check && {pm} run memory:share',

  // ── tracker-board.mjs (PR2) ───────────────────────────────────────────────────
  'tracker.noRemote':        '⚠ Could not detect origin remote.',
  'tracker.vcsNotConfigured':'⚠ VCS provider not configured: {error}',
  'tracker.noSession':       '⚠ No authenticated VCS session for {host} — see https://{host}/{project}',
  'tracker.noUser':          '⚠ Could not get user — only unassigned tickets are shown.',
  'tracker.unassigned':      'Unassigned',

  // ── project-status.mjs (PR2) ──────────────────────────────────────────────────
  'ps.title':             '# Project state — generated projection, DO NOT edit or save',
  'ps.maven.section':     '## Maven Reactor',
  'ps.maven.count':       '{count} module(s) in the reactor (includes aggregators).',
  'ps.maven.orphansTitle':'⚠ Tracked poms OUTSIDE the reactor (not built with backend:build):',
  'ps.maven.missingPom':  '(pom MISSING: {dir})',
  'ps.frontend.section':  '## Frontend (Nx)',
  'ps.frontend.empty':    'No Nx projects yet (empty frontend).',
  'ps.frontend.count':    '{count} Nx project(s).',
  'ps.vcs.section':       '## Open work',
  'ps.vcs.noRemote':      '⚠ Could not detect origin remote.',
  'ps.vcs.notConfigured': '⚠ VCS provider not configured (vcs.provider in brain.config.json).',
  'ps.vcs.noSession':     '⚠ No authenticated VCS session — see https://{host}/{repo}',
  'ps.vcs.issues':        'Open issues ({count}):',
  'ps.vcs.prs':           'Open PRs/MRs ({count}):',
  'ps.vcs.error':         '⚠ Could not query VCS: {message}',
  'ps.footer':            '— End of projection. To regenerate: brain:project:status',

  // ── verify-change.mjs ────────────────────────────────────────────────────────
  'verify.error.rerun':   'Fix and re-run: {pm} run brain:change:verify',

  // ── brain-upgrade.mjs ────────────────────────────────────────────────────────
  'upgrade.error.usage':  'Usage: {pm} run brain:upgrade -- v0.1.0 [--dry-run] [--no-install] [--force]',

  // ── bootstrap.sh (PR3) ───────────────────────────────────────────────────────
  // §1 Base dependencies
  'bootstrap.deps.section': 'Base dependencies',
  'bootstrap.deps.missing': "Missing '{tool}' (required). Install it and re-run brain:env:init.",
  'bootstrap.deps.ok':      'git, python3 present; package manager: {pm}',

  // §2 Ecosystem tools
  'bootstrap.ecosystem.section':  'Ecosystem tools',
  // {tool} = tool name, {hint} = install hint command/URL (always English)
  'bootstrap.ecosystem.notFound': '{tool} not found — {hint}',

  // §3 Personal access token
  'bootstrap.pat.section':         'Personal access token (.env)',
  'bootstrap.pat.alreadySet':      '{var} already set in .env',
  'bootstrap.pat.noTty':           'no TTY: add {var} to .env and re-run brain:env:init',
  'bootstrap.pat.openPrompt':      'Open the browser with the pre-filled form? [Y/n]: ',
  'bootstrap.pat.manualUrl':       'Create it manually at: {url}',
  'bootstrap.pat.browserFallback': 'If the browser did not open, go to: {url}',
  'bootstrap.pat.enterPrompt':     'Paste your PAT (not shown): ',
  'bootstrap.pat.skipped':         'No token: skipping VCS authentication. Re-run brain:env:init when you have it.',
  'bootstrap.pat.saved':           '{var} saved in .env (gitignored)',

  // §4 Git credential helper
  'bootstrap.cred.section': 'Git credential helper (HTTPS)',
  'bootstrap.cred.ok':      'push/pull over HTTPS use your personal PAT from .env',

  // §5 VCS authentication
  'bootstrap.auth.section':   'VCS authentication',
  // {host} = VCS host (e.g. github.com)
  'bootstrap.auth.alreadyOk': 'already authenticated against {host}',
  'bootstrap.auth.ok':        'authenticated against {host}',
  'bootstrap.auth.failed':    'auth failed — check the token in .env',
  'bootstrap.auth.noToken':   'No token: VCS remains unauthenticated',

  // §6 SDD harness
  'bootstrap.sdd.section':            'SDD implementation (harness)',
  'bootstrap.sdd.prompt':             'Which SDD implementation do you use? [gentle-ai]: ',
  // {harness} = harness name (e.g. gentle-ai)
  'bootstrap.sdd.ok':                 'harness: {harness} (.env)',
  'bootstrap.sdd.gentleaiMissing':    'gentle-ai missing — brew install gentle-ai and re-run brain:env:init',
  'bootstrap.sdd.ecosystemOk':        'ecosystem already initialized (gentle-ai doctor)',
  'bootstrap.sdd.ecosystemConfigured':'ecosystem configured (skills, engram, gga)',
  'bootstrap.sdd.ecosystemFailed':    'gentle-ai install failed — run it manually and re-run brain:env:init',
  'bootstrap.sdd.noTty':              "no TTY: run 'gentle-ai install' manually",
  'bootstrap.sdd.registryOk':         'skill registry updated',
  'bootstrap.sdd.registryFailed':     'skill-registry refresh failed (non-blocking)',
  // {harness} = unknown harness name
  'bootstrap.sdd.unknownHarness':     "harness '{harness}' has no known init routine — configure its skills manually",
  // no {placeholder} — generic failure from brain/scripts/harness/cli.mjs init
  'bootstrap.sdd.initFailed':         'harness init failed (non-blocking)',
  // ADR gap detection (Step 4 of gentle-ai init)
  'bootstrap.sdd.noProjectAdrs':      'No project ADRs found (brain/project/decisions/ is empty or absent).',
  'bootstrap.sdd.noProjectAdrsHint':  'Run /project:bootstrap-adrs in your AI agent to draft the starter ADR set (Stack, Testing, Build).',

  // §7 Team memory
  'bootstrap.memory.section':        'Team memory',
  'bootstrap.memory.prompt':         'Which memory backend do you use? [engram]: ',
  // {backend} = backend name (e.g. engram)
  'bootstrap.memory.backend':        'memory backend: {backend} (.env)',
  'bootstrap.memory.hookOk':         'pre-push hook activated (materializes .memory/ before push — ADR-0003)',
  'bootstrap.memory.hookFailed':     'could not activate core.hooksPath (pre-push hook)',
  'bootstrap.memory.nodeAbsent':     'node absent — engram backend setup skipped',
  'bootstrap.memory.engram.ok':      'engram backend configured (symlink + merge driver)',
  'bootstrap.memory.engram.failed':  'memory setup failed (non-blocking)',
  'bootstrap.memory.pull.ok':        'memory imported (.memory/ → engram)',
  'bootstrap.memory.pull.failed':    'memory:pull failed (non-blocking)',
  'bootstrap.memory.index.ok':       'durable index reprojected (brain/ → engram)',
  'bootstrap.memory.index.failed':   'memory:index failed (non-blocking)',
  // {backend} = unknown backend name
  'bootstrap.memory.unknownBackend': "backend '{backend}' has no known init routine — configure it manually",

  // §8 Ticket board  — {path} = PROJECT_PATH, {host} = VCS_HOST
  'bootstrap.board.section': 'Open tickets in {path}',
  'bootstrap.board.failed':  'could not list tickets — see https://{host}/{path}',

  // §9 Done
  'bootstrap.done.section': 'Environment ready',
  // {tools} = space-separated list of missing optional tools
  'bootstrap.done.pending': 'Pending: {tools}',
  'bootstrap.done.install': 'Run: npm run tools:install  (installs all at once)',

  // ── install-tools.sh (PR3) ────────────────────────────────────────────────────
  // Pre-check (before eval — inline English default used in the script)
  'tools.require.noApt': 'This script requires apt-get (Ubuntu/Debian). Install the tools manually following brain/project/methodology/developer-environment.md.',

  // skip() helper — "already installed" suffix
  'tools.installed': 'already installed',

  // §1 apt packages — {pkgs} = space-separated package list
  'tools.apt.section':    'System packages (apt)',
  'tools.apt.installing': 'Installing: {pkgs}',
  'tools.apt.ok':         'apt: {pkgs}',
  'tools.apt.allPresent': 'all apt packages already present',

  // §1b VCS CLI — {cli} = cli binary name (gh / glab)
  'tools.vcs.section':   'VCS CLI ({cli})',
  'tools.vcs.installed': '{cli} installed',
  'tools.vcs.notInApt':  '{cli} is not in apt — install it manually:',

  // §2 Node.js — {version} = node version string
  'tools.node.installing': 'Installing nvm...',
  'tools.node.nvmOk':      'nvm installed',
  'tools.node.nodeOk':     'node {version} via nvm',
  'tools.node.reloadShell':'Open a new terminal or run: source ~/.bashrc',

  // §3 Claude Code
  'tools.claude.section':    'Claude Code (Anthropic CLI)',
  'tools.claude.installed':  'claude installed',

  // §4 gentle-ai
  'tools.gentleai.section':          'gentle-ai + ecosystem (engram, gga)',
  'tools.gentleai.installing':       'Installing gentle-ai...',
  'tools.gentleai.ok':               'gentle-ai installed',
  'tools.gentleai.alreadyConfigured':'gentle-ai ecosystem already configured',
  'tools.gentleai.configuring':      'Configuring ecosystem (engram, gga, skills)...',
  'tools.gentleai.configured':       'ecosystem configured',
  'tools.gentleai.configFailed':     'gentle-ai install failed — retry manually',

  // §5 Summary — {tool} = binary name
  'tools.summary.section':       'Installation complete',
  'tools.summary.nextStep':      'Next step:',
  'tools.summary.checkVersions': 'Check versions:',
  'tools.summary.notFound':      '{tool}  (not found — restart the terminal)',

  // ── ticket-start.mjs (PR2) ────────────────────────────────────────────────────
  'ticket.error.baseRequiresArg': '✗ --base requires a branch name. Example: --base feature/issue-99-my-story',
  'ticket.error.usage':           'Usage: brain:ticket:start -- <issue-id> [--worktree] [--base <branch>]',
  'ticket.error.usageExample1':   'Example: brain:ticket:start -- 42',
  'ticket.error.usageExample2':   '         brain:ticket:start -- 42 --worktree --base feature/issue-99-my-story',
  'ticket.error.noRemote':        '✗ Could not detect origin remote.',
  'ticket.error.vcsInit':         '✗ Could not initialize VCS: {message}',
  'ticket.error.tokenNotFound':   '✗ VCS token not found in .env — run brain:env:init',
  'ticket.fetching':              'Searching for issue #{id}...',
  'ticket.error.fetchFailed':     '✗ Could not get issue #{id} — check VCS session and ID. {message}',
  'ticket.error.notFound':        '✗ Issue #{id} not found in {project}',
  'ticket.labels':                'Labels: {labels}',
  'ticket.branch':                'Branch: {branch}',
  'ticket.updatingBase':          'Updating {base}...',
  'ticket.error.fetchBase':       '✗ Could not fetch base branch \'{branch}\' from remote.',
  'ticket.error.fetchBaseHint':   '    Does it exist and is it pushed? Check the name.',
  'ticket.error.worktreeExists':  '✗ Worktree folder already exists: {path}',
  'ticket.error.worktreeExistsHint': '    Remove it (git worktree remove) or use a different issue.',
  'ticket.error.worktreeCreate':  '✗ Error creating worktree: {error}',
  'ticket.worktreeCreated':       '✓ Worktree created at {path}',
  'ticket.envCopied':             '✓ .env copied to worktree.',
  'ticket.noEnv':                 '→ No .env at {root} — skipping copy.',
  'ticket.branchExists':          '→ Branch already exists — switching to it...',
  'ticket.error.branchCreate':    '✗ Error creating branch: {error}',
  'ticket.branchCreated':         '✓ Branch created and active.',
  'ticket.nextSteps.header':      'Next steps:',
  'ticket.nextSteps.cd':          '    0. cd {path}   (open your work session here)',
  'ticket.nextSteps.step1':       '    1. Implement — use /sdd-new {id} if the change is complex',
  'ticket.nextSteps.step2':       '    2. {pm} run brain:repo:check before each commit',
  'ticket.nextSteps.step3':       '    3. {pm} run memory:share && git add .memory/ before pushing',
  'ticket.nextSteps.step4':       '    4. git push -u origin {branch}',

  // ── ticket-start.mjs — feature working memory (Slice 3) ─────────────────────
  'ticket.resume.noContext': '→ No feature resume context found — continuing.',

  // ── session-start.mjs (issue #138, PR3) ───────────────────────────────────────
  // Resolved ONCE (as templates, placeholders intact) in session-start.mjs's CLI
  // entry via t(), then interpolated synchronously by the pure renderContextBlock
  // (design §1.8). {branch}/{change}/{count}/{list} are filled at render time.
  'session.header':             'brain · session context',
  'session.branch':             'branch:   {branch}',
  'session.branch.unknown':     '(unknown)',
  'session.change.one':         'change:   {change}',
  'session.change.none':        'change:   (no change folder for branch)',
  'session.change.ambiguous':   'change:   ambiguous ({count}): {list}',
  'session.memory.ok':          'memory:   engram hydrated',
  'session.memory.skip':        'memory:   engram unavailable (skipped)',
  'session.manifest.restored':  'manifest: churn restored (safe)',
  'session.ticket.label':       'ticket:',
  'session.ticket.none':        '(no active ticket memory)',
};
