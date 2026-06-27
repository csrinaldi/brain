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
// Glob syntax (matched by scripts/lib/installer.mjs):
//   *   matches anything except a path separator
//   **  matches anything, including path separators (recursive)
//   A trailing `/**` matches every file under that directory.

// Paths brain owns. The upgrade OVERWRITES these in the consumer.
export const managed = [
  'brain/core/**',
  'scripts/**',
  '.gitattributes',
  '.github/workflows/governance.yml',   // the L1 gate travels with brain (ADR-0014)
  '.github/PULL_REQUEST_TEMPLATE.md',   // the Closes/Fixes scaffold the gate parses (ADR-0014)
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
