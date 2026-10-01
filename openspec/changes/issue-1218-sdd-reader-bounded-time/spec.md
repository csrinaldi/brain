---
status: draft
issue: 1218
---

# Spec — sdd-reader-bounded-time (issue 1218)

Capability: `sdd-artifact-reader` (modified; introduced by #1198, not yet archived to `openspec/specs/`). Delta requirements: what MUST be true after this change. The proposal's rulings R1-R6 are binding and are referenced by number. Requirement keywords follow RFC 2119. Requirements that modify an R1198-n requirement say so explicitly; every R1198-n not named here is unchanged.

Scenario grammar: each scenario carries one `WHEN` and one `THEN` line and an optional `GIVEN`, so the UI's spec cards (`ui/lib/spec-cards.mjs`, which keeps only the last `THEN`) render this file in full. A scenario that needs several observable outcomes states them in its single `THEN` line.

Fixed values used throughout (all binding from the rulings):

- Pre-scan thresholds: more than 600 delimiters in one inline span, or a single delimiter run longer than 50.
- Render budget: 1500 ms.
- Pre-scan notice: "a passage with N formatting marks is shown as plain text".
- Timeout notice: "this document was too slow to render (over 1500 ms) and is shown as plain text".
- Pre-scan delimiters: `*`, `_`, `~`, `[` and `]`, and no other character.
- Loading text: "rendering the document…".
- Worker-error notice: "this document could not be rendered and is shown as plain text".
- No-worker notice: "this browser cannot render this document off the page, so it is shown as plain text".
- No-branch reason: "no change branch in this clone".
- Unreadable reason cap: 200 characters.

### R1218-1: A pre-scan degrades pathological inline spans to literal text

`lib/markdown.mjs` MUST run a pure, linear pre-scan over each inline span before marked tokenizes it (R1). A span is a maximal run of lines closed by these reset rules: a blank line closes the span; a list item, a heading, a block quote marker or a table row closes the span and opens a new one on that line; a fence opener closes the span, and the lines of the fenced code are skipped (not counted) until a closer of the same character at least as long as the opener, or until the end of the text. The pre-scan MUST count the delimiter characters, exactly the five characters `*`, `_`, `~`, `[` and `]`, in the span, and the length of the longest run of one repeated delimiter character. A run is a maximal sequence of one delimiter character inside one line, and a newline ends a run. Backtick, `(`, `)`, `<` and `>` MUST NOT be counted. A span MUST be degraded when it holds MORE than 600 delimiters, or when it holds a single run LONGER than 50. A span at exactly 600 delimiters, or with a longest run of exactly 50, MUST NOT be degraded. The counter MUST reset at every span boundary above, so the count is per passage and never per document. The thresholds sit above the measured real maxima (122 delimiters in one span, a run of 7).

This requirement modifies R1198-13: rendering terminates on any input, and the cheap known classes terminate without reaching the worker backstop.

#### Scenario: A span over 600 delimiters is degraded
- **GIVEN** one paragraph of 601 delimiter characters mixed with text
- **WHEN** the adapter builds the tree
- **THEN** the paragraph's content is a single literal text node and no strong, em, del, code or a element is produced from it

#### Scenario: A span at exactly 600 delimiters is not degraded
- **GIVEN** one paragraph of exactly 600 delimiter characters with no run longer than 50
- **WHEN** the adapter builds the tree
- **THEN** the paragraph is tokenized by marked and the tree carries no pre-scan notice

#### Scenario: A single run longer than 50 is degraded
- **GIVEN** a paragraph containing a run of 51 `*` characters around a word
- **WHEN** the adapter builds the tree
- **THEN** the paragraph is emitted as literal text and carries the pre-scan notice

#### Scenario: A run of exactly 50 is not degraded
- **GIVEN** a paragraph containing a run of 50 `*` characters
- **WHEN** the adapter builds the tree
- **THEN** the paragraph is tokenized by marked and carries no pre-scan notice

#### Scenario: The counter resets at span boundaries
- **GIVEN** a document of 10 list items, each holding 300 delimiters, so the document holds 3000 delimiters and no single item holds more than 600
- **WHEN** the adapter builds the tree
- **THEN** no item is degraded and the tree carries no pre-scan notice

#### Scenario: A table row opens its own span
- **GIVEN** a table of 10 rows, each row holding 300 delimiters, so the table holds 3000 delimiters and no single row holds more than 600
- **WHEN** the adapter builds the tree
- **THEN** no row is degraded and the tree carries no pre-scan notice

#### Scenario: Fenced code is skipped by the pre-scan
- **GIVEN** a fenced code block holding 700 `*` characters between a fence opener and its closer
- **WHEN** the adapter builds the tree
- **THEN** no span is degraded, the tree carries no pre-scan notice and the block renders as code

#### Scenario: Characters outside the five delimiters are not counted
- **GIVEN** one paragraph of 700 characters drawn from backtick, `(`, `)`, `<` and `>` with no run longer than 50
- **WHEN** the adapter builds the tree
- **THEN** the paragraph is tokenized by marked and the tree carries no pre-scan notice

#### Scenario: The pre-scan is linear and does not call marked
- **GIVEN** the injected tokenize seam replaced by a function that throws
- **WHEN** the pre-scan classifies a 200 KB `*` run
- **THEN** it returns the degraded verdict without calling the seam and within the render budget

### R1218-2: A degraded passage is announced and the rest of the document still renders

A passage degraded by the pre-scan MUST render as literal text and MUST be preceded or followed by a visible notice reading "a passage with N formatting marks is shown as plain text" (R5), where N is the number of delimiter characters (`*`, `_`, `~`, `[` and `]` only) counted in that passage. Every other passage of the same document MUST render with its normal elements. Each degraded passage MUST carry its own notice, so the notice count equals the degraded-passage count. No degradation MUST be silent. This notice is distinct from the timeout notice (R1218-5), because the cause and the scope differ.

#### Scenario: The notice states N
- **GIVEN** one paragraph of 700 delimiters
- **WHEN** the document is rendered
- **THEN** the output contains the text "a passage with 700 formatting marks is shown as plain text"

#### Scenario: Other passages still render
- **GIVEN** a document with a heading, one degraded paragraph and a later paragraph holding `**bold**`
- **WHEN** the document is rendered
- **THEN** the output holds the h1 and one strong element for the later paragraph, and the degraded paragraph appears as literal text with its notice

#### Scenario: Two degraded passages give two notices
- **GIVEN** a document with two separate paragraphs, each over the threshold
- **WHEN** the document is rendered
- **THEN** the output contains exactly two pre-scan notices

#### Scenario: The degraded text is the source, not a dropped passage
- **GIVEN** a degraded paragraph whose source is known
- **WHEN** the document is rendered
- **THEN** the visible text of the passage equals its source characters

### R1218-3: No real artifact is degraded

Every file under `openspec/changes/**` MUST render through the adapter with zero pre-scan degradations (AC1.4). This is asserted by a test over the whole tree, not a sample, so a future marked upgrade or a threshold change that touches a real artifact fails it.

#### Scenario: The whole change tree renders with zero degradations
- **GIVEN** every markdown file under `openspec/changes/**`, including the archive
- **WHEN** each is run through the pre-scan
- **THEN** none yields a degraded span and none carries a pre-scan notice

#### Scenario: The assertion is a real detector
- **GIVEN** the same test run with one fixture of 601 delimiters added to the file set
- **WHEN** the test runs
- **THEN** it fails and names the fixture

### R1218-4: A worker renders each document, one worker per request

`static/app.js` MUST NOT run marked on the main thread when a document is expanded (R6). Each expansion MUST create ONE module Web Worker from `/lib/markdown-worker.mjs`, which imports the same vendored `marked.esm.js` and runs the lexer and the adapter. The worker MUST post its result back as plain data: a tree of objects, arrays, strings, numbers, booleans and null, with no functions, DOM nodes or class instances, so it crosses `postMessage` by structured clone. The worker MUST be terminated as soon as it posts a result, and on timeout (R1218-5) and on error (R1218-6). No worker is shared between rows, so a slow document cannot affect another open row.

This requirement modifies R1198-11: the tokenizer is still the one vendored marked, now also imported by the worker file, and the source guard that forbids `marked.parse` also covers `lib/markdown-worker.mjs`. It modifies R1198-12: the no-`innerHTML` scan also covers the worker file.

#### Scenario: Expanding a row creates one worker
- **GIVEN** an injected worker factory counting its calls
- **WHEN** the user expands one document row
- **THEN** the factory is called exactly once and no marked call runs on the main thread

#### Scenario: Two open rows have two workers
- **GIVEN** two document rows expanded in turn
- **WHEN** the second row's worker is created
- **THEN** the two workers are distinct instances and the first row's worker is not touched

#### Scenario: A result terminates its worker
- **GIVEN** a worker that posts a tree
- **WHEN** the result is received
- **THEN** that worker's `terminate` has been called exactly once

#### Scenario: The posted tree is plain data
- **GIVEN** the real worker file run under `worker_threads` against a fixture covering every construct in the R1198-6 subset
- **WHEN** the worker posts its tree
- **THEN** the received value deep-equals the tree the adapter builds in-process and `structuredClone` of it equals itself

#### Scenario: The worker file imports only the vendored tokenizer
- **GIVEN** the source of `lib/markdown-worker.mjs`
- **WHEN** the source guard scans its imports
- **THEN** the tokenizer import resolves to `ui/vendor/marked.esm.js`, no bare `marked` specifier exists and no `marked.parse` or `innerHTML` appears

#### Scenario: The worker file is served
- **GIVEN** the running UI server
- **WHEN** `/lib/markdown-worker.mjs` is requested
- **THEN** the response is 200 with a JavaScript content type

### R1218-5: A document that exceeds 1500 ms renders as announced plain text

The render budget MUST be 1500 ms per document (R2). When a worker has not posted a result within 1500 ms of its creation, `app.js` MUST terminate it and render the WHOLE document as literal text (preformatted, source verbatim) under the notice "this document was too slow to render (over 1500 ms) and is shown as plain text". The main thread MUST NOT be blocked for longer than the budget by any document, because marked runs only in the worker. The timeout MUST degrade only the document that timed out.

This requirement modifies R1198-13: the "pathological nesting terminates within a bounded time" scenario now holds for inline emphasis as well, and the bound is the 1500 ms budget, enforced by the worker rather than assumed of marked.

#### Scenario: A worker that never answers is cut at the budget
- **GIVEN** an injected worker that never posts and an injected clock and timer
- **WHEN** the timer advances by 1500 ms
- **THEN** the worker is terminated and the row shows the timeout notice and the document source as literal text

#### Scenario: A result just inside the budget is accepted
- **GIVEN** an injected worker that posts a tree at 1499 ms
- **WHEN** the result is received
- **THEN** the row shows the rendered elements and no timeout notice

#### Scenario: The timeout notice wording is exact
- **GIVEN** a timed-out document
- **WHEN** the row is rendered
- **THEN** the row text contains "this document was too slow to render (over 1500 ms) and is shown as plain text" and differs from the pre-scan notice

#### Scenario: The fallback is the whole document verbatim
- **GIVEN** a timed-out document with a heading and a table
- **WHEN** the row is rendered
- **THEN** the visible text equals the document source and no h1 or table element exists in the row

#### Scenario: One timeout does not touch another row
- **GIVEN** two expanded rows, the first with a worker that never answers and the second with a worker that answers
- **WHEN** the first row times out
- **THEN** the second row keeps its rendered elements and its worker is unaffected

#### Scenario: The 200 KB emphasis input is bounded
- **GIVEN** the 200 KB input of `*`x1e5 + `a` + `*`x1e5 and the real worker file under `worker_threads` with a 1500 ms budget
- **WHEN** the document is rendered through the pre-scan and the worker
- **THEN** the pre-scan degrades the passage with its notice, and the worker round trip completes without reaching the timeout

#### Scenario: A link-backtracking input is bounded by the worker
- **GIVEN** the 200 KB input `[a](` repeated 50000 times, which the pre-scan counts as over 600 delimiters or hands to the worker
- **WHEN** the document is rendered
- **THEN** it either shows the pre-scan notice or the timeout notice within 1500 ms plus teardown, and the main thread is never blocked

#### Scenario: A deep block quote is bounded
- **GIVEN** an input of 262000 `>` characters
- **WHEN** the document is rendered
- **THEN** the row shows the timeout notice as plain text, or the rendered tree if the worker finishes under budget, and the main thread is never blocked

#### Scenario: A deeply nested list is bounded
- **GIVEN** an input of 700 nested list indents
- **WHEN** the document is rendered
- **THEN** the row shows the rendered tree, which the real worker returns in about 197 ms, and the main thread is never blocked

#### Scenario: Timing is testable through the injected seam
- **GIVEN** `app.js` loaded with an injected async tokenize and an injected timer in the fake DOM
- **WHEN** a never-resolving tokenize is expanded and the timer is advanced by 1500 ms
- **THEN** the timeout path runs with no real waiting and no `Worker` global

### R1218-6: A worker failure or a missing worker is announced and not silent

A worker that raises an error event, throws on construction, or posts a message of an unrecognized shape MUST be treated as a failed render, not as a timeout. `app.js` MUST terminate the worker and render the whole document as literal text under the notice "this document could not be rendered and is shown as plain text". This wording differs from the timeout notice on purpose, because "too slow" would misstate the cause. A `RangeError` raised inside the worker (the stack overflow of the measured `>` and `*` inputs) is such an error.

When no `Worker` is available in the browser (`typeof Worker` is not a function), the outcome is `unavailable`, which is distinct from a failed render. `app.js` MUST render the whole document as literal text under the notice "this browser cannot render this document off the page, so it is shown as plain text". There MUST NOT be a main-thread marked call as a fallback, because that would reopen the freeze.

#### Scenario: A worker error shows its own notice
- **GIVEN** an injected worker that raises an error event
- **WHEN** the error is received
- **THEN** the row shows the notice "this document could not be rendered and is shown as plain text" and the document source as literal text

#### Scenario: A worker that cannot be constructed fails said
- **GIVEN** an injected worker factory that throws
- **WHEN** the user expands a row
- **THEN** the row shows the worker-error notice and no exception escapes `app.js`

#### Scenario: A malformed message is an error
- **GIVEN** an injected worker that posts a value that is not a tree
- **WHEN** the message is received
- **THEN** the worker is terminated and the row shows the worker-error notice

#### Scenario: No Worker available shows its own notice
- **GIVEN** a browser environment where `Worker` is undefined
- **WHEN** the user expands a row
- **THEN** the row shows the notice "this browser cannot render this document off the page, so it is shown as plain text" and the document source as literal text, with no marked call on the main thread and no worker-error notice

#### Scenario: An error terminates its worker
- **GIVEN** an injected worker that raises an error event
- **WHEN** the error is received
- **THEN** that worker's `terminate` has been called exactly once

### R1218-7: Expanding a row shows a loading state and drops stale results

Between expanding a row and receiving a result, the row MUST show a loading state (a visible "rendering the document…" line) and MUST NOT show an empty body. Each expansion MUST carry a token. A result, timeout or error whose token is not the row's current token MUST be discarded and MUST NOT change the DOM, including after a collapse and re-expand, after a collapse with no re-expand, and after a result that arrives for a closed row. A discarded request's worker MUST still be terminated.

This requirement modifies R1198-1: a stage row still expands in place to its document, now asynchronously.

#### Scenario: The loading state is visible while rendering
- **GIVEN** an injected tokenize that has not resolved
- **WHEN** the user expands a row
- **THEN** the row shows the loading line "rendering the document…" and holds no document body

#### Scenario: A result replaces the loading state
- **GIVEN** an expanded row showing the loading line
- **WHEN** the tokenize resolves with a tree
- **THEN** the loading line is gone and the rendered elements are shown

#### Scenario: A stale result after re-expand is dropped
- **GIVEN** a row expanded, collapsed and expanded again, with the first request still pending
- **WHEN** the first request resolves after the second
- **THEN** the row shows the second request's result and the first result is not rendered

#### Scenario: A result for a collapsed row is dropped
- **GIVEN** a row expanded and then collapsed with its request pending
- **WHEN** the request resolves
- **THEN** the collapsed row's DOM is unchanged and the request's worker has been terminated

#### Scenario: Result order does not matter
- **GIVEN** two requests for one row, the second resolving before the first
- **WHEN** the first then resolves
- **THEN** the DOM still shows only the second request's result

#### Scenario: A stale timeout is dropped
- **GIVEN** a row re-expanded while the first request's timer is pending
- **WHEN** the first timer fires
- **THEN** the row does not show the timeout notice

### R1218-8: A clone with no change branch is `missing`, not `unreadable`

When `resolveBranch` finds no change branch in the clone, `readResumeDocument` MUST return `state: 'missing'` with the reason "no change branch in this clone" (R3). No new state is added: the four states of R1198-2 stay `present`, `missing`, `unreadable` and `truncated`. A real failure of `git branch --list` (a non-zero exit, a spawn error) MUST stay `unreadable` and MUST carry the failure reason (R1218-10). When no ref resolved (an ambiguous branch or a git failure), the shared wording MUST say "the change branch could not be resolved: <reason>", never "could not be read at the change branch", because no ref was read. The SDD row and the Working memory tab MUST show the same wording for the no-branch case, both derived from one constant rather than two strings.

This requirement modifies R1198-2: the "missing" state now also covers a change whose branch is absent from the clone, and `missing` and `unreadable` still MUST NOT share wording.

#### Scenario: No change branch yields missing
- **GIVEN** a clone where the change's branch does not exist locally
- **WHEN** the change view is built
- **THEN** the `resume` document has state `missing` and reason "no change branch in this clone"

#### Scenario: A branch listing failure stays unreadable
- **GIVEN** a `git branch --list` that exits non-zero
- **WHEN** the change view is built
- **THEN** the `resume` document has state `unreadable` and carries the failure reason

#### Scenario: An unresolved branch says it could not be resolved
- **GIVEN** a change whose branch listing is ambiguous or whose `git branch --list` failed
- **WHEN** the SDD row and the Working memory tab are both rendered
- **THEN** both read "resume.md: the change branch could not be resolved: <reason>" and the state stays `unreadable`

#### Scenario: The SDD row and the Working memory tab share the wording
- **GIVEN** a change with no branch in the clone
- **WHEN** the SDD row and the Working memory tab are both rendered
- **THEN** both contain the exact text "no change branch in this clone" and neither contains the unreadable wording

#### Scenario: The wording has one source
- **GIVEN** the sources of `change-route.mjs` and `lib/drawer-model.mjs`
- **WHEN** a guard scans for the literal "no change branch in this clone"
- **THEN** it appears in exactly one module and the other imports it

#### Scenario: A deleted change branch is missing
- **GIVEN** a real temporary git repository where the change branch was created and then deleted
- **WHEN** the change view is built
- **THEN** the `resume` document has state `missing` and the reason is the no-branch wording

### R1218-9: One shared `run` helper pipes stderr

The default command runner MUST exist once. `server.mjs`, `change-route.mjs` and `watcher.mjs` MUST use the same helper, `gitRun(root)` in `brain/scripts/ui/git-run.mjs`, which MUST spawn with stderr piped (`stdio` of `['ignore', 'pipe', 'pipe']`) so a failure's `err.stderr` holds git's message (R4). The three duplicate default `run` definitions (`server.mjs`, `change-route.mjs` and `watcher.mjs`) MUST be removed. A guard test MUST fail if `child_process` is imported anywhere under `brain/scripts/ui/` other than in `git-run.mjs` (tests and `vendor/` excluded), so a second default runner cannot reappear.

#### Scenario: A failing command exposes its stderr
- **GIVEN** the shared helper run against `git rev-parse` of a revision that does not exist
- **WHEN** the command fails
- **THEN** the thrown error's `stderr` contains git's message, such as "fatal: Needed a single revision"

#### Scenario: All three consumers import the same helper
- **GIVEN** the sources of `server.mjs`, `change-route.mjs` and `watcher.mjs`
- **WHEN** their imports are scanned
- **THEN** all three use `gitRun` from `git-run.mjs` and none defines its own default runner

#### Scenario: A duplicate default run fails the guard
- **GIVEN** a copy of `change-route.mjs` that imports `child_process` and defines a local default `run` using `execFileSync`
- **WHEN** the guard scans `brain/scripts/ui/`
- **THEN** the guard fails and names the file

#### Scenario: The guard passes on the real tree
- **GIVEN** the real `brain/scripts/ui/` sources
- **WHEN** the guard scans for `child_process` imports
- **THEN** `child_process` appears only in `git-run.mjs`

### R1218-10: The unreadable reason is one cause line from git's stderr, capped

`gitErrorLine`, exported from `brain/scripts/ui/git-run.mjs`, MUST return the cause of a failure, not the command that failed (R4). It MUST select ONE line from the error's stderr: the first line starting with `fatal:` or `error:`; otherwise the first non-empty line of stderr; otherwise, when the error carries no stderr, the first line of the error's message. The selected line MUST be trimmed and capped at 200 characters in total. A line cut by the cap MUST end with the ellipsis `…` within that 200. The reason MUST NOT contain a newline.

#### Scenario: Stderr becomes the reason
- **GIVEN** an error whose stderr is "fatal: Needed a single revision\n"
- **WHEN** `gitErrorLine` runs
- **THEN** it returns "fatal: Needed a single revision" with no trailing newline

#### Scenario: The fatal or error line wins over earlier lines
- **GIVEN** an error whose stderr is "hint: something\nfatal: bad revision\nhint: more"
- **WHEN** `gitErrorLine` runs
- **THEN** it returns "fatal: bad revision" and the result holds no newline

#### Scenario: Without a fatal or error line the first non-empty line is used
- **GIVEN** an error whose stderr is "\n\nwarning: first\nsecond\n"
- **WHEN** `gitErrorLine` runs
- **THEN** it returns "warning: first"

#### Scenario: A long line is capped
- **GIVEN** an error whose stderr is a single line of 500 characters
- **WHEN** `gitErrorLine` runs
- **THEN** the result is exactly 200 characters and ends with an ellipsis

#### Scenario: A line at exactly 200 characters is not cut
- **GIVEN** an error whose stderr is exactly 200 characters on one line
- **WHEN** `gitErrorLine` runs
- **THEN** the result equals the stderr and carries no ellipsis

#### Scenario: A missing stderr falls back to the message
- **GIVEN** a plain `Error` whose message is "boom\nsecond line" and no `stderr` property, as `fakeGit({fail})` throws
- **WHEN** `gitErrorLine` runs
- **THEN** it returns "boom", the first message line trimmed

#### Scenario: A remote-only headBranch names the cause
- **GIVEN** a real temporary git repository whose `headBranch` exists only as a remote ref
- **WHEN** the change view is built and the `resume` document is read
- **THEN** the document is `unreadable` and its reason contains git's message about the missing revision and not only the name of the command

### R1218-11: The documented state set and the existing reader contract are otherwise unchanged

No new document state, tab, route, dependency or marked version is introduced. The tab set of R1198-1, the four states of R1198-2, the 262144-byte cap of R1198-3, the stamp of R1198-5, the link and HTML rules of R1198-7 to R1198-10 and the dependency rule of R1198-17 MUST hold unchanged. `package.json` MUST NOT gain any dependency entry, and `vendor/VERSIONS` MUST still record `marked@18.0.14` with an unchanged sha256.

#### Scenario: The vendored tokenizer is untouched
- **GIVEN** `vendor/VERSIONS` and the vendored `marked.esm.js`
- **WHEN** the drift test of R1198-11 runs
- **THEN** it passes with the original version and hash

#### Scenario: Dependencies are unchanged
- **GIVEN** `package.json` before and after the change
- **WHEN** their dependency sections are compared
- **THEN** the sections are equal

#### Scenario: The tab set is unchanged
- **GIVEN** the change view built for a change
- **WHEN** its tab keys are read
- **THEN** they are spec, sdd, tasks, workingMemory, reviews and records

## Out of scope

- Changing marked's version, or patching the vendored file.
- An LLM, or any non-deterministic rendering.
- A file-serving route for repo files.
- #883's uncommitted overlay: no working-tree or index content is read or shown.
- A new document state: the no-branch case reuses `missing`.
- A worker pool or a reused worker across requests. R6 allows reuse only if the worker is discarded on every timeout, and this spec requires one worker per request.
- A user-visible setting for the thresholds or the budget.
- Changing the 256 KB document cap of R1198-3.
- Fixing `RangeError` paths inside marked itself: they are caught and announced, not repaired.

## Traceability

| Source | Requirement IDs |
|---|---|
| Intent 1 (a pathological inline span freezes the page) | R1218-1, R1218-4, R1218-5 |
| Intent 2 (no change branch is not `unreadable`) | R1218-8 |
| Intent 3 (the unreadable reason names the cause) | R1218-9, R1218-10 |
| AC1.1 (main thread never blocked over 1500 ms, worker terminated at the budget) | R1218-4, R1218-5 |
| AC1.2 (every degraded render shows a notice, including a missing worker) | R1218-2, R1218-5, R1218-6 |
| AC1.3 (200 KB emphasis, `>` and nesting tests fail before and pass after) | R1218-5, R1218-1 |
| AC1.4 (zero degradations over real artifacts) | R1218-3 |
| AC2 (missing with the no-branch wording in both places; listing failure stays unreadable) | R1218-8 |
| AC3 (stderr reason, remote-only headBranch test, one `run` helper for server, change-route and watcher) | R1218-9, R1218-10 |
| R1 (pre-scan thresholds, worker backstop) | R1218-1, R1218-2, R1218-4 |
| R2 (1500 ms budget, whole-document literal fallback, async render with loading text "rendering the document…", stale results) | R1218-5, R1218-7 |
| R3 (`missing`, "no change branch in this clone", shared wording) | R1218-8 |
| R4 (one `run` piping stderr, `gitErrorLine` one capped cause line) | R1218-9, R1218-10 |
| R5 (distinct pre-scan notice, one passage) | R1218-2, R1218-5 |
| R6 (one worker per request, terminated on result or timeout) | R1218-4, R1218-5, R1218-7 |
| Modified R1198-13 (bounded time now covers inline emphasis) | R1218-1, R1218-5 |
| Modified R1198-1, R1198-2, R1198-11, R1198-12 | R1218-7, R1218-8, R1218-4 |
| Unchanged contract (no dependency, no new state) | R1218-11 |
