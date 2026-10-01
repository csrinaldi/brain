---
status: approved
approved: 2026-10-01 (maintainer)
issue: 1218
---

# Proposal — sdd-reader-bounded-time (issue 1218)

## Intent

The round-2 cold review of #1212 (#1198) found one correction and two editorial defects in the SDD artifact reader.

1. **Correction.** A pathological inline emphasis freezes the page. `lib/markdown.mjs` has one guard, `MAX_INPUT`, and the route's 256 KB cap means it never triggers. `renderDocumentSection` in `static/app.js` renders synchronously on the main thread. Measured on node 22 with the vendored marked 18.0.14: a 200 KB `*` run takes 11 077 ms, then throws a `RangeError`. A 20 KB run of `**a ` takes 4418 ms.
2. **Editorial.** A clone with no change branch reports `unreadable` (`change-route.mjs:313`). Nothing failed, so `unreadable` is the wrong state.
3. **Editorial.** The unreadable reason names the command that failed, not the cause. Both default `run` seams discard stderr.

## Scope

### In
- A pure pre-scan in `lib/markdown.mjs` that degrades pathological inline spans to literal text and announces it (R1).
- A module Web Worker that renders with a 1500 ms budget. A worker that exceeds the budget is terminated, and the document falls back to announced plain text (R1, R2).
- An async render in `app.js` with a loading state, which drops stale results across expand/collapse (R2).
- "No change branch" becomes `missing`, with one wording shared by the SDD row and the Working memory tab (R3).
- One shared `gitRun` helper (`brain/scripts/ui/git-run.mjs`) that pipes stderr. `gitErrorLine` returns one trimmed line of it, capped at 200 characters (R4).

### Out
- Changing marked's version.
- An LLM.
- A file-serving route.
- #883's uncommitted overlay.

## Maintainer rulings (2026-10-01, binding)

| # | Ruling |
|---|---|
| R1 | **Option C.** A cheap, pure pre-scan in `lib/markdown.mjs` degrades pathological inline spans to literal text before marked runs. It triggers at about 600 delimiters in one inline span, or at a single delimiter run longer than 50. The thresholds sit far above the measured real maxima (122 per span, run of 7), and no real artifact is affected. The degradation is announced. A module Web Worker, `/lib/markdown-worker.mjs`, imports the same vendored marked. It is the backstop that guarantees the budget for any input, known or unknown. |
| R2 | **Budget: 1500 ms.** A worker that exceeds it is terminated. The document then renders as literal text with the notice "this document was too slow to render (over 1500 ms) and is shown as plain text". Rendering in `app.js` becomes async with a loading state. Expand/collapse races and stale results are handled. |
| R3 | **Item 2.** Reuse `state:'missing'` with the reason "no change branch in this clone". No new state is added. A real `git branch --list` failure stays `unreadable`. The SDD row and the Working memory tab share one wording. |
| R4 | **Item 3.** The duplicated default `run` becomes ONE helper that pipes stderr. `gitErrorLine` yields one trimmed line of stderr, capped in length. *Design found three copies, not the two this ruling named when it was written: `server.mjs`, `change-route.mjs` and `watcher.mjs`. All three move to the helper.* |

## Capabilities

- **New:** none.
- **Modified:** `sdd-artifact-reader`, introduced by #1198 and not yet archived to `openspec/specs/`. Its delta adds the render-time budget, the degraded-render notices, the missing/no-branch wording and the stderr-bearing unreadable reason.

## Approach

**Option C (chosen, R1).** A pre-scan handles the known classes cheaply. The worker bounds the unknown ones.

- **Pre-scan.** One linear pass per inline span counts delimiters and the longest delimiter run. Spans are the inline runs marked's own block phase produces, so the counter resets wherever marked starts a new one. A span over a threshold is emitted as literal text, and the tree carries a notice.
- **Worker.** `markdown-worker.mjs` runs `lexer` and the adapter, then posts the tree back. `server.mjs:56` `LIB_MODULE_RE` already serves it. Its `../vendor/marked.esm.js` resolves to the allow-listed vendor path, and no CSP is set.
- **Async seam.** `app.js` takes an injected async `tokenize`. Tests inject a synchronous fake, and the browser gets the worker-backed one. Each expansion carries a token, and a result whose token is stale is discarded.

