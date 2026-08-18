---
status: draft
issue: 709
---

# Tasks: The selector is a fence TAG, and the splitter is CommonMark-correct (#709)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1000–1200 total (2 PR slices); each slice individually >400 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (selector) → PR 2 (splitter), sequential, PR 2 depends on PR 1 merged |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (recommended — see rationale below) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
Terminal PR: none (each PR merges to main)

**Rationale for stacked-to-main over feature-branch-chain**: D0 requires selector-before-splitter as a *code-safety* ordering (landing splitter first opens a measured regression window), not a review-sequencing preference. No tracker/integration branch is named anywhere in proposal/spec/design — both slices are complete, independently revertible units (design's rollback table) that each stand on `main` alone. A tracker branch would add a hop with no offsetting benefit here. Orchestrator: confirm with the user before apply; if they prefer feature-branch-chain instead, add a terminal task opening the tracker PR before either child PR is opened.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Selector: `epic-graph.mjs` reads `lang`, not `protocol:` scalar; docs + ADR draft | PR 1 | Base `main` @ `b3c08a5`. MUST merge before Unit 2 (D0). |
| 2 | Splitter: CommonMark-correct `fenced-blocks.mjs` + 14-axis matrix | PR 2 | Base `main`, rebased onto PR 1's merge commit. MUST NOT open/merge before PR 1 (D0). |

---

## Phase 1: Prerequisites

- [ ] 1.1 Confirm PR #703's live state and issue #709/#710 bodies via `gh pr view 703` and `gh issue view 709 710` (no shell was available to spec/design phases — this is unverified, not assumed).
- [ ] 1.2 **Close PR #703 unmerged** (D10: replace, not rebase). Comment citing: exceeds the 400-line budget alone (411 additions), and 3 of #710's 5 findings are regressions its own diff introduced. Do not resolve conflicts in it.

## Phase 2: Selector — commit 1 / PR 1 (lands FIRST — D0). Do not reorder.

Files: `brain/scripts/status/epic-graph.mjs`, `brain/scripts/status/epic-map.test.mjs`, `openspec/changes/issue-639-graph-block-locator/spec.md`, `openspec/changes/issue-495-declared-budget-claim/design.md`, `brain/core/methodology/vcs-contract.md`.

> **ORDERING CORRECTION (measured, not assumed).** ADR-0032's promotion was written as
> Phase 7, after both PRs. That order cannot pass CI: the selector's own header cites
> `ADR-0032` three times (`epic-graph.mjs:10,39,95`) and
> `test/adr-citation-resolves.e2e.test.mjs` refuses a citation that resolves to no file
> in `brain/project/decisions/` — `npm test` on this branch was **3931/3932 with that
> one failure** before the promotion. The last promoted record is ADR-0031. The
> promotion therefore belongs INSIDE PR 1, as tasks 2.10/2.11 below (moved verbatim
> from Phase 7). This is the shape the repo already uses: ADR-0031 landed inside PR
> #672 (`eccd803`) as its own 3-file commit, not in a separate PR and not directly on
> `main`.

- [x] 2.1 `epic-graph.mjs`: selector reads `lang === GRAPH_PROTOCOL` (first word, exact case), not `scalar(content, 'protocol')`. Remove the scalar-based selection path. Correct header doctrine (currently `:11-17`, `:80-83`).
- [x] 2.2 Implement D6's answer table in `parseGraphBlock`: one `brain-graph/1` match → parsed object; >1 → `{ok:false}` naming count+lines (REQ-639-3, unchanged); zero + no mention → `null`; zero + a `skipped`/unterminated entry hides a graph-tagged fence → `{ok:false}` naming line+reason.
- [x] 2.3 Implement D7: legacy shape (`​```yaml` + `protocol: brain-graph/1` inside) → `{ok:false}` naming the retag, ~4 lines. This is the entire migration net.
- [x] 2.4 `epic-map.test.mjs`: fixture builder emits `​```brain-graph/1`. Add cases: declared-vs-illustrated (yaml+protocol doesn't declare, REQ-639-1 scenario 2), legacy-shape refusal (D7), case sensitivity (`BRAIN-GRAPH/1`/`Brain-Graph/1` don't match, axis 12), trailing attributes still match (axis 11), one declared + one yaml-illustrated is NOT ambiguity (axis 13).
- [x] 2.5 Update `openspec/changes/issue-639-graph-block-locator/spec.md`: REQ-639-1 superseded per this change's delta; REQ-639-2/3/4/5 unchanged.
- [x] 2.6 Correct `issue-495-declared-budget-claim/design.md` D1's table row for `brain-graph/1`: move to the second family, point at ADR-0032. **Also corrected the row's stated criterion** — "is it rendered for a human?" is the wrong discriminator for this block; spoofability is. Moving the example without correcting the reason would have left the table asserting something false about the row it now sits in.
- [x] 2.7 ~~Retag the illustration in `vcs-contract.md`'s `issueRelations` row (fabricated-vs-omitted-dependency reference) to the new tag shape.~~ **NO-OP — the illustration this task assumes does not exist.** `rg` over the whole file finds no fenced `brain-graph/1` block: the `issueRelations` row mentions "the declared `brain-graph/1` block" only as an inline code span, which 6.1 already declares safe. The one real column-0 `protocol: brain-graph/1` illustration in the tree is `openspec/changes/issue-459-epic-map-derived/proposal.md:38`, named in `epic-graph.mjs`'s header and deliberately left as the historical record of the shape being retired.
- [x] 2.8 Verify the ADR-0032 draft's content still matches the shipped selector behavior (D12/D13) — no status/signature edits, review only. **Matches**: Decision states tag-first-word/exact-case and that the yaml+scalar shape no longer declares; both are what `parseGraphBlock` does.
- [x] 2.9 `npm test` scoped to `epic-graph`/`epic-map` suites; `brain:epic:map --dry-run` shows no new edge and ~~#709/#710's own bodies report D7's retag, not an edge~~. **Full suite 4025/4025.** `brain:epic:map 313 --dry-run`: 66 issues, **zero edges, zero unreadable blocks** — no fabricated edge, which is the half that matters. **The retag half of this task is FALSE as written**, and the reason is worth keeping: `parseGraphBlock` on the live bodies of #709, #710, #702 and #459 all return `null`, not D7's refusal. D7 reads the legacy scalar with `scalar()`, which requires `^protocol:` at **column 0**; every live illustration is indented (#709's sits under 7 spaces). So the migration net does not fire on this corpus at all. The design's "accepted cost" paragraph — that meta-issues illustrating the old shape would now say "retag me" — does not reproduce. The corpus is safe by **incidental indentation**, exactly as exploration recorded; D7 is a net for a column-0 shape nothing in this repo currently writes. 4+ spaces is CommonMark-indented code, so this stays true after Phase 3's splitter lands.
- [ ] 2.10 **[HUMAN-ONLY — @crinaldi. No agent may check this box.]** (moved from 7.1) Review the ADR-0032 draft, run `npm run brain:promote -- openspec/changes/issue-709-declaring-selector/brain-drafts/adr-0032-graph-block-declared-by-its-tag.md`, type `PROMOTE`, then run the printed commit command. This commit IS the human signature (ADR-0028). An agent MUST NOT set `status:approved`, MUST NOT add a `**Signed**:` line, and MUST NOT run the commit command on the maintainer's behalf (#124, `actor-check` §9, Tier 3 prohibited per `agent-authorities.md`). **Blocks 2.11 and PR 1 — `local-checks` is red until this lands.**
> **2.10 evidence (the box stays for @crinaldi to check — an agent must not tick it).**
> Promoted and signed: commit `a4262ec`, author `Cristian <csrinaldi@gmail.com>`, three
> files, `Status: Accepted`, dated 2026-08-18.

- [x] 2.11 (moved from 7.2) Verify (not construct) that the promotion commit carries `brain/HOME.md`'s new ADR-0032 entry and the regenerated `AGENTS.md` (`brain:promote`'s §1d cascade, `decision-gate`/ADR-0026 Amendment 4). Then re-run full `npm test` — the `adr-citations` e2e must go green. **Verified**: `a4262ec` carries exactly `AGENTS.md` (+1), `brain/HOME.md` (+1) and the 235-line ADR; both index entries link the promoted path. Suite went 4024/4025 → **4025/4025**, the `adr-citations` failure cleared by the promotion and by nothing else.
- [ ] 2.12 PR 1 exceeds the 400-line budget (selector + tests + the 257-line ADR + doctrine corrections). Record `size:exception` — accepted by the maintainer, this session. Splitting the ADR out of PR 1 is NOT the alternative: it reopens the citation gap 2.10 exists to close.

## Phase 3: Splitter core — commit 2 / PR 2 (lands SECOND — D0). MUST NOT open before Phase 2 merges.

File: `brain/scripts/lib/fenced-blocks.mjs`.

- [ ] 3.1 Hand-scanned opener/closer (D8) — no backtracking regex; replaces `` /^(`{3,})\s*([^`]*?)\s*$/ ``.
- [ ] 3.2 Delimiter+run-length: backtick/tilde are peers, never close each other; closer run ≥ opener's run of the same char closes (axes 2, 4).
- [ ] 3.3 Indentation: 0–3 space opener legal, content de-indented by opener's indent; 4+ spaces is content, not a fence (axis 5).
- [ ] 3.4 Blockquote (D3): a `>`-prefixed line in TEXT is not a fence delimiter/content; record in `skipped` with reason `blockquote` (axis 6).
- [ ] 3.5 HTML comment (D4): COMMENT state on `<!--`…`-->`; unterminated comment reported via its own `unterminatedComment` field, never through `unterminated` (axis 8).
- [ ] 3.6 List-item nested fence: indented opener under a list bullet declares, content de-indented (axis 7).
- [ ] 3.7 LF/CRLF: `split(/\r?\n/)` + `trimEnd` on the closer line (axis 9).
- [ ] 3.8 Unterminated fence (D5): blocks closed above stand; nothing below is a block; report unconditionally regardless of tag — delete #703's `isGraphFence(unterminated)` attribution branch (axis 10).
- [ ] 3.9 Info string: `tag` keeps its exact present meaning (whole trimmed string, unchanged for `amendment-draft.mjs`/`checkpoint-block.mjs`); add `lang` = first whitespace-delimited word (axes 1, 11, 12).
- [ ] 3.10 `skipped[]` channel: `{ line, tag, lang, reason: 'blockquote'|'indented-code'|'html-comment' }[]`.
- [ ] 3.11 Header comment in `fenced-blocks.mjs` stating the loose-direction closer rule and why REQ-487-5's strictness does not transfer from `yaml-block.mjs` (D2).

