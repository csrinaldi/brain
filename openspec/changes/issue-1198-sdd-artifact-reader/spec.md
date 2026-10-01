---
status: draft
issue: 1198
---

# Spec — sdd-artifact-reader (issue 1198)

Capability: `sdd-artifact-reader` (new). Delta requirements: what MUST be true after this change. The proposal's rulings R1-R7 are binding and are referenced by number. Requirement keywords follow RFC 2119.

Scenario grammar: each scenario carries one `GIVEN`, one `WHEN` and one `THEN` line, so the UI's spec cards (`ui/lib/spec-cards.mjs`) render this file in full. A scenario that needs several observable outcomes states them in its single `THEN` line.

### R1198-1: The seven documents are readable from the SDD tab

The SDD tab MUST expose a readable document for each of exactly seven artifacts: `proposal.md`, `spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md` and `resume.md`. `archive` is a lifecycle stage and MUST NOT be offered as a document. Each stage row MUST expand in place to show its document (R4). No new tab MUST be added: the tab set returned by `buildChangeView` stays spec, sdd, tasks, workingMemory, reviews, records.

#### Scenario: Each artifact present at HEAD yields a non-empty document
- **GIVEN** a change directory whose seven artifacts are all committed and non-empty
- **WHEN** the change view is built
- **THEN** `documents` holds seven entries keyed proposal, spec, design, tasks, apply, verify and resume, each with state `present` and non-empty text

#### Scenario: The archive stage has no document
- **GIVEN** a change whose stage rows include `archive`
- **WHEN** the change view is built
- **THEN** no entry in `documents` is keyed `archive`, and the `archive` stage row keeps its present/missing mark without an expandable document

#### Scenario: Stage rows expand inside the SDD tab and no tab is added
- **GIVEN** the drawer rendered for a change with committed documents
- **WHEN** the user activates a stage row in the SDD tab
- **THEN** that row's document is shown beneath it, the drawer still has exactly the six tabs it had before this change, and no `documents` content is placed in any other tab

### R1198-2: Document states are distinct and said

Every document MUST resolve to exactly one of four states, each with its own wording: `present`, `missing` (no file at the read ref), `unreadable` (the read failed for any other reason), and `truncated` (present and over the cap). `missing` and `unreadable` MUST NOT share wording, and neither MUST render as an empty document, because an empty body would be read as "the file has nothing in it".

#### Scenario: Missing and unreadable use different wording
- **GIVEN** one change whose `design.md` does not exist at HEAD, and another whose `design.md` read fails with a git error
- **WHEN** both change views are built and rendered
- **THEN** the first shows the missing wording, the second shows the unreadable wording together with the failure reason, and the two strings are not equal

#### Scenario: A failed read is never an empty document
- **GIVEN** a document whose read returned an error
- **WHEN** the document is rendered
- **THEN** the rendered node contains the unreadable message and contains no body element for the document

#### Scenario: A zero-byte committed file is present, not missing
- **GIVEN** `tasks.md` is committed at HEAD with zero bytes
- **WHEN** the change view is built
- **THEN** the `tasks` document has state `present` with empty text, and its state is not `missing`

### R1198-3: Documents are capped at 256 KB with a truncation note

A document whose committed content exceeds 262144 bytes MUST be cut at that cap and MUST carry the note "truncated at 262144 bytes" (R3). A document at or below the cap MUST be returned whole and MUST NOT carry the note. The UI MUST NOT offer a "load full" action.

#### Scenario: An oversized document is truncated and says so
- **GIVEN** `design.md` committed at HEAD with 300000 bytes
- **WHEN** the change view is built
- **THEN** the `design` document has state `truncated`, its text is at most 262144 bytes, and it carries the note "truncated at 262144 bytes"

#### Scenario: A document exactly at the cap is not truncated
- **GIVEN** `design.md` committed at HEAD with exactly 262144 bytes
- **WHEN** the change view is built
- **THEN** the `design` document has state `present`, its text is whole, and it carries no truncation note

#### Scenario: Truncation never splits a multibyte character into garbage
- **GIVEN** a committed document whose 262144th byte falls inside a multibyte UTF-8 sequence
- **WHEN** the change view is built
- **THEN** the returned text contains no U+FFFD replacement character that the original did not contain

### R1198-4: One read path, committed content only

