---
status: draft
issue: 1218
---

# Design — sdd-reader-bounded-time (issue 1218)

## Technical approach

This design extends #1198's design (`issue-1198-sdd-artifact-reader/design.md`, D1–D14). It contradicts none of those decisions. One rationale is amended: D5's "the `run` seam ignores stderr anyway" stops being true, but D5's tri-state still never parses stderr. Stderr feeds only the reason text.

```
app.js (main thread; never tokenizes)       lib/render-budget.mjs (pure, effects injected)
expand ─▶ loading note ─▶ renderOffThread(text, {spawn, setTimer, clearTimer})
                               │ spawn() = new Worker('/lib/markdown-worker.mjs', {type:'module'})
                               ▼
              lib/markdown-worker.mjs ── {id,text} ─▶ markdownTree (pre-scan, then Lexer.lex)
                               ◀── {id, ok, tree} / {id, ok:false, error}
outcome: tree | timeout (1500 ms) | failed | unavailable | cancelled ─▶ token check ─▶ DOM
```

## Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D15 | **The pre-scan is pure and lives in `lib/markdown.mjs`.** It exports `prescan(body)`, which returns `[{from, to, marks, longestRun, degraded}]` by line index. `markdownTree` runs it on the body after the frontmatter. | A separate `lib/markdown-prescan.mjs` | It is about 40 lines and has one caller. A second module would add a lib file and a second door without isolating anything. |
| D16 | **What counts as an inline span.** A span is a maximal run of lines with these reset rules: (1) a blank line (`/^\s*$/`) closes the span; (2) a list item (`/^\s*(?:[-+*]\|\d{1,9}[.)])(?:\s\|$)/`), a heading (`/^ {0,3}#{1,6}(?:\s\|$)/`), a quote marker (`/^ {0,3}>/`) or a table row (`/^\s*\|/`) closes the span and opens a new one on that line; (3) a fence opener (`/^\s*(`{3,}\|~{3,})/`) closes the span. The fenced lines are skipped until a closer of the same character that is at least as long, or until the end of the text (marked also runs an unclosed fence to the end). | Tracking marked's block grammar exactly | These are the reset points the exploration measured (real maximum: 122). Every regex is anchored, so each line is scanned once. When a construct is not detected, the scan over-counts, which is the safe direction. The only under-counting case is a line wrongly taken as a fence opener (any indentation is accepted, so real fenced code inside list items is skipped). The worker covers that case. |
| D17 | **The delimiters are `*` `_` `~` `[` `]`.** A run is a maximal sequence of one delimiter character inside one line. A newline ends a run. | Also counting `` ` ``, `<` or `(` | These five feed the three measured hot spots: `emStrong` uses `*`/`_`, `del` uses `~`, the `link` backtracking uses `[`/`]`, and the `inlineText` lookahead fires on mixed runs. Measured runs of backticks cost 0–4 ms and runs of `<` cost 40–148 ms at 200 KB, so neither needs counting. `(` is common in prose and would only add false positives, and `[a](` is already caught by its `[`. Escaped delimiters are counted too, which over-counts and is therefore safe. |
| D18 | **The thresholds.** A span is degraded when `marks > 600` or `longestRun > 50` (R1). | 1000 or 1500 marks | At 1000 marks (`**a `×500) and at 1500 marks (`_a `×1500) the cost is already about 490 ms. The cost is quadratic, so extrapolating to 600 marks gives at most about 80 ms per span (`_a `: (600/1500)²×493). The real maxima are 122 marks and a run of 7, so the margins are 4.9× and 7×. |
| D19 | **How a span is degraded.** If no span is degraded, the body is lexed **once, exactly as it is today**, so real artifacts produce byte-identical trees. Otherwise the body is cut at the degraded spans' line boundaries. Each normal chunk is lexed on its own with a fresh options object (D3), and each degraded span becomes `{t:'degraded', notice, text}`, where the notice reads `a passage with N formatting marks is shown as plain text` (N = `marks`, R5). Any throw still makes the whole document one code block with D4's notice. | Backslash-escaping the delimiters; one top-level notice | Escaping still feeds marked 100k tokens and has not been measured. Placing the notice next to its passage keeps each degradation visible where it happens (AC1.2). The cost is accepted: a reference definition or a list cut by the split renders as text or as two lists, and only inside a document that is already announced as degraded. |
| D20 | **The worker is `lib/markdown-worker.mjs`.** It imports only `./markdown.mjs`, so the pre-scan also runs inside the worker. It exports a pure `reply({id, text}) → {id, ok:true, tree} \| {id, ok:false, error}`. It binds `globalThis.onmessage = (e) => globalThis.postMessage(reply(e.data))` only when `typeof globalThis.postMessage === 'function' && typeof globalThis.document === 'undefined'`, which is true only in a worker. | Importing marked directly | `LIB_MODULE_RE` (`server.mjs:56`, `^\/lib\/([a-z][a-z0-9-]*)\.mjs$`) already serves `/lib/markdown-worker.mjs`, so `server.mjs` needs no route. `markdown.mjs`'s `../vendor/marked.esm.js` resolves from `/lib/` to the allow-listed `/vendor/marked.esm.js` (`server.mjs:54`). The `./`-only rule (`lib/source-guard.test.mjs:43`) holds, and so does the ban on `import.meta`/`process` (`:78-84`). |
| D21 | **The budget lives in a pure module, `lib/render-budget.mjs`.** It exports `RENDER_BUDGET_MS = 1500`, `TIMEOUT_NOTICE`, `FAILED_NOTICE`, `UNAVAILABLE_NOTICE` and `renderOffThread(text, {spawn, setTimer, clearTimer, budgetMs})`, which returns `{promise, cancel}`. The promise never rejects. The timer starts **before** `spawn()`, so the budget includes worker startup. Every terminal path, whether a result, the timeout, an `error` event or `cancel`, clears the timer and calls `terminate()` exactly once. A late message or a mismatched `id` is ignored. | Timer logic inline in `app.js` | The fake DOM has no `Worker`. With injected effects, every race can be tested in node without the page. |
| D22 | **One worker per request (R6).** It is created on expand and terminated on result, timeout, collapse, or issue change. | A pooled worker | R6 prefers per-request. A slow document then cannot affect another row. Startup is inside the budget, so the guarantee holds whatever startup costs. **Measured by the orchestrator (2026-10-01): 39–47 ms** to spawn, import markdown.mjs and the vendored marked, and return a first render. That is 8 runs in node `worker_threads`, a proxy for a browser module worker. It is well under the 150 ms threshold, so per-request stays. The worker test still records startup with `t.diagnostic`, so a regression is visible. |
| D23 | **`app.js` changes.** The import of `markdownTree` is removed, so no path tokenizes on the main thread. `spawn` is `() => new Worker('/lib/markdown-worker.mjs', { type: 'module' })`, guarded by `typeof Worker === 'function'` at call time. If `Worker` is undefined or the constructor throws, the outcome is `unavailable`. The timer arguments are `(fn, ms) => setTimeout(fn, ms)`, looked up when called. | A main-thread `markdownTree` fallback | A main-thread fallback would reopen the freeze. Module workers are baseline in current browsers. |
| D24 | **Render states.** While a render is pending, the section has `aria-busy="true"` and holds `p.note.doc-loading[role=status]` reading "rendering the document…". `timeout` renders `p.note` with `this document was too slow to render (over 1500 ms) and is shown as plain text` (R2), then `pre.md-plain` with `textContent = doc.text`. `failed` and `unavailable` use the same layout with their own notices: "this document could not be rendered and is shown as plain text" and "this browser cannot render this document off the page, so it is shown as plain text". A `degraded` block renders as `p.note` (its notice) followed by `p.md-literal`. | | Every degraded outcome is announced (AC1.2), and only `textContent` is used. |
| D25 | **Stale drop and cache.** Each control owns `seq = requestSequence()` (`lib/frames.mjs:121`). Opening takes `token = seq.next()`, and collapsing calls `seq.next()`. An outcome is applied only if `seq.isCurrent(token)` holds and the target section is still attached to the control. `docTrees` (`app.js:129`) now maps the stamp to `{promise, cancel, settled}`. A re-render (R1198-16, `expandedDocs`) reuses the in-flight entry instead of spawning again. A collapse while unsettled calls `cancel()` and deletes the entry. `selectNode` and `closeDrawer` (`:1543`, `:1552`) cancel every entry before replacing the map. Settled outcomes, `tree` and `timeout`, stay cached, because the commit is fixed. | A global token | Each control's state is independent. Keying the cache by `path @ commit` already scopes it. |
| D26 | **R3: no branch is `missing`.** `resolveBranch` (`change-route.mjs:126`) returns `kind: 'none' \| 'ambiguous' \| 'failed'` when `ok` is false. Only `none` (zero names, `:137`) maps, in `readResumeDocument` (`:313`), to `documentEntry(path, null, {state:'missing', reason: NO_CHANGE_BRANCH})`. `ambiguous` and `failed` stay `unreadable`, and `documentWording` says "`resume.md: the change branch could not be resolved: <reason>`" for an unreadable document with no ref, since no ref was read. `drawer-model.mjs` exports `NO_CHANGE_BRANCH = 'no change branch in this clone'`, and `documentWording` (`:129`) returns `` `${file}: ${doc.reason}` `` for a missing document that has a reason. `buildWorkingMemoryTab` (`:143`) returns `{ok:false, reason: documentWording(resume)}`, so the SDD row and the tab share one string. | A new state | R3 rules out a new state. A git failure is still the thrown path (`:133`), so it cannot be confused with an empty listing. |
| D27 | **R4: one `run`.** New file `brain/scripts/ui/git-run.mjs` exports `gitRun(root) → (file, args, {maxBuffer}?)`, which calls `execFileSync` with `cwd: root, encoding:'utf8', stdio:['ignore','pipe','pipe']`, and `gitErrorLine(err, cap = 200)`. `gitErrorLine` takes the first `fatal:`/`error:` line of `err.stderr`, else the first non-empty stderr line, else the first line of `err.message`. The line is trimmed and cut to 199 characters plus `…`. It replaces the local reason helper (`:223`) and the `err.message` at `:134`. **There are three default runs, not two:** `server.mjs:92`, `change-route.mjs:427`, and also `watcher.mjs:36`. All three use `gitRun(root)`. | `ui/lib/` or `brain/scripts/lib/` | A `node:` import is banned in `ui/lib/` (D9, `source-guard.test.mjs:47`). The helper is server-side code that belongs to the ui and sits beside its callers, so its guard scope is exactly `ui/`. |
| D28 | **Guards.** (1) The innerHTML scan (`app-source-guard.test.mjs:138`) already covers every `ui/lib/*.mjs`, which includes the two new files. (2) `marked-usage-guard`: the assertion at `:103` is inverted, so `app.js` imports neither `markdown.mjs` nor `markdown-worker.mjs`. A new rule: outside tests, `markdownTree` is imported only by `lib/markdown-worker.mjs`, and the worker imports only `./markdown.mjs`. (3) `app-source-guard`: exactly one `new Worker('/lib/markdown-worker.mjs', { type: 'module' })`, and that file exists. (4) New `git-run-guard`: outside tests and `vendor/`, `child_process` appears only in `git-run.mjs`, and no `stdio` ignores stderr. Each guard carries a self-test over an injected source. | | |

