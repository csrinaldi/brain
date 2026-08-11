// base-comparison.mjs — the producer `causal_disposition: 'pre-existing'` never had
// (issue #408, M3 residual).
//
// Every layer of the `follow_ups` path shipped except a producer: `verdict.mjs` routes
// `pre-existing`/`base-only` out of the blocking set, `schema-v2.mjs` admits both,
// `reviewer-protocol.md` §Findings documents them, `parseVerdict` reads the block back.
// No evaluator ever emitted either value, so the routing branch was unreachable in
// production and `follow_ups` was always `[]`. #381 moved it from broken to EMPTY, not
// to working.
//
// ─────────────────────────────────────────────────────────────────────────────
// TWO MEASUREMENTS DECIDED THIS DESIGN, and the first one killed the obvious version.
//
// (1) THE OBVIOUS DESIGN IS INERT HERE. The natural comparator reads the base commit's
//     own check-run rollup and asks "was this gate already red?". Measured on
//     `csrinaldi/brain` at `1e05960`: `governance.yml` triggers on `pull_request` ONLY,
//     so a commit on `main` carries `m4-danger-paths`, `audit-and-revert` and
//     `relabel-retrigger` — and NOT ONE of the eight governance gates. A rollup-based
//     comparator would find no base entry for any required gate, classify nothing, and
//     stay green in every test while never firing in production. That is #335's class
//     exactly, and it is why this module RE-RUNS the check at base instead of reading a
//     status somebody else recorded.
//
// (2) ONLY ONE GATE CAN INHERIT A FAILURE. Of the eight required jobs, seven are
//     diff-scoped or PR-scoped BY CONSTRUCTION — `diff-size` measures `base...head`,
//     `issue-link`/`decision-gate`/`memory-gate`/`phase-order` read this PR's body and
//     this change's artefacts, `actor-check`/`brain-writes-reviewed` read this PR's
//     approval and authorship. A defect in any of them is this change's doing by
//     definition; asking whether it "exists on base" is not a hard question, it is a
//     meaningless one. `local-checks` is the exception: it runs `repo:check`,
//     `brain:nav` and the unit suite over the TREE, and a tree can be broken before
//     this branch touched it.
//
// So the honest producer is narrow on purpose: one gate, re-derived at base, in a
// throwaway worktree. It answers #408's design question 1 — *"is the base...head diff
// sufficient, or does an honest claim need the finding re-run against a base checkout
// (as the reversion check does)?"* — with the second option, and the reason is (1).
// ─────────────────────────────────────────────────────────────────────────────
//
// WHAT THIS DELIBERATELY DOES NOT PRODUCE. `base-only` ("exists only on the base, not
// touched by this diff") has no honest producer among brain's checks: every finding
// brain emits is either about this PR or about a tree the PR is part of, so nothing it
// can observe is base-ONLY. The value stays documented, admitted by the schema and
// routed by `verdict.mjs` — and unproduced, stated rather than invented.
// `causal-admission.mjs`'s own rule applies to this module too: inventing the claim
// would be worse than omitting it. Both values route to the same branch, so the branch
// becomes reachable on `pre-existing` alone.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Gates whose failure brain can HONESTLY re-derive at base.
 *
 * One entry, and that is measurement (2) above, not a placeholder. What makes
 * re-running feasible at all is that brain declares ZERO runtime and dev dependencies:
 * every command below runs in a bare `git worktree` with no install step.
 */
export const BASE_REPRODUCIBLE_GATES = Object.freeze(['local-checks']);

/** The marker `governance.yml` itself gates its `npm test` step on. */
const BRAIN_SOURCE_MARKER = '.brain-source';

/**
 * The commands that reproduce `gate` inside `worktreePath` — MIRRORING the workflow
 * step for step, including its condition.
 *
 * `governance.yml`'s `local-checks` job runs `repo:check` and `brain:nav`
 * unconditionally and the unit suite only `if: hashFiles('.brain-source') != ''` —
 * the marker is present in the brain SOURCE repo and absent in every consumer. So a
 * consumer's `local-checks` is two fast node scripts, and only brain's own repo pays
 * for the suite. Re-deriving that condition here rather than always running the suite
 * is not an optimisation: running a suite the gate never ran would answer a question
 * nobody asked, and a base probe that claims "the gate fails at base" must run what
 * the gate runs.
 *
 * The marker is read from the BASE worktree, not from cwd. Whether the repo is a brain
 * source checkout is a property of the tree being probed.
 *
 * @param {string} gate @param {string} worktreePath @param {(p: string) => boolean} exists
 * @returns {Array<[string, string[]]>}
 */
export function commandsFor(gate, worktreePath, exists = existsSync) {
  if (gate !== 'local-checks') return [];
  const cmds = [
    ['node', ['./brain/scripts/check-refs.mjs']],
    ['node', ['./brain/scripts/check-brain-nav.mjs']],
  ];
  if (exists(join(worktreePath, BRAIN_SOURCE_MARKER))) {
    cmds.push(['node', ['--test', 'brain/scripts/**/*.test.mjs', 'test/**/*.e2e.test.mjs']]);
  }
  return cmds;
}

/** `gate:local-checks` → `local-checks`; anything else → null. */
export function gateNameOf(finding) {
  const m = /^gate:(.+)$/.exec(finding?.id ?? '');
  return m ? m[1] : null;
}

