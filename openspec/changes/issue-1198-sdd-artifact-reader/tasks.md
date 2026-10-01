---
status: draft
issue: 1198
---

# Tasks — sdd-artifact-reader (issue 1198)

Strict TDD (runner: `node:test`; whole suite `npm test`; one file `node --test <file>`). Every implementation task is preceded by the failing test that drives it (RED, then GREEN, then REFACTOR). Paths are relative to `brain/scripts/ui/` unless absolute. Requirement IDs are written `R1198-n` (spec.md); D-numbers refer to design.md.

Order: phases run sequentially 1 to 8, except where "Parallel" is noted. The first RED of the change is task 2.1.

## Phase 1: Vendor and guards

Note: 2.1 is the first RED the design names, but the vendored file must exist for any lexer test to import, so the vendor is placed in phase 1 as a fixture-free copy step. 2.1 is still the first failing behavioural test.

- [x] 1.1 RED. Create `vendor/vendor.test.mjs`. Tests: sha256 of `vendor/marked.esm.js` equals the hash in `vendor/VERSIONS` (`marked 18.0.14 sha256:<hex> marked.esm.js`); `vendor/LICENSE.marked` exists; `package.json` has no `marked` under `dependencies`, `optionalDependencies` or `peerDependencies` and the three sections equal the baseline; the vendor file contains no `fetch(`, `XMLHttpRequest`, `import(`, `globalThis`, `window.` or `document.`; a copy with one byte changed fails the drift check and names the file. Fails because the files do not exist. Satisfies R1198-11, R1198-17.
- [x] 1.2 GREEN. Add `vendor/marked.esm.js` (marked 18.0.14, byte-identical to the upstream ESM build), `vendor/LICENSE.marked` (MIT) and `vendor/VERSIONS` with the recorded sha256. Do not edit the vendored file. Satisfies R1198-11, R1198-17.
- [x] 1.3 RED. Create `marked-usage-guard.test.mjs`. It scans all `ui/**/*.{mjs,js}` excluding `vendor/` and `*.test.mjs` and fails when: the vendor file is imported by anything but `lib/markdown.mjs`, or with bindings other than exactly `{ Lexer }`, or by namespace, default or dynamic import; `marked(`, `marked.` or `parseInline` appears; `Parser` appears in an import; `Lexer.` is used other than `Lexer.lex(`; any `.parse(` has a receiver other than `JSON` or `Date` (so `frames.mjs:86` and `history-model.mjs:79` stay legal); a bare `marked` specifier is imported. Include self-tests that feed the scanner a `marked.parse(text)` snippet and a bare-specifier snippet and expect failures. Satisfies R1198-11, R1198-17.
- [x] 1.4 GREEN. Make 1.3 pass against the current tree (no `lib/markdown.mjs` yet, so the scan is vacuously clean). Keep the scanner exported as a function so later tasks can reuse it on injected sources. Satisfies R1198-11.
- [x] 1.5 RED. Modify `lib/source-guard.test.mjs`: add a test that the `./`-only import rule accepts exactly one exemption, `(lib/markdown.mjs, ../vendor/marked.esm.js)`, rejects the same specifier from any other lib file, and fails when the exemption is unused. Satisfies R1198-11.
- [x] 1.6 GREEN. Add the exact `(file, specifier)` exemption to the `./`-only rule in the source-guard module (`lib/source-guard.test.mjs:37-50` region, and its helper if the rule lives in one). The "unused exemption" assertion stays red until task 2.2 creates `lib/markdown.mjs`; mark it skipped-until-2.2 in the test and remove the skip in 2.2. Satisfies R1198-11.
- [x] 1.7 RED. Modify `static/app-source-guard.test.mjs`: extend the innerHTML-family scan (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`) to also scan every `ui/lib/*.mjs` over `codeOnly()` text (so the comment in `lib/memory-model.mjs:4` does not match). Add a test that an injected `lib/markdown.mjs` copy containing an `innerHTML` assignment fails and names `lib/markdown.mjs`, and that the unmodified `static/app.js` passes. Satisfies R1198-12.
- [x] 1.8 GREEN. Implement the extended scan in `static/app-source-guard.test.mjs` (the scanning helper, not product code). Satisfies R1198-12.

## Phase 2: Markdown adapter and safeHref

- [x] 2.1 RED (first RED). Create `lib/markdown.test.mjs` with the test "an html token renders as literal text (R5)": `markdownTree('<script>alert(1)</script>')` returns a `literal` block with the exact text and no other block. Fails because `lib/markdown.mjs` does not exist. Satisfies R1198-9.
- [x] 2.2 GREEN. Create `lib/markdown.mjs` exporting `markdownTree(text)` and `safeHref(raw)`. Minimal: `import { Lexer } from '../vendor/marked.esm.js'`; call `Lexer.lex(text, { gfm: true, breaks: false, pedantic: false })` with a fresh object literal per call (D3); map `html` to `literal`. Remove the skip added in 1.6. Satisfies R1198-9, R1198-11.
- [x] 2.3 RED. Extend `lib/markdown.test.mjs` with block constructs, one test per construct so removing a mapping fails its test: h1 to h4 headings, paragraph, nested `ul` inside `li` and `ol` with `start`, task items (`- [x]`/`- [ ]` give `task:true`, `checked` set, and no literal `[x]` text), GFM table (header, align, rows), table-removed-mapping mutation test that fails against an adapter without the table rule, fenced code kept verbatim (`<b>x</b>` and `**not bold**` stay text, no strong child), blockquote, `hr`, `lang` kept only when `/^[\w+-]{1,32}$/` (D13), unsupported construct (`[^1]: note`) degrades to literal source. Satisfies R1198-6.
- [x] 2.4 GREEN. Implement the full block mapping per the token table in design.md: `space`/`def`/`checkbox` dropped, block-level `text` with `tokens` becomes `paragraph`, unknown block becomes `literal` from `raw`. Satisfies R1198-6.
- [x] 2.5 RED. Extend `lib/markdown.test.mjs` with inline constructs (codespan, strong, em, del, br, link) and R6: `![architecture diagram](https://a.example/x.png)` gives text `[image: architecture diagram]`; `![](u)` gives `[image: ]`; neither carries the URL anywhere in the tree. Include inline `Tag` html becoming literal text and an HTML comment staying visible (`<!-- note to self -->`). Satisfies R1198-6, R1198-9, R1198-10.
- [x] 2.6 GREEN. Implement the inline mapping, `escape` to text, unknown inline to text from `raw`, `image` to `[image: alt]`. Satisfies R1198-6, R1198-9, R1198-10.
- [x] 2.7 RED. Add the `safeHref` table tests to `lib/markdown.test.mjs`: `https://a.example` and `http://a.example` give `{ok:true, href}`; relative (`./design.md`, `x/y.md`, `../other/spec.md`, `//evil.example/`) give `reason:'relative'`; `#top` gives `anchor`; `javascript:`, `data:`, `vbscript:`, `ftp:`, `file:`, `mailto:` give `scheme`; obfuscated forms (leading space, `JaVaScRiPt:`, `java\tscript:`, `jav&#x61;script:`, `&#106;avascript:`, `java%73cript:`, NUL, U+202E) are never `ok`; `https://github.com@evil.example` and `https:///` are `malformed`; a non-string is `malformed`. Link rendering: a relative link becomes `{t:'inert', target, children}` with its path as text, an anchor is inert, a refused scheme is inert, an allowed link is `{t:'link', href}` with `href = url.href`. Autolink `<javascript:alert(1)>` and reference definition `[r]: javascript:...` stay inert. Satisfies R1198-7, R1198-8.
- [x] 2.8 GREEN. Implement `safeHref` per design steps 1 to 6 (strip control and Unicode whitespace, `#` check, scheme regex, `{http, https}` allowlist, `new URL` with protocol, non-empty hostname and empty username/password), and wire it into link and autolink mapping. Satisfies R1198-7, R1198-8.
- [x] 2.9 RED. Add frontmatter, depth, termination, determinism and no-nondeterminism tests to `lib/markdown.test.mjs`: leading `---\n...\n---` yields `{t:'frontmatter', text}` and the rest is lexed (D11), while an unclosed `---` is not frontmatter; 2000 nested `>` and 2000 nested list indents return and the nesting is capped at depth 32 with deeper content as `literal` (D4); inputs `'['x50k`, `'*'x50k`, `'>'x10k`, unclosed fence, unclosed `<!--`, a 1000-column table, NUL bytes, `[a](`, `[x](<`, `| a | b |\n|---|`, empty text each return within 2 s, never throw, and `blocks.length > 0` for non-empty input; a stubbed `Lexer.lex` that throws (injected through the adapter's seam, or by a crafted input reaching marked's "Infinite loop on byte") degrades to one `code` block plus a notice; a 262144-byte table document returns with elements; `markdownTree(x)` deep-equals itself across two calls and across a fresh module import, for the real `openspec/changes/**` artifacts; the adapter source contains no `Date`, `Math.random`, `performance.now` or `process.env`. Satisfies R1198-13, R1198-14, R1198-6.
- [x] 2.10 GREEN. Implement frontmatter handling, the depth-32 cap, the `try/catch` around `Lexer.lex` and `notices[]`. Satisfies R1198-13, R1198-14.
- [x] 2.11 RED. Create `test-support/fixtures/markdown-xss.txt` and add the tree-level XSS assertions to `lib/markdown.test.mjs`: raw HTML (`<script>`, `<img onerror>`, `<a href="javascript:...">`, `<!-- <script> -->`, `<style>`), every script-scheme link form from design.md, `//evil.example/`, `https://user@evil.example`, `"` breakouts in title and URL, `![a](javascript:...)`, NUL and U+202E. Assert no tree node carries an href other than `^https?://`, and the script text survives as text. Satisfies R1198-7, R1198-8, R1198-9, R1198-10.
- [x] 2.12 GREEN. Fix any gap the fixture exposes in `lib/markdown.mjs` (expected: none beyond 2.8). Satisfies R1198-7 to R1198-10.
- [x] 2.13 REFACTOR. Tidy `lib/markdown.mjs` (single token-mapping table, no duplicated inline walkers). Run `node --test lib/markdown.test.mjs marked-usage-guard.test.mjs vendor/vendor.test.mjs lib/source-guard.test.mjs static/app-source-guard.test.mjs`. Satisfies R1198-11, R1198-12.

## Phase 3: fake-git support and stub migration

- [x] 3.1 RED. Create `test-support/fake-git.test.mjs`: `fakeGit({files, head, branches})` returns a `run(file, args, opts)` that answers `rev-parse --verify <ref>^{commit}`, `--literal-pathspecs ls-tree -l -z <commit> -- <paths>` (blob size, mode, type; absent path yields exit 0 with no line), `cat-file blob <sha>` (honours `opts.maxBuffer`, throwing `ENOBUFS` when the blob exceeds it), `show <ref>:<path>`, `blame` and `branch --list` from an in-memory `{path: text}` map; supports per-command failure injection and a call log; throws on any unrecognized command so tests cannot pass on an unmodelled call. Satisfies R1198-2, R1198-3, R1198-15 (enabling).
- [x] 3.2 GREEN. Create `test-support/fake-git.mjs` (not a `*.test.mjs`; counts toward the budget at about 50 lines). Satisfies R1198-2, R1198-3, R1198-15 (enabling).
- [x] 3.3 RED. Modify `change-route.test.mjs`: move every `recordingRun` handler that throws on unexpected calls (tests near `:78`, `:101`, `:118`, `:150`, `:168`, `:190`, `:207` and later) to `fake-git`, and change `:150`'s regex to the "is not committed at HEAD" wording with separate assertions for missing and unreadable. Expect failures against the current route. Satisfies R1198-2, R1198-4.
- [x] 3.4 GREEN (migration only). The old assertions that still describe unchanged behavior (blame, branch resolution, ticket tab) pass with `fake-git`; failures that remain are the intentional new-behavior reds consumed by phases 4 and 5. Record which tests are red-by-design in a comment at the top of the modified section, and remove the comment as they go green. Satisfies R1198-4.
- [x] 3.5 Modify `static/app-smoke.test.mjs`: `boot()` (`:143`, `:155`) uses `fake-git` over the fixture files so `#1067` (`:444`) does not fail on an unreadable spec. Confirm `:431`'s `stage-file` list is unaffected. Satisfies R1198-1, R1198-4.
- [x] 3.6 Modify `server.test.mjs` `:867` parity stub to `fake-git`; modify `lib/provenance.test.mjs` (`:133`, `:156`) where its stub intersects the changed `run` signature. Satisfies R1198-4.

## Phase 4: change-route documents

Depends on 3. Tasks 4.x are sequential.

- [x] 4.1 RED. In `change-route.test.mjs`: with a fake repo with seven committed artifacts, `buildChangeView().value.documents` holds exactly proposal, spec, design, tasks, apply, verify, resume, each `present` with non-empty text, and no key `archive`; a zero-byte committed `tasks.md` is `present` with empty text; absent file is `missing` with `commit: null` and the looked-for `path`; `rev-parse` or `ls-tree` throwing makes all six `unreadable` with the reason; `cat-file` throwing makes that one `unreadable` with the reason; a tree or mode `120000` entry is `unreadable`; `missing` and `unreadable` strings differ; unreadable never yields a body. Without a change dir the six stage entries are `null`. Satisfies R1198-1, R1198-2.
- [x] 4.2 GREEN. In `change-route.mjs`: add `readDocuments` (one `rev-parse --verify HEAD^{commit}`, one `git --literal-pathspecs ls-tree -l -z H -- <6 paths>`, one `cat-file blob <sha>` per present document), the tri-state mapping and the `documents` payload shape from design.md. Satisfies R1198-1, R1198-2, R1198-4.
- [x] 4.3 RED. Cap tests: 300000-byte `design.md` is `truncated` with text at most 262144 bytes and note "truncated at 262144 bytes"; exactly 262144 bytes is `present` with no note; a document whose 262144th byte falls inside a multibyte sequence produces no U+FFFD that the source lacks and `truncatedAt` backs up to the character boundary; a 2 MB document reads with `maxBuffer = size + 4096` and is `truncated` (not unreadable); a blob above `READ_LIMIT` (8 MiB) is `unreadable` with "N bytes exceeds the read limit" and is not read; the call log shows the `maxBuffer` option. Satisfies R1198-3.
- [x] 4.4 GREEN. Implement `CAP = 262144`, `READ_LIMIT`, the Buffer cut with UTF-8 boundary back-up and the `maxBuffer` option in `change-route.mjs`. Satisfies R1198-3.
- [x] 4.5 RED. Seam test: `run(file, args, opts)` third argument is forwarded by `server.mjs:87` (assert in `server.test.mjs` that a stub receives `{maxBuffer}`); existing two-argument stubs still work; no artifact read in `change-route.mjs` goes through a working-tree reader (a source scan: no artifact `readFileSync`/`_read` call remains). Satisfies R1198-4.
- [x] 4.6 GREEN. Make `server.mjs:87` forward the optional third argument (about 3 lines) and `change-route.mjs` pass it. Satisfies R1198-4.
- [x] 4.7 RED. Stamp tests: a present document's stamp is `{path: 'openspec/changes/issue-1198-sdd-artifact-reader/proposal.md', commit: <H>}`; a missing or unreadable document carries the path and `commit: null`; paths with `*` in a directory name are not globbed (literal pathspecs argv asserted). Satisfies R1198-5.
- [x] 4.8 GREEN. Implement the stamp (commit `H` for the six, D6). Satisfies R1198-5.
- [x] 4.9 RED. Resume tests: `resume.md` committed on the change branch but absent at HEAD is `present`, its stamp names the branch-tip commit (`rev-parse --verify <branch>^{commit}`, resolved once), the tree is listed at that commit and the blob read by sha with `cat-file blob` (no call names the bare branch afterwards), missing versus unreadable is told apart by `ls-tree -l -z <commit> -- resume.md`, `resolveBranch` runs exactly once per view and is shared by the Working memory tab and the resume document; the six HEAD documents are unaffected. Satisfies R1198-4, R1198-5.
- [x] 4.10 GREEN. Implement resume per D7 and hoist `resolveBranch` into a single call. Satisfies R1198-4, R1198-5.
- [x] 4.11 REFACTOR. Tidy `change-route.mjs` (one document reader function, shared reason formatting); run `node --test change-route.test.mjs server.test.mjs lib/provenance.test.mjs`. Satisfies R1198-1 to R1198-5.

## Phase 5: spec and tasks from HEAD, single read (AC7)

Depends on 4.

- [x] 5.1 RED. In `change-route.test.mjs`: a committed `spec.md` with three requirements plus a working-tree edit adding a fourth shows three in `documents.spec.text` and in the spec tab; a committed `tasks.md` with one checked box plus a working-tree edit checking a second shows one checked item in the tasks tab; the spec tab and tasks tab wording becomes "`<path>` is not committed at HEAD (`<H12>`)" and "`<path>` could not be read at HEAD: `<reason>`"; a truncated spec or tasks adds the tab note "truncated at N bytes; cards cover the read part"; four `### R` headings in the raw text give four cards (`parseSpecCards(documents.spec.text).value.length` equals the card count); with a counting `fake-git`, `cat-file` is called exactly once for `spec.md`'s blob during one `buildChangeView`; a failing `spec.md` read makes the spec document `unreadable` and the spec tab report the same failure, never an empty card list. Satisfies R1198-4, R1198-15.
- [x] 5.2 GREEN. In `change-route.mjs`: `buildSpecTab` receives `documents.spec` and never reads; `buildTasksTab` derives from `documents.tasks.text`; `_read` stays accepted for signature parity and becomes unused; blame keeps `HEAD` (`change-route.mjs:89`). Satisfies R1198-4, R1198-15.
- [x] 5.3 REFACTOR. Remove dead working-tree helpers if any remain unused; run `node --test change-route.test.mjs static/app-smoke.test.mjs`. Satisfies R1198-4, R1198-15.

## Phase 6: drawer model, app.js expandable rows, lazy render, css

Depends on 2 and 5. 6.1 to 6.2 (model) can precede 6.3 to 6.6 (DOM); the CSS task 6.7 is independent of the tests and may run in parallel with 6.5 and 6.6.

- [x] 6.1 RED. In `lib/drawer-model.test.mjs`: `sddEntries(items, documents)` attaches `document: {key, state, stamp: '<path> @ <commit12>', wording, note, text}` to each stage row with a document and `document: null` for `archive`; wording for missing is "`<file>` is not committed at `<ref>`" and for unreadable "`<file>` could not be read at `<ref>`: `<reason>`", and the two are not equal; the truncation note "truncated at 262144 bytes" is carried; the unnumbered row `working memory — resume.md` is appended after the seven stages only when `documents?.resume` exists, so the existing fixture at `lib/drawer-model.test.mjs:288` stays valid; the buildChangeView tab set is still spec, sdd, tasks, workingMemory, reviews, records. Satisfies R1198-1, R1198-2, R1198-3, R1198-5.
- [x] 6.2 GREEN. Implement `documentView` and `sddEntries` in `lib/drawer-model.mjs` (about 45 lines). `lib/sdd-model.mjs` and `lib/resume-view.mjs` stay unchanged (D10). Satisfies R1198-1, R1198-2, R1198-3, R1198-5, R1198-16.
- [x] 6.3 RED. Create `static/markdown-render.test.mjs` (boots the real app on the fake DOM with `installDom` + `loadApp`, `proposal.md` set to `test-support/fixtures/markdown-xss.txt`): rows show a native `button.doc-toggle` with `aria-expanded` and `aria-controls="doc-<issue>-<key>"` only when the state is present; missing and unreadable render the said wording with no button; expanding appends a `section[role=region]` labelled with the stamp and containing stamp path, stamp commit, truncation note when applicable and the rendered blocks; collapsing removes it; the click handler does not call `renderDrawer()` (focus preserved); `markdownTree` is not called until a row is expanded (lazy), and an `expandedDocs` Set restores expanded state across stream re-renders; the `path@commit` cache clears on `selectedIssue` change; no new tab is added. Walk the fake DOM for the XSS fixture: no `SCRIPT`, `IMG`, `IFRAME`, `STYLE`, `OBJECT`, `EMBED` or `INPUT` element; no attribute matching `/^on/i` or named `style`; every `A[href]` matches `/^https?:\/\//` with `rel="noopener noreferrer"`, `target="_blank"` and `referrerpolicy="no-referrer"`; the script text is visible. Element mapping checks: headings map to `h${min(6, level+2)}`, `ol` gets `start` only when not 1, task items carry a `☑`/`☐` text mark, tables use `thead/tbody` with `md-align-*` classes, inert links render as `span.md-inert` plus a `code` target, frontmatter as `pre.md-frontmatter`, literal as `p.md-literal`, no `title` attribute anywhere. Two renders of the same input give equal serialized structure. Resume: body paragraph renders as markdown beside the frontmatter row. Satisfies R1198-1, R1198-2, R1198-5, R1198-6, R1198-7, R1198-8, R1198-9, R1198-10, R1198-12, R1198-14, R1198-16.
- [x] 6.4 GREEN. In `static/app.js`: add `renderMdBlocks` and `renderMdInline` using only `el()` (`:120`), `document.createTextNode` and `setAttribute`; extend `renderEntry` (`:1693`) with the toggle button, the in-place expand and collapse, the `expandedDocs` Set (like `collapsedTracks` at `:114`) and the `Map` cache; import `markdownTree` from `/lib/markdown.mjs`. No `innerHTML`, no `marked` import, no `marked.parse`. Satisfies R1198-1, R1198-5, R1198-6 to R1198-10, R1198-12, R1198-16.
- [x] 6.5 RED. In `static/app-source-guard.test.mjs` and `marked-usage-guard.test.mjs`: re-run against the real `app.js` and `lib/markdown.mjs`; add a test that `app.js` and `lib/markdown.mjs` import nothing named `marked` and the tokenizer import path resolves to `ui/vendor/marked.esm.js`. Satisfies R1198-11, R1198-12, R1198-17.
- [x] 6.6 GREEN. Fix any guard finding in `app.js` or `lib/markdown.mjs`. Satisfies R1198-11, R1198-12, R1198-17.
- [x] 6.7 Add the document styles to `static/app.css` (about 40 lines): `.doc-toggle`, `.md-literal`, `.md-inert`, `.md-frontmatter`, `.md-align-left|center|right`, document section, table, blockquote, code. Alignment is class-only (never inline `style`). Satisfies R1198-1, R1198-6.
- [x] 6.8 REFACTOR. Tidy `app.js` renderers (shared block/inline dispatch table); run `node --test lib/drawer-model.test.mjs static/markdown-render.test.mjs static/app-smoke.test.mjs static/app-source-guard.test.mjs`. Satisfies R1198-1 to R1198-16.

## Phase 7: server /vendor route and traversal refusal

Depends on 1 (the vendored file). Independent of 4 to 6, so it may run in parallel with them.

- [x] 7.1 RED. In `server.test.mjs`: `GET /vendor/marked.esm.js` returns 200 with a JavaScript content type and a body whose sha256 equals the value recorded in `vendor/VERSIONS`; `GET /vendor/x.js` returns 404; `/vendor/../server.mjs` and `/vendor/%2e%2e/server.mjs` are refused and serve no file outside `ui/vendor/`; the `KNOWN_ROUTES` assertion at `:861` includes `/vendor/marked.esm.js`. Satisfies R1198-11.
- [x] 7.2 GREEN. In `server.mjs`: add `VENDOR_DIR`, one literal `STATIC_FILES` entry `['/vendor/marked.esm.js', {dir: VENDOR_DIR, name: 'marked.esm.js', type: JS_TYPE}]` and add the route to `KNOWN_ROUTES` (D2, about 6 lines). No request path is ever joined onto a filesystem path. Satisfies R1198-11.
- [x] 7.3 Confirm the browser path end to end: `lib/markdown.mjs` imports `'../vendor/marked.esm.js'`, resolved at `/lib/` to `/vendor/marked.esm.js` in the browser and to `ui/vendor/` in node (D1). Satisfies R1198-11.

## Phase 8: full suite and repository gate

Depends on all previous phases.

- [x] 8.1 Run `npm test`. All green; no skipped test introduced by this change remains (the 1.6 skip is gone). Satisfies R1198-1 to R1198-17.
- [x] 8.2 Run `npm run brain:repo:check`. Check that the minified `vendor/marked.esm.js` passes the secret and TODO rules in `brain/project/check-refs-rules.mjs` (applied line by line, so an 80-line minified file is a risk). If it does not, add a named, path-exact exemption for `brain/scripts/ui/vendor/marked.esm.js` in `brain/project/check-refs-rules.mjs` with a written reason (a vendored, hash-pinned third-party file), and add a test that the exemption matches only that path. Run the check before the first commit. Satisfies R1198-11, R1198-17.
- [x] 8.3 Run `npm run brain:change:verify`. Confirm the diff budget, with the counted size in the forecast below. Satisfies R1198-17.
- [x] 8.4 Confirm `package.json` has no new `dependencies`, `optionalDependencies` or `peerDependencies` entry (`git diff -- package.json` empty for those sections). Satisfies R1198-17.

## Dependency summary

- 1 before 2 (the adapter imports the vendored file). 2 before 6.
- 3 before 4 and 5 (fake-git is the stub base). 4 before 5 before 6.
- 7 needs only 1, so it is parallel with 2 to 6.
- 8 closes the change.

## Micro-decisions in flight

- 1.6 and 2.2: the "exemption is unused" test is skipped until `lib/markdown.mjs` exists, then enabled in 2.2.
- 3.4: failures left over after the stub migration are intentional reds consumed by phases 4 and 5, not regressions.

## Review Workload Forecast

| Item | Estimate (lines, excluding `*.test.mjs` and `openspec/changes/**`) |
|---|---|
| `vendor/marked.esm.js` (counts, 80 lines), `LICENSE.marked` (~45), `VERSIONS` (1) | ~126 |
| `lib/markdown.mjs` | ~170 |
| `change-route.mjs` | ~110 |
| `static/app.js` | ~110 |
| `lib/drawer-model.mjs` | ~45 |
| `static/app.css` | ~40 |
| `test-support/fake-git.mjs` (not a `*.test.mjs`, so it counts) | ~50 |
| `server.mjs` | ~6 |
| `brain/project/check-refs-rules.mjs` (only if 8.2 needs the exemption) | ~0 to 8 |
| `test-support/fixtures/markdown-xss.txt` (fixture, counts if not ignored) | ~40 |

- Estimated changed lines (excluding tests): measured 921 gated lines (878 added, 43 deleted), against the `lite` budget of 1000.
- Chained PRs recommended: No
- 400-line budget risk: Not applicable at the declared `lite` tier (budget 1000); the estimate exceeds 400 but sits at about 92 percent of 1000. If the maintainer judges by the `standard` budget of 400, the risk is High.
- Decision needed before apply: No (single PR under `lite`). The design's split point (vendor, markdown, guards, server route and the five new documents with UI; then spec and tasks move to HEAD, with AC7 and the test migration) is held in reserve and is not needed unless review asks for it.