## Interfaces

```js
// lib/render-budget.mjs
renderOffThread(text, { spawn, setTimer, clearTimer, budgetMs = RENDER_BUDGET_MS })
  -> { promise: Promise<{kind:'tree', tree}|{kind:'timeout'|'failed'|'unavailable'|'cancelled'}>, cancel() }
// worker message protocol: in {id, text}; out {id, ok:true, tree} | {id, ok:false, error:string}
// tree Block += {t:'degraded', notice:string, text:string}
```

## Testing strategy (strict TDD, node:test)

**First RED:** in `lib/markdown.test.mjs`, "a 200 KB `*` emphasis run degrades to one passage carrying the N-marks notice in under 200 ms". Today the same input takes 11 s and produces the parse notice.

| File | Action | What |
|---|---|---|
| `lib/markdown.test.mjs` | Modify | Each of these finishes in under 200 ms (`performance.now`) and carries a `degraded` block: `*`/`_` 200 KB, `**a `×5000, `_a `×5000, `*a_b~`×4e4, `[a](`×5e4. Plus: each reset rule, the fence skip including an unclosed fence, run > 50, exactly 600 not degraded and 601 degraded, and the notice's N. **AC1.4:** `prescan` alone over every `.md` under `openspec/changes/**`, asserting zero degraded spans and reporting the maximum as a diagnostic. It is a linear pass, far below the 839 ms that the full lex takes. |
| `lib/render-budget.test.mjs` | Create | Fake spawn and timers: result → terminate; timeout → terminate; cancel; `error` event; spawn throws; late or mismatched `id`. **Integration:** the real worker through `test-support/node-web-worker.mjs` (a `worker_threads` shim defining `postMessage`/`onmessage`), given about 150 sub-threshold `_a `×590 paragraphs (well over 1500 ms), resolves `timeout` within budget + 300 ms, and the thread exits. |
| `lib/markdown-worker.test.mjs` | Create | `reply` protocol. The real worker's tree for a real artifact deep-equals the in-process tree. Startup is recorded with a diagnostic. |
| `static/markdown-render.test.mjs` | Modify | The existing expansions gain `await settle()`. New: a click on the `>`×262000 or 700-indent document returns in under 100 ms with the loading note (fails today: 683 / 766 ms synchronously). Stale drop: a held worker, collapse, release → nothing rendered and the worker terminated. Re-render reuses the in-flight entry. Timeout wording: `setTimeout` is swapped around the click only, then the captured callback is fired. `Worker` absent → the unavailable notice and no `md` structure. |
| `test-support/dom.mjs` | Modify | `installDom({worker})`. The default is an in-process fake that answers with `reply` on `setImmediate`. A `hold` mode and `null` are also available. Instances are exposed, and `restore()` resets `Worker`. |
| `change-route.test.mjs`, `lib/drawer-model.test.mjs` | Modify | AC2: both surfaces read `resume.md: no change branch in this clone`, and an injected `branch` failure stays unreadable. AC3: a real temp repo with a remote-only `headBranch` gives the reason `fatal: Needed a single revision`, one line, at most 200 characters. |
| `git-run.test.mjs`, `git-run-guard.test.mjs` | Create | `gitErrorLine` cases. A real failure carries `.stderr`. The guard. |
| `test-support/fake-git.mjs` | Modify | Every thrown Error carries `.stderr`, as the piped run does. |
| `marked-usage-guard.test.mjs`, `static/app-source-guard.test.mjs` | Modify | D28. |

