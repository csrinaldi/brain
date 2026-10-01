---
status: draft
issue: 1198
---

# Design — sdd-artifact-reader (issue 1198)

## Technical approach

The design has three layers, and each one owns a single concern:

```
change-route.mjs (server; IO)                 lib/markdown.mjs (pure)           app.js (DOM)
rev-parse HEAD -> ls-tree -> cat-file  ──text──▶  Lexer.lex -> our tree  ──tree──▶  createElement + textContent
   │ one string per document                      (R1/R5/R6 applied here)          (lazy, on expand)
   ├─▶ documents.{proposal,spec,design,tasks,apply,verify,resume}
   ├─▶ spec tab   = parseSpecCards(documents.spec.text)        (AC7: same string)
   └─▶ tasks tab  = parseTasksList(documents.tasks.text)
drawer-model.mjs: sdd rows + resume row carry a documentView (stamp, wording, note, text)
```

- marked's token shape stops at `lib/markdown.mjs`.
- The DOM builder depends only on our tree.

## Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D1 | The vendored file is `brain/scripts/ui/vendor/marked.esm.js`, with `vendor/LICENSE.marked` and `vendor/VERSIONS` beside it. `lib/markdown.mjs` imports `'../vendor/marked.esm.js'`. | `static/vendor/` or `lib/vendor-marked.mjs` | A relative specifier resolves against `/lib/` in the browser and against `ui/lib/` in node. A file at `ui/<P>` must therefore be served at `/<P>`, and `ui/vendor/` gives the URL `/vendor/marked.esm.js`, which the proposal's server row already names. Keeping it out of `static/` leaves `app-source-guard`'s "no vendored library" scope (`app-source-guard.test.mjs:8`) about the page alone. Placing it in `lib/` would subject it to every lib guard and to `LIB_MODULE_RE`. The proposal and spec were aligned to this path on 2026-09-30. |
| D2 | `server.mjs` adds one literal `STATIC_FILES` entry, `['/vendor/marked.esm.js', {dir: VENDOR_DIR, name: 'marked.esm.js', type: JS_TYPE}]`, and adds the route to `KNOWN_ROUTES`. | A `/vendor/*` pattern | This keeps the allow-list posture (`server.mjs:41-52`): no request path is ever joined onto a filesystem path. |
| D3 | The only marked API used is `import { Lexer } from '../vendor/marked.esm.js'`, called as `Lexer.lex(text, { gfm: true, breaks: false, pedantic: false })`, with **a fresh object literal on every call**. | `marked.lexer(text)` with defaults | Verified in `marked.esm.js:46`: `constructor(e){… this.options=e||y; this.options.tokenizer=…}`. A passed object **replaces** the defaults rather than merging with them, so `gfm` must be explicit or tables, task items, `del` and autolinks disappear. The lexer also **mutates** the object, so a shared or frozen one is wrong. A private options object also makes the global `marked.use`/`setOptions` state irrelevant. Import has no side effects: the file contains no `globalThis`, `window`, `document`, `process` or `fetch` (measured). |
| D4 | `markdown.mjs` catches any throw from `Lexer.lex`, including marked's "Infinite loop on byte" (`marked.esm.js:60`) and `RangeError`. The whole text then degrades to one `code` block plus a notice. The adapter also caps nesting at depth 32, and anything deeper becomes `literal`. | Letting it throw | "Malformed input must terminate and degrade to text." |
| D5 | Documents are read with `git rev-parse --verify HEAD^{commit}` → `H`, then **one** `git --literal-pathspecs ls-tree -l -z H -- <6 paths>`, then `git cat-file blob <blobSha>` for each present document. | `git show HEAD:<p>` with stderr parsing | `ls-tree` gives a clean tri-state: a line means present, exit 0 with no line means **missing**, and a throw means **unreadable**. It needs no stderr, and the `run` seam ignores stderr anyway (`server.mjs:87`, `change-route.mjs:297`). It also returns the byte size and the blob type. The content is byte-identical to `git show H:<p>` (R2). `--literal-pathspecs` stops a `*` in a dir name from globbing. |
| D6 | The stamp's `commit` is `H`, the commit the read was made at. For resume it is `git rev-parse --verify <branch>^{commit}`. | `git log -1 -- <p>` for each document | `git show <commit>:<path>` reproduces the bytes exactly. This costs one spawn instead of six. |
| D7 | Resume keeps the read `git show <branch>:resume.md` with an unchanged argv (R2, `change-route.mjs:131`). It is preceded by `ls-tree <branch> -- resume.md` to tell missing from unreadable. `resolveBranch` runs **once**, and its result is shared by the Working memory tab and the resume document. | Re-resolving per consumer | One read, and no duplicated `git branch --list`. |
| D8 | Cap: `CAP = 262144`. Above `READ_LIMIT = 8 MiB` (blob size from `ls-tree`) the document is not read and the state is unreadable, with the reason "N bytes exceeds the read limit". Otherwise `run(…, {maxBuffer: size + 4096})`, then the cut described below. | Reading with the default `maxBuffer` | `execFileSync` defaults to 1 MiB, so a 2 MB document would come back as `ENOBUFS` labelled "unreadable" when it should be "truncated". |
| D9 | `run(file, args, opts?)` gains an optional third argument. Only `maxBuffer` is read. `server.mjs:87` forwards it. | A second seam | This is the smallest change to the injected port. Existing two-argument stubs keep working. |
| D10 | Resume is reachable from the **SDD tab** as an unnumbered row, `working memory — resume.md`, after the seven stages (AC3, R4). The Working memory tab stays frontmatter-only, and `resume-view.mjs` is **unchanged**. | Rendering the body in the Working memory tab (proposal "affected areas") | AC3 says "reachable from the SDD tab". Rendering it twice would give two expand states for one document. |
| D11 | Leading YAML frontmatter is handled by `markdown.mjs`. If the text starts with `---\n` and a closing `---` line exists, the adapter emits `{t:'frontmatter', text}` and lexes the rest. This covers proposal, design and resume. | Lexing it raw | marked reads `key: v\n---` as a setext `h2`. |
| D12 | Anchors (`#x`) are inert, like relative links, and headings get no `id`. | Live in-document anchors | Generated ids could clobber page ids such as `#drawer`. R1 already accepts inert text. |
| D13 | Link titles are dropped (no `title` attribute). Code-block `lang` is kept only if it matches `/^[\w+-]{1,32}$/`. | Passing them through | They are less surface, and nothing needs them. |
| D14 | The adapter has an input ceiling, `MAX_INPUT = 524288` bytes. Above it the input is never handed to the tokenizer: it renders as one `code` block plus a notice. | No ceiling beyond the 256 KB document cap | Documents are capped upstream at 262144, so the ceiling only binds a caller that bypasses the cap. marked runs out of heap at around 4 MB of deeply nested lists, so the ceiling bounds that failure. Tested in `lib/markdown.test.mjs`. |

