// brain/scripts/memory/lib/backend-selection.mjs — which backend actually runs
// (issue #641).
//
// ADR-0004 puts the selector in `MEMORY_BACKEND` and its resolution in
// `cli.mjs`; this module is that resolution, lifted out so it can be measured
// without a child process. Two things live here and nothing else: a probe that
// answers whether a binary is there, and a pure decision over that answer.
//
// ── Why a fallback exists at all ────────────────────────────────────────────
//
// ADR-0017 makes the durable record format brain-owned and the backend mere
// transport, so capture is supposed to be possible with NO backend installed —
// that is why `plainfiles` exists. But only `memory:save` was pinned to it
// (REQ-530-1); `share`/`pull` kept the `engram` default, so in the agent
// environment the verb the PR template names died with
//
//   memory/cli: engram.share() failed — engram binary not found. Install via: gentle-ai install
//
// while `MEMORY_BACKEND=plainfiles npm run memory:share` exited clean the whole
// time. #641 reports four PRs whose memory capture was skipped on the strength
// of that message: it reads as "capture is impossible here" when it means "you
// asked for the wrong transport".
//
// ── Why the probe is THREE-valued ───────────────────────────────────────────
//
// `evidence-reader-empty-on-failure` is the defect family this repo keeps
// finding, and a two-valued probe is how you build one: `which` exiting
// non-zero means "engram is not installed", but `which` failing to RUN means
// "I do not know" — and collapsing those makes a broken probe indistinguishable
// from a confident absence, which would then silently switch someone's backend.
// So `available` is `true` / `false` / `null`, and `null` never substitutes.

import { spawnSync } from "node:child_process";

/** The backend `MEMORY_BACKEND` resolves to when nobody states one (ADR-0004). */
export const DEFAULT_BACKEND = "engram";

/** The zero-binary, records-only backend the default falls back to (C3, issue #246). */
export const FALLBACK_BACKEND = "plainfiles";

/** The binary the default backend needs; absent, every engram op fails. */
export const ENGRAM_BIN = "engram";

/**
 * The ops the fallback covers: EXACTLY the ops that fail BECAUSE the binary is
 * missing. Measured on a machine with no `engram`, not reasoned about — the
 * first version of this list was reasoned about, and three of its five entries
 * were wrong:
 *
 *   share   → engram binary not found            ← genuinely blocked, covered
 *   pull    → engram binary not found            ← genuinely blocked, covered
 *   import  → engram binary not found            ← blocked, but see below
 *   setup   → ✓ merge driver registered, EXIT 0  ← never needed the binary
 *   save    → 'save' is not a cli verb for engram ← a deliberate refusal
 *   search  → 'search' is not a cli verb for engram ← a deliberate refusal
 *   index   → "0 documentos indexados", EXIT 0    ← never calls requireEngram
 *
 * A fallback may only replace a FAILURE. Where there is none it is not a
 * fallback, it is a silent behaviour change:
 *
 *   - `setup` was the regression. `engram.setup()` creates the `.engram →
 *     .memory` symlink and registers the `merge=union` driver for
 *     `.memory/manifest.json` (ADR-0002), and needs no binary to do either.
 *     Substituting `plainfiles.setup()` — which deliberately does NEITHER —
 *     silently dropped the merge driver on every machine without engram, which
 *     is the very mechanism ADR-0017's union safety rests on.
 *   - `save`/`search` are not blocked either: engram REFUSES them by design
 *     (C3 Decision 5), and its refusal already names the records-only route
 *     (#530's `memory.save.engramUnsupported`). Substituting would make that
 *     signpost unreachable on the default backend — replacing a designed
 *     refusal with different behaviour rather than repairing a failure.
 *
 * `import` IS genuinely blocked, and is still excluded — but on its own ground:
 * `plainfiles` has no `importMemory` at all, so substituting would trade
 * "engram binary not found", which names the actual fix, for "backend
 * 'plainfiles' does not implement op 'import'", which names a backend the
 * caller never chose. `index` and `feature-*` project into engram's own store
 * and are excluded for the same reason plus never failing on the binary.
 */
export const FALLBACK_OPS = Object.freeze(["share", "pull"]);

/**
 * Reasons `selectBackend` can return. Exported so callers branch on a value
 * rather than on prose, and so a test can enumerate them.
 */
