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
 *   1. Ensure .engram → .memory symlink exists (ADR-0003).
 *   2. Register the merge driver for .memory/manifest.json.
 *
 * Called by bootstrap.sh §7 via: node scripts/memory/cli.mjs setup
 */
export async function setup() {
  // 1. Ensure symlink .engram → .memory
  const symlinkPath = join(repoRoot, ".engram");
  let targetExists = false;
  try { lstatSync(join(repoRoot, ".memory")); targetExists = true; } catch { /* not found */ }

  // lstatSync does not throw for symlinks (even broken ones); use try/catch for the
  // case where the path simply does not exist at all.
  let symlinkAlreadyExists = false;
  try {
    lstatSync(symlinkPath); // succeeds for regular files, dirs, AND symlinks
    symlinkAlreadyExists = true;
  } catch {
    symlinkAlreadyExists = false;
  }

  if (!targetExists) {
    console.warn("  ⚠ .memory/ does not exist yet — skipping symlink creation");
  } else if (symlinkAlreadyExists) {
    console.log("  ✓ .engram → .memory symlink already in place");
  } else {
    symlinkSync(".memory", symlinkPath);
    console.log("  ✓ .engram → .memory symlink created");
  }

  // 2. Register merge driver for manifest.json
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
