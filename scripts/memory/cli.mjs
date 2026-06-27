#!/usr/bin/env node
// scripts/memory/cli.mjs — MEMORY_BACKEND dispatcher.
//
// Usage: node scripts/memory/cli.mjs <op>
//   op: share | pull | import | index | setup | feature-checkpoint | feature-resume
//
//   pull   — churn-resilient full pull: manifest restore + git pull + engram import.
//            Use for cross-machine sync (npm run memory:pull).
//   import — import-only: engram sync --import, no git pull.
//            Use after git already pulled (post-merge hook, day-start step 5).
//
// Reads MEMORY_BACKEND from the environment or .env (default: engram).
// Imports the corresponding backend from ./backends/<backend>.mjs and
// dispatches the requested operation.
//
// Pattern mirrors SDD_HARNESS dispatch in scripts/bootstrap.sh §6.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

// ---------------------------------------------------------------------------
// Read MEMORY_BACKEND: env var > .env file > default "engram"
// ---------------------------------------------------------------------------
function readEnvFile() {
  const envPath = join(repoRoot, ".env");
  if (!existsSync(envPath)) return {};
  const vars = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

const envVars = readEnvFile();
const MEMORY_BACKEND = process.env.MEMORY_BACKEND ?? envVars.MEMORY_BACKEND ?? "engram";

// ---------------------------------------------------------------------------
// Validate op
// ---------------------------------------------------------------------------
const VALID_OPS = [
  "share",
  "pull",
  "import",
  "index",
  "setup",
  "feature-checkpoint",
  "feature-resume",
];
const op = process.argv[2];

if (!op) {
  console.error(`memory/cli: missing <op>. Valid ops: ${VALID_OPS.join(", ")}`);
  process.exit(1);
}

if (!VALID_OPS.includes(op)) {
  console.error(`memory/cli: unknown op '${op}'. Valid ops: ${VALID_OPS.join(", ")}`);
  process.exit(1);
}

// Map verb strings that cannot be valid JS export names to their actual export name.
// "import" is a reserved keyword in JS — the backend export is named "importMemory".
const VERB_TO_EXPORT = { import: "importMemory" };

// Normalize hyphenated op to camelCase for export name lookup,
// then apply reserved-keyword overrides.
// e.g. "feature-checkpoint" → "featureCheckpoint", "import" → "importMemory"
const fn = VERB_TO_EXPORT[op] ?? op.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// ---------------------------------------------------------------------------
// Load backend and dispatch
// ---------------------------------------------------------------------------
const backendPath = new URL(`./backends/${MEMORY_BACKEND}.mjs`, import.meta.url);

let backend;
try {
  backend = await import(backendPath);
} catch (err) {
  console.error(`memory/cli: backend '${MEMORY_BACKEND}' not found at ${backendPath.pathname}`);
  console.error(`  Cause: ${err.message}`);
  process.exit(1);
}

if (typeof backend[fn] !== "function") {
  console.error(`memory/cli: backend '${MEMORY_BACKEND}' does not implement op '${op}'`);
  process.exit(1);
}

try {
  // Forward positional args (e.g., [feature]) to the backend function.
  await backend[fn](...process.argv.slice(3));
} catch (err) {
  console.error(`memory/cli: ${MEMORY_BACKEND}.${fn}() failed — ${err.message}`);
  process.exit(1);
}
