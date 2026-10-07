---
status: approved
issue: 1311
---

# Proposal — dark-theme-controls-contrast (issue 1311)

## Intent

Under the Dark theme the status-bar buttons ("disable polling", "poll now", "refresh remotes"), the holding-lane show/hide button and the pager render `rgb(0,0,0)` text on `rgb(20,27,45)` (about 1.3:1), and every `open ↗` link keeps the browser default `#0000EE` on `#0B0F17`. Cause: `app.css` sets `background` on those buttons from tokens but never `color`, and no rule colours `a`, so the user agent's default form-control and link colours (which follow `color-scheme`, left at `normal`) win.

## Scope

### In
- A base rule giving `button`, `select`, `input` and `a` colour (and, for controls, background and border) from tokens.
- `color-scheme` declared per theme (`light` on the base, `dark` in both dark blocks) so any UA-default control surface follows the theme.
- A test pinning both, with a WCAG contrast computation over the token values.

### Out
- New tokens, a palette change, or any change to the theme switcher.

## Approach

Add `color-scheme` to the three token blocks and one element-level rule block after them. Class rules keep winning by specificity. Reuse `--ink`, `--surface`, `--line`, `--accent`.

## Size

Under 40 gated lines, against the `lite` budget of 1000. One PR.

## Success criteria

- Computed colour of every button and link is a theme token in System, Light and Dark.
- Text on controls and links meets 4.5:1 in both token sets; the test computes it.