**Rejected:**
- **A-only (pre-scan alone).** It bounds only the classes measured. `[a](` link backtracking (11 799 ms at 200 KB) and the `inlineText` lookahead on mixed runs show that other quadratic paths exist. A heuristic tuned to marked 18 can drift on any upgrade, and nothing would then guarantee the budget.
- **B-only (worker alone).** It bounds wall time, but every pathological document costs the full 1500 ms and then degrades the WHOLE document to plain text. The cheap, known cases would pay the worst outcome, and readable content would be lost.

## Affected areas

| Path | Impact |
|---|---|
| `brain/scripts/ui/lib/markdown.mjs` | Modified. Pre-scan and degradation notice. |
| `brain/scripts/ui/lib/markdown-worker.mjs` | New. Worker entry. |
| `brain/scripts/ui/static/app.js` | Modified. Async render, loading state, stale-result guard, budget and terminate. |
| `brain/scripts/ui/change-route.mjs`, `server.mjs`, `watcher.mjs` | Modified. No branch maps to `missing`. Reasons come from `gitErrorLine`. Each local `run` is removed in favour of `gitRun` (`ui/git-run.mjs`, new). |
| `brain/scripts/ui/server.mjs` | Modified. Uses the shared `run`. |
| `brain/scripts/ui/lib/run.mjs` (name decided in design) | New. The single `run` helper. |
| `brain/scripts/ui/lib/drawer-model.mjs` | Modified. Shared no-branch wording. |
| `*.test.mjs` beside each file | New or modified. |

## Risks

| Risk | L | Mitigation |
|---|---|---|
| Async render races: a fast collapse/re-expand, or a result arriving for a closed row | Med | Each request carries a token, and stale results are dropped. Tests drive the order through the injected seam. |
| The fake DOM has no `Worker` | High | An injected tokenize seam covers `app.js`. One `worker_threads` integration test runs the real worker file. |
| The pre-scan's reading of marked's block phase drifts across marked upgrades | Med | The worker is the backstop, and a pin test fails when marked's block segmentation changes. The thresholds have wide margins. A test runs every real artifact and asserts zero degradations. |
| Worker startup cost on every expansion | Low | Measure in design. Reuse one worker until it is terminated. |
| A terminated worker leaves a hung row | Low | The timeout path always renders the plain-text fallback. |

## Size forecast

About 200–250 changed lines, excluding tests, against the `lite` budget of 1000.

## Rollback

Revert the PR. No data, config or dependency changes. Rendering becomes synchronous again, and the two editorial wordings revert.

## Success criteria (mapped to the acceptance criteria)

- [ ] AC1.1. Expanding any document never blocks the main thread for more than 1500 ms. The worker is terminated at the budget.
- [ ] AC1.2. Every degraded render shows a notice, from the pre-scan or from the timeout. None is silent.
- [ ] AC1.3. Tests with the 200 KB emphasis input, the `>` case and the nesting case fail before the fix and pass after.
- [ ] AC1.4. Every real artifact under `openspec/changes/**` renders with zero pre-scan degradations.
- [ ] AC2. A deleted change branch yields `missing` with "no change branch in this clone", in both the SDD row and the Working memory tab. A `git branch --list` failure stays `unreadable`.
- [ ] AC3. The unreadable reason is git's stderr: trimmed, one line, length-capped. A real temp-repo test with a remote-only `headBranch` names it. There is one `run` helper.

## Proposal question round

R1–R4 settle the product decisions. These items still need maintainer review:
- Does the pre-scan notice use the same wording as the timeout notice, or does it name the span that was degraded?
- Does a timeout degrade only the document that timed out, or does it also discard a worker shared with other expanded rows?

### Answers (maintainer, 2026-10-01, binding as R5–R6)

| # | Ruling |
|---|---|
| R5 | The pre-scan notice and the timeout notice use different wording, because they have different causes and scopes. The pre-scan degrades **one passage**: "a passage with N formatting marks is shown as plain text". The timeout degrades **the whole document**, with the R2 notice. |
| R6 | One worker per request. It is created on expand and terminated on result or timeout, so a slow document cannot affect another open row. Design measures the worker's startup cost. A reused worker is acceptable only if it is discarded on every timeout. |
