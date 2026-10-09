# Design (#1225)

## Mirror the 1.10.1 cut
Same files (`CHANGELOG.md`, `README.md`, `docs/adoption.md`, `docs/KNOWN-LIMITATIONS.md`, `package.json`), same voice: a "read before upgrading" table first, then one section per observable change, what ships, follow-ups, why this bump level.

## Claims are read from the code
Each merge was read with `git show` and each sentence traced to a function or script line (`bootstrap.sh`, `ticket-start.mjs`, `brain-ship.mjs`, `ui/change-route.mjs`, `ui/lib/markdown.mjs`, `ui/static/app.js`, `ui/vendor/`). Both previous cuts overclaimed, so the sweep targets scope words ("every", "never", "no"), exit codes and what is a manual step. The first draft headline, "the first PR needs no manual step", was an overclaim: the #1204 report shows the two steps were adding a label and pushing, and the fixes only move the failure to the first step and name the fix. The headline and opening paragraph say so.

## No doctrine change
No `brain/core/**` or `brain/project/**` file is touched. No stale doctrine row was found, so there is no `brain-drafts/`.
