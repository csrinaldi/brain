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
      'fail-closed brain:memory:share secret scanner (issue #214) and its sole, committed bypass ' +
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
      "Add reviewer.{handle,tokenEnv}: the cold reviewer's identity pointer " +
      '(issue #266 H1, comment 4992662021) — git carries the env var NAME, ' +
      'never the token VALUE (REQ-H1-1). governance.reviewActors stays absent.',
    defaults: {
      reviewer: { handle: '', tokenEnv: 'BRAIN_REVIEWER_TOKEN' },
    },
  },
  // #1124: this entry's `standard` protects EXISTING consumers and stays. A NEW
  // consumer's `lite` is not a migration default: it is NEW_CONSUMER_DEFAULTS
  // below, which migrateConfig never reads.
  {
    version: '0.9.0',
    description:
      'Add governance.tier: the declared doctrine axis (issue #358 Q5), orthogonal ' +
      "to the detected substrate rung (ADR-0015). Default is 'standard' — REQ-TIER-10 " +
      "requires 'standard' to be behaviourally equivalent to brain's pre-tier doctrine, " +
      'so this migration is a no-op for every existing consumer (governance-tiers.mjs ' +
      "resolves the SAME REQUIRED_JOBS/DETECTION_JOBS split at 'standard' as before " +
      "tiering existed). A default of 'lite' is forbidden — it would silently weaken " +
      'governance on upgrade. See ADR-0026.',
    defaults: {
      governance: {
        tier: 'standard',
      },
    },
  },
  {
    version: '0.10.0',
    description:
      'Add sdd.map: the stage → engine router (issue #323, first inhabited by ' +
      "#682's cold-review stage per ADR-0033). Empty by default — an unrouted " +
      'stage is the honest default, and a shipped entry would spawn an engine ' +
      'nobody asked for.',
    defaults: {
      sdd: {
        map: {},
      },
    },
  },
  {
    version: "1.2.0",
    description: "Add sdd.stages: the declared stage set (issue #456 slice A). Empty by default — the four lifecycle stages live in code (sdd-layout.mjs LIFECYCLE_STAGES), never in a consumer config, so an upgrade cannot introduce a fourth declaration of them in a file no test can guard. ADDITIVE-ONLY: a declared set omitting one of the four is REFUSED (maintainer ruling 2026-08-29; ADR-0019 Amendment 1 condition 4).",
    defaults: {
      sdd: {
        stages: {}
      }
    }
  },
  {
    version: "1.3.0",
    description: "Add sdd.configs: per-stage configuration general to all stages — agent and enabled state (issue #312 slice A, design D3). Empty by default: a stage absent from sdd.configs takes the inhabitant's declared defaults, so an upgrade cannot silently disable or reassign a stage nobody configured.",
    defaults: {
      sdd: {
        configs: {}
      }
    }
  },
  {
    version: "1.4.0",
    description: "Add sdd.engines: the record of what each SDD_ENGINE framework declared when brain:engines --record last interrogated it (issue #824, written ONLY through brain:config — Compuerta 4). Empty by default: an engine nobody recorded is honestly absent, and absence is distinguishable from 'interrogated and declared nothing'.",
    defaults: {
      sdd: {
        engines: {}
      }
    }
  },
  {
    version: "1.6.0",
    description:
      "Add memory.lane.enabled: the runtime guard both #906 triggers (the detaching " +
      "SessionEnd launcher and the synchronous day:start sweep) read before spawning " +
      "`memory/cli.mjs ship` (ADR-0034 L5, issue #906 A6). Default false on EVERY " +
      "tier, always — flipping it is a maintainer act, gated on #889 D7.2's first " +
      "manual lane PR merging, never a migration default. NOTE (A6, measured): this " +
      "entry is DORMANT until package.json is cut to >=1.6.0 (migrateConfig applies " +
      "only m.version <= targetVersion, and targetVersion is the installed " +
      "package.json version — 1.5.0 at the time this entry was written). " +
      "Correctness does not depend on it: the launcher and the sweep both treat an " +
      "absent memory.lane.enabled as false (loadBrainConfig reads raw JSON, no " +
      "migration), and `brain:config set memory.lane.enabled true` is accepted " +
      "immediately regardless — deriveKnownPaths walks every migration's defaults " +
      "with no version filter (config-verb.mjs). Version 1.5.0 was rejected: " +
      "migrateConfig stamps schemaVersion = targetVersion, so a consumer already " +
      "stamped 1.5.0 would silently skip a same-numbered entry forever. " +
      "EXCEPTION (measured, #906 cold review C1): dormancy is a property of " +
      "migrateConfig()'s targetVersion filter, not of this list — " +
      "buildDefaultConfig() (lib/brain-config.mjs) applies EVERY migration " +
      "UNFILTERED and stamps schemaVersion to the latest entry, so a config " +
      "built fresh on this codebase already carries schemaVersion=1.6.0 and " +
      "memory.lane.enabled=false even while package.json reads 1.5.0. Two " +
      "measured consequences follow from that gap between the file on disk and " +
      "the version that shipped it: (1) release-debt.mjs reports " +
      "severity:'migration' from the moment this entry merges, not from the " +
      "1.6.0 cut; (2) a consumer whose config was built on this exact codebase " +
      "cannot `brain:upgrade` to any version below 1.6.0 without " +
      "--allow-downgrade, because its stamped schemaVersion already reads " +
      "ahead of its own package.json. The real remedy is cutting 1.6.0 " +
      "promptly, not a code change to this entry — recorded in design.md's " +
      "Risks table for the maintainer.",
    defaults: {
      memory: {
        lane: {
          enabled: false,
        },
      },
    },
  },
  {
    version: "1.9.1",
    description:
      "Add memory.backend: the team's memory backend selector (issue #1165). Empty by " +
      "default — the vcs.provider convention: '' is UNDECLARED, and a declared-but-empty " +
      "key changes nothing for an existing consumer, whose backend keeps coming from " +
      "process env / .env exactly as before. A non-empty default is forbidden: it would " +
      "silently choose a backend for a team that never chose one, which is the defect " +
      "(MEMORY_BACKEND lived only in the untracked .env, so a second checkout ran " +
      "engram while the team used plainfiles). Set once, in tracked config, by env:init " +
      "or `brain:config set memory.backend <engram|plainfiles>`. Versioned 1.9.1, the " +
      "smallest version above the shipped 1.9.0, so it applies on whichever of 1.9.1 / " +
      "1.10.0 is cut next. Resolution: brain/scripts/memory/lib/backend-resolve.mjs.",
    defaults: {
      memory: {
        backend: "",
      },
    },
  },
  {
    version: "1.11.1",
    description:
      "Move every axis to the ADR-0038 shape: { default, providers } for vcs, memory, platform " +
      "and sdd (issue #1114 S3.2). No consumer changes behaviour: each default is the value that " +
      "axis EFFECTIVELY resolves to today (process env, then .env, then the config's own key, " +
      "then today's code default for platform and sdd; undeclared memory and vcs stay \"\"), and " +
      "brain:upgrade prints every value it wrote with its source. No `version` is written, except " +
      "the `brain` SDD provider's \"self\". A custom stage routed in sdd.map adds its runtime to " +
      "platform.providers as {}, and cold-review gets sdd.roles['cold-review'] = " +
      "{ agent: 'brain:cold-review', engine, model }. sdd.map and sdd.configs are not reshaped " +
      "(#1132). The legacy keys (memory.backend, vcs.provider, engine, harness) STAY for the alias " +
      "window: shell readers (install-tools.sh, bootstrap.sh), the brain-config scaffold and the " +
      "brain:config verb still read or write them, and readAxis prefers the shape. The one key that " +
      "cannot stay is the flat `platform` string, which is the same key as the new `platform` object. " +
      "Needs the axisContext migrateConfig hands it (brain-upgrade and brain:config build it from " +
      "env and .env); with none, the entry changes nothing, so buildDefaultConfig is untouched. " +
      "Versioned 1.11.1, the smallest version above the shipped 1.11.0.",
    migrate: migrateToAxisShape,
  },
];