## Phase 4: Splitter 14-axis matrix + 5 non-axis obligations (PR 2)

File: `brain/scripts/lib/fenced-blocks.test.mjs`, appended below the 3 existing verbatim cases (do not touch them — see 5.2).

- [ ] 4.1 Axis 1 — tag none/`yaml`/`yml`/`YAML`/foreign/`brain-graph/1`: only exact `brain-graph/1` sets `lang`.
- [ ] 4.2 Axis 2 — delimiter backtick vs `~~~`: both open/close; neither leaks into the other.
- [ ] 4.3 Axis 3 — nesting both directions: inner fence of the other type is content, not a boundary.
- [ ] 4.4 Axis 4 — closer run shorter/equal/longer: shorter = content, equal/longer close.
- [ ] 4.5 Axis 5 — indentation 0/1–3/4+: 0–3 opens/closes; 4+ is content.
- [ ] 4.6 Axis 6 — blockquote nesting: `skipped` reason `blockquote`.
- [ ] 4.7 Axis 7 — list-item nested fence: declares, de-indented content.
- [ ] 4.8 Axis 8 — HTML comment wrapping: `skipped` reason `html-comment`.
- [ ] 4.9 Axis 9 — LF vs CRLF: identical opener/closer/content results.
- [ ] 4.10 Axis 10 — unterminated fence: reported; blocks above stand; nothing below is a block.
- [ ] 4.11 Axis 11 — info-string trailing attributes (`yaml title="x"`): first word only compared.
- [ ] 4.12 Axis 12 — case (`BRAIN-GRAPH/1`, `Brain-Graph/1`): exact-case only, no match.
- [ ] 4.13 Axis 13 — multiplicity, incl. one declared + one yaml-illustrated: illustration does not count toward REQ-639-3 ambiguity.
- [ ] 4.14 Axis 14 — position first/last/only: position never selects.
- [ ] 4.15 Scenario — tilde-nesting attack: `​```yaml`+`protocol: brain-graph/1` nested inside `~~~console…~~~` yields no backtick fence, `parseGraphBlock` returns `null`.
- [ ] 4.16 Scenario — legally indented closer (2-space run) still closes a column-0 opener; content after is not swallowed.
- [ ] 4.17 Non-axis — D14 indent-0 byte-identity: content extraction for an indent-0 opener is byte-for-byte unchanged (load-bearing for `amend-find`'s exact-anchor use).
- [ ] 4.18 Non-axis — `skipped[]` carries the correct reason for each of its 3 values, individually asserted (not just "non-empty").
- [ ] 4.19 Non-axis — `unterminatedComment` never populates `unterminated`, and vice versa.
- [ ] 4.20 **Mutation task**: mutate the D5 unconditional-report path (remove the tag-agnostic reporting, reintroduce `isGraphFence`-style attribution) and confirm the axis-10 test FAILS. #710 finding 4 was this exact axis, unpinned, at 139 pass / 0 fail before this change — a green suite here must be shown to die on this specific mutation, not merely be green.

## Phase 5: Regression net & hard-boundary pin

- [ ] 5.1 Run `amendment-draft.test.mjs`, `checkpoint-block.test.mjs`, `brain-promote.amendment.test.mjs`, `brain-promote.golden.test.mjs`, `review/evaluators/checkpoint.test.mjs`, `review/cli.test.mjs` — all pass, `git diff` on these 6 files is empty. **If not empty: STOP, escalate to the maintainer — do not fix up inside this change (REQ-709-4).**
- [ ] 5.2 Confirm `fenced-blocks.test.mjs`'s 3 original cases (incl. the `` ``` ``-inside-```` `` case at `:29`) are byte-verbatim, only appended to.
- [ ] 5.3 Confirm `brain/scripts/review/lib/yaml-block.mjs`, `parse-verdict.mjs`, `decision-block.mjs`, `vcs/actor-check.mjs` show a **zero-line diff** (`git diff --stat` scoped to these 4 paths, empty) — D11/REQ-709-5. No `fencedBlocks` import added to any of them.
- [ ] 5.4 Confirm `yaml-block.drift.test.mjs` (the boundary sentinel) still passes unedited.

