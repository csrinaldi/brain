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

// Paths brain owns. The upgrade OVERWRITES these in the consumer.
export const managed = [
  'brain/core/**',
  'brain/scripts/**',
  '.gitattributes',
  '.github/workflows/governance.yml',   // the L1 gate travels with brain (ADR-0014)
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