## The tree (`lib/markdown.mjs`)

```js
// markdownTree(text) -> { blocks: Block[], notices: string[] }   (never throws)
// safeHref(raw)      -> { ok: true, href } | { ok: false, reason: 'relative'|'anchor'|'scheme'|'malformed' }
Block  = {t:'heading', level:1-6, children:Inline[]} | {t:'paragraph', children}
       | {t:'list', ordered, start:number|null, items:[{task:boolean, checked:boolean|null, blocks:Block[]}]}
       | {t:'code', lang:string|null, text} | {t:'blockquote', blocks} | {t:'hr'}
       | {t:'table', align:('left'|'center'|'right'|null)[], header:Inline[][], rows:Inline[][][]}
       | {t:'literal', text}        // html block (R5), unknown block type -> token.raw
       | {t:'frontmatter', text}
Inline = {t:'text', text} | {t:'strong'|'em'|'del', children} | {t:'codespan', text} | {t:'br'}
       | {t:'link', href, children}            // href = safeHref().href only
       | {t:'inert', target, children}         // relative / anchor / refused scheme (R1)
```

Token mapping:

| marked token | Our node |
|---|---|
| `space`, `def`, `checkbox` | Dropped. A checkbox's state is read from `list_item.task`/`checked`. |
| `html`, inline `Tag` | `text`/`literal` with `raw` (R5). |
| `image` | `{t:'text', text:'[image: '+alt+']'}` (R6). |
| block-level `text` with `tokens` (tight list items) | `paragraph`. |
| `escape` | `text`. |
| Unknown inline token | `text`, built from `raw`. |

## Link policy: `safeHref`

