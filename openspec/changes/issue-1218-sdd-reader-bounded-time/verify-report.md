---
schema: gentle-ai.verify-result/v1
evidence_revision: git:37d6ed39ae0106e019431bb8f5855eb4db71b919
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 10/11 compliant, 1/11 partial
scenarios: 87/89 compliant, 2/89 partial
test_command: "npm test"
test_exit_code: 0
test_output_hash: sha256:513ea8b7fac51e87d1009a23c1014741c68bd312af62b2d7b43dd3220d733758
build_command: "npm run brain:repo:check && npm run brain:change:verify"
build_exit_code: 0
build_output_hash: sha256:not-captured
---

# Verify Report: issue-1218-sdd-reader-bounded-time

**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 4 SUGGESTION).
**Verified in**: `/home/gandalf/IA/brain-issue-1218`, branch `fix/issue-1218-fixui-the-sdd-reader-can-freeze-on-patho`, HEAD `37d6ed39`, 7 commits over `origin/main` (merge-base `6095ff5a`). Read-only: no code edited, nothing committed; every mutation was reverted with `git checkout -- <file>` and `git status` shows no code change (only the untracked change dir).
**Mode**: Strict TDD, full artifact set. apply-progress could not be read (engram unavailable), so TDD evidence was audited from git history and by re-running each commit's tests against its parent's code.

## Completeness

Tasks: 38/38 ticked, 0 unchecked (the brief said 36; the file holds 38 checkbox tasks: 8+3+5+6+4+5+4+3). Task state matches code: every file the tasks name exists.

## Build and tests (executed)

| Command | Result |
|---|---|
| `npm test` | exit 0. tests 7075, pass 7072, fail 0, cancelled 0, skipped 3, todo 0 (35.7 s). The 3 skips are the pre-existing engram T-INT-1..3, unrelated |
| `npm run brain:repo:check` | exit 0. "No prohibited references found." and "Artifact structure is valid." |
| `npm run brain:change:verify` | exit 0. "Validacion completa: repo + scripts" (`node --check` over the changed scripts) |

## TDD compliance (Strict)

The commits pair each test with its code, so RED-first cannot be read from history. I reproduced RED directly: for each commit I checked out its parent, overlaid that commit's test and test-support files, and ran them.

| Commit | New tests against PARENT code | Reading |
|---|---|---|
| `fd7dc9f6` prescan | 0 pass, 1 fail (the whole file fails to load/assert) | RED |
| `7faa9d3d` render-budget, `5d161cd7` worker | new modules, import fails on parent | RED trivially |
| `b6775002` app.js worker | 45 pass, 15 fail | RED (the 45 are pre-existing cases in the same files) |
| `a0f43710` no-branch | 47 pass, 4 fail | RED |
| `307007a2` git-run | 58 pass, 3 fail | RED |

Verdict: the "RED-first for every phase, including app.js" claim holds in substance: each commit's tests fail without that commit's code and pass with it. Each test exercises the new code (mutation section below). Caveat: the commit order shows tests and code landing together, so the claim "run and seen to fail" is verifiable only by reproduction, as done above.

## Acceptance of issue #1218

| Check | Result |
|---|---|
| Timing, 200 KB `*` run degrades | 5.6 ms (test bound 200 ms) |
| Timing, all known pathological classes | 2.4 ms for the group |
| Timing, real worker, 200 KB `*` input via `renderOffThread` | 39.6 ms, outcome `tree` with a `degraded` block, no timeout |
| Timing, real worker, 150 sub-threshold `_a ` paragraphs | cut at the budget (`timeout`, test asserts under 1800 ms) and thread exits; the never-answers app test 29.7 ms (fake timer) |
| Worker startup (spawn to first reply) | 57 ms (design measured 39-47 ms) |
| `rg "markdown.mjs\|marked" static/app.js` | only two comments (lines 1717, 1965). No import of `markdown.mjs`, `markdown-worker.mjs` or `marked` |
| `child_process` under `brain/scripts/ui` excluding tests and `vendor/` | one import: `git-run.mjs:8`. `lib/sdd-model.mjs:59` and `lib/blame.mjs:3` mention it in comments only |
| Pre-scan over real artifacts | 0 degradations (R1218-3 test, whole `openspec/changes/**` tree, passing) |
| Gated diff | 493 against the 1000 `lite` budget. Confirmed with the given command; 13 files |

## Mutation checks (all reverted, tree clean)

