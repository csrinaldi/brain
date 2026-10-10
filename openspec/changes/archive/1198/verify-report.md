---
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e44ad8c5228a81f406dff971c6c1dcd63f9993515293c1f3a01a0d43252230b3
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 17/17 compliant, 0/17 partial
scenarios: 53/53 compliant, 0/53 partial
test_command: "npm test"
test_exit_code: 0
test_output_hash: sha256:146f941f9e1046d84d88b7ade65cdf9319cd277aca17b3271835415ae0489491
build_command: "npm run brain:repo:check && npm run brain:change:verify"
build_exit_code: 0
build_output_hash: sha256:c83f1d20818225a09e68b62494682e87faaad6b96f48d8f9b18303f025ece7fa
---

# Verify Report: issue-1198-sdd-artifact-reader

**Date**: 2026-09-30
**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 1 SUGGESTION). The artifact-drift findings and the R1198-13 assertion gap were resolved after this report; see "Resolution" below.
**Verified in**: `/home/gandalf/IA/brain-issue-1198`, branch `feat/issue-1198-featui-every-sdd-artifact-is-readable-in`, HEAD `9c09d67e`, 4 commits over `origin/main`. Read-only: no source file edited, nothing committed.
**Mode**: Strict TDD. Full artifact set: proposal, spec, design, tasks. apply-progress could not be read (engram unavailable to this executor), so the TDD cycle table was not audited directly; see "TDD Compliance".

## Completeness

Tasks: 56/56 ticked (phases 1 to 8), no unchecked task. Task state matches code state: every file named in the tasks exists, the 1.6 skip is gone (`# skipped 3` are three pre-existing engram-version skips in an unrelated file, T-INT-1/2/3).

## Build and tests (executed)

| Command | Result |
|---|---|
| `npm test` | exit 0. tests 6975, pass 6972, fail 0, cancelled 0, skipped 3, todo 0 (duration 39.5s) |
| `npm run brain:repo:check` | exit 0. "No prohibited references found." and "Artifact structure is valid." |
| `npm run brain:change:verify` | exit 0. repo + `node --check` over 19 changed scripts, "Validacion completa: repo + scripts" |

The 3 skips are `T-INT-1..3` ("installed engram reports 'engram 2.0.0', outside the tested 1.20.x range"), unrelated to this change.

## TDD Compliance (Strict TDD)

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | NOT AUDITED | apply-progress is in engram only, which I cannot reach. tasks.md records a RED then GREEN task pair for every phase, and the orchestrator reported the app.js exception below |
| All tasks have tests | OK | every implementation task has a test file: `vendor/vendor.test.mjs`, `marked-usage-guard.test.mjs`, `lib/markdown.test.mjs`, `test-support/fake-git.test.mjs`, `change-route.test.mjs`, `lib/drawer-model.test.mjs`, `static/markdown-render.test.mjs`, `server.test.mjs`, the two source-guard tests. All exist and pass |
| RED confirmed | PARTIAL | cannot replay history (the 4 commits each bundle tests and code, so the order is not recoverable from git). See the app.js finding |
| GREEN confirmed | OK | all of the above pass on execution in the full run |
| Triangulation | OK | markdown (30 tests, one per construct, safeHref across 5 groups of inputs), change-route (about 30 tests with multiple distinct values: 0 / 262144 / 300000 / 2 MB / 9 MiB sizes) |
| Safety net | n/a | modified suites (`change-route`, `app-smoke`, `server`, `provenance`, `drawer-model`) all green after migration to `fake-git` |

### app.js renderers written before `markdown-render.test.mjs` (classified honestly)

Apply reported that for `static/app.js` the renderers (`renderMdBlocks` / `renderMdInline`) were written before `static/markdown-render.test.mjs`. Tasks 6.3 (RED) and 6.4 (GREEN) were therefore inverted for that file. Classification: **WARNING, not CRITICAL**. Reasons:

