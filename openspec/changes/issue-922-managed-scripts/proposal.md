# Proposal: issue #922 — MANAGED_SCRIPT_KEYS omits doctrine-recommended npm scripts

## Outcome (current state, as of `c740bc1c`)

The catalog gap this proposal measures has been closed. The maintainer
promoted the brain-draft's proposed array by hand in commit `525f7c0a`:
`MANAGED_SCRIPT_KEYS` in `brain/core/managed-paths.mjs` now carries 34 keys,
all `brain:`-namespaced, with the memory verbs as `brain:memory:*` (per #961
review round 2, after PRs #966/#972 renamed the underlying scripts and
doctrine prose). `managed-paths.test.mjs` was updated in `2ae18386` to assert
invariants (unique keys, `^brain:[a-z]` pattern) instead of an exact
`length === 10`, and `managed-script-keys-doctrine.test.mjs` is green. The
"EXPECTED RED" framing below describes this proposal's original,
pre-promotion state — it is no longer the state of the branch.

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

### Set A — recommended AND managed (10, at measurement time)

All 10 `MANAGED_SCRIPT_KEYS` entries as they stood when this was measured
(the catalog is 34 keys today — see Outcome above): `brain:env:init`,
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
lane's ship verb; at the time this was measured, the doctrine prose already
said `` `brain:memory:ship` ``, but `package.json` had only `memory:ship` —
`brain:memory:ship` did not exist as a script yet, a real naming
inconsistency at the time, noted but not fixed here, out of scope) and
`brain:config` (adr-0023 line 20: "`brain:config` writes").

**Outcome**: PR #966 (`dc4b56e1`) added `brain:memory:ship` as a real npm
script alongside the bare `memory:ship` alias; PR #972 (`62f6bdd3`) confirmed
doctrine consistently names `brain:memory:ship`. The naming inconsistency
described above no longer exists — both scripts exist in `package.json`
today, and `brain:memory:ship` is one of the 34 keys in the current
`MANAGED_SCRIPT_KEYS` catalog.

Ticket's named minimum (`memory:save`, `memory:ship`, `memory:audit`,
`brain:config`) — all 4 confirmed present in this set.

### Set C — managed but NOT recommended — possibly stale (0, at measurement time)

None. All 10 entries measured were doctrine-justified; nothing to remove.

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
  **EXPECTED RED at the time of this writing** — 22 missing keys reported
  (the 2 manual ones are a known blind spot of the mechanical extraction,
  documented in the test and here). Turned green once the draft was promoted
  (`525f7c0a`) — see Outcome above; it is green as of `c740bc1c`.
- The brain-draft with the proposed 34-entry array (matched by the promoted
  catalog key for key).
- This measurement, recorded so the maintainer could review before
  promoting.

## Decision: keep the test permanently red (not weakened) until promotion

An always-red test would break CI for everyone if left unscoped. The
alternative considered — asserting the catalog matches ONLY the draft's
post-promotion state, gated on the draft having been applied — was rejected:
that gate would need to detect "has this draft been promoted" some other way
(e.g. checking `MANAGED_SCRIPT_KEYS.length`), which just re-implements the
same assertion with an extra layer of indirection and no real gain. Instead:
this test was accepted as **expected red** for the lifetime of this open
issue — the red result WAS the tracked defect, visible in `npm test` output
rather than hidden in an issue tracker alone. It was designed to turn green
automatically, no test edit required, the moment a maintainer promoted the
draft.

This was not a novel pattern for this repo: `brain/scripts/lib/
sdd-layout-doc-promotion-tripwire.test.mjs` (issue #253) is an EXISTING,
already-merged test of exactly this shape — "THIS TEST IS EXPECTED RED ON
THIS BRANCH, BY DESIGN... DO NOT delete this test to unblock CI — the RED is
the point." It went green on its own once its target doc was promoted (now
green on `main`, confirmed by running it).

**Outcome**: this design worked as intended. The maintainer promoted the
draft (`525f7c0a`), and `managed-script-keys-doctrine.test.mjs` turned green
without a test edit, exactly as designed. Commit `2ae18386` then replaced
`managed-paths.test.mjs`'s `length === 10` assertion with invariants and
retired the drift test's "EXPECTED RED" header, since it no longer applies.
There is no failing test from this change on the branch today.