Six documents (`proposal.md`, `spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`) MUST be read from the committed content at the resolved HEAD commit (R2). `resume.md` MUST be read from the committed content at the change branch's tip, resolved to a commit once, so the stamp names the commit the text came from. No command is prescribed. No document MUST be read from the working tree or the index. `spec.md` and `tasks.md` MUST no longer read the working tree.

#### Scenario: An uncommitted edit is not shown
- **GIVEN** `spec.md` committed at HEAD with three requirements and a working-tree edit that adds a fourth
- **WHEN** the change view is built
- **THEN** the `spec` document text contains three requirements and does not contain the uncommitted fourth

#### Scenario: Tasks come from HEAD, not the working tree
- **GIVEN** `tasks.md` committed at HEAD with one checked box and a working-tree edit that checks a second
- **WHEN** the change view is built
- **THEN** the tasks tab counts one checked item

#### Scenario: Resume is read at the branch tip
- **GIVEN** `resume.md` committed on the change branch but absent at HEAD
- **WHEN** the change view is built
- **THEN** the `resume` document is `present`, its stamp names the branch-tip commit, and the six HEAD-read documents are not affected

#### Scenario: No filesystem read of an artifact remains
- **GIVEN** the source of `change-route.mjs`
- **WHEN** the source is scanned for artifact reads
- **THEN** every artifact read goes through the git read helper, and none goes through the working-tree reader

### R1198-5: Every document carries a `{path, commit}` stamp

Every document in a `present` or `truncated` state MUST carry a stamp `{path, commit}` where `path` is the repo-relative artifact path and `commit` is the commit the document was read at: the resolved HEAD hash, obtained by one `rev-parse` shared by all six HEAD-read documents (for `resume`, the resolved branch-tip hash). The stamp is NOT the commit that last changed the file. The UI MUST render the stamp with the document. A `missing` or `unreadable` document MUST carry the `path` it looked for and MUST NOT carry an invented commit.

#### Scenario: A present document is stamped
- **GIVEN** HEAD resolves to commit `abc1234`, which is later than the commit that last changed `proposal.md`
- **WHEN** the change view is built
- **THEN** the `proposal` document's stamp equals `{path: "openspec/changes/issue-1198-sdd-artifact-reader/proposal.md", commit: "abc1234"}`, the commit it was read at, and the same commit appears on the other five HEAD-read documents

#### Scenario: The rendered document shows its stamp
- **GIVEN** a present document with a stamp
- **WHEN** the document is rendered in its stage row
- **THEN** the row's text contains both the stamp path and the stamp commit

#### Scenario: A missing document has no fabricated commit
- **GIVEN** `verify-report.md` absent at HEAD
- **WHEN** the change view is built
- **THEN** the `verify` document stamp has the expected path and its `commit` is null

### R1198-6: The renderer produces the full artifact subset as elements

The renderer MUST turn markdown text into elements for exactly this subset: headings (h1-h4 at least), paragraphs, nested ordered and unordered lists, task items (`- [ ]` / `- [x]`), GFM tables, fenced code blocks, block quotes, horizontal rules, and inline code, bold, italic, strikethrough (`del`), hard line breaks (`br`) and links. Any construct outside the subset MUST render as its literal source text. Each construct MUST map to its own element type, so removing one construct's rule fails that construct's test.

#### Scenario: Block constructs map to elements
- **GIVEN** markdown with a `##` heading, a paragraph, a blockquote and a `---` rule
- **WHEN** it is rendered
- **THEN** the output contains one h2, one p, one blockquote and one hr, in source order

#### Scenario: Nested lists keep their nesting
- **GIVEN** a bullet list with an indented sub-list and an ordered list
- **WHEN** it is rendered
- **THEN** the sub-list is a ul nested inside its parent li, and the ordered list is an ol

#### Scenario: Task items carry their checked state
- **GIVEN** the lines `- [x] done` and `- [ ] open`
- **WHEN** they are rendered
- **THEN** two list items are produced, the first marked checked and the second unchecked, and the `[x]`/`[ ]` markers do not appear as literal text

#### Scenario: A GFM table renders as a table
- **GIVEN** a header row, a delimiter row and two body rows
- **WHEN** it is rendered
- **THEN** the output is one table with one header row of th cells and two body rows of td cells

#### Scenario: Removing the table rule fails
- **GIVEN** the table fixture and an adapter with the table mapping removed
- **WHEN** the table test runs against that adapter
- **THEN** the test fails because no table element is produced

