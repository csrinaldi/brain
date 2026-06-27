#!/usr/bin/env node
// scripts/memory/backends/engram.mjs — engram backend for the MEMORY_BACKEND dispatcher.
//
// Encapsulates all engram-specific operations. Exported functions are called by
// scripts/memory/cli.mjs; no caller should invoke the `engram` binary directly.
//
// Operations:
//   share()  — export live memory to .memory/ (engram sync)
//   pull()   — import .memory/ into engram    (engram sync --import)
//   index()  — project brain/ docs into engram (delegates to brain-to-engram.mjs)
//   setup()  — ensure .engram → .memory symlink + register merge driver

import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * ensureMemorySymlink(root) — idempotent: guarantees .engram → .memory symlink.
 *
 * Scenarios (ADR-0002 / REQ-S0-1):
 *   1. .memory/ exists, .engram absent          → create symlink.
 *   2. .memory/ exists, .engram is a symlink    → already correct, no-op.
 *   3. .memory/ exists, .engram is a real dir   → warn and skip (do not clobber).
 *      This protects machines that have not yet pulled the git mv migration.
 *   4. .memory/ absent                          → warn and skip (fresh clone pre-import).
 *
 * @param {string} [root=repoRoot]  Repo root; defaults to this package's root.
 *                                  Override in tests to use temp directories.
 */
export function ensureMemorySymlink(root = repoRoot) {
  const symlinkPath = join(root, ".engram");
  const targetPath = join(root, ".memory");

  // Does the target (.memory/) exist at all?
  let targetExists = false;
  try {
    lstatSync(targetPath);
    targetExists = true;
  } catch {
    /* not found */
  }

  if (!targetExists) {
    console.warn("  ⚠ .memory/ does not exist yet — skipping symlink creation");
    return;
  }

  // What is .engram right now?
  let engramStat = null;
  try {
    engramStat = lstatSync(symlinkPath);
  } catch {
    /* .engram does not exist — normal post-migration state on a fresh clone */
  }

  if (engramStat === null) {
    // Normal case: create the symlink.
    symlinkSync(".memory", symlinkPath);
    console.log("  ✓ .engram → .memory symlink created");
  } else if (engramStat.isSymbolicLink()) {
    // Already a symlink — idempotent, nothing to do.
    console.log("  ✓ .engram → .memory symlink already in place");
  } else {
    // .engram is a real file or directory — do not clobber; warn instead.
    // Most likely cause: this machine has not yet pulled the git mv migration.
    console.warn(
      "  ⚠ .engram is a real directory — pull the migration before re-running setup",
    );
  }
}

/**
 * Resolve the `engram` binary. Throws if not found.
 */
function requireEngram() {
  const result = spawnSync("which", ["engram"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("engram binary not found. Install via: gentle-ai install");
  }
  return "engram";
}

/**
 * share() — export live engram memory to .memory/ (idempotent, content-addressed).
 * Equivalent to what `memory:share` used to do directly.
 */
export async function share() {
  const engram = requireEngram();
  execFileSync(engram, ["sync", "--export"], { stdio: "inherit" });
}

/**
 * pull() — import .memory/ into engram.
 * Equivalent to what `memory:pull` used to do directly.
 */
export async function pull() {
  const engram = requireEngram();
  execFileSync(engram, ["sync", "--import"], { stdio: "inherit" });
}

/**
 * index() — project brain/ documents into engram.
 * Delegates entirely to brain-to-engram.mjs — no logic duplication.
 */
export async function index() {
  const scriptPath = join(repoRoot, "scripts", "brain-to-engram.mjs");
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    cwd: repoRoot,
  });
  if (result.status !== 0) {
    throw new Error(`brain-to-engram.mjs exited with status ${result.status}`);
  }
}

/**
 * setup() — idempotent setup for the engram backend:
 *   1. Ensure .engram → .memory symlink (delegates to ensureMemorySymlink).
 *   2. Register the merge driver for .memory/manifest.json (ADR-0002).
 *
 * Called by bootstrap.sh §7 via: node scripts/memory/cli.mjs setup
 */
export async function setup() {
  // 1. Ensure symlink .engram → .memory using the hardened helper.
  ensureMemorySymlink();

  // 2. Register merge driver for .memory/manifest.json.
  const result = spawnSync(
    "git",
    [
      "config",
      "merge.engram-manifest.driver",
      "node scripts/merge-engram-manifest.mjs %O %A %B",
    ],
    { stdio: "inherit", cwd: repoRoot },
  );
  if (result.status !== 0) {
    throw new Error("Failed to register engram-manifest merge driver");
  }
  console.log("  ✓ merge driver engram-manifest registered");
}