// ── 1.11.1: the ADR-0038 axis shape ─────────────────────────────────────────
// Pure over (config, helpers.axisContext). The context carries the two values that live outside
// the file (see brain/scripts/lib/axis-migration-context.mjs); everything else is read from the
// config itself. `helpers.notice(line)` is optional: the caller that prints (brain:upgrade) gets
// one line per value written.
function migrateToAxisShape(config, helpers = {}) {
  const ctx = helpers.axisContext;
  if (!ctx) return config;
  const say = (line) => { if (typeof helpers.notice === 'function') helpers.notice(line); };
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const has = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k);
  const isShape = (n) => isObj(n) && (has(n, 'default') || has(n, 'providers'));
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  const perMachine = (source) => /^(process env|\.env)/.test(source);

  const out = structuredClone(config);

  const toShape = (axis, value, source) => {
    if (isShape(out[axis])) return;
    const node = isObj(out[axis]) ? out[axis] : {};
    out[axis] = { ...node, default: value, providers: value ? { [value]: {} } : {} };
    if (value === '') {
      say(`${axis}.default = "" (undeclared: ${source} is empty; declare it with: npm run brain:config -- set ${axis}.default <name>)`);
    } else {
      say(`${axis}.default = ${value} (from ${source})` +
        (perMachine(source) ? ' - a per-machine value, now the team\'s tracked default' : ''));
    }
  };

  toShape('memory', text(out.memory?.backend), 'brain.config.json memory.backend');
  toShape('vcs', text(out.vcs?.provider), 'brain.config.json vcs.provider');
  toShape('platform', ctx.platform.value, ctx.platform.source);
  toShape('sdd', ctx.sdd.value, ctx.sdd.source);

  // The `brain` SDD provider: what brain already runs, given a name. "self" is the one version a
  // migration may write (ratified point 3): it is the package's own, not the machine's.
  if (isObj(out.sdd.providers) && !has(out.sdd.providers, 'brain')) {
    out.sdd.providers.brain = { version: 'self' };
    say('sdd.providers.brain = {"version":"self"} (brain\'s own provider, declared on every consumer)');
  }

  // Routed engines (ADR-0038 section 7). A LIFECYCLE stage's engine is a framework and is never a
  // platform provider; a CUSTOM stage's engine is a runtime and is.
  const lifecycle = new Set(ctx.lifecycleStages ?? []);
  const map = isObj(out.sdd.map) ? out.sdd.map : {};
  for (const [stage, route] of Object.entries(map)) {
    const engine = text(route?.engine);
    if (!engine || lifecycle.has(stage)) continue;
    if (isObj(out.platform.providers) && !has(out.platform.providers, engine)) {
      out.platform.providers[engine] = {};
      say(`platform.providers.${engine} = {} (runtime routed by sdd.map["${stage}"].engine)`);
    }
    if (stage === 'cold-review' && !has(out.sdd.roles, stage)) {
      const role = { agent: 'brain:cold-review', engine };
      const model = text(route?.model);
      if (model) role.model = model;
      out.sdd.roles = { ...(isObj(out.sdd.roles) ? out.sdd.roles : {}), [stage]: role };
      say(`sdd.roles["${stage}"] = ${JSON.stringify(role)} (from sdd.map["${stage}"])`);
    }
  }
  return out;
}

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

// NEW_CONSUMER_DEFAULTS (issue #1124, ADR-0026 Amendment 8) — what a config env:init
// CREATES declares, beyond the migrations. Kept OUT of the `migrations` list on
// purpose: `migrateConfig` walks that list for EXISTING consumers, and a `lite`
// there would silently weaken every one of them on upgrade — the reason the
// 0.9.0 entry above defaults to `standard`. A new consumer has nothing to weaken:
// the default tier is chosen for the one-maintainer repository that runs
// env:init first, and env:init says so, why, and how to change it
// (lib/tier-notice.mjs).
//
// buildDefaultConfig() (lib/brain-config.mjs) merges this FIRST and the
// migrations after it. mergeDefaults never overwrites a value already present, so
// a fresh config is exactly "a consumer that declared lite before any migration
// ran" — the same path a declared tier already takes through every upgrade.
export const NEW_CONSUMER_DEFAULTS = Object.freeze({
  governance: Object.freeze({ tier: 'lite' }),
});