#### Scenario: Fenced code is preserved verbatim
- **GIVEN** a fenced block with a language tag containing `<b>x</b>` and `**not bold**`
- **WHEN** it is rendered
- **THEN** one pre/code element holds the text exactly as written and no b or strong element exists in it

#### Scenario: Inline constructs map to elements
- **GIVEN** a paragraph with `code`, `**bold**`, `*italic*` and `[text](https://example.com)`
- **WHEN** it is rendered
- **THEN** the paragraph holds one code, one strong, one em and one a element whose href is `https://example.com`

#### Scenario: An unsupported construct degrades to literal text
- **GIVEN** a construct outside the subset, such as a footnote definition `[^1]: note`
- **WHEN** it is rendered
- **THEN** its source appears as literal text and no element for it is produced

### R1198-7: Relative links render as inert text

A link whose target is relative (no scheme, no leading `//`, including `./x`, `../x`, `x/y.md` and `#anchor`) MUST render as inert text showing its path, never as an anchor (R1). No attribute carrying the path MUST be set on any element.

#### Scenario: A relative link shows its path as text
- **GIVEN** the markdown `[design](./design.md)`
- **WHEN** it is rendered
- **THEN** the output contains the text `design` followed by its path `./design.md` as plain text, and contains no a element

#### Scenario: Anchors and parent paths are inert
- **GIVEN** the markdown `[top](#top)` and `[up](../other/spec.md)`
- **WHEN** they are rendered
- **THEN** neither produces an a element and each shows its target as text

### R1198-8: Link schemes pass an allowlist, and everything else is inert

A link MUST become an anchor only when its target, after the normalization below, has the scheme `http` or `https`. `mailto` and every other scheme are refused. Normalization MUST trim whitespace and strip ASCII control characters, Unicode whitespace and zero-width or bidi controls before the scheme is read. Character references and entities are NOT decoded: an entity-obfuscated scheme such as `jav&#x61;script:` is not recognised as a scheme, so it is treated as relative and rendered inert. Every other target MUST render as inert text. An accepted anchor MUST carry `rel="noopener noreferrer"`. The decision MUST be made on the normalized form, never on the raw string.

#### Scenario: Allowed schemes become anchors with a safe rel
- **GIVEN** links to `https://a.example` and `http://a.example`
- **WHEN** they are rendered
- **THEN** each yields an a element whose rel is `noopener noreferrer`

#### Scenario: Script-bearing schemes are inert
- **GIVEN** links to `javascript:alert(1)`, `data:text/html,<script>1</script>` and `vbscript:msgbox(1)`
- **WHEN** they are rendered
- **THEN** no a element and no href attribute is produced for any of them, and each target appears only as text

#### Scenario: Obfuscated schemes are inert
- **GIVEN** links to ` javascript:alert(1)`, `JaVaScRiPt:alert(1)`, `java\tscript:alert(1)`, `jav&#x61;script:alert(1)` and `&#106;avascript:alert(1)`
- **WHEN** they are rendered
- **THEN** none produces an a element, and each appears only as text

#### Scenario: Unknown schemes are inert
- **GIVEN** links to `ftp://a.example` and `file:///etc/passwd`
- **WHEN** they are rendered
- **THEN** neither produces an a element

### R1198-9: HTML is literal text

Any HTML in a document, whether a block, an inline tag or a comment, MUST render as visible literal text (R5). It MUST NOT be parsed, dropped or executed. No element other than those the R1198-6 subset names (including `del` and `br`) MUST be created from document content.

#### Scenario: A script tag is shown, not run
- **GIVEN** the markdown `<script>alert(1)</script>`
- **WHEN** it is rendered
- **THEN** the output contains the literal text `<script>alert(1)</script>` and no script element

#### Scenario: Event-handler attributes are shown, not applied
- **GIVEN** the markdown `<img src=x onerror=alert(1)>` and `<a href="x" onclick="y()">z</a>`
- **WHEN** they are rendered
- **THEN** both appear as literal text, and no img or a element and no onerror or onclick attribute exists in the output

#### Scenario: An HTML comment is visible
- **GIVEN** the markdown `<!-- note to self -->`
- **WHEN** it is rendered
- **THEN** the text `<!-- note to self -->` is visible in the output

### R1198-10: Images are inert text

