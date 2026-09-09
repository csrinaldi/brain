---
status: tasked
issue: 862
---

# Tasks: #862 — the memory lane ruling

A **ruling ticket** (proposal.md, design.md). It implements nothing itself: this checklist
drafts doctrine, files the five slice tickets the design's dependency graph names, writes their
numbers back into the epic, and opens one docs-only PR — same shape as #863
(`openspec/changes/issue-863-backend-contract/tasks.md`), whose promotion sitting became PR
#875/#876. Ratified 2026-09-09: L1–L9 as recommended, plus C1 (secret scrub required lane check)
and C2 (deterministic collector dedup) — engram `sdd/issue-862-memory-lane/ruling` (#3215).

Work only under `openspec/changes/issue-862-memory-lane/`. Nothing under `brain/`, nothing in
code — D0 in design.md.

## 1. Artifact status bumps

- [x] 1.1 Bump `status:` frontmatter on `explore.md`, `proposal.md`, `spec.md`, `design.md` from
      `proposed` to `tasked`, alongside this file — one shared value across the change dir, the
      way #863's artifacts moved together (`phase-order-check.mjs`'s `STATUS_LADDER` is
      forward-only; unknown/custom values no-op, so this is a safe, monotonic bump).

## 2. Doctrine drafts (`brain-drafts/`, D0 — drafts, not writes)

Every amendment draft below is planned with `planAmendment`
(`brain/scripts/lib/amendment-draft.mjs:681`) against the **current** tree (post-#877: #863's
ADR-0002 Amendment 1 and consolidation-protocol Amendment 1 are already on `main` at `f8bdca52`).
Anchors are taken from `main` as it stands today, not from #863's own drafts — design.md's
"Ordering constraint" is already satisfied by the fast-forward; do not re-derive anchors from the
pre-#877 line numbers cited in earlier drafts of this design.

