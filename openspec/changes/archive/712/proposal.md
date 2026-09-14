---
status: draft
issue: 712
---

# Proposal — a secret policy that cannot be read is not the default secret policy

## Intent

Four readers of `governance.memorySecret*` answer `catch { return {} }`. A present-but-unreadable
`brain.config.json` therefore silently reverts the scan to the five baseline patterns
(`secret-scrub.mjs:23-29`) that the operator explicitly said were insufficient when they added their
own — and the run reports clean. The scan is never OFF, which is why this is not #942's severity; it
is a policy the operator wrote being discarded without a word, at the exact moment the records
travel.

The enforcement surface is worse than the exploration measured. `governance/lane-scrub.mjs:53-59`
has the same `catch`, and `lane-scrub` is `required` at all three tiers with evidence `secret-scan`
(`vcs/governance-tiers.mjs:230-234`). The CI gate that exists to catch a leaked secret in a lane PR
scans with the operator's patterns discarded, and passes.

## The rulings

Each is a decision the maintainer ratifies; the "why" is the one line that justifies it.

- **R1 — Direction is a property of the KEY, and a read inherits its strictest key.**
  `memorySecretPatterns` is DENY-direction (empty ⇒ fewer refusals ⇒ fail-open).
  `memorySecretAllowPatterns` is ALLOW/exemption-direction (empty ⇒ stricter). One read carries
  both, so under #942's R1 the read PROPAGATES. *Why: #942's binary classifies a reader by what its
  value denies, and a single read cannot be half-propagated — the deny-direction key decides for
  the read that carries it.*
- **R2 — Losing the allowlist needs no separate handling.** *Why: it can only produce a LOUD false
  refusal naming the pattern and line number, never a silent pass; it is the committed, reviewable
  sole bypass (`secret-scrub.mjs:1-11`), so refusing without it is the safe direction. Answers
  exploration Q3: same read, one rule, for opposite reasons.*
- **R3 — Reuse `loadBrainConfigOrThrow(root)` (`lib/brain-config.mjs:77`), no new primitive.**
  *Why: #942 shipped it with its tests (`lib/brain-config.test.mjs:249-283`), and `memory/cli.mjs`
  already imports that module (`:449`) — a copy inside `memory/` would be the THIRD definition of
  "absent vs unreadable" in one tree (`upstream-records.mjs:61-77` is the second).*
- **R4 — Four call sites, one behaviour.** `memory/lane/collect.mjs:94-100`,
  `memory/backends/engram.mjs:451-457`, `memory/backends/plainfiles.mjs:41-47`,
  `governance/lane-scrub.mjs:53-59`. *Why: the exploration's inventory (§3) predates the lane-scrub
  gate row and misses it; #942's own scope note already assigned that file to #712, and it is the
  only one of the four that is a required CI context.*
- **R5 — `save()`'s single read does NOT split.** *Why: on an unreadable config `deriveProject`
  (`plainfiles.mjs:29-33`) falls back to the directory basename and writes a wrong, durable
  `project` label into a shared record — the second concern deserves the refusal too, so the
  conflation is two fail-opens, not one. The read (`engram.mjs:952`, `plainfiles.mjs:112`) precedes
  the append (`engram.mjs:1023`), so a throw loses no capture. Answers Q1: reject option B.*
- **R6 — `ship` does NOT thread its CLI config into `collectLane`; the gap CLOSES here anyway.**
  Each read is hardened against its own root. *Why: `cli.mjs:463`'s `loadBrainConfig()` resolves
  module-relative while `collectLane` scans `BRAIN_MEMORY_TEST_ROOT ?? repoRoot` (`cli.mjs:450`) —
  reusing the first would govern the scanned tree with a different tree's policy. Two reads of two
  files is correct; two SWALLOWING reads was the defect. Answers Q2.*
- **R7 — Per operation.** `memory:save` (both backends) refuses, exit 1 through the existing catch
  at `cli.mjs:839`. `memory:collect` refuses, exit 1 through `cli.mjs:364`. `memory:ship` refuses at
  both layers (CLI `loadBrainConfig()` already throws; the internal collect now does too), exit 1
  through `cli.mjs:518`. *Why: `collect` writes only a local ref, but the lane commit it mints IS
  what `ship` publishes and the scan verdict is minted THERE — a collect that "succeeded" under a
  discarded policy is a clean bill of health on the exact bytes that later travel.*
