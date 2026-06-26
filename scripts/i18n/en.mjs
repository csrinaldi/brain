// scripts/i18n/en.mjs — Canonical English catalog.
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
  'day.vcs.tokenNotFound':  'Token not found in .env — run npm run env:init',
  'day.vcs.authFailed':     'Auth failed — check the token or that the provider CLI is installed. npm run env:init',

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
  'day.brain.upgrade':          'Upgrade consciously: npm run brain:upgrade -- {latest}',
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
  'day.memory.exportFailed':   'engram export failed — run npm run memory:share manually.',
  'day.memory.notAvailable':   'engram not available — skipping shared memory.',
  'day.memory.install':        'Install: gentle-ai install   or   npm run tools:install',

  // Done footer
  'day.done.withTicket':      'With a ticket:',
  'day.done.ticketStart':     'npm run ticket:start -- <iid>   (terminal)',
  'day.done.ticketStartAgent':'/ticket-start <iid>             (Claude / AI agent)',
  'day.done.noTicket':        'No ticket — explore or propose:',
  'day.done.sddExplore':      '/sdd-explore <idea>             explore before committing',
  'day.done.gitlabIssue':     '/gitlab-issue                   create an issue from an idea',
  'day.done.beforePush':      'Before pushing:',
  'day.done.checkCmd':        'npm run repo:check && npm run memory:share',

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
  'ps.footer':            '— End of projection. To regenerate: npm run project:status',

  // ── ticket-start.mjs (PR2) ────────────────────────────────────────────────────
  'ticket.error.baseRequiresArg': '✗ --base requires a branch name. Example: --base feature/issue-99-my-story',
  'ticket.error.usage':           'Usage: npm run ticket:start -- <issue-id> [--worktree] [--base <branch>]',
  'ticket.error.usageExample1':   'Example: npm run ticket:start -- 42',
  'ticket.error.usageExample2':   '         npm run ticket:start -- 42 --worktree --base feature/issue-99-my-story',
  'ticket.error.noRemote':        '✗ Could not detect origin remote.',
  'ticket.error.vcsInit':         '✗ Could not initialize VCS: {message}',
  'ticket.error.tokenNotFound':   '✗ VCS token not found in .env — run npm run env:init',
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
  'ticket.nextSteps.step2':       '    2. npm run repo:check before each commit',
  'ticket.nextSteps.step3':       '    3. npm run memory:share && git add .memory/ before pushing',
  'ticket.nextSteps.step4':       '    4. git push -u origin {branch}',
};