Image syntax MUST render as the inert text `[image: alt]`, where `alt` is the image's alt text (R6). No img element MUST be created and no URL MUST be loaded or exposed as an attribute.

#### Scenario: An image becomes bracketed text
- **GIVEN** the markdown `![architecture diagram](https://a.example/x.png)`
- **WHEN** it is rendered
- **THEN** the output contains the text `[image: architecture diagram]` and no img element

#### Scenario: An image with no alt text still says it is an image
- **GIVEN** the markdown `![](https://a.example/x.png)`
- **WHEN** it is rendered
- **THEN** the output contains the text `[image: ]` and no element carries the URL

### R1198-11: The tokenizer is vendored, pinned and lexer-only

The tokenizer MUST be `marked@18.0.14`, vendored at `brain/scripts/ui/vendor/marked.esm.js` with its license at `vendor/LICENSE.marked` and the pinned version and sha256 recorded in `vendor/VERSIONS` (R7). The adapter `ui/lib/markdown.mjs` MUST call only `marked.lexer()`. A source guard MUST fail on any call to `marked.parse`, `marked.parseInline` or any other HTML-string output of marked in the adapter and in `static/app.js`. A drift test MUST fail when the sha256 of the vendored file differs from the value recorded in `vendor/VERSIONS`. The browser and node:test MUST import the same vendored file, and the server MUST serve it.

#### Scenario: The vendored file matches its recorded hash
- **GIVEN** the vendored `marked.esm.js` and `vendor/VERSIONS`
- **WHEN** the drift test computes the file's sha256
- **THEN** it equals the hash recorded for version 18.0.14

#### Scenario: An unrecorded swap fails the drift test
- **GIVEN** the vendored file with one byte changed and `vendor/VERSIONS` unchanged
- **WHEN** the drift test runs
- **THEN** it fails and names the vendored file

#### Scenario: A parse call fails the source guard
- **GIVEN** a copy of `markdown.mjs` with a call to `marked.parse(text)` added
- **WHEN** the source guard scans it
- **THEN** the guard fails and names the forbidden call

#### Scenario: The vendored file is reachable by the browser
- **GIVEN** the running UI server
- **WHEN** `/vendor/marked.esm.js` is requested
- **THEN** the response is 200 with a JavaScript content type and a body whose sha256 equals the recorded value

#### Scenario: Vendor paths cannot escape their directory
- **GIVEN** the running UI server
- **WHEN** `/vendor/../server.mjs` and `/vendor/%2e%2e/server.mjs` are requested
- **THEN** both are refused and no file outside `ui/vendor/` is served

### R1198-12: No innerHTML anywhere in the rendering path

Rendering code MUST create text only through `textContent` or text nodes, and MUST NOT use `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`. The existing `app-source-guard.test.mjs` scan MUST be extended to cover `ui/lib/markdown.mjs` in addition to `static/app.js`.

#### Scenario: The guard covers the adapter
- **GIVEN** a copy of `lib/markdown.mjs` with an `innerHTML` assignment added
- **WHEN** the source guard scans the rendering path
- **THEN** the guard fails and names `lib/markdown.mjs`

#### Scenario: The guard still covers the app
- **GIVEN** `static/app.js` containing no forbidden sink
- **WHEN** the source guard scans the rendering path
- **THEN** it passes

### R1198-13: Rendering terminates on any input

The adapter and the DOM builder MUST terminate and MUST NOT throw on any input string, including empty text, unclosed fences, unbalanced emphasis and brackets, truncated tables, deeply nested lists and blockquotes, and a 256 KB input. Malformed input MUST degrade to literal text and MUST NOT be dropped.