- **R8 — lane-scrub refuses as `uncomputable` (exit 2), and its config read stays AFTER the
  `recordPaths.length === 0` early return (`lane-scrub.mjs:142-147`).** *Why: the file already
  routes "invalid secret pattern in config" to uncomputable (`:165-172`) — "cannot verify" must
  never read as "verified clean"; and #908's cold review deliberately kept a config problem from
  blocking every PR instead of only the ones that add lane records.*
- **R9 — No report-and-continue.** *Why: `resolveUpstreamRef`'s `configError` is right for CHOOSING
  a ref, where a wrong choice is recoverable; a scan that already ran under the wrong policy has
  let the bytes through by the time the operator reads the warning. Rejects exploration option C.*
- **R10 — No new i18n keys; the English detail rides on the primitive's `Error` message through the
  existing catch arms.** *Why: `i18n/coverage.test.mjs:96-103` requires an `es.mjs` entry for every
  `en.mjs` key, and `activeLang()` (`i18n/t.mjs:17-19`) resolves the locale from the very config
  that is unreadable — so any Spanish string added here is dead by construction until #715. This is
  #942's R10 with the parity cost measured; it also keeps the diff smaller. Answers Q4.*
- **R11 — Read paths are out of scope by EVIDENCE, not assumption.** `_loadConfig` is wired only to
  `save()` (`engram.mjs:939`, `plainfiles.mjs:99`) and the callerless `dualWriteRecords`
  (`engram.mjs:266`); `memory:search` (`cli.mjs:862-874`) never reaches `resolveSecretConfig`.
  *Why: no read path consumes this config, so there is no existing fail-open to close — refusing
  there would be NEW behaviour, not a fix.*
- **R12 — Absent stays green.** No `brain.config.json` ⇒ `{}` ⇒ default patterns, empty allowlist,
  every op proceeds; asserted per call site. *Why: a fresh consumer install has no config, and
  conflating absent with unreadable turns installation into a refusal. For lane-scrub the switch is
  behaviour-preserving on this axis: its catch already yielded `{}` for the absent case.*
- **R13 — Delivery: one PR, `Closes #712`.** Estimated ~70 counted lines (four readers ~40, refusal
  plumbing ~15, docblocks ~15); tests and `openspec/changes/**` are excluded by
  `governance.ignoreList`. *Why: four edits of one shape behind a primitive that is already
  reviewed and tested — splitting would ship the same rule twice and give a reviewer two diffs of
  the same paragraph. If design finds lane-scrub's `uncomputable` branch drags its surface wider,
  the chain boundary is PR1 = the three `memory/` readers, PR2 = lane-scrub.*

## Scope

### In scope

- `memory/lane/collect.mjs` `_defaultLoadConfig`, `memory/backends/engram.mjs`
  `_defaultLoadBrainConfig` (covers both its wiring points, `:266` and `:939`),
  `memory/backends/plainfiles.mjs` `_defaultLoadBrainConfig` → `loadBrainConfigOrThrow(root)`, no
  catch (R3, R4, R5).
- `governance/lane-scrub.mjs` `defaultReadConfig` → `loadBrainConfigOrThrow()`, throw turned into
  `{pass:false, uncomputable:true}` ⇒ exit 2, read kept after the early return (R8).
- Refusal surfacing: the three `memory` CLI catch arms carry the primitive's message unchanged; the
  `collect` reason string stops implying a git failure (R7, R10).
- Tests: present-but-unparseable fixture AND absent fixture per call site, on the
  `upstream-records.test.mjs:277,370-390` template. The unparseable axis is untested today for all
  four.

### Out of scope (non-goals)

