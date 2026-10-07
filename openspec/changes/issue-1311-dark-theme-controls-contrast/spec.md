---
status: approved
issue: 1311
---

# Spec — dark-theme-controls-contrast (issue 1311)

Capability: `ui-theming` (modified; #1059). Requirement keywords follow RFC 2119.

### R1311-1: Controls and links read theme tokens

`app.css` MUST contain element rules for `button` and `a` that set `color` from a `var(--…)` token, and for `button`, `select` and `input` that set `background` and `border-color` from tokens.

#### Scenario: A button with no class rule is legible in Dark
- **GIVEN** the Dark theme and a `button` that no class rule colours
- **WHEN** the page renders
- **THEN** the button text resolves to `--ink` on `--surface`, never the UA default black

### R1311-2: The UA follows the theme

Each theme block MUST declare `color-scheme` matching its palette: `light` on bare `:root`, `dark` in the system-dark media block and in `:root[data-theme='dark']`.

#### Scenario: A UA-default control under Dark
- **GIVEN** the Dark theme
- **WHEN** a native `select` popup or scrollbar renders
- **THEN** it uses the dark UA appearance

### R1311-3: AA contrast on controls and links

In both the light and the dark token sets, `--ink` on `--surface`, `--accent` on `--paper` and `--accent` on `--surface` MUST have a WCAG contrast ratio of at least 4.5:1.

#### Scenario: Both palettes pass
- **GIVEN** the token values in `app.css`
- **WHEN** the test computes relative luminance for each pair
- **THEN** every ratio is at least 4.5
