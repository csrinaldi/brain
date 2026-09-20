---
status: draft
issue: 942
---

# Proposal — a deny list that cannot be read is not an empty deny list

## Intent

Every reader that feeds an approval DENY decision today answers `catch { return [] }`. An
unreadable `brain.config.json` — malformed JSON, a permission error, a directory in the file's
place — therefore denies nobody: `actor-check`'s rule 15 stops refusing (`actor-check.mjs:395-404`),
L6's human-approver exclusion stops excluding (`brain-writes-reviewed.mjs:248-271`), and
`brain:approve` lets a registered agent post a signed approval (`approve/cli.mjs:116-140`). The
config is read from the PR's own checked-out tree, so the PR being judged supplies the file whose
unreadability disarms the judge. This is `evidence-reader-empty-on-failure` one layer below the
gate, and it is live at three call sites.

## The rulings

Each is a decision the maintainer ratifies; the "why" is the one line that justifies it.

- **R1 — Direction rule.** A reader that supplies a DENY or exclusion list MUST propagate a config
  read/parse failure; the consuming gate applies its tier policy (`required` → fail, `detection` →
  warn). A reader that supplies an ALLOW or exemption list MAY degrade to empty. *Why: empty is the
  strict direction for an allow list and the permissive direction for a deny list — the same
  `catch` is safe in one and a fail-open in the other.*
- **R2 — Where the rule is written.** As a draft amendment to
  `brain/core/anti-patterns/evidence-reader-empty-on-failure.md`, filed at
  `brain-drafts/deny-readers-fail-closed.draft.md` for maintainer promotion. *Why: agents never
  edit `brain/core/**`, and the existing anti-pattern states the empty-vs-uncomputable rule without
  stating the direction asymmetry that decides which readers may keep the empty default.*
- **R3 — The shared primitive.** One `loadBrainConfigOrThrow(root = REPO_ROOT)` exported from
  `brain/scripts/lib/brain-config.mjs`: `ENOENT → {}`, any other read error or any parse error →
  `throw` with a named message, mirroring `memory/lib/upstream-records.mjs:62-75`. Each reader
  calls it and handles the throw in its own direction — deny readers propagate, allow readers keep
  their `catch`. Explicitly NOT a shared list and NOT a shared policy function. *Why:
  `approvalDenySet`'s docblock (`actor-check.mjs:1069-1090`) records what merging deny and allow
  readings already cost once (#124 round 2); the primitive shares the READ, never the meaning.*
- **R4 — Placement is free for the gates.** `actor-check.mjs` already imports
  `lib/brain-config.mjs` transitively via `governance/approved-label.mjs`; `approve/cli.mjs`
  imports it directly. Only `brain-writes-reviewed.mjs` gains a new import edge. *Why: no new
  module-graph risk for the two gate files with the tightest locks.*
- **R5 — The write-side twin ships in this PR.** `approve/cli.mjs`'s `defaultReadDenyActors` and
  `defaultReadAgentActors` are hardened alongside the read side; the throw surfaces through
  `runApprove`'s existing `say('✗ …'); return done(1)` shape (`:220-227`), never as a raw stack
  trace in a TTY. *Why: fixing only the read side recreates exactly the read/write divergence #124
  round 2 already paid to close — the twin's own docblock is the evidence.*
- **R6 — `brain-writes-reviewed`'s catch is a prerequisite inside this change, not a follow-up.**
  `:407-415` becomes tier-aware, in the shape `actor-check.mjs:1322-1341` already uses
  (`resolveTierForFailure` + `resolveGatePolicy` → `fail` when `required`, `warn` otherwise).
  *Why: a throwing deny reader behind an unconditional `warn` is cosmetic — the fail-open survives
  the fix.*
- **R7 — The stale docstring is corrected here.** `:365-370`'s "while this job is detection-only
  (DETECTION_JOBS)" is the stated justification for the `warn`; it is false — the gate is
  `required` at every tier (`GATE_MATRIX:211-219`, `DETECTION_JOBS` empty, ten required contexts,
  not eight). *Why: changing the behaviour and leaving its written reason in place is how the next
  reader reverts it in good faith.*
- **R8 — `loadBrainConfig()` is NOT changed.** It keeps throwing for both absence and malformation;
  `approve/cli.mjs`'s deny readers switch to `loadBrainConfigOrThrow()` instead. *Why: adding a
  distinguishable error would change the failure contract of five callers
  (`run-check.mjs:172-178`, `governance-tiers.mjs`, `phase-order-check.mjs`, `approved-label.mjs`,
  `approve/cli.mjs`) that correctly treat any throw as absence; only the deny readers need the
  distinction, and R3 gives it to them without touching the other four.*
- **R9 — The `config-parses` governance check is a follow-up ticket.** Not in this change.
  *Why: a new gate is a new required CI context plus a `GATE_MATRIX` row plus a `governance.yml`
  job moved together by the drift guard — a branch-protection change in a different risk class
  from a reader fix, and `check-refs.mjs:133-152` already asserts the parse locally while R1 makes
  an unparseable config red at `actor-check` regardless.*
- **R10 — English-only refusal strings, caveat documented.** No new `es.mjs` keys. The refusal
  docblock records that the Spanish string is blocked on #715 and what would unblock it. *Why:
  `t.mjs`'s `activeLang()` resolves the locale through `loadBrainConfig().docs?.language` — the
  same unreadable config the message describes — so a Spanish string cannot be selected in the one
  case it exists for. Blocking #942 on #715 keeps a live fail-open open; a third option (resolving
  the locale from the environment or a hard default) costs a second source of truth for language
  inside gate files, which is not paid for here.*
