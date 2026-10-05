---
status: approved
issue: 1307
---

# Spec — drawer-pinned-to-viewport (issue 1307)

Capability: `inspector-drawer` (modified). Keywords follow RFC 2119. Scenario grammar: one `WHEN` and one `THEN` per scenario.

### R1307-1: The drawer is pinned to the viewport

Above the phone breakpoint, `.drawer` MUST be `position: sticky` with `top: 0`, `align-self: flex-start`, and a height bounded by the viewport (`max-height: 100vh`), so it does not take the page's height. It MUST NOT scroll itself as a whole (`overflow: hidden`).

#### Scenario: Opening a node far down the page
- **GIVEN** the page scrolled to 2600 px
- **WHEN** a node card is clicked
- **THEN** the drawer's top edge is within the viewport (>= 0 and < the viewport height)

### R1307-2: The header does not scroll; the body does

The drawer's children MUST be exactly a `.drawer-head` region and a `.drawer-body` region. `.drawer-body` MUST have `flex: 1`, `min-height: 0` and `overflow: auto`. Everything the drawer drew before (title, marks, children, notes, tabs, tab content, blocks) MUST live in `.drawer-body`.

#### Scenario: Header and body are separate regions
- **GIVEN** an open drawer with a loaded change
- **WHEN** the DOM is read
- **THEN** the drawer has two children, `.drawer-head` holding the close control and `.drawer-body` holding the tab bar and the tab content

### R1307-3: The tab bar stays visible

`.drawer-body .tabs` MUST be `position: sticky; top: 0` with an opaque background, so the tabs stay visible while the body scrolls.

#### Scenario: Scrolling the drawer body
- **GIVEN** an open drawer whose body is taller than the drawer
- **WHEN** the body is scrolled
- **THEN** the tab bar's top edge is unchanged

### R1307-4: Unchanged behaviour

Esc closes the drawer, the tab buttons switch tabs, and the phone layout (`max-width: 760px`) keeps a full-width, non-sticky drawer. Light and Dark use the same tokens.
