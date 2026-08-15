#!/usr/bin/env node
// brain/scripts/memory/cli.mjs — MEMORY_BACKEND dispatcher.
//
// Usage: node brain/scripts/memory/cli.mjs <op>
//   op: share | pull | import | index | reindex | setup | feature-checkpoint | feature-resume
//
//   pull    — churn-resilient full pull: manifest restore + git pull + engram import.
//             Use for cross-machine sync (npm run memory:pull).
//   import  — import-only: records-only engram hydrate (D2/C4), no git pull.
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
import { formatDuplicateReport } from "./lib/duplicates.mjs";
import {
  DEFAULT_BACKEND,
  ENGRAM_BIN,
  FALLBACK_BACKEND,
  REASON,
  probeBinary,
  selectBackend,
} from "./lib/backend-selection.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

// ---------------------------------------------------------------------------
// Read MEMORY_BACKEND: env var > .env file > default "engram"
// ---------------------------------------------------------------------------
// BRAIN_MEMORY_ENV_FILE (test-only seam, mirroring BRAIN_MEMORY_TEST_ROOT and
// BRAIN_MIGRATE_V1_TEST_ROOT below): when set, `.env` is read from that path
// instead of `<repoRoot>/.env`. NEVER set this outside tests.
//
// It exists because the STATED-vs-DEFAULTED distinction added for #641 is read
// partly OUT OF `.env`, and `.env` is gitignored — so whether a maintainer's
// machine happens to carry `MEMORY_BACKEND=engram` decided the outcome of the
// very branch under test. That is the ambient-state trap #657's suite already
// hit with `$VCS_TOKEN`: green here, red on the maintainer's box, for reasons
// having nothing to do with the code.
function readEnvFile() {
  const envPath = process.env.BRAIN_MEMORY_ENV_FILE ?? join(repoRoot, ".env");
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
// STATED vs DEFAULTED (issue #641). The resolved value alone cannot tell the two
// apart — `MEMORY_BACKEND=engram` in `.env` and no `.env` at all both come out
// "engram" — and the fallback further down turns on exactly that distinction: an
// unstated default may be filled in, an operator's stated selector may not.
const STATED_BACKEND = process.env.MEMORY_BACKEND ?? envVars.MEMORY_BACKEND;
const MEMORY_BACKEND = STATED_BACKEND ?? DEFAULT_BACKEND;

// ---------------------------------------------------------------------------
// Duplicate reporting (issue #574) — the ONE printer, used by every op.
//
// The rule itself lives in lib/duplicates.mjs and is enforced in
// lib/store.mjs#rebuildIndex; this is the half that makes it audible. Before
// #574 the store's second failure mode reached a human through no path at all:
// `rebuildIndex` collapsed repeated ids into its Map and returned only a count,
// `plainfiles.share` returned an `indexCount` nobody printed, and
// `engram.share` returned undefined outright — which also meant the #541
// `unprovenanced` line below could never fire on the engram backend, since
// there was never a `result` to read it from.
//
// Printed for ANY op whose result carries the accounting, rather than
// per-verb: a rule that only speaks on the verbs someone remembered to wire up
// is the silence this ticket is about.
//
// To STDERR, not stdout, for the reason importMemory already states about its
// own skip notice: the automated callers discard stdout. `brain/scripts/hooks/
// post-merge` runs `cli.mjs import >/dev/null || true` — deliberately keeping
// stderr — and post-merge is the exact moment a union merge mints a duplicate.
// A report on stdout would be written to /dev/null on every pull, which is the
// same outage in a different pipe. (`pre-push`'s `share` and post-merge's
// `resolve-index` still use `2>&1 >/dev/null` and swallow both; those hook
// files are outside this ticket's file claim — flagged, not silently worked
// around.)
// ---------------------------------------------------------------------------
function reportDuplicates(duplicates, { indexCount, surface, brief } = {}) {
  for (const line of formatDuplicateReport(duplicates, { indexCount, surface, brief })) console.error(line);
}

// ---------------------------------------------------------------------------
// Validate op
// ---------------------------------------------------------------------------
const VALID_OPS = [
  "share",
  "pull",
  "import",
  "index",
  "reindex",
  "resolve-index",
  "migrate-v1",
  "setup",
  "feature-checkpoint",
  "feature-resume",
  "save",
  "search",
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
//
// BRAIN_MEMORY_TEST_ROOT (test-only seam, see the note further down where
// save/search read it): reindex honours it too, so cli.reindex-duplicates.test.mjs
// can drive this op end-to-end against a fixture and assert what it PRINTS —
// the only way to test the reporting half of #574 without touching the real
// `.memory/`.
if (op === "reindex") {
  const { rebuildIndex } = await import("./lib/store.mjs");
  const memoryRoot = process.env.BRAIN_MEMORY_TEST_ROOT ?? repoRoot;
  try {
    const { count, duplicates } = rebuildIndex({
      recordsDir: join(memoryRoot, ".memory", "records"),
      indexPath: join(memoryRoot, ".memory", "index.jsonl"),
    });
    console.log(`memory/cli: ${await t("memory.reindex.done", { count })}`);
    reportDuplicates(duplicates, { indexCount: count });
    process.exit(0);
  } catch (err) {
    console.error(`memory/cli: ${await t("memory.reindex.failed", { message: err.message })}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// "resolve-index" — the doctrine-fixed resolution for a conflicted
// .memory/index.jsonl: discard both sides, regenerate from records/, and stage
// it only if git still considers the path unmerged (adr-0017:121-129, 143-147).
// Backend-agnostic for the same reason as "reindex" above.
// ---------------------------------------------------------------------------
if (op === "resolve-index") {
  const { resolveIndex } = await import("./lib/resolve-index.mjs");
  try {
    const { count, staged, duplicates } = resolveIndex({ repoRoot });
    const key = staged ? "memory.resolveIndex.staged" : "memory.resolveIndex.done";
    console.log(`memory/cli: ${await t(key, { count })}`);
    // The op that exists BECAUSE two branches merged is the last one that
    // should stay quiet about what the merge duplicated (#574).
    reportDuplicates(duplicates, { indexCount: count });
    process.exit(0);
  } catch (err) {
    console.error(`memory/cli: ${await t("memory.resolveIndex.failed", { message: err.message })}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// "migrate-v1" is likewise backend-agnostic (chunks → records is a durable-
// format concern, ADR-0017 — not a MEMORY_BACKEND one).
//
// `--dry-run`  → the C2a report only, never mutates `.memory/`.
// no `--dry-run` → executes the real migration (un-refused, C2b — design.md
//   Decision 1): the CLI being runnable IS the runbook's intended step 1;
//   the control is the runbook order + the human keystroke, not a CLI switch
//   (the `--no-scrub` class C1b prohibited stays rejected). `memory.dualWrite`
//   itself is retired (D3/C4, issue #229) — records-only write is now
//   unconditional. The abort-if-populated guard in `runMigration()` still
//   protects re-runs.
// `--rollback` → the inverse (REQ-C2B2-2): restores chunks from `legacy/`,
//   drops `records/`, reindexes. Rehearsed only in fixtures per the runbook;
//   the real rollback runs only via the cutover runbook.
//
// BRAIN_MIGRATE_V1_TEST_ROOT (test-only seam): when set, this op resolves
// `.memory/` under `<value>/.memory` instead of the real repo root. NEVER
// set this outside tests — it exists solely so cli.migrate-v1.test.mjs can
// drive this op end-to-end against a fixture without ever touching the
// real `.memory/`.
// ---------------------------------------------------------------------------
if (op === "migrate-v1") {
  const testRoot = process.env.BRAIN_MIGRATE_V1_TEST_ROOT;
  const memoryRoot = testRoot ? join(testRoot, ".memory") : join(repoRoot, ".memory");
  const chunksDir = join(memoryRoot, "chunks");
  const recordsDir = join(memoryRoot, "records");
  const legacyDir = join(memoryRoot, "legacy");
  const indexPath = join(memoryRoot, "index.jsonl");

  if (process.argv.includes("--rollback")) {
    const { rollbackMigration } = await import("./lib/migrate-v1.mjs");
    try {
      const summary = rollbackMigration({ chunksDir, recordsDir, legacyDir, indexPath });
      console.log(
        await t("memory.migrateV1.rollbackSummary", {
          restored: summary.restored,
          indexCount: summary.indexCount,
        }),
      );
      process.exit(0);
    } catch (err) {
      console.error(`memory/cli: ${err.message}`);
      process.exit(1);
    }
  }

  if (!process.argv.includes("--dry-run")) {
    const { runMigration } = await import("./lib/migrate-v1.mjs");
    try {
      const summary = runMigration({ chunksDir, recordsDir, legacyDir, indexPath });
      console.log(
        await t("memory.migrateV1.realRunSummary", {
          written: summary.written,
          rejected: summary.rejected,
          skipped: summary.skipped,
          unparseable: summary.unparseableChunks,
          emptyObservations: summary.emptyObservationsChunks,
          indexCount: summary.indexCount,
        }),
      );
      process.exit(0);
    } catch (err) {
      console.error(`memory/cli: ${err.message}`);
      process.exit(1);
    }
  }

  const { collectChunkObservations, buildMigrationReport } = await import(
    "./lib/migrate-v1.mjs"
  );

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
// Which backend actually runs (issue #641).
//
// Placed HERE, below the backend-agnostic ops: `reindex`, `resolve-index` and
// `migrate-v1` have already exited, because the durable format is brain-owned
// (ADR-0017) and they never consult a backend at all. Only the ops that do get
// this far, so nothing above pays for a probe it does not need.
//
// The decision itself is in lib/backend-selection.mjs, with the reasoning. What
// belongs here is the half the ticket is actually about: SAYING SO. Every
// outcome other than "the default was available" or "you named a backend"
// prints, because the failure #641 reports is not that the fallback was
// missing — `MEMORY_BACKEND=plainfiles` worked all along — it is that no
// message ever said so, and four PRs' worth of capture was skipped on the
// strength of an error that read as "capture is impossible here".
//
// To STDERR, for the same reason the duplicate report above uses it: the
// automated callers (`brain/scripts/hooks/pre-push`, `post-merge`) discard
// stdout, and a substitution notice on stdout would be discarded exactly where
// the substitution is most likely to happen. (#633 covers those two hooks
// swallowing stderr as well — flagged there, not worked around here.)
// ---------------------------------------------------------------------------
const selection = selectBackend({
  requested: MEMORY_BACKEND,
  stated: STATED_BACKEND !== undefined,
  op,
  probe: MEMORY_BACKEND === DEFAULT_BACKEND ? probeBinary(ENGRAM_BIN) : { available: true },
});

if (selection.reason === REASON.SUBSTITUTED) {
  console.error(
    `memory/cli: ${await t("memory.backend.substituted", {
      op,
      from: selection.from,
      fallback: selection.backend,
    })}`,
  );
} else if (selection.reason === REASON.STATED_BUT_ABSENT) {
  // Not a substitution and not fatal on its own — the dispatch below still
  // fails exactly as it does today. This adds the signpost that was missing:
  // the old message named only `gentle-ai install`, so the working alternative
  // was invisible to a reader who had no way to install anything.
  console.error(
    `memory/cli: ${await t("memory.backend.statedButAbsent", {
      op,
      backend: MEMORY_BACKEND,
      fallback: FALLBACK_BACKEND,
    })}`,
  );
} else if (selection.reason === REASON.PROBE_FAILED) {
  // "I could not check" is reported as itself, never as "engram is missing" —
  // the `evidence-reader-empty-on-failure` distinction. Nothing is switched on
  // an answer this weak, so the run continues on the default.
  console.error(
    `memory/cli: ${await t("memory.backend.probeFailed", {
      op,
      backend: MEMORY_BACKEND,
      fallback: FALLBACK_BACKEND,
      reason: selection.detail,
    })}`,
  );
}

// ---------------------------------------------------------------------------
// Load backend and dispatch
// ---------------------------------------------------------------------------
const BACKEND = selection.backend;
const backendPath = new URL(`./backends/${BACKEND}.mjs`, import.meta.url);

let backend;
try {
  backend = await import(backendPath);
} catch (err) {
  console.error(`memory/cli: backend '${BACKEND}' not found at ${backendPath.pathname}`);
  console.error(`  Cause: ${err.message}`);
  process.exit(1);
}

if (typeof backend[fn] !== "function") {
  console.error(`memory/cli: backend '${BACKEND}' does not implement op '${op}'`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// "save" carries structured flags (--type/--project/--scope/--topic) the
// generic positional-forward below would mis-pass as extra positionals
// (design.md Decision 7). A minimal arg parser extracts the two positionals
// (title, content) and the four flags into {type, project, scope, topic},
// then calls backend.save(title, content, opts, seams). This keeps the
// parser backend-agnostic: engram's save receives the same shape and
// refuses it (Decision 5) via the shared unsupportedOp helper.
//
// NO --actor/--actor-kind/--ts flag is recognized ANYWHERE in this parser
// (Decision 2 — spoof resistance enforced at the parser, never a caller-
// supplied provenance field).
//
// BRAIN_MEMORY_TEST_ROOT (test-only seam, mirrors BRAIN_MIGRATE_V1_TEST_ROOT
// above): when set, save/search resolve `.memory/` under `<value>` instead
// of the real repo root. NEVER set this outside tests.
// ---------------------------------------------------------------------------
const memoryTestRoot = process.env.BRAIN_MEMORY_TEST_ROOT;

if (op === "save") {
  const rest = process.argv.slice(3);
  const positionals = [];
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      flags[arg.slice(2)] = rest[++i];
    } else {
      positionals.push(arg);
    }
  }
  const [title, content] = positionals;
  // `--issue` (#530): the record format has carried an `issue` field all along and
  // no verb ever populated it — #368 measured 2157 records with it empty. A record
  // that cannot be tied to a ticket is one the coverage metric already reports as
  // "adoption pending". Parsed here as a NUMBER: `validateWritableRecord`'s W2
  // refuses a non-integer, so a typo fails closed at the chokepoint rather than
  // landing a string in a durable field.
  const issue = flags.issue === undefined ? undefined : Number(flags.issue);
  const opts = { type: flags.type, project: flags.project, issue, scope: flags.scope, topic: flags.topic };
  const seams = memoryTestRoot ? { root: memoryTestRoot } : {};
  try {
    const result = await backend.save(title, content, opts, seams);
    console.log(`memory/cli: ${await t("memory.plainfiles.save.done", { id: result?.id, file: result?.file })}`);
    reportDuplicates(result?.duplicates, { indexCount: result?.indexCount });
    process.exit(0);
  } catch (err) {
    console.error(`memory/cli: ${BACKEND}.save() failed — ${err.message}`);
    process.exit(1);
  }
}

if (op === "search") {
  const query = process.argv[3];
  const searchOpts = memoryTestRoot ? { root: memoryTestRoot } : {};
  try {
    const result = await backend.search(query, searchOpts);
    if (!result?.matches?.length) {
      console.log(`memory/cli: ${await t("memory.plainfiles.search.empty")}`);
    } else {
      console.log(`memory/cli: ${await t("memory.plainfiles.search.summary", { count: result.matches.length })}`);
      for (const m of result.matches) {
        console.log(`  - ${m.id} [${m.type}] ${m.content.slice(0, 120)}`);
      }
    }
    // A duplicated record used to come back as two identical hits and inflate
    // the count printed above (#574) — it is collapsed now, and said so.
    //
    // `the records read`, not `the result set`: the accounting is store-wide
    // (the reader collapses every repeat it passes, matched or not), so on a
    // query that matched nothing "collapsed into the result set" would name a
    // collapse that did not happen there. And `brief`, because a search is a
    // question about records, not a maintenance run on the store.
    reportDuplicates(result?.duplicates, { surface: 'the records read', brief: true });
    process.exit(0);
  } catch (err) {
    console.error(`memory/cli: ${BACKEND}.search() failed — ${err.message}`);
    process.exit(1);
  }
}

// BRAIN_MEMORY_TEST_ROOT for the store-wide ops too (#574). Without it these
// ops resolve the REAL `.memory/` no matter what the seam says — which is how
// the end-to-end test for `share`'s duplicate report first ran against this
// repository's own store. Restricted to these four by name:
// `feature-checkpoint`/`feature-resume` take a positional [feature], and
// passing them an options object would silently become a feature named
// "[object Object]".
//
// HONEST BOUND, because the first version of this comment claimed a guarantee
// it does not have: the `{root}` is HONOURED by every plainfiles op and by
// `engram.share`/`engram.importMemory`, but `engram.pull()` and
// `engram.setup()` take NO parameters (see their definitions), so the object is
// discarded and they act on the real repo root. Not reachable today — the env
// var is set nowhere outside three test files, never in package.json, the hooks
// or CI — so this is a bound on the seam, not a live defect. Any test that
// needs a rooted `engram.pull`/`setup` must give those two a `{root}` first
// rather than trusting this set.
const ROOTED_OPS = new Set(["share", "pull", "import", "setup"]);

try {
  // Forward positional args (e.g., [feature]) to the backend function.
  const forwarded = memoryTestRoot && ROOTED_OPS.has(op)
    ? [{ root: memoryTestRoot }]
    : process.argv.slice(3);
  const result = await backend[fn](...forwarded);

  // `share` returns an accounting and nothing ever printed it, so every number it
  // measured — including the one added for #541 — died in the return value. The
  // observations that arrived WITHOUT a §4 provenance block are surfaced here, because
  // an outage nobody sees is the same outage: their records land as `@legacy` with no
  // `issue` and read exactly like a healthy one.
  if (op === "share" && result && typeof result.unprovenanced === "number" && result.unprovenanced > 0) {
    console.log(`memory/cli: ${await t("memory.share.unprovenanced", { count: result.unprovenanced })}`);
  }

  // #574 — the duplicate accounting, for every op that produced one (`share`,
  // `pull`, `setup`, `import`, and anything added later that reads the store).
  // Keyed on the result carrying it, not on a list of verbs: the failure this
  // ticket names is a store-wide rule that only some callers happened to voice.
  //
  // `import` gets its own surface: it hydrates engram from `records/` and never
  // writes the index (only `pullMemory` reindexes), so the default wording
  // would have it claim a collapse into an index it did not touch.
  reportDuplicates(result?.duplicates, {
    indexCount: result?.indexCount,
    surface: op === "import" ? "the records read" : undefined,
  });
} catch (err) {
  console.error(`memory/cli: ${BACKEND}.${fn}() failed — ${err.message}`);
  process.exit(1);
}
