# Spec: issue-922-managed-scripts

Tier: `lite`. The GitHub issue (#922) is the specification; this file is the
structural minimum the `lite` tier requires, restating its acceptance
criteria as testable requirements.

## REQ-922-1 — every doctrine-recommended script is measured, not assumed

The change MUST enumerate every `npm run <script>` mention across
`brain/core/**`, `brain/project/**`, `AGENTS.md`, `CLAUDE.md`, `docs/**`
(excluding `docs/inbox/**`, an explicitly ungoverned capture zone), and
cross-check it against `MANAGED_SCRIPT_KEYS` and `package.json`'s real
scripts, producing three sets: recommended-and-managed,
recommended-but-not-managed, managed-but-not-recommended.

**Acceptance**: `proposal.md` records the three sets. The ticket's named
minimum (`memory:save`, `memory:ship`, `memory:audit`, `brain:config`) MUST
all appear in recommended-but-not-managed.

## REQ-922-2 — a test cross-checks doctrine against the catalog and fails on drift

A test MUST exist that extracts the recommended set from doctrine text at
test time (data-driven, not a hardcoded list) and asserts
`MANAGED_SCRIPT_KEYS` is a superset of it, mirroring the existing
`.gitattributes` drift guard (`managed-paths.test.mjs`).

**Acceptance**: `brain/scripts/lib/managed-script-keys-doctrine.test.mjs`
exists, is data-driven, and FAILS against today's `MANAGED_SCRIPT_KEYS`
(proving the gap is real). It is expected to stay RED until a maintainer
promotes the brain-draft — this is an accepted, precedented pattern in this
repo (`sdd-layout-doc-promotion-tripwire.test.mjs`, #253), not something to
silence by weakening the assertion.

## REQ-922-3 — the production fix ships as a draft, never a direct edit

`brain/core/managed-paths.mjs` is Tier 2. This change MUST NOT edit it
directly. The proposed array MUST exist under
`openspec/changes/issue-922-managed-scripts/brain-drafts/` for a maintainer
to review and move by hand.

**Acceptance**: the draft names its anchor's exact byte-for-byte current
text, and its uniqueness (occurs exactly once) is verified by simulation
against the real `countOccurrences` from `brain/scripts/lib/
amendment-draft.mjs` — not a `` ```brain-amendment/1 `` fenced block, since
that contract hard-refuses non-`.md` targets (verified by simulation against
the real `parseAmendmentDraft`).

## REQ-922-4 — lands before 1.6.0

Out of this change's control (depends on promotion), but recorded: the fix
must land before 1.6.0 is cut, per the issue and epic tasks.md (#864 task
4.8, `memory.lane.enabled`).
