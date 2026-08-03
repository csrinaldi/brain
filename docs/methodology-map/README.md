# Methodology Map

A single self-contained HTML page that draws brain's working method as a flow: adoption,
the daily rhythm, the SDD feature cycle, the golden path, the two memory layers, the six
governance levels, and the authority boundaries. Every box links to the file that defines
it, so the map is a navigation surface over the repository, not a second description of it.

```bash
open docs/methodology-map/index.html        # macOS
xdg-open docs/methodology-map/index.html    # Linux
```

No build step, no dependencies, no network calls — one file, opened straight from a clone.

## What it is for

The map is the base for showing how the method **evolves**. Three views:

- **Flow map** — the current shape of the method. Each node carries the version or ADR
  that introduced it and a status (shipped · proposed · in flight).
- **A day in it** — one feature walked end to end in a consumer repo, from
  `brain:day:start` to the merge, with the real commands and the shape of the output the
  scripts actually emit. Each step links back into the map. It includes one REVISE round
  on purpose: a review that finds something is the normal case, not a failure.
- **Evolution** — the same method as a timeline, release by release, so the argument is
  visible: describe the rule, make it observable, then make it fail closed where the
  substrate allows.

Controls: filter by who executes a step (human / agent / CI), switch the source links
between local file paths and GitHub URLs, toggle light/dark. Selecting a node updates the
URL hash, so a specific step is shareable (`…/index.html#l5`).

## Extending it

Everything is data. Two arrays near the top of the `<script>` block:

```js
NODES      // one entry per box: { id, lane, group, actor, label, verb, since, status,
           //                      summary, detail[], produces[], gates[], caveats[],
           //                      docs[[label, path]] }
JOURNEY    // one entry per step of the worked example: { phase, actor, title, cmd, out,
           //                      why[], map[nodeId] }
MILESTONES // one entry per release on the Evolution timeline
```

- `lane` must match an id in `LANES`; a lane with `flow: true` renders its nodes as a
  chain with arrows. A lane may instead declare `groups: [{ id, title, note, flow,
  loopback }]`, and each node then carries a `group` — that is how the review cycle
  renders its pipeline, its verdicts, and the human step as three separate rows, with
  the REVISE loop drawn as a return edge.
- `actor` is one of `human` · `agent` · `reviewer` · `ci` · `either`, and drives the
  colour and the filter. `reviewer` is deliberately its own colour: the cold reviewer is
  an agent with strictly narrower authority than a Tier-1 one.
- `status` is `shipped` · `proposed` · `in-flight`, drawn as the dot in the node's corner.
- `caveats` renders as a "Not closed yet" list. Use it — a map that only shows what works
  is the kind of document nobody trusts twice.

Everything data-driven is HTML-escaped on render, so placeholders can be written the way
the docs write them (`<id>`, `<tag>`, `issue-<n>-<slug>`) without vanishing into the DOM.
- `docs` paths are **repo-relative** — the page resolves them against either the local
  checkout or the GitHub blob URL, depending on the link-base toggle.

Adding a step to the method means adding one object. Nothing else changes.

A `JOURNEY` step's `map` array holds node ids: each renders as a chip that switches to
the flow map, opens that node, and scrolls to it. An id with no matching node is skipped
rather than rendered dead.

## Accuracy

The content is written from `main` by hand. It is documentation, not a generated
artifact — if a verb, gate, or ADR changes, this page does not update itself. Treat a
mismatch between a node and the file it links to as a bug in the node.

The worked example's terminal blocks follow the same rule. The commands are real and the
output follows the format the scripts emit (`brain:check`'s `[PASS] <check>` lines,
`brain:save`'s commit message, `renderVerdict`'s fenced YAML, `day:start`'s section
headings from the i18n catalog). The scenario around them — the repo, the issue, the
findings — is invented, and the shas are not real shas.