- The RED for the logic that matters did happen first and in the right place: the token mapping, `safeHref` and every XSS decision live in `lib/markdown.mjs`, whose tests (2.1 to 2.12) preceded it. app.js only turns an already-decided tree into elements.
- A late test is acceptable only if it is a real detector. I checked that by mutation in a scratch copy (not in the worktree): turning the `rel` attribute into `x`, `blockquote` into `div` and `hr` into `span` in app.js made `markdown-render.test.mjs` go from 9/9 to 7/9 passing, with the R1198-6 block-mapping test and the R1198-7 to 10/12 hostile-fixture test failing. A second mutation, renaming the `table` case in `lib/markdown.mjs`, failed 3 tests (table mapping, 262144-byte table, determinism). So the tests would have failed against a missing or wrong renderer; the RED is retrospectively demonstrated.
- It is still a protocol deviation: no recorded failing run exists for 6.3. Recommend noting it in the archive report rather than treating it as a defect to fix.

### Test layer distribution (informational)

| Layer | Files | Notes |
|---|---|---|
| Unit | markdown, vendor, marked-usage-guard, drawer-model, fake-git, source-guards | pure functions and source scans on `node:test` |
| Integration | change-route (fake-git over the real route), markdown-render and app-smoke (real `app.js` on a fake DOM), server (real HTTP) | `server.test.mjs:949` goes through a real temp git repo and the real `execFileSync` seam |
| E2E (real browser) | none | the project has no browser runner. SUGGESTION: the browser import of `/vendor/marked.esm.js` from `/lib/markdown.mjs` is proven by path and by the 200 response, never by a browser |

### Assertion quality

No tautologies, no assertions without a production call. Loops were checked for emptiness: `markdown-render.test.mjs:154` loops over built nodes and anchors, guarded by `anchors.length >= 2`; `markdown.test.mjs:163` uses `.every()` over `links(...)` and I confirmed both inputs yield one inert link each, so it is not vacuous.

| File | Line | Assertion | Issue | Severity |
|---|---|---|---|---|
| `lib/markdown.test.mjs` | 214 to 224 | `out.blocks.length > 0` for the R1198-13 malformed inputs | Spec R1198-13 requires "the visible text contains the input's non-markup characters". The test proves termination and non-empty output, not that the text survives. I ran all five inputs by hand and they do degrade to the literal text, so the behaviour is right, the assertion is weaker than the spec | WARNING |
| `lib/markdown.test.mjs` | 205 | `maxDepth <= 33` plus `'"literal"' or notices.length === 1` | An either-or: passes if the whole document degrades with a notice. Fine for termination, does not pin which path the 2000-nesting input takes | SUGGESTION |

**Assertion quality**: 0 CRITICAL, 1 WARNING, 1 SUGGESTION.

### Changed file coverage / quality tools

Coverage analysis skipped: no coverage command is configured for `npm test`. Linter and type checker: not configured (`node --check` via `brain:change:verify` passed on all 19 scripts).

## Spec compliance matrix (R1198-1 to R1198-17)

Test locations are relative to `brain/scripts/ui/`. "CR" is `change-route.test.mjs`, "ML" is `lib/markdown.test.mjs`, "MR" is `static/markdown-render.test.mjs`, "DM" is `lib/drawer-model.test.mjs`. Every cited test passed in the full run (exit 0, 0 failures).