/**
 * Is this finding one a base re-run could speak to AND one that currently blocks?
 *
 * BOTH halves are load-bearing. The gate half is measurement (2) above. The blocker
 * half is the laziness rule (#408 design question 3): re-running the suite at base is
 * the most expensive thing the reviewer can do, and it is only worth doing when the
 * answer changes a verdict. An editorial finding routed to `follow_ups` reads slightly
 * better and blocks exactly as much as before — nothing.
 */
export function needsBaseProbe(findings = []) {
  return findings.some(f => f?.severity === 'blocker' && BASE_REPRODUCIBLE_GATES.includes(gateNameOf(f)));
}

/**
 * Re-runs the reproducible gates at `baseSha`, in a detached throwaway worktree.
 *
 * COLDBOOT-CWD ISOLATION (protocol §8), copied deliberately from
 * `checkpoint.mjs`'s `defaultRunReversion`: never `git checkout` in the operator's cwd,
 * always a separate detached worktree, always torn down in `finally`. That function is
 * the precedent for "run something at base" in this codebase and the reason #408 asks
 * whether an honest claim needs a base checkout — reusing its shape rather than
 * inventing a second isolation discipline.
 *
 * NEVER THROWS, and a failure is `null` — UNCOMPUTABLE, not "nothing was already
 * broken". The caller must keep such findings blocking; see `classifyAgainstBase`.
 *
 * `NODE_TEST_CONTEXT` is stripped from the child env for the reason
 * `defaultRunReversion` records: when this code itself runs under `node --test`, the
 * inherited variable trips node's recursive-test guard, the child silently SKIPS every
 * file and exits 0 — which here would read as "the suite passes at base", the exact
 * inversion of the claim being made.
 *
 * @param {{ baseSha: string|null, gates: string[], cwd?: string, tmp?: string, _exec?: Function }} args
 * @returns {{ failed: string[], command: string }|null}
 */
export function probeBase({ baseSha, gates = [], cwd = process.cwd(), tmp = tmpdir(), _exec, _exists = existsSync } = {}) {
  if (!baseSha || gates.length === 0) return null;
  const exec = _exec ?? ((file, args, opts) => execFileSync(file, args, opts));
  const worktreePath = join(tmp, `brain-review-base-${baseSha}`);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;

  try {
    try { exec('git', ['worktree', 'remove', '--force', worktreePath], { cwd, encoding: 'utf8' }); } catch { /* no prior worktree */ }
    exec('git', ['worktree', 'add', '--detach', worktreePath, baseSha], { cwd, encoding: 'utf8' });

    const failed = [];
    const ran = [];
    for (const gate of gates) {
      const commands = commandsFor(gate, worktreePath, _exists);
      if (commands.length === 0) continue;
      let gateFailed = false;
      for (const [file, args] of commands) {
        ran.push(`${file} ${args.join(' ')}`);
        try {
          exec(file, args, { cwd: worktreePath, encoding: 'utf8', env });
        } catch {
          gateFailed = true;
          break; // the gate is already red at base; the remaining steps add nothing
        }
      }
      if (gateFailed) failed.push(gate);
    }
    return { failed, command: `git worktree add --detach <base> && ${ran.join(' && ')}` };
  } catch {
    // A git/fs failure is uncomputable evidence, never a crash and never a verdict.
    return null;
  } finally {
    try { exec('git', ['worktree', 'remove', '--force', worktreePath], { cwd, encoding: 'utf8' }); } catch { /* best effort */ }
  }
}

/**
 * Re-classifies findings the base probe can speak to. Pure.
 *
 * THREE OUTCOMES, and the middle one is the whole point:
 *   · the gate is red at base too  → `causal_disposition: 'pre-existing'`, and
 *     `verdict.mjs` routes it to `follow_ups[]` instead of blocking on it.
 *   · the gate is GREEN at base    → this change broke it. Left as `introduced`.
 *   · the probe could not run      → left as `introduced`, and the inability is
 *     reported as a condition.
 *
 * THE UNCOMPUTABLE CASE IS NOT `unknown`, deliberately. `unknown` forces `STOP` +
 * `escalate: human` on every affected finding (protocol §Findings), so a base probe
 * that failed for infrastructure reasons would summon a human for every gate finding
 * on every PR — the "escalation storm" #394 exists to prevent. Leaving the finding
 * `introduced` keeps it BLOCKING, which is the safe direction: a failed base check
 * costs a false block, never a false pass.
 *
 * The evidence is EXTENDED, never replaced. A reader has to be able to see both the
 * original gate quote and the base observation that reclassified it; a finding that
 * says only "it is pre-existing" is a claim without the thing it is a claim about.
 *
 * @param {{ findings?: Array<object>, baseProbe?: {failed: string[], command: string}|null, probeAttempted?: boolean }} args
 * @returns {{ findings: Array<object>, conditions: string[] }}
 */
export function classifyAgainstBase({ findings = [], baseProbe = null, probeAttempted = false } = {}) {
  if (!baseProbe) {
    // Nothing was asked (no base-comparable blocker) → silence, not a condition:
    // reporting "could not compare" on a review that never needed to would be noise.
    if (!probeAttempted) return { findings, conditions: [] };
    return {
      findings,
      conditions: [
        'evidence uncomputable: base comparison (worktree at base unavailable) — '
        + 'gate findings stay blocking rather than being deferred unverified',
      ],
    };
  }

  const failed = new Set(baseProbe.failed ?? []);
  const out = findings.map((f) => {
    const gate = gateNameOf(f);
    if (!gate || !failed.has(gate)) return f;
    return {
      ...f,
      causal_disposition: 'pre-existing',
      evidence: `${f.evidence} — SAME gate fails at base: ${baseProbe.command}`,
    };
  });
  return { findings: out, conditions: [] };
}