- [x] 2.1 **`adr-0034-memory-travels-on-its-own-lane.md`** — new ADR (highest existing is
      `adr-0033-cold-review-transport.md`; #863 only adds amendments, so #862 takes **ADR-0034**).
      Content: the lane as its own governance mechanism (L1 lane class, L2+C1 merge-by-tier and
      the required `lane-scrub` check, L3 index-off-the-lane, L4+C2 collector plumbing and
      deterministic dedup, L5 trigger/credential separation) — states the collector's
      `--no-verify` push as a documented, load-bearing hook bypass (design.md Risk 2), not buried
      in code. Shape: `brain:promote`'s new-ADR path (`amendment-draft.mjs:4`, slice #378).
      Verification (no disk writes, no confirmation prompt — `transformDraft`/`destinationFor` are
      exported, `planNewAdrPromotion` itself is not):
      ```
      node -e "
      import('./brain/scripts/brain-promote.mjs').then(async ({ transformDraft, destinationFor }) => {
        const fs = await import('node:fs');
        const draftPath = 'openspec/changes/issue-862-memory-lane/brain-drafts/adr-0034-memory-travels-on-its-own-lane.md';
        const draftText = fs.readFileSync(draftPath, 'utf8');
        console.log('destination:', destinationFor(draftPath), '(must not exist yet)');
        console.log(transformDraft(draftText, { gitUserName: 'check', today: '2026-09-09' }));
      });"
      ```
      Confirm `destinationFor(...)` resolves to `brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md`
      (absent today) and `transformDraft` returns `{ ok: true, number: '0034', title }`.

      **Filename correction, found during apply.** `DRAFT_BASENAME_RE` in
      `brain-promote.mjs:89` (`/^adr-(\d{4})-([a-z0-9][a-z0-9-]*)\.md$/`) does
      not match a `.draft.md` suffix — a `.draft.md` name makes
      `destinationFor` return `null`, and `brain-promote.mjs`'s
      `amendmentShapeRefusal` states the convention explicitly: *"A NEW ADR
      draft is named `adr-NNNN-<lowercase-slug>.md`. An AMENDMENT draft is
      named `*.draft.md`."* Every historical new-ADR draft under
      `brain-drafts/` (`adr-0023-sdd-role-port.md`,
      `adr-0033-cold-review-transport.md`, `adr-0032-…`, `adr-0031-…`) carries
      plain `.md`, never `.draft.md` — confirmed by `git log
      --diff-filter=A -- '*/brain-drafts/adr-*.md'`. The draft therefore
      shipped as `adr-0034-memory-travels-on-its-own-lane.md`, not the
      `.draft.md` name this task originally named; the verification command
      above is corrected to match. `.draft.md` stays reserved for the
      `brain-amendment/1` shape (tasks 2.2, 2.3).

- [x] 2.2 **`consolidation-protocol.draft.md`** — `brain-amendment/1`, doctrine shape (not ADR),
      rewriting `consolidation-protocol.md` §5 (`brain/core/methodology/consolidation-protocol.md:186-204`
      on the current tree). Anchor: the sentence "Once the MR is merged, the team absorbs the
      memory with `npm run memory:pull`... **This sentence is under ruling #862**" at line 202 —
      replace with the lane's actual flow (records reach `main` on their own PR; the feature
      branch carries none), and drop the "Until the memory lane (#862) exists, records still
      travel with the branch" caveat at line 194 once 3.1b's first scenario and #874 have proven
      it (state that sequencing in the draft's prose, per L7/design.md §"Ordering constraint").
      Verification:
      ```
      node -e "
      import('./brain/scripts/lib/amendment-draft.mjs').then(async ({ planAmendment }) => {
        const fs = await import('node:fs');
        const draftText = fs.readFileSync('openspec/changes/issue-862-memory-lane/brain-drafts/consolidation-protocol.draft.md', 'utf8');
        const targetText = fs.readFileSync('brain/core/methodology/consolidation-protocol.md', 'utf8');
        const r = planAmendment({ draftText, targetText, homeText: null, gitUserName: 'check', today: '2026-09-09' });
        console.log(r.ok, r.ok ? (r.plan?.acts ?? r.acts) : r.error);
      });"
      ```
      Every act must read `pending` (not `blocked`, not partially `done`) — `ok: true`.

- [x] 2.3 **`adr-0002-amendment-2.draft.md`** — `brain-amendment/1`, ADR shape (one extra act:
      Status line + `brain/HOME.md` marker), amending `adr-0002-memoria-git-based-dos-capas.md`'s
      canonical-flow bullets (currently at Amendment 1, `**Status**:` line 3 — this draft declares
      `amendment: 2`). Target: the `memory:pull`/`memory:share` bullets at lines 27-28 area — point
      them at the lane once it exists, same "the verbs keep their names until #862 settles the
      lane" note this ADR already carries (line 71) resolved.
      Verification:
      ```
      node -e "
      import('./brain/scripts/lib/amendment-draft.mjs').then(async ({ planAmendment }) => {
        const fs = await import('node:fs');
        const draftText = fs.readFileSync('openspec/changes/issue-862-memory-lane/brain-drafts/adr-0002-amendment-2.draft.md', 'utf8');
        const targetText = fs.readFileSync('brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md', 'utf8');
        const homeText = fs.readFileSync('brain/HOME.md', 'utf8');
        const r = planAmendment({ draftText, targetText, homeText, gitUserName: 'check', today: '2026-09-09' });
        console.log(r.ok, r.ok ? (r.plan?.acts ?? r.acts) : r.error);
      });"
      ```
      Every act `pending`, `ok: true` — including act 4 (the `brain/HOME.md` marker for ADR-0002).

- [x] 2.4 **`openspec-readme-rule-3.draft.md`** — plain patch, not a `brain-amendment/1` draft:
      `openspec/README.md:25` is outside `brain/**`, so `amendment-draft.mjs`'s
      `target.startsWith('brain/')` guard refuses it and `brain:promote` does not apply. Content:
      rule 3 ("Always committed. Artifacts travel with the code in the same MR.") gains the lane
      exception (epic tasks.md 5.3: "5.3 lane exception"). This draft is a note for task 5.3's own
      PR — it is edited directly there, not promoted through `brain-promote`. No `planAmendment`
      verification applies; state that explicitly in the draft's header so a reader does not look
      for one.

## 3. File the five tickets (issue-creation skill, Feature Request template)

Every issue body states `Parent: #864` in prose (never a closing keyword against the epic — the
epic pattern in epic tasks.md's header) and the REQ id(s) it owns from spec.md's "Requirement
ownership" table. Filing an issue is within agent authority (Tier 1); `status:approved` is the
maintainer's act, same split as #863's 3.2.

- [x] 3.1 **File `mrAutoMerge` (epic task 2.5)** — VCS port verb: `vcs-contract.md` row after
      `mrCreate` (`:33`) plus the Phase 3 adapter table (`:95-104`); GH `gh pr merge --auto
      --squash`; GL `PUT .../merge_requests/{iid}/merge` with
      `merge_when_pipeline_succeeds=true`; refuses `{enabled:false, reason:'requires-human-approval'}`
      when tier `requiredReviews > 0`, never throws. Owns REQ "merge by tier". No dependency —
      files first; 3.1b cannot open-and-merge without it (design.md dependency order).
      **Filed: #886.**

- [x] 3.2 **File the collector (epic task 3.1a)** — `brain/scripts/memory/lane/plan.mjs`
      (`planLaneCommit`, pure) + `lane/collect.mjs` (the git-in/git-out shell, seam pattern of
      `governance/postmerge/git-seam.mjs:27,54`). Owns REQ "collector, deterministic dedup" (C2:
      same first-wins rule the reader uses, tiebroken by lexicographic worktree path then physical
      line — `duplicates.mjs:20-24`). State design.md Risk 2 in the ticket: `--no-verify` on the
      push is deliberate and documented in ADR-0034, not incidental. Depends on 3.1 (2.5).
      **Filed: #887.**

- [x] 3.3 **File push + PR (epic task 3.1b)** — through the port (`mrCreate` + `mrAutoMerge`);
      poster credential never in the capturing session (ADR-0033); PR body per L1 (`Memory lane:
      <host> <date>`, no issue reference, `Records: <n>`, file list). Owns REQ "trigger +
      credential". Scenario to prove: "a record does not wait for its feature". State design.md
      Risk 5 in the ticket: `BRAIN_MEMORY_TOKEN` on unattended hosts is scoped to the ship process
      alone, asserted via `withoutCredentials` everywhere else. Depends on 3.2 (3.1a); **auto-merge
      is not *enabled* until #805 (`supersedes`) lands** — the ticket states this as an enablement
      gate, not a filing blocker (design.md Risk 6).
      **Filed: #888.**

- [x] 3.4 **File path restriction + lane class + governance (epic task 3.1c)** — the CI check
      `lane-paths` as a required status context (path restriction to `.memory/records/` additions
      only), the `issue-link`/`actor-check` lane branch (`run-check.mjs:313`, `actor-check.mjs:671` — before the
      closing-keyword refusal, per L1's table), `brain:audit`'s `[LANE]` row
      (`brain-audit.mjs:326,334-344`), and the required `lane-scrub` check (C1 — reuses
      `secret-scrub.mjs`'s `scrubRecordsFile`, registered in `vcs-contract.md:43`'s `checks`
      array, fail-closed, no bypass flag). Owns REQ "lane recognition", "secret scrub required
      check", "index off the lane". State design.md Risk 1 in the ticket: `lane-paths` MUST land
      as a required context in the **same PR** that teaches the gates the lane branch, never
      before — the exemption is only as narrow as the path check makes it safe. State the open
      question from design.md verbatim: whether `lane-paths` also tolerates a committed
      `index.jsonl` — L3 rules records-only as the default, the ticket's implementer decides only
      if a concrete conflict forces it. Depends on 3.3 (3.1b) and on epic task 2.4 (artifact
      retirement) landing first — manifest churn would trip the path check (design.md dependency
      diagram, epic tasks.md:33).
      **Filed: #889.**

- [x] 3.5 **File retirement of feature-PR surfaces + template wording (epic task 3.1d)** —
      `pre-push:70`'s `share` call on feature branches, `ticket.nextSteps.step3` (en/es),
      `brain-save.mjs`, `contributor-scaffold.mjs:274`, `day.done.checkCmd`; the PR template's
      memory line rewritten to "captured as a record (`memory:save --issue N`); it reaches `main`
      on the lane". Owns REQ "`memory-gate` unchanged / template wording", "feature-PR surface
      retirement". Scenario to prove: "feature pull requests carry no records", proved on the
      first feature PR after merge. Sequencing (spec.md's "retirement is sequenced" requirement,
      non-negotiable): ships only after 3.1b's first scenario has passed AND #874 (record-first,
      epic task 3.2) has landed. Depends on 3.4 (3.1c).
      **Filed: #890.**

## 4. Write ticket numbers back into the epic

- [x] 4.1 Edit `openspec/changes/issue-864-memory-2-0/tasks.md`: replace `2.5`'s
      `**(ticket: file under #862)**` and `3.1a`–`3.1d`'s same markers with the five numbers filed
      in section 3. Leave the existing uncommitted edit on task 2.4 (`depends on 3.2`) exactly as
      it stands in this worktree — it rides this PR unchanged.
- [x] 4.2 Comment on #864 stating: the five tickets and their numbers; the dependency order (2.5 →
      3.1a → 3.1b → 3.1c → 3.1d, with #805 gating 3.1b's auto-merge *enablement* and #874 → epic
      2.4 gating 3.1c and 3.1d); and which acts are Tier 2 (maintainer-only) vs agent-doable:
      - **Tier 2 (maintainer)**: the promotion sitting — running `brain:promote`'s typed
        confirmation on the three `brain-amendment/1`/new-ADR drafts, editing
        `openspec/README.md` rule 3 directly for 5.3, and adding `status:approved` to each of the
        five filed tickets before their own PRs can open.
      - **Agent-doable (Tier 1)**: drafting all four doctrine documents under `brain-drafts/`,
        filing the five tickets, writing their numbers back into the epic, this comment, running
        `brain:review` before opening this PR, and opening this PR itself.

## 5. The PR

- [ ] 5.1 Run `brain:review` before announcing. Branch `docs/issue-862-memory-lane` (or
      equivalent `docs/` name — this PR is docs-only under `openspec/**`, no code, same as #863's
      #875).
- [ ] 5.2 Open the PR: `Closes #862`; `Parent: #864` stated in prose only, never a closing
      keyword against the epic; label `type:docs` (matching #863's PR type). Body: the four
      drafts, the five filed ticket numbers, the epic tasks.md edit, the #864 comment — all listed
      in the Changes Table.
- [ ] 5.3 File a follow-up ticket for the promotion sitting itself (the maintainer's Tier 2 act:
      running `brain:promote` on the three `brain-amendment/1`/new-ADR drafts and editing
      `openspec/README.md` rule 3 by hand) — the same shape #863's sitting became (#876 for #875).
      Do not fold that sitting into this PR; state its ticket number in the PR body as a
      "Follow-up" line.

**Section 5 deferred, out of this apply run's authorized scope.** The apply run's own
instructions authorised filing only the five Wave 3 tickets (3.1) and the #864 comment (4.2) — not
pushing, not opening the PR, and by extension not filing 5.3's follow-up ticket, whose body is
meant to reference the PR this section opens. `brain:review` (5.1) also refuses without a PR
number (`node ./brain/scripts/review/cli.mjs`: *"Usage: npm run brain:review -- <pr-number>"*) —
it cannot run before 5.2. All of section 5 stays for the orchestrator/maintainer's own sitting:
push the branch, open the PR, run `brain:review` against it, then file 5.3 and link it in the PR
body.

## Review Workload Forecast

- Estimated changed lines: ~+300 / −20. All under `openspec/changes/issue-862-memory-lane/**`
  (four `brain-drafts/*.draft.md` files, four artifact frontmatter bumps) plus a ~15-line edit to
  `openspec/changes/issue-864-memory-2-0/tasks.md`. Every touched path sits under
  `openspec/**`, which is on `governance.ignoreList` — 0 counted `diff-size` lines, same as #863's
  and the epic's own forecasts.
- 400-line budget risk: None (exempt path).
- Chained PRs recommended: No — one docs-only PR, same shape as #863/#875.
- Decision needed before apply: No — the ruling (L1–L9, C1, C2) is already ratified (2026-09-09,
  engram `sdd/issue-862-memory-lane/ruling`). The five ticket numbers are filed by the agent
  during apply (Tier 1); the promotion sitting is a separate maintainer follow-up (section 5.3),
  not a blocker of this PR.
