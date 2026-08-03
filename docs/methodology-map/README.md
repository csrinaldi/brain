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

The map is the base for showing how the method **evolves**. Two views:

- **Flow map** — the current shape of the method. Each node carries the version or ADR
  that introduced it and a status (shipped · proposed · in flight).
- **Evolution** — the same method as a timeline, release by release, so the argument is
  visible: describe the rule, make it observable, then make it fail closed where the
  substrate allows.

Controls: filter by who executes a step (human / agent / CI), switch the source links
between local file paths and GitHub URLs, toggle light/dark. Selecting a node updates the
URL hash, so a specific step is shareable (`…/index.html#l5`).

## Extending it

Everything is data. Two arrays near the top of the `<script>` block:

```js
NODES      // one entry per box: { id, lane, actor, label, verb, since, status,
           //                      summary, detail[], produces[], gates[], docs[[label, path]] }
MILESTONES // one entry per release on the Evolution timeline
```

- `lane` must match an id in `LANES`; a lane with `flow: true` renders its nodes as a
  chain with arrows.
- `actor` is one of `human` · `agent` · `ci` · `either`, and drives the colour and the
  filter.
- `status` is `shipped` · `proposed` · `in-flight`, drawn as the dot in the node's corner.
- `docs` paths are **repo-relative** — the page resolves them against either the local
  checkout or the GitHub blob URL, depending on the link-base toggle.

Adding a step to the method means adding one object. Nothing else changes.

## Accuracy

The content is written from `main` by hand. It is documentation, not a generated
artifact — if a verb, gate, or ADR changes, this page does not update itself. Treat a
mismatch between a node and the file it links to as a bug in the node.
