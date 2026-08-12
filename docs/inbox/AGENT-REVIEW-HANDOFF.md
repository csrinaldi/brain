# Agent Review Handoff

**Read this before running any review on this repo.** It carries a routing rule the
project's own doctrine already states (reviewer-protocol.md §13) but that agents kept
missing across issues #535 and #551, plus the current map of open decisions in the
reviewer subsystem. Written from a completed audit (issue #572); zero prior context
required.

`docs/inbox/**` is a capture zone (issue #327) — not a source of truth, never governed.
If anything here conflicts with `brain/core/methodology/reviewer-protocol.md` or an ADR,
the doctrine wins.

---

## Quick path

1. **Asked to review a brain PR or issue?** Run the deterministic entrypoint, not a
   hand-written prompt:
   ```bash
   npm run brain:review -- --pr <id>
   # or, for issue rulings:
   npm run brain:review -- --issue <id> --mode ruling
   ```
   Read-only companions: `npm run brain:review:queue`, `npm run brain:review:board`.

2. **No reviewer identity available** (`BRAIN_REVIEWER_TOKEN` unset, or it doesn't
   cross-check against `reviewer.handle` in `brain.config.json`)? **Say so explicitly
   and stop.** Do not silently fall back to an ad-hoc chat review — that fallback is
   the exact defect this document exists to prevent (see Finding 1 below).

3. Doing exploratory, defect-hunting work (mutation testing, adversarial dual-blind
   review)? That is a legitimate and valuable INPUT to a review, not a substitute for
   one. See "Complementarity" below for how to route its output.

---

## Finding 1 — §13 was being violated, and the entrypoint already exists

`brain/core/methodology/reviewer-protocol.md:364-380` (§13):

> the subagent MUST NOT be given ad-hoc manual execution prompts... The subagent is
> strictly a command executor of the deterministic VCS review entrypoint.

Across issues #535 and #551, every review ran instead through a generic dual-blind
adversarial skill with hand-written prompts — exactly what §13 forbids. The entrypoint
was already wired: `npm run brain:review -- --pr <id>` / `--issue <id> --mode ruling`
(`package.json:64-66` → `brain/scripts/review/cli.mjs`, ~28 modules, all tested).

### What the ad-hoc path did NOT lose

Defect-finding power. It found six real vacuous-pass routes in `T7b`, each proven by
live mutation.

### What it DID lose — procedural rigour, each item verifiable

| Lost | Mechanism that provides it |
|---|---|
| Reproducibility | `headRefOid` binding, `rev` counter, one fixed entrypoint |
| Verified identity | `identity.mjs` refuses to run unless the reviewer token resolves to a login DIFFERENT from the author (fail-closed, #413). Ad-hoc judges have no identity — nothing structurally prevents self-review. |
| Auditable record | a parseable `brain-review/N` YAML block posted via `prReviewComment`/`issueComment` (`poster.mjs:155`), visible to `brain:review:queue` and `board.mjs`, re-readable by a later cold review through `parse-verdict.mjs`. Chat findings are invisible to all of it. |
| Findings contract | `buildVerdict` (`verdict.mjs`) DROPS any finding without `evidence:` (a command actually run) and downgrades any blocker without `cites:` (an ADR/REQ/gate id) to `correction`. |
| Bounded escalation | a well-formed `## FORK` in ruling mode ALWAYS escalates to a human (`evaluators/ruling.mjs`); `rev >= 3` forces `STOP`. |

**The defect was the silent fallback, not the tool choice.** Rule: run the entrypoint;
if identity is unavailable, say so and stop (Quick path, step 2).

### Complementarity — the dual-blind pass is a findings producer, not a verdict

Its live mutations become the verdict's `evidence:` field; its doctrine references
become the `cites:` field. A mutation stops being a chat artifact and becomes
contracted evidence the moment it's fed through `brain:review`. `brain-review/2` alone
would **not** have found the six T7b routes — it is a verdict machine with evidence
discipline, not a bug hunter. Neither replaces the other; route mutation-testing output
INTO the entrypoint's evidence fields rather than treating either as sufficient alone.

### Honest symmetry — do not overclaim the fix

On the adversarial axis, the real protocol is currently no better than the ad-hoc path.
Its refuter (`evaluators/refuter.mjs`) only activates when a finding carries
`evidence_class: 'inferential'`, and no evaluator produces that value —
`causal-admission.mjs:28` says so in its own comment: *"a no-op today."* #284 (below) is
what closes this gap.

---

## Finding 2 — the missing 20% of M3 is decision debt, not implementation debt

`/1` is complete and invocable. All four open tickets below are blocked on a **human
ruling**, not on code — each already carries the defect measured against the real
parser, red-first tests specified, and a written recommendation. Under #124 only the
maintainer can apply `status:approved` / sign these rulings.

| Ticket | State | What's blocked and why |
|---|---|---|
| [#284](https://github.com/csrinaldi/brain/issues/284) | OPEN | Refuter role. Removes persuasive-false-positive failures from an unattended LLM reviewer. Two open `## FORK`s: (a) lazy trigger (≥1 inferential blocker) vs always-on at checkpoint mode; (b) own `brain-refute/1` block vs folded per-finding `refuter:` field. |
| [#477](https://github.com/csrinaldi/brain/issues/477) | OPEN | A corrupt findings list parses as NO findings. `parseJsonScalar` returns `null` on anything unreadable and `parseVerdict` drops the field — "unparseable" and "absent" are indistinguishable. This is the exact inversion §10 forbids in the evaluators ("never APPROVE on uncomputable evidence"), appearing in the reader that feeds them. Three candidate designs on the table. |
| [#483](https://github.com/csrinaldi/brain/issues/483) | OPEN | `validateSchemaV2` is exported, tested, and called from **zero** production sites; `buildVerdict` routes by `causal_disposition` without validating it. A typo'd disposition reclassifies a pre-existing defect as introduced; an invented `evidence_class` reaches the posted verdict unchallenged; a near-miss spelling of `unknown` loses the STOP + human escalation entirely. Same class as M10 (#335). |
| [#495](https://github.com/csrinaldi/brain/issues/495) | OPEN | `parseBudgetClaim` can fabricate a blocker. It scans the whole document and accepts any `N/M` where `M` is a budget some tier declares — four ordinary sentences (one verbatim from the repo's own `governance-tiers.test.mjs`) each produce a `drift:counted-lines-budget` blocker whose `evidence:` states a claim the source document never made. Named `evidence-reader-inventing-on-ambiguity` — worse than a false negative because it fails loudly and wrongly. |

Also record, because they change the map:

- **[#408](https://github.com/csrinaldi/brain/issues/408) CLOSED**, but landed a narrow
  producer only: `pre-existing` for `local-checks`; `base-only` remains unproducible by
  design (inventing the claim would be worse than omitting it). Its own words: *"M3
  shipped the consumers for two classes of finding and a producer for neither."*
- **[#442](https://github.com/csrinaldi/brain/issues/442) CLOSED and shipped**:
  `brain.config.json:37-41` already dogfoods `brain-review/2` while `governance.tier`
  is `lite`.
- **[#569](https://github.com/csrinaldi/brain/issues/569)** (`priority:high`) is the
  structural answer to the T7b lineage: a runtime `getVcs` spy that proves behaviour
  instead of source shape.

---

## Operational lessons (short — they cost real time)

- Verify a mutation actually **landed** before trusting a red; a mutation that silently
  fails to match produces a meaningless green (#409).
- Give each adversarial reviewer its own worktree. Two judges mutating one worktree
  stomp each other's proof state.
- `git stash` is repository-scoped, not per-worktree — the same entries appear in every
  worktree.
- `gh issue view --json` and `gh issue edit --add-label` use GraphQL and fail under
  GraphQL rate limiting while REST is healthy; `gh api repos/OWNER/REPO/...` works as a
  fallback.
- Six routes into one defect across four rounds of T7b: each round closed its route by
  widening a text scanner and claimed the class; the next round found another. Widening
  buys one shape and gives away the next — when the count reaches this, change the
  mechanism instead of the pattern.

---

## Related reading

- `brain/core/methodology/reviewer-protocol.md` — the doctrine this document routes
  agents into, especially §5 (elimination), §6.2 (mode selection), §10 (uncomputable
  evidence), §13 (subagent executor doctrine).
- `docs/inbox/reviewer-mechanisms-comparison.md` — an earlier comparison of
  judgment-day vs `brain:review` as mechanisms (in Spanish).
- Durable memory record for this audit: search `.memory/records/` for issue `572`, or
  `MEMORY_BACKEND=plainfiles node ./brain/scripts/memory/cli.mjs search "reviewer-protocol audit"`.
