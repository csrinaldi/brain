---
status: approved
issue: 1311
---

# Design — dark-theme-controls-contrast (issue 1311)

### D118: Element-level token rules plus `color-scheme`, no per-component edits

**Decision.** Add `color-scheme` to the three token blocks and, right after them, one rule block: `button, select, input { color: var(--ink); background: var(--surface); border-color: var(--line); font: inherit }` and `a { color: var(--accent) }`.

**Why.** The defect class is "an element nobody styled keeps the UA colour". Fixing the five reported buttons one by one leaves the next unstyled control broken. Element selectors have the lowest specificity, so every existing class rule (`.modes button`, `.status-bar button`, …) still wins and nothing visual changes where a colour was already set. `color-scheme` makes the UA's own surfaces (select popups, scrollbars, focus) follow the theme.

**Tokens.** `--ink`/`--surface` carry text on controls; `--accent` carries links (light `#0e7490`, dark `#22d3ee`). No new token: the three blocks keep the same names (the #1059 invariant).

**Rejected.** `color: inherit` on controls: inherits `--ink` but leaves `background` and `border` UA-coloured under a light OS with a dark choice. A per-class fix list: misses the unstyled ones.

**Sweep.** `select` (theme switcher) and `input` are the other UA-coloured controls in `app.js`; `summary` and `details` are not used. All covered by the base rule.

**Test.** `tokens.test.mjs` scans the rules and computes WCAG contrast over parsed token values per theme.