#### Scenario: Malformed constructs degrade to text
- **GIVEN** the inputs ```` ```js\nunclosed ````, `**unclosed`, `[a](`, `| a | b |\n|---|` and `[x](<`
- **WHEN** each is rendered
- **THEN** each call returns, does not throw, and the visible text of the output contains the input's non-markup characters

#### Scenario: Pathological nesting terminates
- **GIVEN** an input of 2000 nested `>` markers and another of 2000 nested list indents
- **WHEN** each is rendered
- **THEN** each call returns within a bounded time and does not throw

#### Scenario: A capped document renders
- **GIVEN** a 262144-byte document of repeated table rows
- **WHEN** it is rendered
- **THEN** the call returns and the output contains elements

### R1198-14: Rendering is deterministic

For identical input text the adapter MUST return an identical tree and the DOM builder an identical element structure. Rendering MUST NOT read the clock, a random source or the environment, and MUST NOT call an LLM (epic #878, ruling 3).

#### Scenario: Two renders of one input are equal
- **GIVEN** one markdown fixture covering every construct in the subset
- **WHEN** it is rendered twice
- **THEN** the two trees are deeply equal and the two serialized element structures are equal

#### Scenario: No nondeterministic source is read
- **GIVEN** the source of `lib/markdown.mjs`
- **WHEN** the source guard scans it
- **THEN** it contains no `Date`, `Math.random`, `performance.now` or `process.env`

### R1198-15: Spec raw text and spec cards come from one read

The `spec` document text and the spec cards MUST derive from a single read of the committed content of `spec.md` at the resolved HEAD commit, so the two cannot disagree. The count of `### R<n>-<m>:` headings in the raw text MUST equal the number of cards.

#### Scenario: Raw text and cards agree on the requirement count
- **GIVEN** a committed `spec.md` with four requirement headings
- **WHEN** the change view is built
- **THEN** the `spec` document text contains four `### R` headings and the spec tab holds four cards

#### Scenario: One read feeds both
- **GIVEN** a counting stub for the git read helper
- **WHEN** the change view is built for a change with a `spec.md`
- **THEN** `spec.md` is read exactly once at HEAD for both the document and the cards

#### Scenario: A failed read fails both, said
- **GIVEN** a `spec.md` read that fails
- **WHEN** the change view is built
- **THEN** the `spec` document is `unreadable` and the spec tab reports the same failure, and neither shows an empty card list

### R1198-16: The resume body is shown with its frontmatter

The `resume` document MUST present the body of `resume.md` as well as its frontmatter, read at the branch tip per R1198-4. The frontmatter view MUST keep its current content.

#### Scenario: The body is rendered
- **GIVEN** a `resume.md` with frontmatter and a body paragraph
- **WHEN** the resume document is rendered
- **THEN** it shows the frontmatter fields as before and the body paragraph as rendered markdown

### R1198-17: No dependency is added

`package.json` MUST NOT gain any entry under `dependencies`, `optionalDependencies` or `peerDependencies` (AC6). The tokenizer is a vendored file, not an installed package.

#### Scenario: Dependencies are unchanged
- **GIVEN** `package.json` before and after the change
- **WHEN** their dependency sections are compared
- **THEN** the sections are equal

#### Scenario: marked is not resolved from node_modules
- **GIVEN** the adapter and `static/app.js`
- **WHEN** their imports are scanned
- **THEN** none imports the bare specifier `marked`, and the tokenizer import path resolves to `ui/vendor/marked.esm.js`

## Out of scope

- #883's uncommitted overlay: no working-tree or index content is read or shown.
- Editing documents from the UI.
- LLM summaries or any non-deterministic rendering.
- A file-serving route for repo files, and live links to repo files (relative links stay inert, R1198-7).
- A "load full" action for truncated documents.
- Full CommonMark or GFM coverage beyond the named subset.
- A hand-written tokenizer, an npm-installed markdown package, `marked.parse()`, and server-rendered HTML strings.
- Rendering `archive` as a document, and any new tab.

## Traceability

| Source | Requirement IDs |
|---|---|
| AC1 (XSS fixture renders inert) | R1198-8, R1198-9, R1198-7 |
| AC2 (`app-source-guard` passes, no `innerHTML`) | R1198-12 |
| AC3 (7 documents reachable, non-empty, stamped) | R1198-1, R1198-5, R1198-16 |
| AC4 (each construct yields its element) | R1198-6, R1198-13, R1198-14 |
| AC5 (missing vs unreadable wording) | R1198-2 |
| AC6 (no dependency, vendored and pinned, sha256 and source guard) | R1198-17, R1198-11 |
| AC7 (spec raw text and cards from one read) | R1198-15 |
| R1 (relative link inert) | R1198-7 |
| R2 (HEAD for six documents, branch tip for resume) | R1198-4, R1198-5 |
| R3 (256 KB cap and note) | R1198-3 |
| R4 (stage rows expand in SDD tab, no new tabs) | R1198-1 |
| R5 (HTML as literal text) | R1198-9 |
| R6 (image as `[image: alt]`) | R1198-10 |
| R7 (vendored marked, lexer-only, parse forbidden, sha256 drift) | R1198-11 |
