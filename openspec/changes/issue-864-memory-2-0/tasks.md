---
status: tasked
issue: 864
---

# Tasks: #864 — memory 2.0

Each task is a slice with its own ticket, change dir, worktree and PR to `main`
(design.md §4). Every slice PR **closes its own ticket** and names the epic in prose
(`Parent: #864`) — never a closing keyword against #864, and never `Part of #864` on a PR to
`main` (`issue-link` refuses it there, `run-check.mjs:346`). Check the box in the slice's PR.
The last task is the epic's exit.

> **Revised 2026-09-05** (design.md §7). Tasks marked **[rev]** are new or reworded; tasks
> marked **(ticket: file)** have no issue yet — the owning ruling files it and replaces the
> marker with the number.

## Wave 0 — stop the bleeding, and be able to measure
- [x] 0.0 **[rev]** #864 reopened (human act — PR #867 closed it with a closing keyword). Eleven open slices must not hang off a closed epic, and the exit numbers (6.1) land on it.
- [x] 0.1 #820 — skip-and-say mitigation around `import`; the ticket states that the fix is #863's contract, not this guard. Detector for duplicated `rec-` keys is `memory:audit` (#870).
- [x] 0.2 **[rev]** `memory:audit` **#870** — one command, records + `git log` only, no backend required: p50/p90 learn→main over a window; records vs distinct ids; `actor` shape distribution (`@legacy` / branch-name / handle); `issue` and `supersedes` coverage; `rec-` rows vs distinct keys when the backend exports. Baseline run pasted on #864 before any other slice merges (spec.md "the epic's measurements are a command").

## Wave 1 — rulings
- [x] 1.1 #862 — ruled 2026-09-09 (PR #891, archived in #894), doctrine promoted in #893 (ADR-0034, ADR-0002 Amendment 2, `consolidation-protocol.md §5`, `openspec/README.md` rule 3); the lane ruling recorded (ADR-0002 amendment or new ADR); `consolidation-protocol.md §5` rewritten; lane contract fixed: trigger, branch grammar, path restriction, merge rule. **[rev]** The ruling also fixes: the governance-surface answer (a `memory/*` branch-grammar exemption vs a standing approved memory issue — `Part of #N` is refused on `main`); the tier table (auto-merge only at `lite`); the `index.jsonl` rule (reindex-before-merge vs index-off-lane); the collector's commit mechanism (plumbing vs dedicated worktree); the `memory-gate` rule under the lane; and files the four Wave 3 lane tickets (3.1a-d).
- [x] 1.2 #863 — **ruled 2026-09-08 (D1–D6, D2b); drafts in `issue-863-backend-contract/brain-drafts/`, promotion is the maintainer's sitting.** The backend contract document exists beside `vcs-contract.md`, states the agnosticism test verbatim; engram and plainfiles measured against it; `harness-contract.md:27,32-34` rewritten in records vocabulary. **[rev]** Also: ADR-0002 and ADR-0004 amended for D2 (manifest/driver/symlink are the adapter's, not the layer's); the capture-door ruling (`mem_save` wrapped, retired, or declared non-conforming); `agent-authorities.md` Tier 1 rewritten; files the 3.2 ticket.