1. A non-string is `malformed`.
2. Delete every `[\u0000- \u007F   -‏ -  -⁤　﻿]`. Browsers strip tabs and newlines anywhere in a URL.
3. A value starting with `#` is `anchor`.
4. Run `/^([a-z][a-z0-9+.-]*):/i`. No match is `relative`. That includes `//host`, `java%73cript:` and `&#106;…`.
5. A lower-cased scheme outside `{http, https}` is `scheme`.
6. `new URL(s)`: a throw is `malformed`. Also require `protocol ∈ {http:, https:}`, a non-empty `hostname`, and an empty `username`/`password` (refuses `https://github.com@evil.example`). The returned href is `url.href`.

The inert `target` is the raw href, trimmed. `app.js` sets the href with `setAttribute` and adds `rel="noopener noreferrer"`, `target="_blank"` and `referrerpolicy="no-referrer"`.

**XSS fixture** (`test-support/fixtures/markdown-xss.txt`). It is `.txt` because any `.md` under `brain/` is a nav document for `brain:check`, and the file holds NUL bytes (and U+202E and live `javascript:` links), so git stores it as binary:

- **Raw HTML:** `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `<a href="javascript:alert(1)">`, `<!-- <script> -->` and `<style>`.
- **Script schemes:** `[x](javascript:alert(1))`, `JaVaScRiPt:`, a leading space, `java\tscript:`, `&#106;avascript:`, `&#x6A;avascript:`, `java%73cript:`, `data:text/html;base64,…`, `vbscript:`, `file:///etc/passwd`, the autolink `<javascript:alert(1)>` and the reference definition `[r]: javascript:…`.
- **Other links:** `//evil.example/`, `https://user@evil.example`, and a `"` breakout in the title and in the URL.
- **Images and control characters:** `![a](javascript:…)`, NUL and U+202E.

The assertions run on both the tree and the rendered fake DOM:

- No `SCRIPT`, `IMG`, `IFRAME`, `STYLE`, `OBJECT`, `EMBED` or `INPUT` element exists.
- No attribute matches `/^on/i` or is named `style`.
- Every `A[href]` matches `/^https?:\/\//`.
- The script text is visible as text.

## Route payload

`buildChangeView().value.documents` is keyed `proposal|spec|design|tasks|apply|verify|resume`. Each entry:

```js
{ path, ref: 'HEAD'|branch, commit: string|null, state: 'present'|'truncated'|'missing'|'unreadable',
  text: string|null, bytes: number|null, truncated: boolean, truncatedAt: number|null, reason: string|null, note: string|null }
```

- **Without a change dir,** the six stage entries are `null`. The `sdd` rows carry no `document` key on the wire: `drawer-model.mjs` joins documents to rows by stage in `sddEntries(items, documents)`, and `archive` has no document because it is a stage, not a document.
- **Truncation** runs server-side on a Buffer: `if (buf.length > CAP) { let end = CAP; while (end > 0 && (buf[end] & 0xC0) === 0x80) end--; text = buf.subarray(0, end).toString('utf8'); truncatedAt = end }`. `bytes` is the blob size from `ls-tree`. A cut document has `state: 'truncated'`, `truncated: true` and `note: "truncated at N bytes"`; it is not `present` with a flag.
- **Missing vs unreadable:**

| Case | State |
|---|---|
| The `rev-parse` or `ls-tree` throw | All six are unreadable, each with that reason. |
| `ls-tree` returns no line | Missing. |
| The type is not `blob`, or the mode is `120000` | Unreadable ("is a tree/symlink"). |
| `cat-file` throws | Unreadable. |

- **Spec and tasks move from `_read` to `documents.spec.text` / `documents.tasks.text` (R2).** The tab wording becomes:
  - missing: "`<path>` is not committed at HEAD (`<H12>`)";
  - unreadable: "`<path>` could not be read at HEAD: `<reason>`".

  A truncated spec or tasks document adds the tab note "truncated at N bytes; cards cover the read part". `_read` becomes unused and stays accepted for signature parity, like `_exists` (`change-route.mjs:294`). Blame keeps `HEAD` (`change-route.mjs:89`), so its line numbers now match the text, where before they were matched against the working tree.
- **Single read (AC7).** `buildChangeView` calls `readDocuments` exactly once. `buildSpecTab` receives `documents.spec` and never reads. A test asserts that `cat-file` was called once for spec's blob and that `parseSpecCards(documents.spec.text).value.length === spec.value.length`.

