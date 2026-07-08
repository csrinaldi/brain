#!/usr/bin/env node
// brain/scripts/memory/cli.mjs — MEMORY_BACKEND dispatcher.
//
// Usage: node brain/scripts/memory/cli.mjs <op>
//   op: share | pull | import | index | reindex | setup | feature-checkpoint | feature-resume
//
//   pull    — churn-resilient full pull: manifest restore + git pull + engram import.
//             Use for cross-machine sync (npm run memory:pull).
//   import  — import-only: engram sync --import, no git pull.
//             Use after git already pulled (post-merge hook, day-start step 5).
//   reindex — regenerate .memory/index.jsonl from .memory/records/ alone
//             (REQ-MF-4, issue #205). Backend-agnostic: dispatched directly
//             here, not through backends/<backend>.mjs — the record format is
//             brain-owned and independent of the live memory backend.
//
// Reads MEMORY_BACKEND from the environment or .env (default: engram).
// Imports the corresponding backend from ./backends/<backend>.mjs and
// dispatches the requested operation.
//
// Pattern mirrors SDD_HARNESS dispatch in brain/scripts/bootstrap.sh §6.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { t } from "../i18n/t.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

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
  "reindex",
  "migrate-v1",
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

// ---------------------------------------------------------------------------
// "reindex" is backend-agnostic: the durable record format (.memory/records/,
// .memory/index.jsonl) is brain-owned (ADR-0017), not a MEMORY_BACKEND concern.
// Dispatched directly here instead of through backends/<backend>.mjs.
// ---------------------------------------------------------------------------
if (op === "reindex") {
  const { rebuildIndex } = await import("./lib/store.mjs");
  try {
    const { count } = rebuildIndex({
      recordsDir: join(repoRoot, ".memory", "records"),
      indexPath: join(repoRoot, ".memory", "index.jsonl"),
    });
    console.log(`memory/cli: ${await t("memory.reindex.done", { count })}`);
    process.exit(0);
  } catch (err) {
    console.error(`memory/cli: ${await t("memory.reindex.failed", { message: err.message })}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// "migrate-v1" is likewise backend-agnostic (chunks → records is a durable-
// format concern, ADR-0017 — not a MEMORY_BACKEND one). C2a scope: `--dry-run`
// only. The persisting real run (records/ writes, chunks → .memory/legacy/,
// idempotency abort, reindex) is C2b — see design.md's dual-write pipeline.
// ---------------------------------------------------------------------------
if (op === "migrate-v1") {
  const { collectChunkObservations, buildMigrationReport } = await import("./lib/migrate-v1.mjs");
  if (!process.argv.includes("--dry-run")) {
    console.error(`memory/cli: ${await t("memory.migrateV1.realRunPending")}`);
    process.exit(1);
  }
  const chunksDir = join(repoRoot, ".memory", "chunks");
  const { observations, unparseable, emptyObservations } = collectChunkObservations(chunksDir);
  const report = buildMigrationReport(observations, { unparseable, emptyObservations });

  console.log(await t("memory.migrateV1.dryRunHeader"));
  console.log(
    await t("memory.migrateV1.summary", {
      records: report.recordCount,
      skipped: report.skippedPersonal,
      rejected: report.rejected.length,
      unparseable: report.unparseableChunks.length,
      emptyObservations: report.emptyObservationsChunks.length,
    }),
  );
  console.log(await t("memory.migrateV1.typesHistogramHeader"));
  for (const [type, count] of Object.entries(report.typesHistogram).sort()) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(
    await t("memory.migrateV1.provenanceHistogramHeader", {
      recovered: report.provenanceHistogram.recovered,
      fallback: report.provenanceHistogram.fallback,
    }),
  );
  if (report.rejected.length > 0) {
    console.log(await t("memory.migrateV1.rejectedHeader"));
    for (const r of report.rejected) {
      console.log(`  - id=${r.id} type=${r.type} title="${r.title}" reason=${r.reason}`);
    }
  }
  if (report.emptyObservationsChunks.length > 0) {
    console.log(await t("memory.migrateV1.emptyObservationsHeader"));
    for (const f of report.emptyObservationsChunks) console.log(`  - ${f}`);
  }
  if (report.unparseableChunks.length > 0) {
    console.log(await t("memory.migrateV1.unparseableHeader"));
    for (const f of report.unparseableChunks) console.log(`  - ${f}`);
    console.log(`  ${report.unparseableNote}`);
  }
  process.exit(0);
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
