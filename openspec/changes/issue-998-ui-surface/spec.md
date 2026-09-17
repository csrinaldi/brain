# Spec — issue-998: the Brain UI surface

One requirement per PR of the chain; R998-1 is detailed because it ships first, the others state their acceptance and are detailed when their PR starts (the design carries the shapes).

### R998-1: the state vocabulary, provenance and the token block

`lib/state-vocab.mjs` MUST map every node to `{code, label, mark, className}` for exactly the states the data can produce: `planned`, `in-flight`, `done`, `blocked`, `awaiting-review`, `undeclared` (code value `unclassified`), `unreadable`, `not-computed` (roadmap `ok:false`), `unknown` (the per-node guard's output), keeping `colour.mjs`'s priority order and its throw on an unmapped state. `lib/provenance.mjs` MUST own `sourceLabel`, rendering `[repo: <path>:<line>]`, `[repo: <path>]`, `[forge: #<n>]` (with the URL kept for the chip), `[git: <sha7>]`, and the existing sentence for a missing source. `app.css` MUST define a token per state (`--state-<code>-fg`, `--state-<code>-bg`), surfaces and text with the light values on bare `:root` and the design's dark values under `@media (prefers-color-scheme: dark)`, and the font stacks `--font-sans` / `--font-mono` as system stacks. No file under `static/` or `lib/` MAY reference an external URL.

#### Scenario: every state has a word, a mark and a class
- **WHEN** `stateOf(node)` is called for each of the nine codes
- **THEN** it returns a distinct `code`, a non-empty `label` and `mark`, and a `className` that exists as a `--state-<code>-*` token pair in `app.css`

#### Scenario: not computed is not unknown
- **WHEN** a node's roadmap is `{ok:false}` and another node's status is unmapped
- **THEN** the first is `not-computed` and the second throws, and the renderer's guard renders it `unknown`; the two classes differ

#### Scenario: provenance forms
- **WHEN** `sourceLabel` receives `{path:'a/b.md', line: 42}`, `{path:'a/b.md'}`, `{url:'https://github.com/o/r/issues/881'}`, `{sha:'4f9a2e1c9'}`, `{}`
- **THEN** it returns `[repo: a/b.md:42]`, `[repo: a/b.md]`, `[forge: #881]` with the URL kept, `[git: 4f9a2e1]`, and the "no source was recorded" sentence

#### Scenario: light is the base, dark is the media query, no external resource
- **WHEN** `app.css` and `index.html` are scanned
- **THEN** every token defined under `prefers-color-scheme: dark` is also defined on bare `:root`, no `http://` or `https://` reference exists, and the font stacks name no downloadable face

### R998-2: four modes, a router, keyboard
Acceptance: the four modes switch with `Tab`, `Esc` closes the door, `J/K` traverse nodes; the absence proof (`views-owned.test.mjs`) enumerates the views this PR owns.

### R998-3: track lanes and the `?` holding lane
Acceptance: no node is filtered; the undeclared render in a collapsed lane with a visible total and the declare snippet; epic grouping says "not data yet" until #967.

### R998-4: the SDD view
Acceptance: seven stages per change, phase-order violations named, grandfathered changes claim no stage, archived changes appear with their archive path.

### R998-5: the reviews timeline and the verdict queue
Acceptance: a round shows its findings with severity and the text it cites; an unreadable thread is a row with its reason; a PR with no verdict says "no round posted".

### R998-6: the door's six tabs, the served branch, the countdown
Acceptance: six tabs each keeping its own reason on failure; the header names the branch served; the bands show the next poll.
