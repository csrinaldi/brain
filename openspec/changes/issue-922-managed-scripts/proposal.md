# Proposal: issue #922 — MANAGED_SCRIPT_KEYS omits doctrine-recommended npm scripts

## Problem

`MANAGED_SCRIPT_KEYS` (`brain/core/managed-paths.mjs:29-40`) lists 10
`brain:*` verb keys. `brain:upgrade` injects an npm script into a consumer's
`package.json` only for keys in this list (`mergePackageJson`). Doctrine tells
an agent to `npm run` many more scripts than these 10 — a consumer who never
had a prior release providing them (or a fresh adopt) gets a "missing script"
error the first time they follow the doctrine.

## Measurement (not assumed)

Extracted every `npm run <script>` mention across `brain/core/**`,
`brain/project/**`, `AGENTS.md`, `CLAUDE.md` (absent from this repo),
`docs/**` — **excluding `docs/inbox/**`**, which
`docs/inbox/AGENT-REVIEW-HANDOFF.md` states explicitly is "a capture zone
(issue #327) — not a source of truth, never governed" (mentions found only
there — `brain:snapshot`, `brain:ui`, `brain:credentials`, `brain:status`,
`brain:review:queue`, `brain:protect-server` — are proposals for scripts that
do not exist in `package.json` yet; a different bug, out of scope here).
`npm run backend:build` (AGENTS.md, agent-authorities.md) is excluded too: an
illustrative placeholder for a CONSUMER's own build script, not a brain/memory
verb, and not a real script in this repo's `package.json` either.

Reproducible with `brain/scripts/lib/managed-script-keys-doctrine.test.mjs`'s
extraction logic (same regex, same filters).

### Set A — recommended AND managed (10)

All 10 current `MANAGED_SCRIPT_KEYS` entries: `brain:env:init`,
`brain:day:start`, `brain:session:start`, `brain:ticket:start`,
`brain:project:feature`, `brain:project:status`, `brain:tracker:board`,
`brain:repo:check`, `brain:change:verify`, `brain:memory:session-end`.

### Set B — recommended but NOT managed — the defect (24)

Mechanically detected via literal `npm run <script>` mentions (22):
`brain:adopt`, `brain:audit`, `brain:change:archive`, `brain:check`,
`brain:governance-status`, `brain:metrics`, `brain:nav`, `brain:next`,
`brain:promote`, `brain:protect`, `brain:review`, `brain:review:board`,
`brain:save`, `brain:ship`, `brain:start`, `brain:upgrade`, `memory:audit`,
`memory:index`, `memory:pull`, `memory:resolve-index`, `memory:save`,
`memory:share`.

Manually confirmed, referenced by verb name in ADR prose rather than a literal
`npm run` mention, so the mechanical drift test cannot catch these two by
itself (2): `memory:ship` (adr-0002 line 31/86, adr-0034 line 136/143 — the
lane's ship verb; the doctrine prose says `` `brain:memory:ship` ``, but the
*real* script is `memory:ship` — a naming inconsistency in the ADR prose,
noted but not fixed here, out of scope) and `brain:config` (adr-0023 line 20:
"`brain:config` writes").

Ticket's named minimum (`memory:save`, `memory:ship`, `memory:audit`,
`brain:config`) — all 4 confirmed present in this set.

### Set C — managed but NOT recommended — possibly stale (0)

None. All 10 current entries are doctrine-justified; nothing to remove.

## Constraint: cannot land in code

`brain/core/managed-paths.mjs` is Tier 2 (`agent-authorities.md`,
`consolidation-protocol.md` §2): an agent may draft the change under
`openspec/changes/{iid}/brain-drafts/`, a human must move it into `brain/`.
See `brain-drafts/managed-script-keys.draft.md` for the proposed array and —
important correction to the task brief — why it is **not** a
` ```brain-amendment/1 ` fenced block: that contract
(`amendment-draft.mjs:116`) hard-refuses any non-`.md` target, verified by
simulation. It follows the generic Tier-2 draft path instead.

## What ships in this PR

- `brain/scripts/lib/managed-script-keys-doctrine.test.mjs` — a data-driven
  drift test (extracts recommended scripts from doctrine text at test time,
  not a hardcoded list) asserting `MANAGED_SCRIPT_KEYS` ⊇ recommended.
  **EXPECTED RED** — 22 missing keys reported (the 2 manual ones are a known
  blind spot of the mechanical extraction, documented in the test and here).
  Turns green once the draft is promoted.
- The brain-draft with the proposed 34-entry array.
- This measurement, recorded so the maintainer can review before promoting.

## Decision: keep the test permanently red (not weakened) until promotion

An always-red test would break CI for everyone if left unscoped. The
alternative considered — asserting the catalog matches ONLY the draft's
post-promotion state, gated on the draft having been applied — was rejected:
that gate would need to detect "has this draft been promoted" some other way
(e.g. checking `MANAGED_SCRIPT_KEYS.length`), which just re-implements the
same assertion with an extra layer of indirection and no real gain. Instead:
this test is accepted as **expected red** for the lifetime of this open
issue — the red result IS the tracked defect, visible in `npm test` output
rather than hidden in an issue tracker alone. It turns green automatically,
no test edit required, the moment a maintainer promotes the draft.

This is not a novel pattern for this repo: `brain/scripts/lib/
sdd-layout-doc-promotion-tripwire.test.mjs` (issue #253) is an EXISTING,
already-merged test of exactly this shape — "THIS TEST IS EXPECTED RED ON
THIS BRANCH, BY DESIGN... DO NOT delete this test to unblock CI — the RED is
the point." It went green on its own once its target doc was promoted (now
green on `main`, confirmed by running it). `npm test` on this branch will
therefore report one new failing test by design — a real, documented
regression signal for the still-open gap, not a CI break to fix.
