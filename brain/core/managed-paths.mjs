// managed-paths.mjs — Distribution manifest for the brain versioned installer.
//
// Defines which paths are UPSTREAM (managed by brain, overwritten on upgrade)
// versus LOCAL (owned by the consumer, never touched). This is the contract
// that enforces ADR-0003 / ADR-0006: "core is read-only in the consumer".
//
// `brain:upgrade` copies only `managed` paths from the installed brain package
// into the consumer repo. `local` paths are listed explicitly as a safety net:
// if a glob ever overlaps, the installer skips the path and warns rather than
// risking a clobber of the consumer's own work.
//
// Glob syntax (matched by brain/scripts/lib/installer.mjs):
//   *   matches anything except a path separator
//   **  matches anything, including path separators (recursive)
//   A trailing `/**` matches every file under that directory.

// The 9 brain:* verb keys that brain:upgrade injects into consumer package.json.
// Single source of truth — imported by installer.mjs mergePackageJson.
export const MANAGED_SCRIPT_KEYS = [
  'brain:env:init',
  'brain:day:start',
  'brain:session:start',
  'brain:ticket:start',
  'brain:project:feature',
  'brain:project:status',
  'brain:tracker:board',
  'brain:repo:check',
  'brain:change:verify',
];

// The .gitattributes line declaring git's BUILT-IN `union` merge driver for the
// brain-owned durable record log (ADR-0017, REQ-MF-3, issue #214/C1b). Unlike
// the legacy `merge=engram-manifest` line, this needs NO per-clone `git config`
// registration. Single source of truth — drift-guarded against the real
// `.gitattributes` file by managed-paths.test.mjs.
export const RECORDS_UNION_MERGE_GITATTRIBUTES_LINE = '/.memory/records/*.jsonl merge=union';

// Paths brain owns. The upgrade OVERWRITES these in the consumer.
export const managed = [
  'brain/core/**',
  'brain/scripts/**',
  '.gitattributes',
  '.github/workflows/governance.yml',   // the L1 gate travels with brain (ADR-0014)
  'brain/scripts/ci/gitlab-governance.yml', // opt-in GitLab governance pipeline fragment (issue #231
                                             // A2, design.md Decision 1). LITERAL only — brain never
                                             // manages the consumer's root .gitlab-ci.yml (that file
                                             // stays LOCAL; adoption is a single `include: local:` line
                                             // the consumer adds themselves).
  '.github/workflows/release.yml',      // L2 rung-2/rung-3 enforcement travels with brain (issue #176)
  '.github/workflows/governance-postmerge.yml', // L2 rung-2/rung-3 enforcement travels with brain (issue #176)
  '.github/PULL_REQUEST_TEMPLATE.md',   // the Closes/Fixes scaffold the gate parses (ADR-0014)
  '.github/CODEOWNERS',                 // L6 rung-1 enhancement, optional (REQ-L6-1, design §6.2)
  '.claude/settings.json',              // Claude Code harness hook — no-verify policy (ADR-0014 §9)
  'package.json', // additive brain:* verb injection via specialMerge (S5, issue #137).
                  // MUST stay registered in brain-upgrade.mjs specialMerge — a plain copy would overwrite the consumer's package.json.
];

// Paths the consumer owns. The upgrade NEVER touches these.
// Listed explicitly so the installer can refuse to copy anything that
// (accidentally) matches both sets — local always wins.
export const local = [
  'brain/project/**',
  'brain.config.json',
  '.env',
  'openspec/changes/**',
  '.memory/**',
];
