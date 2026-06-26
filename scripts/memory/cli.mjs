#!/usr/bin/env node
// scripts/memory/cli.mjs — MEMORY_BACKEND dispatcher.
//
// Usage: node scripts/memory/cli.mjs <op>
//   op: share | pull | index | setup
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
const VALID_OPS = ["share", "pull", "index", "setup"];
const op = process.argv[2];

if (!op) {
  console.error(`memory/cli: missing <op>. Valid ops: ${VALID_OPS.join(", ")}`);
  process.exit(1);
}

if (!VALID_OPS.includes(op)) {
  console.error(`memory/cli: unknown op '${op}'. Valid ops: ${VALID_OPS.join(", ")}`);
  process.exit(1);
}

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

if (typeof backend[op] !== "function") {
  console.error(`memory/cli: backend '${MEMORY_BACKEND}' does not implement op '${op}'`);
  process.exit(1);
}

try {
  await backend[op]();
} catch (err) {
  console.error(`memory/cli: ${MEMORY_BACKEND}.${op}() failed — ${err.message}`);
  process.exit(1);
}
