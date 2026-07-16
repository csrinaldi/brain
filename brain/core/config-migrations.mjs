// config-migrations.mjs — Versioned, additive migrations for brain.config.json.
//
// When a new brain version adds keys to the config schema, it registers a
// migration here. Migrations are ADDITIVE: they fill in keys that are missing
// and NEVER overwrite a value the consumer already set (ADR-0006 acceptance
// criterion). This makes every migration idempotent — re-running it is a no-op.
//
// The installer applies, in order, every migration whose `version` is greater
// than the consumer's recorded `schemaVersion` (stored in brain.config.json),
// up to the target version being installed. Each migration receives the current
// config and a `mergeDefaults(existing, defaults)` helper that preserves
// existing leaf values while adding missing ones.
//
// To add a migration: append an entry { version, description, defaults } (the
// common additive case) OR { version, description, migrate(config, helpers) }
// for renames / restructures. `defaults` is sugar for a pure additive merge.

export const migrations = [
  {
    version: '0.1.0',
    description: 'Initial schema: project identity fields.',
    defaults: {
      project: {
        name: '',
        slug: '',
        gitHost: '',
        gitProjectId: '',
        owner: '',
      },
    },
  },
  {
    version: '0.2.0',
    description: 'Add docs.language: language for project-authored docs (ADR-0009). core is always English.',
    defaults: {
      docs: {
        language: 'en',
      },
    },
  },
  {
    version: '0.3.0',
    description: 'Add vcs.provider selector (ADR-0008): github | gitlab | ...',
    defaults: {
      vcs: {
        provider: '',
      },
    },
  },
  {
    version: '0.4.0',
    description: 'Add governance.ignoreList: globs excluded from the diff-size gate (ADR-0014).',
    defaults: {
      governance: {
        ignoreList: [
          '.memory/**',
          'openspec/changes/**',
          'package-lock.json',
          'pnpm-lock.yaml',
          'yarn.lock',
        ],
      },
    },
  },
  {
    version: '0.5.0',
    description:
      'Add governance.memorySecretPatterns + governance.memorySecretAllowPatterns: the ' +
      'fail-closed memory:share secret scanner (issue #214) and its sole, committed bypass ' +
      '(no CLI flag — brain/scripts/memory/lib/secret-scrub.mjs#DEFAULT_SECRET_PATTERNS mirrors ' +
      'the pattern list below; the two are guarded against drift by installer.test.mjs).',
    defaults: {
      governance: {
        memorySecretPatterns: [
          'ghp_[A-Za-z0-9]{20,}',
          'github_pat_[A-Za-z0-9_]{20,}',
          'glpat-[A-Za-z0-9_-]{20,}',
          'AKIA[0-9A-Z]{16}',
          '-----BEGIN [A-Z ]*PRIVATE KEY-----',
        ],
        memorySecretAllowPatterns: [],
      },
    },
  },
  {
    version: '0.7.0',
    description:
      'Add governance.approvedLabel: the provider-resolved approved-issue label ' +
      '(issue #231 A2 phase 1). Default is the plain base form status:approved; ' +
      'resolveApprovedLabel() (brain/scripts/governance/approved-label.mjs) maps it ' +
      'to the GitLab scoped form (::) at read time. A consumer-set value wins.',
    defaults: {
      governance: {
        approvedLabel: 'status:approved',
      },
    },
  },
  {
    version: '0.8.0',
    description:
      'Add reviewer.{handle,tokenEnv}: the cold external reviewer\'s identity ' +
      'pointer (issue #266 H1, comment 4992662021). Git carries the env var ' +
      'NAME only, never the token VALUE — brain:review refuses to run and ' +
      'prints instructions when env[tokenEnv] is absent (REQ-H1-1). ' +
      'governance.reviewActors ships absent until a reviewer identity is ' +
      'minted (protocol §11) — a decoupled human keystroke, not part of this ' +
      'migration.',
    defaults: {
      reviewer: {
        handle: '',
        tokenEnv: 'BRAIN_REVIEWER_TOKEN',
      },
    },
  },
];

// NOTE (issue #231 A2, human ruling in tasks.md/design.md): this entry is versioned
// 0.7.0, NOT the 0.6.0 gap left by C4's removal of the never-shipped `memory.dualWrite`
// entry (see the note below). Version numbers are content-identifiers and are never
// reused — a reused 0.6.0 would name two indistinguishable states, and this repo ran
// under a real 0.6.0-dualWrite during the C2b-1/C2b-2 cutover window, so that window's
// archaeology needs the number to mean ONE thing. DOCTRINE: retire-by-deletion includes
// the version slot; the migration sequence is monotonic-forever.

// NOTE (D3/C4, issue #229): the 0.6.0 migration entry that added `memory.dualWrite`
// (issue #221, C2b-1) was REMOVED here, not left inert. This is safe ONLY because
// the entry was never shipped to any released consumer — verified CLEAN:
// `git tag --contains 654e86c` (the commit that introduced it) returns NONE; the
// commit exists only on `feature/v2.0.0`, never on `main`, and is not an ancestor
// of any tag. Doctrine: never-shipped keys retire BY DELETION pre-release, since
// there is no consumer to honor. Post-release retirement (the first real one) will
// use tolerate-and-ignore + deprecation warning instead — see design.md for C4.