## UI (R4)

- `drawer-model.mjs`:
  - `sddEntries(items, documents)` attaches `document: documentView(doc)` to each row. A view carries `{key, state, stamp:'<path> @ <commit12>', wording, note, text}`, with wording:
    - missing: "`<file>` is not committed at `<ref>`";
    - unreadable: "`<file>` could not be read at `<ref>`: `<reason>`".
  - The resume row is appended **only when** `changeView.value.documents?.resume` exists, which keeps `drawer-model.test.mjs:288`'s fixture valid.
- `app.js` `renderEntry` (`:1693`):
  - If `item.document` is present and its state is present, it appends a native `<button class="doc-toggle" aria-expanded aria-controls="doc-<issue>-<key>">`. Enter and Space come free with a native button.
  - Missing or unreadable renders `said(wording)` with no button.
  - When expanded, a `<section role="region" aria-label="<stamp>">` holds the stamp, the truncation note and the rendered blocks.
- **Lazy rendering.** `markdownTree` runs only when a row is expanded.
  - The click handler toggles in place: it appends or removes the section and flips `aria-expanded`. It does not call `renderDrawer()`, so focus survives.
  - A page-local `expandedDocs` Set (keyed `issue:key`, like `collapsedTracks` at `:114`) restores the expanded state on stream re-renders.
  - A `Map` cache keyed `path@commit` is cleared when `selectedIssue` changes.
- **DOM builder** (`renderMdBlocks` / `renderMdInline`) uses only `el()` (`:120`), `document.createTextNode` and `setAttribute`. Headings map to `h${min(6, level+2)}` (the drawer title is `h2`).
  - **Lists:** `ul`/`ol`; an `ol` gets `start` when it is not 1. A task item gets a `☑`/`☐` text mark.
  - **Code and tables:** `pre>code`; `table>thead/tbody`, with alignment as the class `md-align-*` (an enum, never a `style`).
  - **Other blocks:** `blockquote`, `hr`, `p.md-literal`, `pre.md-frontmatter`.
  - **Inert link:** `span.md-inert` holding its children plus `code` with the target.

## Guards

1. **`app-source-guard`:** the existing innerHTML-family ban (`:122`) also scans every `ui/lib/*.mjs`. Today nothing there matches except a comment in `memory-model.mjs:4`, so the scan runs over `codeOnly()` text.
2. **The `lib/source-guard` `./`-only rule (`:37-50`)** gains one exact `(file, specifier)` exemption, `markdown.mjs → ../vendor/marked.esm.js`. A test fails if the exemption is unused.
3. **New `ui/marked-usage-guard.test.mjs`** scans all `ui/**/*.{mjs,js}`, excluding `vendor/` and `*.test.mjs`. It checks that:
   - the vendor file is imported only by `lib/markdown.mjs`, with bindings exactly `{ Lexer }`, and with no namespace, default or dynamic import;
   - no `marked(`, `marked.` or `parseInline` appears anywhere, and no `Parser` appears in an import;
   - `Lexer.` is used only as `Lexer.lex(`;
   - every `.parse(` has a receiver of `JSON` or `Date`. A bare `.parse(` ban would fail on `frames.mjs:86` and `history-model.mjs:79`.
4. **New `ui/vendor/vendor.test.mjs`** checks that:
   - the sha256 of `marked.esm.js` equals the hash in `VERSIONS` (`marked 18.0.14 sha256:<hex> marked.esm.js`);
   - `LICENSE.marked` exists;
   - `package.json` has no `marked` in any dependency field (AC6);
   - the vendor file contains no `fetch(`, `XMLHttpRequest`, `import(`, `globalThis`, `window.` or `document.`.
5. **Determinism:** `markdownTree(x)` deep-equals itself across two calls and across a fresh module import, for the real `openspec/changes/**` artifacts in the repo.
6. **Termination:** each of `'['×50k`, `'*'×50k`, `'>'×10k`, an unclosed fence, an unclosed `<!--`, a 1000-column table and NUL bytes returns within 2 s, yields `blocks.length > 0`, and does not throw.

## Test strategy (strict TDD, `npm test`)

**RED first:** `lib/markdown.test.mjs` "an html token renders as literal text (R5)". The module does not exist yet. The rest of that file follows: one test per construct (AC4, so deleting the table mapping fails), R1/R6, the `safeHref` table, frontmatter, depth cap, determinism and termination. Then come the vendor and guard tests, then the route.