export const REASON = Object.freeze({
  /** `MEMORY_BACKEND` named something other than the default — nothing to decide. */
  NOT_DEFAULT: "not-default",
  /** The op is outside `FALLBACK_OPS`; engram's own error is the better one. */
  OP_NOT_COVERED: "op-not-covered",
  /** The binary is there; the default runs, as always. */
  AVAILABLE: "available",
  /** The operator named the default; an explicit selector is never overridden. */
  STATED_BUT_ABSENT: "stated-but-absent",
  /** The probe could not run. NOT the same as absent — so nothing is switched. */
  PROBE_FAILED: "probe-failed",
  /** Defaulted + absent + covered: the fallback runs, and says so. */
  SUBSTITUTED: "substituted",
});

/**
 * probeBinary(bin) — three-valued presence check.
 *
 * @returns {{available: true}
 *          |{available: false}
 *          |{available: null, reason: string}}
 *   `null` means the probe itself did not produce an answer — a missing
 *   `which`, a spawn error, a kill by signal. Callers MUST treat it as "I do
 *   not know" and never as "absent"; see the header note on
 *   `evidence-reader-empty-on-failure`.
 */
export function probeBinary(bin, { _spawn = spawnSync } = {}) {
  let result;
  try {
    result = _spawn("which", [bin], { encoding: "utf8" });
  } catch (err) {
    return { available: null, reason: `\`which ${bin}\` threw — ${err.message}` };
  }
  // spawnSync reports its OWN failure (ENOENT on `which` itself, EACCES, …) in
  // `.error` while still returning an object, so this branch is reachable
  // without a throw and is the one a minimal container hits.
  if (result?.error) return { available: null, reason: `\`which ${bin}\` could not run — ${result.error.message}` };
  if (typeof result?.status !== "number") {
    // Killed by a signal, or a seam that returned a shape with no status.
    const signal = result?.signal ? ` (signal ${result.signal})` : "";
    return { available: null, reason: `\`which ${bin}\` produced no exit status${signal}` };
  }
  return { available: result.status === 0 };
}

/**
 * selectBackend — the pure decision. No I/O: the probe result comes in as data.
 *
 * The three conditions for a substitution are ALL required, and each rules out
 * a distinct way of being wrong:
 *
 *   1. `stated === false` — nobody named a backend. ADR-0004 makes
 *      `MEMORY_BACKEND` an operator-stated selector, and silently overriding a
 *      stated selector is a different class of surprise from filling in an
 *      unstated default. Same asymmetry `plainfiles.save` already uses for
 *      `project` vs `type` (#530): derive facts, never opinions.
 *   2. `probe.available === false` — the binary is measurably absent, as
 *      opposed to unmeasurable. Note this is a DIRECT probe, never a caught
 *      error message: matching on `err.message` would also swallow a genuine
 *      engram failure on a machine that has engram, which is the one thing a
 *      fallback must not do.
 *   3. the op is in `FALLBACK_OPS` — see that constant.
 *
 * @param {object} args
 * @param {string} args.requested   The resolved `MEMORY_BACKEND` value.
 * @param {boolean} args.stated     Whether it came from env/.env rather than the default.
 * @param {string} args.op          The verb being dispatched.
 * @param {{available: boolean|null, reason?: string}} args.probe
 * @returns {{backend: string, substituted: boolean, reason: string, from?: string, detail?: string}}
 */
export function selectBackend({ requested, stated, op, probe }) {
  if (requested !== DEFAULT_BACKEND) {
    return { backend: requested, substituted: false, reason: REASON.NOT_DEFAULT };
  }
  if (probe?.available === true) {
    return { backend: requested, substituted: false, reason: REASON.AVAILABLE };
  }
  if (probe?.available === null || probe?.available === undefined) {
    return {
      backend: requested,
      substituted: false,
      reason: REASON.PROBE_FAILED,
      detail: probe?.reason ?? "the probe returned no answer",
    };
  }
  // From here the binary is measurably absent.
  if (!FALLBACK_OPS.includes(op)) {
    return { backend: requested, substituted: false, reason: REASON.OP_NOT_COVERED };
  }
  if (stated) {
    return { backend: requested, substituted: false, reason: REASON.STATED_BUT_ABSENT };
  }
  return {
    backend: FALLBACK_BACKEND,
    substituted: true,
    reason: REASON.SUBSTITUTED,
    from: requested,
  };
}
