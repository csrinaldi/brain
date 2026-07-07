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
];