| File | Action |
|---|---|
| `lib/markdown.test.mjs`, `ui/vendor/vendor.test.mjs`, `ui/marked-usage-guard.test.mjs` | Create |
| `static/markdown-render.test.mjs` | Create. Boots the real app on the fake DOM (`installDom` + `loadApp`) with `proposal.md` set to the XSS fixture, expands the row and walks the tree (AC1, AC3). |
| `test-support/fake-git.mjs` | Create. Answers `rev-parse`, `ls-tree -l -z`, `cat-file blob`, `show <ref>:<p>`, `blame` and `branch` from an in-memory `{path: text}` map. |
| `change-route.test.mjs` | Modify. Every `recordingRun` handler that throws on unexpected calls (tests at `:78`, `:101`, `:118`, `:150`, `:168`, `:190`, `:207` and later) moves to `fake-git`. `:150`'s regex changes to the "not committed" wording, and missing and unreadable get separate assertions (AC5). New tests cover the cap, the UTF-8 boundary, the 8 MiB limit, AC7, and literal pathspecs. |
| `static/app-smoke.test.mjs` | Modify. `boot()` (`:143`, `:155`) uses `fake-git` over the fixture files. Otherwise `#1067` (`:444`) fails because spec becomes unreadable. `:431`'s `stage-file` list is unaffected (the resume row takes the unnumbered branch). |
| `server.test.mjs` | Modify. `:861` KNOWN_ROUTES; `:867` parity stub; new: `GET /vendor/marked.esm.js` returns 200 with the file's bytes, and `/vendor/x.js` returns 404. |
| `lib/provenance.test.mjs` (`:133`, `:156`), `lib/drawer-model.test.mjs`, `lib/source-guard.test.mjs`, `static/app-source-guard.test.mjs` | Modify, as described above. |

## Size (excluding tests)

| File | Lines |
|---|---|
| `vendor/marked.esm.js`, `LICENSE.marked`, `VERSIONS` | ~80, ~45, 1 |
| `lib/markdown.mjs` | ~170 |
| `change-route.mjs` | +~110 |
| `app.js` | +~110 |
| `drawer-model.mjs` | +~45 |
| `app.css` | +~40 |
| `test-support/fake-git.mjs` | ~50 (not a `*.test.mjs`) |
| `server.mjs` | +~6 |

The forecast was about 660; the measured total is **921** gated lines (878 added, 43 deleted), under the `lite` budget of 1000. `sdd-model.mjs` and `resume-view.mjs` are unchanged.

**Split point,** if review asks for it:

1. The vendor, `markdown.mjs`, the guards, the server route, and the documents for proposal, design, apply, verify and resume, with the UI.
2. Spec and tasks move to HEAD, with the single read (AC7) and the test migration.

Neither slice ever has two reads of one file.

## Contract / API impact

- `GET /api/change/{issue}` gains `value.documents`, which is additive. The `sdd` rows are unchanged.
- Spec and tasks tab content now reflects HEAD (R2).
- The `run` seam gains an optional third argument.
- A new public route, `/vendor/marked.esm.js`.
- No config, schema or dependency change.

## Open risks

- **Path (D1).** Settled: `ui/vendor/`, served at `/vendor/marked.esm.js`; the proposal and spec were aligned to it.
- **ReDoS in marked.** It is bounded by the 256 KB cap (kept), the adapter input ceiling (D14) and the termination test, not eliminated. A future marked bump goes through the sha pin and is re-tested.
- **`brain:repo:check` on the minified vendor file.** The secret and TODO rules in `check-refs-rules.mjs` are applied line by line to an 80-line minified file. The vendor file may need a named exemption, so the implementer must run the check before the first commit.
- **Race windows.** Blame still reads `HEAD` while documents read `H`. Resume `rev-parse` and `show` read the branch twice. Either can disagree only if a commit lands mid-request, which is acceptable for a local read model.
- **Spawn count.** One drawer open costs about 9–12 `git` spawns, up from 2–3. This is local and fast, but unmeasured.
- **Over-limit documents.** A document over 8 MiB is shown as unreadable rather than truncated, which is a deliberate limit beyond R3.
- **Design length.** This design exceeds the skill's 800-word budget because the brief asked for nine evidenced sections.
