# Spec Delta — Wire the Gates Onto the Contract (slice B1)

> B1 is PURE WIRING (Pin A). It migrates the six measured hard-coding sites (#584 §3) onto B0's
> `sdd-layout.mjs` accessor, adds the last drift-guard rung (A3), closes the `new-change.mjs` slug gap, and
> prepares — but does not open or merge — the co-promotion branch for B0's two doc-zone drafts. No new
> runtime behavior is introduced; every gate's observable verdict MUST be identical before and after. See
> [proposal.md](proposal.md) / [design.md](design.md).

## REQ-B1-1: the six measured sites consume the accessor, behavior-preserving

Each of the six sites measured in #584 §3 — `check-refs.mjs:96-112`, `session-start.mjs:38-69`,
`phase-order-check.mjs`, `new-change.mjs:48-110`, `engram.mjs:804-805 & 925-926`,
`feature-resolution.mjs:37-81` — MUST consume the relevant `sdd-layout.mjs` export(s)
(`missingRequiredArtifacts`, `isGrandfathered`, `parseChangeId`, `CHANGES_ROOT`, `changeDir`,
`artifactPaths`, `OPERATIONAL_ARTIFACTS`, `LEGACY_GRANDFATHERED`) instead of its own inline
`openspec/changes/**` literal. The migration MUST NOT change any site's observable output — same inputs,
same verdicts, same paths — for every existing change dir.

#### Scenario: gate verdicts are byte-identical pre/post over the frozen-27 golden fixture

- GIVEN the golden fixture captured under REQ-B1-2 (the BEFORE snapshot, one entry per each of the 27
  frozen change-dir keys, per gate: check-refs S-1 missing-artifacts list, phase-order-check per-dir
  exempt/status evaluation, session-start `deriveChangeFromBranch` token, feature-resolution `resume.md`
  disambiguation)
- WHEN the same 27 frozen keys are re-evaluated AFTER all six sites are wired onto `sdd-layout.mjs`
- THEN each site's verdict for each frozen key is `deepEqual` to the committed BEFORE value — zero diff

## REQ-B1-2: the golden proof is a point-in-time snapshot over the frozen-27 keys, never the live corpus

The behavior-preservation proof MUST be a JSON snapshot captured from the pre-wiring tree, walking every
`openspec/changes/*` dir that exists at capture time (the "frozen 27" — the 12 sealed `LEGACY_GRANDFATHERED`
dirs plus the rest measured at B0/B1 kickoff), serializing each of the four gates' verdict per dir into a
deterministic, sorted structure, and committing it as a golden fixture BEFORE any site is migrated. The
fixture's header MUST state, verbatim in substance: *"point-in-time migration proof over the frozen 27; new
dirs out of scope by design."* The post-wiring test MUST iterate the **fixture's own keys** — never a live
directory listing of `openspec/changes/*` — and assert `deepEqual` per key against the committed BEFORE
value. Synthetic edge-case fixtures (a dir with no artifacts, a dir in `LEGACY_GRANDFATHERED`, a dir with a
nested `specs/*/spec.md`, etc.) MUST be added on top of, never instead of, the frozen-27 corpus proof.

#### Scenario: adding a new (28th) change dir does not break the golden test

- GIVEN the golden test passing against the committed frozen-27 fixture
- WHEN a new, 28th `openspec/changes/issue-<N>-<slug>/` dir is created in the live corpus (legitimate
  growth — e.g. `issue-253-b1/` itself, or any change opened after B1)
- THEN the golden test still passes unmodified, because it iterates the fixture's frozen-27 keys, not a
  live directory listing — the new dir has no BEFORE entry and is correctly out of scope

#### Scenario: the fixture is committed before the wiring, not derived from it

- GIVEN the B1 implementation sequence
- WHEN the BEFORE snapshot is generated
- THEN it is captured and committed from the pre-migration tree (git history shows the fixture commit
  predates every site-migration commit), never regenerated from the post-wiring code — the fixture is the
  frozen ground truth the post-wiring code is judged against, not a self-referential re-derivation

## REQ-B1-3: `phase-order-check.mjs`'s `BASELINE_EXEMPT_DIRS` is replaced by the sealed `LEGACY_GRANDFATHERED` import

`phase-order-check.mjs` MUST replace its hardcoded `BASELINE_EXEMPT_DIRS = ['installer-versionado',
'vcs-adapter', 'cli-i18n']` array with `import { LEGACY_GRANDFATHERED } from '../lib/sdd-layout.mjs'` (or
the correct relative path from its own location) and use it wherever `BASELINE_EXEMPT_DIRS` was previously
referenced. The tripwire's `EXEMPT_PATH_RE`, where it maps to the same exemption concept, MUST be
consolidated to reference the same import rather than maintaining an independent pattern. This swap MUST
NOT change which dirs are exempted — B0's rehearsal test already proved the 3-dir `BASELINE_EXEMPT_DIRS`
set is a strict subset of the sealed 12-dir `LEGACY_GRANDFATHERED` allowlist, so the exemption behavior for
every existing dir is unchanged.

#### Scenario: `phase-order-check` exempts exactly the same dirs before/after

- GIVEN the set of dirs exempted by `phase-order-check.mjs` under the old `BASELINE_EXEMPT_DIRS` literal
- WHEN the same check runs after the swap to `import { LEGACY_GRANDFATHERED }`
- THEN the set of dirs treated as exempt is identical — no dir gains or loses exemption, and
  `BASELINE_EXEMPT_DIRS` no longer exists as a separate declaration anywhere in the file

## REQ-B1-4: drift-guard A3 asserts the six sites reference the module, matching the real import shape

A new drift-guard test (A3, staged at B0 design §3) MUST assert that each of the six sites named in
REQ-B1-1 contains a statement matching the real import shape — `from '<relative-path>/sdd-layout.mjs'`
inside an `import { ... }` declaration — rather than matching on a loose substring (e.g. bare
`sdd-layout` or `LEGACY_GRANDFATHERED` appearing anywhere in the file, including in a comment or an
unrelated string). The guard MUST fail if a site re-declares a rival layout literal (its own array of
artifact names, its own `openspec/changes` path literal, its own grandfather list) instead of importing
from the module, even if the file happens to also mention `sdd-layout.mjs` in a comment.

#### Scenario: a site re-declaring a rival literal fails A3

- GIVEN a hypothetical site among the six that keeps (or reintroduces) its own inline array of required
  artifact filenames or its own `openspec/changes` path literal, without importing the corresponding
  `sdd-layout.mjs` export
- WHEN drift-guard A3 runs
- THEN it fails, naming the offending site file

#### Scenario: a legitimate import passes without a substring false-positive

- GIVEN a site containing `import { changeDir, artifactPaths } from '../lib/sdd-layout.mjs';` and,
  elsewhere in the same file, an unrelated comment or string that happens to contain the substring
  `sdd-layout` without being an import statement
- WHEN drift-guard A3 runs
- THEN it passes for that site based on the genuine import statement, and does not fail or vacuously pass
  based on the unrelated substring occurrence alone

## REQ-B1-5: `new-change.mjs` mandates `issue-<N>-<slug>` at scaffold time

`new-change.mjs` MUST require a slug when constructing `changeId` and MUST NOT fall back to a bare
`issue-<N>` directory name when `--title` (or equivalent slug source) is omitted. This closes gap #2 from
#584 §4 and aligns the scaffolder with `sdd-layout.md`'s (B0) documented mandatory-slug rule.

#### Scenario: `new-change` without a slug is rejected or produces a valid slugged id

- GIVEN an invocation of `new-change.mjs` for a given issue number with no `--title` (or equivalent slug
  input) provided
- WHEN the scaffolder resolves `changeId`
- THEN it either rejects the invocation with an actionable error asking for a slug, or derives a
  non-empty slug from another available source — in no case does it emit a bare `issue-<N>` dir name with
  no slug segment

#### Scenario: `new-change` with a title produces `issue-<N>-<slug>` as before

- GIVEN an invocation of `new-change.mjs` with `--title` provided
- WHEN the scaffolder resolves `changeId`
- THEN it produces `issue-<N>-<slug>` exactly as it did before B1 — this path is unchanged, only the
  no-title fallback is fixed

## REQ-B1-6: the co-promotion branch is complete-and-ready, pushed-not-opened, off `feature/v2.0.0`

The agent MUST prepare a dedicated branch, based off the same base as B1 (`feature/v2.0.0`, post-B0) —
never off the B1 branch itself — containing ONLY the doc-zone promotion of B0's two drafts:

- `issue-250-b0/brain-drafts/adr-draft-harness-port.md` promoted to
  `brain/project/decisions/adr-0019-harness-port.md` with `Status: Accepted`, the promotion banner, an
  ISO-format date, and its ADR number re-verified against BOTH `brain/project/decisions/` (already
  promoted numbers) AND `openspec/**/brain-drafts/` (claimed-but-unpromoted numbers) at the time the
  branch is prepared.
- `issue-250-b0/brain-drafts/sdd-layout.md` moved to `brain/core/methodology/sdd-layout.md`.
- `HOME.md` and `HOME.template.md` nav entries for the promoted `sdd-layout.md`, added in the SAME commit
  (or same atomic set of commits) as the doc move — never split across separate commits/branches.

The branch MUST be pushed by the agent. The agent MUST NOT open a pull/merge request for it and MUST NOT
merge it — per the doc-zone-promotion doctrine, that action is exclusively human. The diff MUST require
ZERO manual edits by the human before opening and merging.

#### Scenario: the prepared branch's diff needs zero human edits before open+merge

- GIVEN the co-promotion branch pushed by the agent
- WHEN a human inspects the diff to open and merge it
- THEN `brain/project/decisions/adr-0019-harness-port.md` already has `Status: Accepted`, the promotion
  banner, an ISO date, and a re-verified unique ADR number; `sdd-layout.md` already lives at
  `brain/core/methodology/` (not under `brain-drafts/`); `HOME.md` and `HOME.template.md` already contain
  the nav entry for it; and no further edit is required before the human opens the PR/MR and merges it

#### Scenario: `brain:nav` passes because the doc move and nav edits are atomic

- GIVEN the co-promotion branch's commit(s)
- WHEN `brain:nav` integrity is checked against that branch
- THEN it does not fail with "doc exists in `brain/core/**` without a nav entry" — the `sdd-layout.md`
  move and both `HOME.md` / `HOME.template.md` edits land together, never as a doc-move-only commit
  followed by a separate nav-fix commit

#### Scenario: the agent never opens or merges the branch

- GIVEN the co-promotion branch pushed to the remote
- WHEN B1's work is otherwise complete
- THEN no pull/merge request has been opened by the agent, and the branch has not been merged by the
  agent — the human is the sole actor for open + merge

## Out of scope (non-goals)

- **B2** — the instruction-emission adapter and the Antigravity baptism (real second-AI harness, #247
  candidate). Designed against the real Antigravity consumer, never wired in B1.
- **B3** — deferred (no speculative third adapter).
- **Any change to the sealed set.** `LEGACY_GRANDFATHERED` (the 12 dirs, closed and frozen at B0) is only
  imported and referenced by B1 — never edited, extended, or reordered.
- **`VALID_OPS` expansion.** The `harness/cli.mjs` dispatcher stays single-op (`init`); artifact work
  remains harness-neutral by design (B0 reframe, #585).
- **`promotedSpecPath`** — whether the accessor also owns `openspec/specs/<capability>/spec.md` — is an
  E1 decision, out of B1's scope.

## Gate

`npm test`, `brain:repo:check`, `brain:nav`, and `brain:change:verify` MUST stay green with no new
`brain:audit` failure. Docs MUST be in English (ADR-0009). TDD: the frozen-27 golden-capture fixture is
committed FIRST (REQ-B1-2), then each site migration proceeds RED→GREEN against it (REQ-B1-1), then A3
(REQ-B1-4) is added once all six sites are wired. Changed lines MUST stay ≤400 with no `size:exception`
(pure wiring).