- **R11 — Absent config stays green.** No `brain.config.json` → `{}` → empty deny set → the gates
  pass and `brain:approve` proceeds, at every touched reader, asserted by a dedicated test per
  reader. *Why: a fresh consumer install has no config file; conflating absent with unreadable
  turns installation into a refusal — and no test in the tree exercises that path today.*
- **R12 — Delivery: one PR.** Estimated ~110 counted lines (primitive ~20, five readers ~35,
  tier-aware catch ~15, docstring ~6, doctrine draft ~35), tests excluded — inside the 400-line
  budget. Closes #942. If design finds R6 drags the `brain-writes-reviewed` surface wider, the
  chain boundary is PR1 = R3 + `actor-check` + `approve/cli`, PR2 = R6 + R7 + L6's readers.
  *Why: the read and write sides must land together (R5) and the L6 reader is inert without its
  catch (R6), so the smallest honest slice is all three call sites.*

## Scope

### In scope

- `loadBrainConfigOrThrow(root)` in `brain/scripts/lib/brain-config.mjs` (R3).
- Deny readers hardened: `actor-check.mjs:1099-1108`; `brain-writes-reviewed.mjs:249-278` (both);
  `approve/cli.mjs:116-140` (both).
- `brain-writes-reviewed.mjs:407-415` made tier-aware + `:365-370` docstring corrected (R6, R7).
- `brain-drafts/deny-readers-fail-closed.draft.md` (R2).
- Tests: malformed-config fixture per reader (fail-closed), absent-config fixture per reader
  (green), in `vcs/actor-check.test.mjs`, `vcs/brain-writes-reviewed.test.mjs`,
  `approve/cli.test.mjs`.

### Out of scope (non-goals)

- The secret-scan loaders (`plainfiles.mjs`, `engram.mjs`, `lane/collect.mjs`, `lane-scrub.mjs`) — #712.
- The tier resolver's ratified degrade to `standard` (`readConfigSafe`, REQ-TIER-10) and the same
  ratified default in `brain-check.mjs` / `phase-order-check.mjs`.
- #715 itself — no locale-resolution change (R10).
- A `config-parses` governance job (R9) and any `GATE_MATRIX` / `governance.yml` edit.
- The ALLOW-direction readers (`governance.ignoreList` consumers, `approved-label.mjs`,
  `actor-check.mjs:1058-1066`) — unchanged by R1, deliberately.
- `governance-relabel.yml:8-26`'s stale "actor-check … DETECTION_JOBS, non-blocking" comment —
  same stale-doctrine family as R7, but a workflow edit; recorded, own ticket.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `governance-v3`: REQ-L5-1 and REQ-L6-2 gain an explicit config-read-failure clause — a deny/
  exclusion input that cannot be read is uncomputable, not empty, and the gate fails closed at
  `required` tiers.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `brain/scripts/lib/brain-config.mjs` | Modified | New `loadBrainConfigOrThrow(root)` export; existing `loadBrainConfig()` untouched |
| `brain/scripts/vcs/actor-check.mjs` | Modified | `defaultReadDenyActors` propagates; routed through the existing tiered catch |
| `brain/scripts/vcs/brain-writes-reviewed.mjs` | Modified | Two deny readers propagate; catch made tier-aware; docstring corrected |
| `brain/scripts/approve/cli.mjs` | Modified | Both deny readers propagate into the existing `✗ … done(1)` refusal shape |
| `brain-drafts/deny-readers-fail-closed.draft.md` | New | Direction-asymmetry amendment for maintainer promotion |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A malformed config now reds every PR in a consumer repo at once | Med | That is the intended direction; the refusal names the file and the parse error, and `check-refs.mjs` catches it locally first |
| R6 widens the L6 diff past the budget | Med | R12's chain boundary is pre-declared |
| `brain:approve` refusal reaches a TTY as a stack trace | Low | Throw caught in `runApprove`, asserted by a test |
| A future reader copies the `catch { return [] }` shape again | Med | R2's doctrine draft plus the direction stated in each hardened reader's docblock |

## Rollback plan

Revert the PR. No config schema change, no migration, no new CI context, no `GATE_MATRIX` row —
the readers return to `catch { return [] }` and the gates return to today's behaviour byte for
byte. The doctrine draft is inert until promoted.

## Dependencies

- None blocking. #715 is acknowledged and explicitly not blocking (R10); #712 and the
  `config-parses` follow-up are sequenced after.

## Success criteria

- [ ] A present-but-unparseable `brain.config.json` makes `actor-check` and `brain-writes-reviewed`
      return `fail` at `standard`, with a reason naming the file and the parse error.
- [ ] The same config makes `brain:approve` exit 1 with a `✗` refusal, not a stack trace.
- [ ] A directory with no `brain.config.json` leaves all five readers returning `[]` and every gate
      green — asserted per reader.
- [ ] A mutation restoring any `catch { return [] }` in a deny reader fails at least one test per
      call site.
- [ ] `brain-writes-reviewed`'s docstring and its catch agree with `GATE_MATRIX`.