- [ ] 1.2a **[rev, #863 D1/D5]** one-time heal of the three pre-guard duplicated rows in the engram store (`rec-35e09fc539447742`, `rec-4d99842973ef6c5b`, `rec-d2ded214bc5d66c1`) **(ticket: file)** — adapter-side deletion of its own rows per the contract's Deletion section; `memory:audit` backend row reads distinct = rows afterwards.

## Wave 2 — prerequisites
- [ ] 2.1 #805 — a writer for `supersedes` (`memory:save --supersedes <id>`), refusing an id absent from the store (local `records/` ∪ `origin/main`, spec.md Vocabulary); ruling on deletion recorded; the four-step correction sequence written where a reader meets it.
- [ ] 2.2 #738 — provenance at capture: a fresh record carries `actor`, `actorKind`, `issue`, never `@legacy`; **[rev]** `actor` is a handle, never a branch name (`buildRecord` refuses a `/`); `actorKind` is measured, `PLAINFILES_ACTOR_KIND` retired; ruling on `actorKind: unknown` lands as an ADR-0017 amendment if adopted; guard at `exportObservation`. **[rev #870]** Two records carry `actor: "main"` — a bare default-branch name with no `/`; the refusal must cover `main`/`master`/`develop`/`trunk` as well as any `/`, as `memory:audit`'s classifier already does.
- [ ] 2.3 #247 — **[rev]** what remains after PR #258 (readers migrated): chunk materialization retired from `share`/`dualWriteRecords`; `share` reads no chunk file; `chunk-reader.mjs` gets its retirement verdict; grep-guard asserts zero consumers.
- [ ] 2.4 **[rev]** artifact retirement **(ticket: file under #863; depends on 3.2 — #863 D3: retiring the manifest while `share` still writes it reproduces #803 on every push)** — `.memory/manifest.json` untracked and unrestored (`lib/memory-manifest.mjs`, session-start step 1 — **and `openspec/specs/session-start/spec.md` REQ-3 amended in the same PR: it REQUIRES the restore today**, cold review of #877 rev 4); `.memory/legacy/*.jsonl.gz` (48 files) removed with the reader story stated; `.gitattributes:5` and `merge-engram-manifest.mjs` and `bootstrap.sh`'s driver registration removed; `.engram` symlink confined to `engram.mjs#setup`; `.gitignore` memory block rewritten. Spec scenario "no backend artifact is load-bearing" passes under both backends.
- [x] 2.5 **[rev]** `mrAutoMerge` VCS port verb **(ticket: #886 — shipped in PR #895, 6d1452a5; arms only at exactly zero required reviews)** — `vcs-contract.md` row, GitHub (enable auto-merge) and GitLab (merge-when-pipeline-succeeds), never throws, arms only when the tier's `requiredReviews` is exactly 0 and refuses otherwise rather than pretending; consumed only by the lane.

## Wave 3 — implementation
- [x] 3.1a **[rev]** lane collector **(ticket: #887 — planner in PR #898/#897, shell and `memory:collect` in #887's PR B; the local ref only, the push and cadence are 3.1b)** — at session end / cadence, gathers new records from every worktree of the clone into a `memory/<host>-<date>` branch without checking it out in the main checkout; marks or removes shipped worktree copies; never runs on `pre-push` of a feature branch.
- [x] 3.1b **[rev]** lane push + PR **(ticket: #888 — library in #901/PR #902, CLI op in PR 2; triggers deferred to #889)** — through the VCS port (`mrCreate` + 2.5), poster credential never in the capturing session (ADR-0033); PR body per 1.1's governance ruling; auto-merge only where the tier allows. Scenario "a record does not wait for its feature" proved by doing it. **Depends on 2.4** (manifest churn would trip 3.1c).
- [ ] 3.1c **[rev]** lane path restriction + governance **(ticket: #889)** — a CI check, required status context, refusing any path outside `.memory/records/` additions + `index.jsonl`, naming the path; `issue-link`/`actor-check`/`phase-order`/`decision-gate` green on a lane PR without waiver; `brain:audit` reports no `issueLink` failure on lane merges; the two-lanes-one-index rule implemented.
- [ ] 3.1d **[rev]** retire the feature-PR surfaces **(ticket: #890)** — `contributor-scaffold.mjs` memory line, `ticket.nextSteps.step3` (en/es), `brain-save.mjs`, `pre-push`'s `share` for feature branches; `memory-gate` scoped mode reads base∪head (or the ruled alternative). Scenario "feature pull requests carry no records" proved on the first feature PR after merge.
- [ ] 3.2 record-first capture **#874** — the agent's capture produces a record, the backend hydrates from it; **[rev]** the `mem_save` door closed per 1.2's ruling; two sessions on one topic yield two records and the later carries `--supersedes` declared by its writer (needs 2.1); `share` becomes "commit what is already true".

## Wave 4 — hardening
- [ ] 4.1 #361 — reindex parity between backends, per the contract.
- [ ] 4.2 #461 — `source` citing an undeclared issue no longer fabricates `issue`.
- [ ] 4.3 #712 — unparseable `brain.config.json` is "could not look", never "found nothing", on the `share` path.
- [ ] 4.4 #714 — suite verdict independent of `BRAIN_MEMORY_UPSTREAM_REF`.
- [ ] 4.5 #638 — duplicate-report strings in the i18n catalogs.

## Close / amend
- [ ] 5.1 #795 closed in favour of #862 once 3.1b's first scenario passes **and [rev]** its acceptance 1 and 3 are answered: `memory-presence.mjs`'s header cites the ruling and names the export trigger and the backend→file lag bound.
- [x] 5.2 #313 banner points to #864 (done 2026-09-05).
- [ ] 5.3 **[rev]** `openspec/README.md` rule 3 ("Artifacts travel with the code in the same MR") gains the lane exception, and `docs/KNOWN-LIMITATIONS.md`'s memory entries are refreshed.

## Exit
- [ ] 6.1 **[rev]** `npm run memory:audit` on a fresh clone under `MEMORY_BACKEND=engram` AND `MEMORY_BACKEND=plainfiles`; both outputs on #864 beside the numbers they replace (p50 learn→main vs 10.9 h, target p50 ≤ 1 h / p90 ≤ 24 h at `lite`; `rec-` distinct = rows vs 2336/2339; `actor` handle share vs 0/94, `@legacy` vs 66/94; `supersedes` > 0 vs 0); the four do-it-once scenarios linked (unmerged-branch record on `main`; feature PR with zero records; lane refused on a foreign path; two lanes one index); the vacuity table filled for the `plainfiles` run; `brain:change:verify` green for the structural half; a human closes #864.

## Review Workload Forecast
- Estimated changed lines (this revision): ~+300 / −60, all under `openspec/changes/issue-864-memory-2-0/` — planning artifacts, no code; `.memory/**` and `openspec/changes/**` are in `governance.ignoreList`.
- 400-line budget risk: Low (exempt paths).
- Chained PRs recommended: No — this PR revises the epic's contract; slices are separate PRs by design (design.md §4).
- Decision needed before apply: **Yes — reopen #864 (0.0)**, a human act; and the latency targets in spec.md are proposed for #862 to ratify.

## Micro-decisiones en caliente
- 2026-09-05 — stacked-to-main, no tracker branch: a tracker for a memory epic would strand the epic's own records (design.md §4).
- 2026-09-05 — the agnosticism test ("does it hold under plainfiles?") is the acceptance filter for every slice, written into spec.md as the first requirement.
- 2026-09-05 **[rev]** — `supersedes` is declared by the writer, never inferred from a topic: no `topic` field enters the format (design.md §6).
- 2026-09-05 **[rev]** — the exit is a command (`memory:audit`), not `brain:change:verify`, which cannot re-measure a scenario (design.md §5).
- 2026-09-05 **[rev]** — the lane does not auto-merge where the tier's `requiredReviews` is 1; the human wait is reported, not hidden (design.md §6).
- 2026-09-05 **[rev]** — status advanced `draft → tasked` on all four artifacts: the ladder in `phase-order-check.mjs` is forward-only and the four artifacts exist.