- Re-opening #942's direction rule or any of its five hardened readers.
- The `config-parses` governance job (#942 R9) and any `GATE_MATRIX` / `governance.yml` edit.
- #715 itself — no locale-resolution change (R10).
- The tier resolver's ratified degrade to `standard` (`readConfigSafe`, REQ-TIER-10) and its twins
  in `brain-check.mjs` / `phase-order-check.mjs`.
- Retiring `upstream-records.mjs`'s local `loadBrainConfigAt` in favour of the primitive — same
  family, own ticket.
- `memory:search` and every read path (R11).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `governance-v3`: ADDED `REQ-SCAN-*` — the secret-scan policy input is uncomputable, not default,
  when `brain.config.json` exists and cannot be read; `lane-scrub` reports `uncomputable`, and the
  three `memory` write ops refuse. Note for sdd-spec: no published spec covers the secret scan today
  (`openspec/specs/` has no `secret-scan` or `memorySecretPatterns` text), so the lane-scrub gate
  requirement must be located — it may still live in an unarchived change folder.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `brain/scripts/memory/lane/collect.mjs` | Modified | `_defaultLoadConfig` propagates; new import edge to `lib/brain-config.mjs` |
| `brain/scripts/memory/backends/engram.mjs` | Modified | `_defaultLoadBrainConfig` propagates (both wiring points) |
| `brain/scripts/memory/backends/plainfiles.mjs` | Modified | same shape; `deriveProject` now refuses with the scan (R5) |
| `brain/scripts/governance/lane-scrub.mjs` | Modified | `defaultReadConfig` propagates → `uncomputable`, exit 2 |
| `brain/scripts/memory/cli.mjs` | Modified | `collect` reason string stops blaming git; no new i18n keys |
| `brain/scripts/lib/brain-config.mjs` | Unchanged | reused as-is (R3) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| An unreadable config reds every lane PR at once | Med | Intended; R8 limits it to PRs that add `.memory/records/*.jsonl`, and `check-refs.mjs:133-152` catches it locally first |
| `memory:save` refuses on a machine whose config is broken for an unrelated reason | Med | The message names the path and the parse offset; absent stays green (R12) |
| The exploration's line numbers are stale (measured on `8ec69885`) | High | Re-verified here against `bef6f867`; design must re-verify before editing |
| A future reader copies `catch { return {} }` again | Med | #942's doctrine draft already states the direction rule; each hardened reader's docblock names it |

## Rollback plan

Revert the PR. No config schema change, no migration, no new CI context, no `GATE_MATRIX` row, no
i18n key — the four readers return to `catch { return {} }` and every op returns to today's
behaviour byte for byte.

## Dependencies

- #942 (merged, `bef6f867`) supplies `loadBrainConfigOrThrow`. Nothing else blocking; #715 is
  acknowledged and explicitly not blocking (R10).

## Success criteria

- [ ] A present-but-unparseable `brain.config.json` makes `memory:save` (both backends) and
      `memory:collect` exit 1 with a message naming the file and the parse error, and no record or
      lane commit is written.
- [ ] The same config makes `lane-scrub` exit 2 with an `uncomputable` reason — on a PR that adds a
      lane record, and NOT on a PR that adds none.
- [ ] A directory with no `brain.config.json` leaves all four call sites on the default pattern set
      and every op green — asserted per call site.
- [ ] Restoring `catch { return {} }` in any of the four readers fails at least one test.
- [ ] No key added to `en.mjs`, and `i18n/coverage.test.mjs` stays green untouched.

## Proposal question round

Assumptions that need the maintainer's word before sdd-spec locks them:

1. **R1's framing** — direction is per-key and the read inherits the strictest key. If the
   maintainer reads #942's rule as per-FILE instead, R1 flips and the whole change collapses to a
   documented degrade.
2. **R4's widening to `lane-scrub`** — the exploration never inventoried it; confirm #712 owns it
   rather than a follow-up ticket, since it is the one required CI context in the set.
3. **R5's refusal on `deriveProject`** — accepting that a broken config now blocks a local
   `memory:save` for a project-name reason as well as a scan reason.
4. **R10's no-new-keys** — accepting a slightly less structured refusal (no `configUnreadable` tag)
   in exchange for zero dead Spanish strings.

Issue #712's comment thread was not read in this phase (no shell access); finding M2's exact wording
should be checked against R4 before ratification.
