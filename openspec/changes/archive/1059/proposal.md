# Proposal — the page is built from the maintainer's design

## Why

The maintainer designed this page in Claude Design and handed over the file. It
was imported and mapped region by region, and then the map was converted into
behavioural rulings — every value carries its source, a failure is said, six
door tabs rather than seven, `prefers-color-scheme`, no font from the network,
no inline handlers. All of those shipped in #998 and #882 and every one is
enforced by a test.

The design itself did not ship. Not the structure and not the palette. The
token block's own comment recorded how: PR 1 of #998 restructured the colours
into tokens — the structure the design asked for — and carried the OLD page's
values through, because no requirement asked otherwise and no test could fail
for it.

The cause is worth writing down, because it is not an execution failure. The
design was treated as a source of rulings rather than as the ticket's
acceptance criterion, so nothing in #998 or #882 could fail for not resembling
it. Eleven PRs and six cold-review rounds found real defects; none of them
could see this one, because the contract did not contain it.

## What changes

The design file is the acceptance criterion. Its STRUCTURE is the base; its
palette and visual language are direction. Work proceeds region by region, and
for every region the answer is one of exactly three, written down in `spec.md`:
filled with the data the read model already carries, restricted with the reason
on the page, or completed by a ticket that produces the missing data.

## What does not change

The read model, the pure `lib/*` builders, the parsers and the guards. They are
what makes filling the design possible, and they are 7 860 of the 9 280
non-test lines the UI had when this began. What is rebuilt is the render layer.

Nor does the state vocabulary: `lib/state-vocab.mjs` keeps defining what a
state is called and marked. This change alters how the page looks, never what
it says.

## Non-goals

- Self-hosting Plus Jakarta Sans and JetBrains Mono. The design loads them from
  Google Fonts and `app-source-guard.test.mjs` refuses a font from the network;
  the system stack ships unless the maintainer rules otherwise.
- Epic clustering (#1032), the waiting duration and merged-PR state (#880 and a
  ticket of its own), and the served branch resolving to its epic. Each needs
  data that does not exist, and each is named in `spec.md` rather than guessed.