| Req | Proving test(s) | Status |
|---|---|---|
| R1198-1 seven documents, archive excluded, no new tab | CR:397 (seven present, no archive key); DM:476 (archive has no document); DM:529 (still six tabs); MR:72 and MR:91 (row expands in place, button) | COMPLIANT |
| R1198-2 four distinct states | CR:413, 423, 435, 442 (missing vs unreadable vs tree/symlink); CR:407 (zero byte is present); DM:491 (wording differs, no body); MR:72, MR:222 (no button, said) | COMPLIANT |
| R1198-3 256 KB cap and note | CR:462 (300000 truncated, note), CR:472 (exactly 262144 present), CR:479 (multibyte, no U+FFFD), CR:488 (2 MB), CR:496 (8 MiB); DM:507; MR:199; server.test:949 (real seam) | COMPLIANT, state name deviates from design, see (a) |
| R1198-4 committed content only | CR:570 (spec shows HEAD), CR:578 (tasks from HEAD), CR:542 (resume at branch tip, read as a blob at the once-resolved commit), CR:507 (no filesystem read remains), CR:514 | COMPLIANT |
| R1198-5 `{path, commit}` stamp | CR:524 (stamp is HEAD), CR:413 (missing: path, `commit` null), CR:531, DM:476 (`path @ commit12`), MR:91 (row text has path and commit) | COMPLIANT (resolved): the maintainer ruled on 2026-09-30 that the stamp is the commit the document was read at; spec R1198-5 now says so |
| R1198-6 subset as elements | ML:26, 32, 36, 49, 56, 64, 76, 81, 88; MR:129 (page maps blocks to elements). Table-rule mutation run by me: 3 failures | COMPLIANT |
| R1198-7 relative links inert | ML:150 (`./spec.md`, `#top` inert with target text); MR:154 | COMPLIANT |
| R1198-8 scheme allowlist | ML:111, 116 (`mailto`, `ftp`, `file`, `data`, `vbscript` refused), ML:126 (leading space, case, tab, `jav&#x61;`, `&#106;`, `%73`, NUL, U+202E), ML:132, ML:156, ML:163; MR:154 asserts `rel="noopener noreferrer"` | COMPLIANT. Entity references are not decoded (f), they fall to `relative` and stay inert, which fails closed |
| R1198-9 HTML literal | ML:10, 102; ML:271 and MR:154 (script, img onerror, comment, style visible, no such element) | COMPLIANT |
| R1198-10 images inert | ML:95 (`[image: alt]`, URL absent from tree); MR:154 (`[image: img]`) | COMPLIANT. The `![](u)` to `[image: ]` empty-alt case is not asserted separately, SUGGESTION |
| R1198-11 vendored, pinned, lexer-only | vendor.test:24 (sha), :30 (one-byte drift names file), :37, :49; marked-usage-guard:69, :76 (`marked.parse` self-test), :82, :93; source-guard.test:62, :70; server.test:917 (200, JS type, sha), :932 (404 and traversal refused) | COMPLIANT |
| R1198-12 no innerHTML | app-source-guard:122, :138 (every `lib/*.mjs` and real app.js), :148 (injected `lib/markdown.mjs` caught and named) | COMPLIANT |
| R1198-13 terminates on any input | ML:190, 199, 205, 214, 225, 231 | COMPLIANT (resolved): `lib/markdown.test.mjs` now asserts the non-markup text of the five malformed inputs survives; a mutation that drops the lexed blocks makes it fail |
| R1198-14 deterministic | ML:251 (twice and fresh import, over the repo's real artifacts), ML:262 (no `Date`, `Math.random`, `performance.now`, `process.env`), MR:185 (DOM structure) | COMPLIANT |
| R1198-15 one read for spec | CR:604 (blob read once, card count equals raw `### R` count), CR:612 (failure reported by both, no empty list), CR:570 | COMPLIANT |
| R1198-16 resume body with frontmatter | MR:208 (body rendered as markdown), MR:222, DM:515, CR:542. `resume-view.mjs` is unchanged | COMPLIANT |
| R1198-17 no dependency | vendor.test:42 (no `marked` in any dependency section); marked-usage-guard:93; `git diff origin/main...HEAD -- package.json` is empty (0 lines) | COMPLIANT |

Summary: 17 COMPLIANT, 0 PARTIAL, 0 MISSING, 0 FAILING, 0 UNTESTED.

## Acceptance criteria (issue #1198)

| AC | Result | Evidence |
|---|---|---|
| AC1 XSS fixture inert | MET | I ran both fixture tests by name: `XSS fixture ... script text survives as text` (ML:271) and `hostile fixture builds no active element ...` (MR:154): 2 tests, 2 pass, 0 fail. MR:154 walks the real rendered DOM and asserts no SCRIPT/IMG/IFRAME/STYLE/OBJECT/EMBED/INPUT, no `on*` or `style` attribute, every `A[href]` matches `^https?://` with `rel="noopener noreferrer"`, and the script, `<img onerror>`, `javascript:` and `[image: img]` text visible. `rg` for `innerHTML\|outerHTML\|insertAdjacentHTML\|document.write\|marked.parse\|parseInline` under `brain/scripts/ui`: the only code hit is inside `vendor/marked.esm.js` (marked's own unused renderer, never imported by name). The other hits are comments (`lib/markdown.mjs:11`, `lib/memory-model.mjs:4`) and the guards' own patterns and self-tests. No `innerHTML` and no `marked.parse` in any shipped source |
| AC2 `app-source-guard` passes, no `innerHTML` | MET | app-source-guard:122, :138 pass; the guard now also scans every `lib/*.mjs` (:138) and catches an injected one (:148) |
| AC3 7 documents reachable, non-empty, stamped | MET | CR:397, DM:476/515, MR:72/91/208 |
| AC4 each construct yields its element, removing the table rule fails | MET | ML:26 to 88 and MR:129. Mutation run: removing the `table` case fails ML:56, ML:231 and ML:251 |
| AC5 missing vs unreadable wording | MET | CR:413/423/442, DM:491, MR:72/222 |
| AC6 no dependency, pinned, sha256 test, source guard | MET | package.json diff empty; vendor.test:24/30/42; marked-usage-guard:69/76/93. Vendored `marked.esm.js` sha256 `528a1b88...7ce0` equals the recorded value in `vendor/VERSIONS` and is byte-identical (`cmp`) to the original at `.../scratchpad/mk/package/lib/marked.esm.js` (marked 18.0.14) |
| AC7 spec raw text and cards from one read | MET | CR:604, CR:612 |

## Known deviations: judgement and which artifact to correct

| | Deviation | Judgement | Correct which artifact |
|---|---|---|---|
| (a) | Truncated is `state:'truncated'` with `truncated:true` and `note` (change-route.mjs:266), spec says the same; design's route payload said `present`+flag | Implementation is right. It follows spec R1198-2 and R1198-3 verbatim, and every consumer handles both (`drawer-model.mjs:129`, `:174`). Design is stale | **design.md** (route payload block and the three-state table). WARNING |
| (b) | Stamp `commit` is the read commit `H` (rev-parse HEAD), not the last commit touching the path | Follows design D6 and is covered by CR:524. It does break the literal R1198-5 scenario ("proposal.md last changed in abc1234, stamp equals abc1234": the stamp would be HEAD, not abc1234). The stamp still reproduces the bytes (the blob at `<commit>:<path>`), which is its purpose, and it costs one spawn instead of six. The trade-off is that a stamp never tells you when the file last changed | **spec.md** R1198-5 (and its three scenarios) should be amended to "the commit the read was made at"; design D6 already says it. If the maintainer wants "last changed", then the code is wrong, not the spec. WARNING. Decision for the maintainer |
| (c) | No `document` key on the route's `sdd` rows | Harmless. The key the design promised in the route payload (`sdd.value[].document`) is instead joined in the model: `drawer-model.mjs sddEntries` looks up `documents[item.stage]` and attaches `document: documentView(...)`. The wire contract is therefore smaller than the design's "Contract / API impact" says. No spec requirement mentions an `sdd` row key | **design.md** ("Route payload" bullet on `document: '<key>'` and "Contract / API impact"). SUGGESTION |
| (d) | The XSS fixture is `markdown-xss.txt`, not `markdown-xss.md` | Deliberate and sound: the fixture holds NUL bytes, U+202E and live `javascript:` links, which a `.md` under `brain/**` would feed to `check-refs` and the markdown tooling, and git stores it as binary (`Bin 0 -> 983 bytes`). Tests read it as text so coverage is unchanged. Side effect: a binary file counts as 0 lines in `git diff --numstat` | **design.md** and **tasks.md** (2.11) name `.md`. WARNING (doc drift only) |
| (e) | `MAX_INPUT = 524288`: an adapter input above it is shown as one `code` block plus a notice and never reaches the tokenizer | Not in spec or design. It is defensible: documents are capped at 262144 upstream, so the ceiling only applies to a caller bypassing the cap, and it bounds marked's ReDoS surface (design "Open risks"). Tested at ML:199. It is undocumented | **design.md** (add as D14 beside D4). SUGGESTION |
| (f) | Character references are not decoded (spec R1198-8 says "decode character references before the scheme is compared") | Safe, spec text overstated. `safeHref('jav&#x61;script:...')` returns `relative` (it does not match a scheme regex, design step 4 says exactly this), so it is inert; I ran it. Visible cost: an authored `&amp;` in running text or a code span shows as `&amp;`; a bare `&` in a URL query is preserved (`?a=1&b=2` is live and correct). No spec scenario fails | **spec.md** R1198-8 should read "a reference that hides a scheme is inert as relative text", matching design step 4. WARNING (doc drift) |

## Design coherence

All 13 decisions D1 to D13 are present in code: D1/D2 vendor path and one literal `STATIC_FILES` route (server.test:917, :932); D3/D4 fresh-options `Lexer.lex`, throw degradation, depth cap 32 (ML:190, ML:225); D5/D8 `ls-tree` tri-state and `maxBuffer = size + 4096`, 8 MiB limit (CR:488, CR:496); D6 H as the stamp; D7 `resolveBranch` once (CR:562); D9 optional third `run` argument (CR:514, server.test:949); D10 resume row unnumbered, `resume-view.mjs` unchanged; D11 frontmatter (ML:170); D12 anchors inert (ML:150); D13 (ML:70). Deviations are only (a) to (f) above plus the `.txt` name.

## Size and governance

- `brain.config.json` `governance.tier` is `lite` (budget 1000). `governance.ignoreList` contains `**/*.test.mjs`, `.memory/**`, `openspec/changes/**` (plus `openspec/specs/**`, `openspec/changes/archive/**`, golden JSON, lock files, `AGENTS.md`), confirmed by reading the file.
- Gated diff recomputed with `git diff --numstat origin/main...HEAD` minus `*.test.mjs`, `openspec/changes/**`, `.memory/**`: 878 added, 43 deleted, **921** total, matching the reported figure, 79 under the 1000 budget (about 8 percent headroom). Per file: `change-route.mjs` 163/34, `lib/drawer-model.mjs` 49/7, `lib/markdown.mjs` 175, `server.mjs` 7/2, `static/app.css` 59, `static/app.js` 197, `test-support/fake-git.mjs` 103, `vendor/LICENSE.marked` 44, `vendor/VERSIONS` 1, `vendor/marked.esm.js` 80.
- The 921 is above the 660 to 700 forecast in tasks.md and 450 to 550 in proposal.md. The overrun is `fake-git.mjs` (103 vs ~50), `change-route.mjs` (+197 churn vs ~110) and `app.js`/`app.css`. Still within `lite`; at the `standard` budget (400) it would be over, which tasks.md already named.
- `markdown-xss.txt` counts as 0 under numstat (binary). If the forge counts it by size the figure is slightly higher; 79 lines of headroom is not at risk from a 983-byte fixture.
- `package.json`: 0 diff lines. `brain/project/check-refs-rules.mjs`: not changed, so task 8.2's conditional exemption was not needed (`brain:repo:check` passes on the minified vendor file as is).

## Issues

### CRITICAL
None.

### WARNING
1. **TDD protocol deviation, app.js.** Renderers were written before `static/markdown-render.test.mjs` (tasks 6.3/6.4 inverted); no failing run exists for 6.3. Mitigated: mutation of app.js and of `markdown.mjs` makes the tests fail (9/9 to 7/9; 3 failures), and the decision logic was test-first in `lib/markdown.mjs`. Record it in the archive report.
2. **apply-progress not auditable here.** The TDD cycle table could not be cross-checked against reality (engram unreachable). The orchestrator should confirm the table exists with a RED/GREEN/TRIANGULATE/SAFETY NET row per task.
3. **R1198-5 spec/implementation mismatch (b).** Amend spec R1198-5 to the read commit, or change the code; the maintainer decides.
4. **R1198-13 assertion gap.** `markdown.test.mjs:214` does not assert the visible text of the malformed inputs. The behaviour is right (verified by hand); strengthen the assertion for the spec scenario to be proven by a test.
5. **design.md stale on the truncated state (a)** and on the fixture name (d); **tasks.md 2.11** also names `.md`.
6. **spec.md R1198-8 overstates entity decoding (f).** Behaviour is safe (fails closed).
7. **Size drift.** 921 vs the 660 to 700 forecast; within `lite` by 79 lines.

### SUGGESTION
1. Document `MAX_INPUT = 524288` (e) in design.md as its own decision.
2. Update design.md for the absence of `sdd.value[].document` on the wire (c).
3. Add an explicit test for `![](url)` giving `[image: ]` (R1198-10 second scenario).
4. No real-browser check of the `/lib/markdown.mjs` to `/vendor/marked.esm.js` import chain exists; consider one manual smoke before release.

## Verdict

PASS WITH WARNINGS. The suite is green (6975 tests, 6972 pass, 0 fail, 3 unrelated skips), the repo gate and change verify pass, all seven ACs are met with runtime evidence, the vendored file is byte-identical to marked 18.0.14, `package.json` is untouched, and the gated diff is 921 of 1000. No CRITICAL issue blocks archive; the warnings are artifact drift and one retrospectively validated TDD-order deviation.

## Resolution (after the report above)

| Finding | Resolution |
|---|---|
| (a) design stale on truncated | design.md now shows `state: 'truncated'` plus `note` |
| (b) R1198-5 mismatch | spec.md R1198-5 and its scenario rewritten: the stamp is the HEAD sha the read was made at, one `rev-parse` for all six documents (maintainer ruling, 2026-09-30) |
| (c) `document` key on rows | design.md says the join is made by stage in `sddEntries(items, documents)`; no wire key |
| (d) fixture name | design.md and tasks.md 2.11 name `markdown-xss.txt` and say why |
| (e) `MAX_INPUT` | design.md D14 added |
| (f) entity decoding | spec.md R1198-8 states entities are not decoded and an entity-obfuscated scheme is relative and inert |
| R1198-13 assertion gap | strengthened test added; a mutation that drops the lexed blocks fails it |
| Size drift | proposal.md, design.md and tasks.md now cite the measured 921 gated lines |

Still open, kept honest: the TDD-order deviation for the `static/app.js` renderers (renderers written before `markdown-render.test.mjs`, retrospectively shown to be detected by mutation) and the unaudited apply-progress are unchanged. The test-count and hash fields in the frontmatter describe the original run.

## Cold review round 1

Verdict was APPROVE with four findings, all resolved.

| Finding | Resolution | Test |
|---|---|---|
| judgment:cold-1 (resume read resolved the branch three times) | `readResumeDocument` resolves the branch to a commit once, lists the tree at that commit and reads the blob by sha with `cat-file blob`; the stamp is true by construction. design D7 rewritten. `fake-git` now resolves a branch's commit id to its tree, as git does | `change-route.test.mjs` "cold-1": the branch advances right after it is resolved; the stamp, text and size all come from the first commit and no later call names the bare branch. Shown RED before the fix |
| judgment:cold-2 (Working memory tab dropped the unreadable reason) | `buildWorkingMemoryTab` derives its wording from the one resume document through the shared `documentWording`; missing keeps its wording | `change-route.test.mjs` "cold-2": symlink, tree and over-limit resume.md each give `resume.md could not be read at <branch>: <reason>`, equal to the SDD row's wording; a missing one still says it is not committed. Shown RED before the fix |
| judgment:cold-3 (spec prescribed `git show` argv the code does not run) | R1198-4 and R1198-15 now say "committed content at the resolved HEAD commit" with no command. Swept proposal, spec, design, tasks, this report and the code comments (`server.mjs`, `static/app.js`) for `git show`, `log -1`, `HEAD:<` and `<branch>:resume` claims; every stale one fixed. Remaining `git show` mentions are the negative assertions in tests and the `fake-git` model | `rg` sweep returns no claim naming an argv the code does not run |
| judgment:cold-4 (subset omitted `del` and `br`) | R1198-6 and R1198-9 name strikethrough (`del`) and hard line break (`br`) in the subset; design D-model already enumerated both | `markdown.test.mjs`: one test per construct, "strikethrough maps to its own del element" and "a hard line break maps to its own br element" |
