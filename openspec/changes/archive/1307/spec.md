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

The drawer's children MUST be exactly a `.drawer-head` region and a `.drawer-body` region. `.drawer-head` MUST hold the id line, the close control and the tab bar, and MUST NOT scroll (`flex: none`). `.drawer-body` MUST have `flex: 1`, `min-height: 0` and `overflow: auto`, and MUST hold everything else (title, marks, children, notes, tab content, blocks).

#### Scenario: Header and body are separate regions
- **GIVEN** an open drawer with a loaded change
- **WHEN** the DOM is read
- **THEN** the drawer has two children, `.drawer-head` holding the close control and the tab bar, and `.drawer-body` holding the title and the tab content

### R1307-3: The tab bar stays visible

The tab bar MUST be a full-width line of `.drawer-head` (`flex: 1 0 100%`), so it stays visible however long the body is.

#### Scenario: Scrolling the drawer body
- **GIVEN** an open drawer whose body is taller than the drawer
- **WHEN** the body is scrolled
- **THEN** the tab bar's top edge is unchanged

### R1307-5: A tab click shows the panel; a data re-render does not move the reader

Rebuilding the drawer resets the body's scroll, so the page sets it deliberately. A tab click MUST scroll the body so the selected panel's top sits at the body's top. A re-render the reader did not ask for (stream or data refresh) of the same node MUST keep the body's scrollTop. Opening a node MUST start the body at 0.

#### Scenario: Switching tab on an epic with many children
- **GIVEN** an open drawer whose children list pushes the tab panel below the fold of the body
- **WHEN** a tab button is clicked
- **THEN** the panel's top edge is at the body's top edge

#### Scenario: A data re-render
- **GIVEN** an open drawer whose body is scrolled
- **WHEN** the page re-renders from new data
- **THEN** the body's scrollTop is unchanged

### R1307-4: Unchanged behaviour

Esc closes the drawer, the tab buttons switch tabs, and the phone layout (`max-width: 760px`) keeps a full-width, non-sticky drawer. Light and Dark use the same tokens.