| Mutation | Result |
|---|---|
| (a) `MAX_MARKS` and `MAX_RUN` = Infinity | the 200 KB test fails, plus 601/600, 51/50, the prescan-seam, reset, fence, notice and AC1.4 tests. With only `MAX_MARKS` raised, 5 tests fail (601/600, pathological classes, resets, one-notice-per-passage, AC1.4 detector); the 200 KB test alone is still caught by the run rule, by design |
| (b) the timeout callback does nothing | `render-budget` timeout test (#4) fails and the app tests "a worker that never answers is cut at 1500 ms" and "one row timing out leaves another row untouched" fail |
| (c) change-route.mjs:321 reason back to `err.message` | the remote-only headBranch test fails (R1218-9/10); 1 fail, 50 pass |
| (d) no-branch mapped back to `unreadable` | 3 fail: #1198 D7, the R1218-8 same-words test, the deleted-branch real-repo test |

## Spec compliance matrix

| Req | Proving tests (brain/scripts/ui) | Status |
|---|---|---|
| R1218-1 | `lib/markdown.test.mjs:339,348,363,368,373,379,391,401,409` (thresholds, resets, fences, seam, 200 KB) | COMPLIANT |
| R1218-2 | `lib/markdown.test.mjs:420,430,438`; `static/markdown-render.test.mjs:398` | COMPLIANT |
| R1218-3 | `lib/markdown.test.mjs:471` (whole tree), `:477` (601-fixture detector names the fixture) | COMPLIANT |
| R1218-4 | `static/markdown-render.test.mjs:265`; `lib/render-budget.test.mjs:43`; `lib/markdown-worker.test.mjs:44,49,56,66` (real worker under `worker_threads`, deep-equal, structuredClone); `marked-usage-guard.test.mjs:127,134,143`; `static/app-source-guard.test.mjs:233,240`; `server.test.mjs:1154` (served, JS content type) | COMPLIANT |
| R1218-5 | `lib/render-budget.test.mjs:36,54,61,69,169,181`; `static/markdown-render.test.mjs:300,316,334,349`; `lib/markdown.test.mjs:354` (link openers) | COMPLIANT after W1 resolution (see Resolution) |
| R1218-6 | `lib/render-budget.test.mjs:79,87,96,103,109,143`; `static/markdown-render.test.mjs:367,385` | COMPLIANT |
| R1218-7 | `static/markdown-render.test.mjs:280,412,425,445,459`; `lib/render-budget.test.mjs:120,130` | COMPLIANT |
| R1218-8 | `change-route.test.mjs:587-588,591,600,607`; `lib/drawer-model.test.mjs:541,551` | COMPLIANT |
| R1218-9 | `git-run.test.mjs:41,46`; `git-run-guard.test.mjs:44,52`; `change-route.test.mjs:694` | COMPLIANT |
| R1218-10 | `git-run.test.mjs:11,17,21,26,34`; `change-route.test.mjs:694` | COMPLIANT |
| R1218-11 | `vendor/vendor.test.mjs:24,42,56`; `static/views-owned.test.mjs:47` (tab keys) | COMPLIANT |

## Issues

### CRITICAL

None.

### WARNING

- W1. R1218-5, scenarios "A deep block quote is bounded" and "A deeply nested list is bounded" are proven only with a `hold` worker (`markdown-render.test.mjs:300`): that shows the click returns under 100 ms with the loading line, but no test sends those inputs through a real worker. I ran them through the real worker shim: `>` x262000 resolves `timeout` at 1502 ms (no tree, no worker-error), the 700-indent list returns a `tree` in 197 ms, `[a](` x50000 degrades in 45 ms. The deep quote ends in the timeout notice, which is not in that scenario's THEN list ("rendered elements, the pre-scan notice or the worker-error notice"). The main thread is never blocked, so the safety goal holds; the spec text and the test do not match the observed behaviour. Fix the scenario wording or add a real-worker test pinning the outcome.
- W2. Deviation (ii), the Working memory tab wording, is unpinned for the non-`none` cases. For `ambiguous` and `failed` the tab used to carry `resolved.reason` verbatim ("more than one feat/issue-N-* branch in this clone: ..."); it now reads `resume.md could not be read at the change branch: <reason>` (`documentWording`, ref is null, so "the change branch" names nothing). For `none` it drops the old "no open PR and no feat/issue-N-* branch" search detail in favour of the shared no-branch wording, which R1218-8 and D26 require. The `none` change is mandated; the ambiguous/failed rewording is a side effect no test pins (`change-route.test.mjs:591` pins only the resume document). Acceptable, but the sentence "could not be read at the change branch" is slightly misleading when no branch was resolved.
- W3. apply-progress was not readable, so the TDD cycle table (RED/GREEN/TRIANGULATE/SAFETY NET columns) could not be audited directly. Compensated by the parent-code reproduction above.

### SUGGESTION

- S1. Deviation (i), the canary 9 to 9.25 MB: justified in direction, generous in size. `npm pack --dry-run` unpacked size is 9,430,369 B (8.994 MiB, 818 files) on main and 9,492,708 B (9.053 MiB, 826 files) on this branch: +62,339 B, +8 files, all ui source and suites. Main was 0.006 MiB under the old 9 canary, so a raise was unavoidable; 9.1 would cover the delta with headroom, 9.25 leaves 0.2 MiB of free room. The canary's own message says "read what was added before raising it", and the +0.06 MB comment states it.
- S2. Deviation (iii), `resolveServedBranch` using `gitErrorLine` (`server.mjs:158`): justified. With the shared runner piping stderr, the header would otherwise print `Command failed: git symbolic-ref ...`; now it prints git's cause line. It is consistent with R1218-10 though not named in the spec. The test (`server.test.mjs:448`) uses a plain `Error`, so it covers only the message fallback; no test feeds a stderr-bearing error through that path.
- S3. `tasks.md` and the brief disagree on the task count (36 vs 38 ticked). Documentation drift only.
- S4. The R1218-1 200 KB test is caught by the run-length rule alone, so it does not isolate the marks threshold; other tests (601/600, resets, notice N) do. No action needed.

## Design coherence (D15-D28)

D15-D19 (pre-scan, five delimiters, reset rules, thresholds, single lex over escaped passages; revised in cold review round 1), D20 (worker file 18 lines, binds `onmessage` only in a worker), D21 (`renderOffThread`, timer before spawn, single `settle`), D22 (one worker per request), D23-D25 (app.js without a markdown import, states, stale drop), D26 (`kind: none|ambiguous|failed`, only `none` maps to `missing`), D27 (`gitRun` plus `gitErrorLine`, all three default runners migrated), D28 (guards with self-tests): all match the code. No design deviation breaks a spec.

## Final verdict

PASS WITH WARNINGS. Ready for archive; W1 is the one worth fixing first (a spec/test wording alignment, no behavioural defect).

## Resolution

| Finding | Fix | Test or evidence |
|---|---|---|
| W1 | R1218-5 scenarios "A deep block quote is bounded" and "A deeply nested list is bounded" now state the measured outcome (the `>` case is the timeout notice as plain text, or a tree if it finishes under budget; the 700-indent list is a tree). One WHEN and one THEN each. | New real-worker test in `lib/render-budget.test.mjs`: `>` x262000 settles to `timeout` or `tree` within budget + 300 ms, never throws, awaits `worker.exited`, leaves no pending timer (process exits 0). R1218-5 is COMPLIANT. |
| W2 | `documentWording` (`lib/drawer-model.mjs`) says "resume.md: the change branch could not be resolved: <reason>" for an unreadable document with no ref; state stays `unreadable` (R3). R1218-8 gained a scenario and its text was extended; D26 updated. | RED then GREEN: `change-route.test.mjs` (ambiguous and git-failed, Working memory tab and SDD row) and `lib/drawer-model.test.mjs` (both surfaces, both reasons). |
| S1 | Tarball canary lowered from 9.25 to 9.1 MB (measured 9.053 MiB), net-zero line count so `test-spawn-hygiene.test.mjs:423` stays valid. | `test/publish-allowlist.e2e.test.mjs` and `brain/scripts/test-spawn-hygiene.test.mjs` pass. |
| S3 | `tasks.md` holds 38 tasks. The "36" appears only in this report's own findings (line 25 and S3) as the discrepancy being recorded; proposal, design and tasks carry no count claim. | `rg '36 tasks'` over the change dir finds nothing. |


## Cold review round 1

The cold review returned APPROVE with three corrections the maintainer approved. Measured inputs are the reviewer's; "before" is the reviewer's figure, "after" is this branch.

| Finding | Fix | Test (RED first) and evidence |
|---|---|---|
| cold-1: the fence detector was looser than marked's | `FENCE` and the closer are marked's own `fences` rule (D16): three spaces at most, a backtick info string without a backtick, a closer of the opener's run with spaces only after it. Commit `62c6f642`. | `markdown.test.mjs` "cold-1" (4 tests). A one-line ```` ```x``` ```` plus `*a `x6000: 2698 ms and not degraded before, 22 ms and degraded after. Four spaces then ```` ``` ```` plus the same body: 2751 ms before, 12 ms after. |
| cold-3: each quote line was its own span | `unquote` reads the prefix in one linear pass; consecutive quote lines and lazy lines are one span; a blank, an empty quote line, a block in the quote, or a deeper quote ends it (D16). A list item and its continuation lines were already one span, confirmed with marked and pinned by a test. Commit `6ce5a3a6`. | "cold-3" (5 tests, one reading marked's own tokens). 20 lines of `> ` + `*a `x290: 2515 ms and not degraded before, 9 ms and degraded after. A 262000-character `>` prefix scans in under 200 ms. |
| cold-2: lexing in segments broke neighbours | The document is lexed once after each degraded passage is backslash-escaped (D19); the notice is a block before the top-level block holding the passage, located by token offsets. Commit `b80b0a25`. | "cold-2" (7 tests): the `[r]` reference input keeps its link to https://example.com/x, the `1. one` input stays one list of three items with the notice before it, the passage survives as literal text, one lex call on escaped text, a degraded quote and bullet keep their structure. An escaped 200 KB `*` run lexes in 91 ms (116 ms through `markdownTree`). |

Escaping linearity, measured with `Lexer.lex` on the escaped text: 400000 chars of `\*` 91 ms, `_` 65 ms, `~` 80 ms, mixed `*a_b~` 84 ms, `**a ` x5000 10 ms. Doubling the input doubles the time for every class. The costly class is `[`: about 5 µs per bracket inside marked's own `reflinkSearch` (escaped or not): `\[` x 2e5 takes 991 ms, so a bracket-only passage near the 524288-byte adapter cap can reach the 1500 ms worker budget and end as the timeout notice. `]` is not escaped, which keeps `[a](` x 5e4 at 78 ms instead of 650 ms.

Real artifacts: unchanged. The zero-degradation test over every `openspec/changes` artifact passes with the new span rules, and no real file's token `raw` lengths disagree with its text (1394 files under `openspec`, `brain`, `docs`).

## CI timing (after cold review round 1)

| Finding | Resolution |
|---|---|
| `local-checks` failed on PR #1223: two pre-scan timing tests ran at 204 ms and 232 ms against a 200 ms bound | That bound assumed the degraded passage was never lexed. Since cold-2, the escaped document is lexed once (about 100 ms locally, about 230 ms on CI for 200 KB), so the CI margin had fallen to 1x. The pre-scan tests now share `PRESCAN_BOUND_MS = 750` (half the worker budget, 15x under the 11 s freeze). The quote-prefix scan keeps 200 ms because it is a pure scan. Spec R1218-1 scenarios and design risks are updated. |

## Cold review round 2

The cold review returned REVISE with four findings the maintainer approved. Each was fixed test first.

| Finding | Fix | Test (RED first) and evidence |
|---|---|---|
| cold-1 (blocker): `childNodes.find` does not exist on a browser NodeList | `findChildByClass` iterates with `for...of`. The test DOM models `childNodes` as a live NodeList view (`length`, index, `item`, `forEach`, `entries`, `keys`, `values`, iteration; no Array methods) (D29). Commit `dfadae34`. | `test-support/dom.test.mjs`: NodeList shape, liveness, and a guard that scans `static/app.js` for `childNodes.(find\|filter\|map\|some\|every\|reduce\|includes\|indexOf)`. The guard was shown failing with the old `find` call restored. Making the shim honest exposed 23 failing tests (app-smoke SDD tab, markdown-render and its #1218 tests): `app.js` `findChildByClass` and four test call sites (`childNodes.find` x4, `childNodes.map` x1), now `Array.from(node.childNodes)` in tests. |
| cold-2 (blocker): a thematic break or setext underline did not end a span | `prescan` ends a span at marked's `hr` and, inclusively, at marked's setext underline (D16). Commit `0106a932`. | `markdown.test.mjs` "cold-2 (r2)": `para` + 700 x ` a*b` + `\n***\nafter` was one paragraph (the hr was lost) and is now `[degraded, paragraph, hr, paragraph]`; `---` and `===` after a degraded paragraph give `[degraded, heading, paragraph]`; every spelling of hr and underline ends a span; marked itself agrees. Side effect, recorded: a line of only `*`, `_` or `-` is marked's hr, so the older hazard fixtures that were a bare run now carry a trailing `x`, and a new test pins that a bare run is an hr. |
| cold-3: backslash escaping is context-sensitive | Same-length private-use placeholders, restored in every string of the token tree (D19). Commit `d4395bdb`. | "cold-3 (r2)": `Use \`x_y*z[0]\` here.` beside a degraded line gives a code span of exactly `x_y*z[0]` (was `x\_y\*z\[0]`); `<https://example.com/a_b>` gives link text and href exactly `https://example.com/a_b`; bare url, image alt and inert target; a document already holding U+E000 to U+E002 round-trips; a document holding the whole block is shown as written under its notice. The round-1 neighbours still pass (`[r]` resolves, one list of three items, notice placement). |
| cold-4: one text node per mark | `inline()` merges every run of adjacent text nodes. | "cold-4 (r2)": ` a*<b>` x 700 was 1400 nodes, now at most 3, for four line shapes. |

Linearity, measured through `markdownTree` (substitute, lex, restore): 200000 `*` plus `x` 74 ms, 250000 88 ms, 240 KB of `*a_` 68 ms; the 750 ms bound stands. The bracket class is no longer the costly one: 262144 `[` plus `x` takes 113 ms (about 1.3 s with backslash escaping) and 524000 takes 183 ms, because marked's `reflinkSearch` no longer sees a `[`. Prescan with adversarial hr and underline lines (`- ` x 1e5, a dash plus 2e5 spaces, `*` tab x 1e5) takes 1 to 7 ms.

Round 2 history kept on purpose: the round 1 rows above describe backslash escaping, which round 2 replaced. The spec parse check and the zero-degradation test over every artifact pass.

## Cold review round 3

The cold review returned APPROVE with four findings; the maintainer ruled on each. Each correction was fixed test first.

| Finding | Fix | Test (RED first) and evidence |
|---|---|---|
| cold-1 (correction): a failed or unavailable row spawned a new worker on every stream frame | `failed`, `unavailable` and `timeout` are sticky for the document stamp across any re-render that is not a user action; only a user collapse evicts them (R1218-7, D25). Commit `ee03c850`. | `markdown-render.test.mjs` "stays as it was across 3 stream frames" for `failed` and `unavailable`, and the timeout twin: the frames come through a new `emit` on the test EventSource stub, and the test asserts no new worker, no timer requested and no loading line. RED before: 2 failures (a frame requested the render again). |
| cold-2 (correction): a cold start was shown as "too slow" with no way back | The cold-1 eviction is the retry: collapse and re-expand requests the render again. The timer still starts before `spawn()` and D21 now says why (main-thread guarantee, startup is off-thread). Commit `ee03c850`. | "collapsing and re-expanding a timed-out document asks for it again": worker count 2, second answer rendered. RED before: the timeout stayed cached. Twin tests for `failed` and `unavailable`. |
| cold-3 (editorial): the timeout notice hard-coded 1500 | `timeoutNotice(budgetMs)`; the `timeout` outcome carries `budgetMs`; `TIMEOUT_NOTICE` is `timeoutNotice(RENDER_BUDGET_MS)`, so the default wording is unchanged. Commit `f19ac6c7`. | `render-budget.test.mjs`: with `budgetMs: 300` the notice says "over 300 ms" and not 1500 (RED: the export did not exist). |
| cold-4 (editorial): a comment implied the pre-scan bounds the document | The `markdown.mjs` comment now says the pre-scan bounds each inline span and the worker budget bounds the whole document. Included in the docs commit. D16 and D21 already said so and were left as they were. | None (comment only). |

## Cold review round 4

The cold review returned REVISE with one blocker, the fourth occurrence of one class: the pre-scan's hand-written span rules diverged from marked's block grammar. The maintainer ruled to stop copying the grammar and read marked's own block phase.

| Finding | Fix | Test (RED first) and evidence |
|---|---|---|
| cold-1 (blocker): only a bullet, or `1.`/`1)`, with at most three leading spaces interrupts a paragraph in marked, so `2. ...` and `    - ...` after a paragraph line are lazy continuation | `prescan` runs `Lexer#blockTokens` (inline work deferred to `inlineQueue`), reads the block tree, counts delimiters per inline-carrying token and maps each span to source lines. The hand-written grammar (BLOCK_START, FENCE and its closer, the hr and setext rules, `unquote`, the span state machine) is deleted. If the block phase throws, the whole document degrades with the existing notice. D16/D19 and R1218-1 now define a span as marked's inline run. Commit `e5452348`. | `markdown.test.mjs` "cold-1 (r4)". RED before: `para start` plus 60 lines of `2. ` + `*a_` x 150 was not degraded and `markdownTree` took 5959 ms; the same with `    - ` took 6786 ms (reviewer: 5966 and 6085 ms). GREEN: both degrade, 16 ms and 7 ms. Also added: a pin test (blockTokens returns ONE paragraph with empty inline tokens and one `inlineQueue` entry), line-mapping tests inside loose, nested, quoted, table and task containers, and the fallback where a container's lines cannot be mapped. |

Evidence kept: the rounds 1 to 3 inputs (fences, quote paragraphs, hr and setext, the `[r]` reference and the single list, code span and autolink placeholders, text-node merging) pass unchanged; the zero-degradation test over every `openspec/changes` artifact passes, and the span count over the repository's markdown equals the count of inline-carrying tokens (59822, no container collapsed). A 3000-document differential run (random lists, quotes, tables, fences, lazy quotes with one hazard each) found the degraded span on the hazard's own line every time after the fallback was added; the one early miss (a quote paragraph directly followed by a table loses a separator newline) is the case the fallback and its test cover. Pre-scan cost, block phase plus counting: 200 KB `*` run 2.8 ms, 200 KB of `2. ` lines 4.2 ms, 198 KB of `*a_` 2.3 ms, a 4000-item list 17 ms. A 262000-character `>` prefix makes marked's block phase recurse past the stack (RangeError, about 0.9 s) and takes the existing whole-document notice; that cost was already paid in the full lex before this change (778 ms).

## Cold review round 5

The cold review returned REVISE with one blocker, one correction and one editorial finding; the maintainer ruled on each. Each was fixed test first.

| Finding | Fix | Test (RED first) and evidence |
|---|---|---|
| cold-1 (blocker): substituting the backslash turned an escaped table pipe `\|` into a cell separator, and marked dropped the surplus cells (silent content loss) | The backslash is never substituted; only `* _ ~ [ ]` are. Left alone it escapes nothing, because the next character is a placeholder. Commit `c80bd4c1`. | "cold-1 (r5)": the reviewer's row keeps 2 cells, the first reads `x | y`, the degraded cell survives in full (RED: `x \`). A degraded paragraph with `\*` and `\[` renders as typed within 750 ms. Linearity with backslashes left alone, 200 KB: `\*` 128 ms, `\\*a` 157 ms, `a\_b*` 78 ms, `\|*` 184 ms, all under the 750 ms bound. |
| cold-1, sweep: other constructs whose syntax uses a counted delimiter | A structure-preservation property test: 1500 random documents with one degraded span, comparing the block token types, counts and table cell splits of `blockTokens(substituted)` with `blockTokens(original)`, about 230 ms. Table pipes, link reference definitions, footnote-like lines, `***`/`___`/`* * *`, setext, `*` bullets and task checkboxes are each also a named case. | The property was RED on the escaped pipe and on the task checkbox. It also found one limit that is not fixed here (see below). |
| cold-2 (correction): the lexer-only guard was blind to instance calls | `marked-usage-guard.test.mjs` permits exactly `Lexer.lex(` and `.blockTokens(` on a `new Lexer(...)` instance, and fails on any other member of an instance or the class, on an alias of `Lexer`, on `inlineTokens`/`lexInline`/`.inline(` in any case, and on `Parser`, `Renderer` and `marked(`. Commit `a2a9dc01`. | Injected-source self-tests (14 snippets, RED on `new Lexer(o).inlineTokens(x)`); the real door passes and makes exactly the two permitted calls. |
| cold-3 (editorial): a degraded task item lost its checkbox | `BLOCK_PREFIX` also keeps `[ ]`, `[x]`, `[X]` right after the bullet. Commit `5451f2a9`. | "cold-3 (r5)": a degraded `- [ ] ` item stays a task item, unchecked, with its text (RED: a plain item showing `[ ] ...`). |

Two repository tests also moved: a fixture host became `example.net` (the shipped-hostnames test) and the tarball canary went from 9.1 to 9.2 MB, because the shipped suites grew about 10 KB (`77838a41`).

Limit found by the property test and left as is: marked drops a duplicate reference definition from the token stream, so the raws stop adding up and the pre-scan falls back to one span for the whole document. A document with a degraded passage and a duplicated definition therefore has every definition in it shown as a paragraph, under the notice. Nothing is lost; the generator keeps definitions distinct.