## Size (excluding `*.test.mjs`)

| File | Lines |
|---|---|
| `lib/markdown.mjs` | +60 |
| `lib/render-budget.mjs` | ~60 (new) |
| `lib/markdown-worker.mjs` | ~25 (new) |
| `static/app.js` | +70 / −8 |
| `git-run.mjs` | ~30 (new) |
| `change-route.mjs`, `server.mjs`, `watcher.mjs` | +12 / −10 |
| `lib/drawer-model.mjs` | +6 |
| `test-support/dom.mjs`, `node-web-worker.mjs`, `fake-git.mjs` | +35, ~25, +4 |
| `static/app.css` | +6 |

The total is about 350 gated lines, against the `lite` budget of 1000. The proposal forecast 200–250, and the difference is the test-support shims.

## Migration / rollout

No migration is required. Reverting the PR restores synchronous rendering and the old wordings.

## Risks

- **The pre-scan bounds each span, not the document.** Many spans just under the threshold add up: 150 spans at about 80 ms each is roughly 12 s. The worker budget catches this case, and the whole document then degrades to plain text. That is R1's accepted backstop, but it is the B-only outcome for that input.
- **Worker startup** is about 40 ms (D22, measured in node as a proxy). A browser module worker may differ, but the budget timer starts before `spawn()`, so the guarantee holds either way.
- **The 122 / 7 maxima were measured with a delimiter set and reset rules that may differ slightly from D16/D17.** The AC1.4 test is the arbiter. If it fails, adjust the rules, not the thresholds.
- **Fence over-detection** (D16) and **marked upgrades** can let an expensive span through the pre-scan. The worker is the guarantee.
- **The timing assertions** (200 ms; budget + 300 ms) can flake on a loaded CI runner. The margins are more than 10× the expected cost.
- **The split lex** (D19) changes the structure of a degraded document: references and lists are cut at the split. This is announced, and never happens for real artifacts.
- **This design exceeds the skill's 800-word budget,** because the brief asked for nine evidenced sections.