## Phase 6: Dog-fooding hygiene (the tag's half-life starts at merge)

- [ ] 6.1 Audit every illustration of `​```brain-graph/1` written by this change itself (spec.md, design.md, ADR-0032 draft, this tasks.md) — each must render as an inline code span, sit inside a longer outer fence (```` ```` ````), or be 4-space indented, never a bare triple-backtick fence. Fix any that would newly parse as a declaration once Phase 3 lands.

## Phase 7: ADR-0032 promotion — MOVED into Phase 2 (tasks 2.10 / 2.11)

Still human-gated, still not an agent task — only earlier. The promotion cannot follow
the PRs it unblocks: PR 1's code cites ADR-0032 and `adr-citations` refuses an
unresolvable citation. See the ordering correction at the head of Phase 2 for the
measurement and the ADR-0031/PR #672 precedent.

## Phase 8: Verify (pre-archive)

- [ ] 8.1 **[NEEDS A RENDERED PAGE — human eyes, not a shell]** Place a `​```brain-graph/1` block in one real issue body on GitHub and one on GitLab; observe the rendered page; confirm or refute D13's unverified assumption that an unknown info-string still renders as a fenced code block, losing only highlighting. If false, record it as an amendment to ADR-0032 — the decision does not move, the record does.
- [ ] 8.2 Re-run `gh pr view 703` and `gh issue view 709 710` to confirm #703 closed and #709/#710's status, before archiving this change (spec.md's stated gap).
- [ ] 8.3 Full `npm test` once both PRs have merged; zero regressions repo-wide.
- [ ] 8.4 `npm run brain:repo:check` before final archive.

---

**Word budget note**: this artifact exceeds the 530-word skill budget, deliberately and flagged rather than done quietly — same call the design phase made about its own 800-word budget. Collapsing the 14-axis matrix or the human-gated ADR/PR-703 tasks into fewer, vaguer items is exactly the failure `red-proof-blind-along-an-unvaried-axis.md` names, and the one three predecessors (#639→#702, #703→#710) made in this exact file.
