# Tasks — The Antigravity Harness Adapter (Track B / B2, Half 1)

> Half 1 ONLY: `antigravity.mjs#init()` (the compiler) + the generated `AGENTS.md` + the drift-guard +
> `managed-paths.mjs` + the `governance.ignoreList` classification + the baptism RUNBOOK doc. Half 2 (the
> `#247` baptism itself — REQ-B2-5) is downstream, human-operated, Antigravity-alone, and NOT executed by
> this checklist — this checklist's only Half-2 deliverable is the runbook document that prepares it.
> Strict TDD (RED → GREEN) for every code task, mirroring the `gentle-ai.mjs`/`plain.mjs` seam convention.
> Docs English (ADR-0009). Binding decisions: [[sdd/issue-256-b2/constraints]] (#601, owner ruling — AGENTS.md
> IS classified in `governance.ignoreList`, doctrine extended, Pin 1–4) and
> [[sdd/issue-256-b2/measurements]] (#604, Antigravity CLI 1.1.1 · Gemini 3.5 Flash (Medium) · host `gandalf`).
> Acceptance = CP-B2 (stop-and-declare for the orchestrator; do not begin the baptism).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated counted lines | ~150–205 (`antigravity.mjs` ~140–190 + `managed-paths.mjs` ~1 + `brain.config.json` ignoreList entry ~1 + `diff-size-count.mjs` doctrine-comment extension ~5–10; `AGENTS.md` is now BUDGET-FREE per the #601 classification, tests are free per the existing `**/*.test.mjs` ignoreList entry, the runbook doc is free per the existing `openspec/changes/**` ignoreList entry) |
| Budget ceiling | 400 |
| 400-line budget risk | **LOW** — post-classification. (Design's own pre-classification forecast was Medium-High with `AGENTS.md` counted at ~130–180; #601 removed that swing factor by ruling AGENTS.md into `governance.ignoreList` as a LITERAL, decided on the B1 principle, not on B2's budget.) |
| Decision needed before apply | **No** — the one open decision (AGENTS.md classification) is already closed by #601; nothing left for apply to escalate. |
| Chained PRs recommended | **No** — the emitter, its generated `AGENTS.md`, and the byte-equality drift-guard are one coherent unit; the drift-guard requires both present, splitting them is incoherent (design's own verdict, unchanged by #601). |
| Delivery | Single PR into `feature/v2.0.0`, `Part of #256`, no `size:exception` expected. |

Verdict: proceed as a single PR. Confirm the actual counted total during apply (task 7.2) against this
~150–205 estimate; if it drifts materially, the honest move is a labeled `size:exception` on the emitter
itself (never on `AGENTS.md`, which stays classified), not an artificial split.

## Phase 1: `compileAgentsMd()` — the pure compiler + `SOURCE_DOCS` (RED → GREEN)
> REQ-B2-2. Fs-free by design — the same function is exercised by the unit test AND the Phase 3 drift-guard.

- [x] 1.1 Test (RED): `antigravity.test.mjs` — inject a fake `docs` map (5 fake source strings keyed by the
      canonical relative paths) into `compileAgentsMd(docs)`; assert it returns a string containing: a
      `generated from <paths> — do not edit` provenance banner naming all 5 `SOURCE_DOCS` paths; the
      injected `agent-authorities.md` fake content reproduced VERBATIM (byte-for-byte substring — this is
      the seam the real Tier-1/2/3 table travels through unmodified); and content traceable to each of the
      other 4 fakes (HOME.md nav, harness-contract.md verb table, sdd-layout.md, workflow-governance.md gate
      list). Fails because `antigravity.mjs` does not exist yet.
- [x] 1.2 GREEN: create `brain/scripts/harness/backends/antigravity.mjs` exporting `SOURCE_DOCS` (the frozen
      5-path array, design §"`init()` shape" exact list and order), `AGENTS_EMIT_PATH = 'AGENTS.md'`, and
      the pure `compileAgentsMd(docs)` implementing: provenance banner first, then the sections in
      `SOURCE_DOCS` order, with `agent-authorities.md`'s content spliced in UNMODIFIED (no re-summarization —
      REQ-B2-2 binds the Tier table to be verbatim, not the whole file necessarily, but treat the whole
      injected fake/real content as the verbatim unit unless the doc itself needs light section-scoping —
      apply-time judgment, see Open Items).
- [x] 1.3 Test (RED) + GREEN: assert `SOURCE_DOCS` is a frozen array of exactly the 5 paths in the design's
      exact order (`brain/HOME.md`, `brain/core/methodology/agent-authorities.md`,
      `brain/core/methodology/harness-contract.md`, `brain/core/methodology/sdd-layout.md`,
      `brain/core/methodology/workflow-governance.md`) and `AGENTS_EMIT_PATH === 'AGENTS.md'`.
- [x] 1.4 Test (RED) + GREEN: `compileAgentsMd` is deterministic — calling it twice with the same `docs` map
      produces byte-identical output (required by Phase 3's regenerate-and-diff drift-guard; a
      non-deterministic compiler would make that guard flaky by construction).

## Phase 2: `antigravity.mjs#init()` — the seam-injected wrapper, dispatchable (RED → GREEN)
> REQ-B2-1, REQ-B2-2. Zero `cli.mjs` change — `plain.mjs`/`gentle-ai.mjs` are the n=2 precedent this extends
> to n=3.

- [x] 2.1 Test (RED): inject a fake `_readDoc(relPath)` returning canned content per path and a capturing
      fake `_writeAgents(relPath, content)`; call `init({ _readDoc, _writeAgents, _repoRoot })`; assert
      `_writeAgents` was called exactly once with `relPath === AGENTS_EMIT_PATH` and `content` equal to
      `compileAgentsMd()`'s output over the same 5 fake docs (same-shape call as `SOURCE_DOCS`, in order).
- [x] 2.2 GREEN: implement `async function init({ _readDoc = _defaultReadDoc, _writeAgents =
      _defaultWriteAgents, _repoRoot = repoRoot } = {})` per design's exact shape: read all 5 `SOURCE_DOCS`
      via `_readDoc`, call `compileAgentsMd`, write via `_writeAgents`. `_defaultReadDoc`/`_defaultWriteAgents`
      use real `readFileSync`/`writeFileSync` resolved against `_repoRoot`.
- [x] 2.3 Test (RED) + GREEN: `init()` NEVER throws — inject a `_readDoc` that throws on one path and a
      `_writeAgents` that throws; assert `init()` resolves (does not reject) in both cases and emits a
      `console.warn` (matching the `gentle-ai.mjs` Step-1..4 guard idiom — capture/restore `console.warn`
      around the call).
- [x] 2.4 Test (RED) + GREEN — end-to-end dispatch: call the REAL `dispatch('antigravity', 'init', [])` from
      the UNMODIFIED `harness/cli.mjs` (real `defaultBackendLoader`, no fake) and assert it resolves without
      throwing — proves `resolveHarness` → `defaultBackendLoader('antigravity')` →
      `VALID_OPS.includes('init')` → `backend.init()` all work with ZERO `cli.mjs` change (REQ-B2-1 scenario
      1). Run this test against a scratch/temp repo root or accept it writes the real `AGENTS.md` here IF
      Phase 3 has not yet produced the committed file — sequence with Phase 3 so this assertion and the
      committed artifact do not race (apply-time judgment: either inject `_repoRoot`/`_writeAgents` to a
      temp target for this specific test, or let it be the actual generation call folded into Phase 3.1).
- [x] 2.5 Test (RED) + GREEN — confirm n=3 (REQ-B2-1 scenario 2): a short assertion/comment that
      `SDD_HARNESS=antigravity`, `SDD_HARNESS=plain`, and `SDD_HARNESS=gentle-ai` are now all real,
      dispatchable `init` inhabitants resolving through the same `cli.mjs` dispatch path — mirror
      `plain.test.mjs` 3.4's `n=2` assertion, extended to 3.

## Phase 3: generate the real `AGENTS.md` + the drift-guard (RED → GREEN)
> REQ-B2-2. The drift-guard IS the chain-guard the #601 classification depends on — it must exist and pass
> before Phase 4's ignoreList change is defensible.

- [x] 3.1 Run `SDD_HARNESS=antigravity node brain/scripts/harness/cli.mjs init` (or the real `init()` call
      with real seams) against the ACTUAL repo root to generate and commit `AGENTS.md` at repo root from the
      5 real `SOURCE_DOCS`. Manually verify: the provenance banner names all 5 real paths; the
      `agent-authorities.md` Tier-1/2/3 table appears verbatim; the harness-contract verb table,
      `sdd-layout.md` layout summary, and `workflow-governance.md` gate list (with skip labels) are all
      present and attributable to their source.
- [x] 3.2 Test (RED): `antigravity.drift.test.mjs` — reads the 5 REAL `SOURCE_DOCS` from disk, calls
      `compileAgentsMd()`, and asserts the result is BYTE-EQUAL to the committed `AGENTS.md` on disk. Before
      3.1 lands, this fails (file absent or mismatched) — confirms the guard actually engages.
- [x] 3.3 GREEN: after 3.1's commit, re-run 3.2 — must pass (byte-equality holds by construction, since 3.1
      generated the file via the same compiler).
- [x] 3.4 Test (RED → GREEN) — hand-edit regression proof: in the test file (not a separate throwaway),
      demonstrate the guard's teeth once by asserting that a MUTATED copy of the committed content (e.g.
      committed content + one appended character) is NOT byte-equal to a fresh `compileAgentsMd()` call —
      i.e. confirm the comparison mechanism actually distinguishes drifted from non-drifted before trusting
      it against the real file (mirrors B0 Phase 2's "prove the guard can catch a rival before trusting it"
      pattern). Do not actually hand-edit the committed `AGENTS.md` to prove this — simulate via a string
      copy.

## Phase 4: `governance.ignoreList` classification — the literal + the extended doctrine line (#601)
> Owner ruling #601 (binding, not reopened here — implementation only). Pin 1 (literal, not glob), Pin 2
> (doctrine line extending B1's), Pin 3 (visible in the PR with rationale).

- [x] 4.1 Edit `brain.config.json`: add the literal `"AGENTS.md"` to `governance.ignoreList` (root file, NOT
      a glob — narrower than B1's `**/*.golden.json`, correct for a single named artifact per #601 Pin 1).
- [x] 4.2 Edit `brain/scripts/vcs/diff-size-count.mjs`'s header doctrine comment (beside the existing B1
      `**/*.golden.json` doctrine block) to commit the EXTENDED line verbatim (#601 Pin 2): "a GENERATED
      operational artifact whose DERIVATION CHAIN is guarded (reviewed generator + reviewed/promoted sources
      + drift-guard byte-equality) = the review surface is the CHAIN, not the emitted file." Name the chain
      concretely for `AGENTS.md`: generator = `antigravity.mjs`/`compileAgentsMd` (reviewed in this PR),
      sources = the 5 canonical `brain/` docs (reviewed/promoted, pre-existing), drift-guard =
      `antigravity.drift.test.mjs` (Phase 3, this PR).
- [x] 4.3 Test (RED) + GREEN: extend `governance-ignorelist.test.mjs` with an assertion that
      `governance.ignoreList` includes the exact literal `'AGENTS.md'` (same house drift-guard convention
      already used there for the 3 lockfile globs) — gives the classification decision teeth against future
      accidental removal.
- [x] 4.4 Confirm (no code change — a verification note in this file or the commit message): #601's
      classification is NOT part of `config-migrations.mjs`'s `0.4.0` default (that ships to every brain
      consumer); `AGENTS.md` is hand-added directly to THIS repo's own `brain.config.json`, same pattern B1
      used for `**/*.golden.json` — general POLICY documented via the doctrine comment, not a shipped
      migration default. Do not add it to `config-migrations.mjs`.

## Phase 5: `managed-paths.mjs` — the emitted-artifact literal (RED → GREEN)
> REQ-B2-4.

- [x] 5.1 Test (RED) + GREEN: extend `managed-paths.test.mjs` with `managed.includes('AGENTS.md')` (exact
      literal, mirroring the `.github/workflows/governance.yml` style assertions already in that file).
- [x] 5.2 Edit `brain/core/managed-paths.mjs`: add `'AGENTS.md'` to the `managed[]` array with the comment
      from design's exact text (generated Antigravity/AGENTS-standard context, issue #256 B2, literal —
      repo root, outside every existing glob, regenerated by `antigravity.mjs#init`, `brain:upgrade` ships it
      because its sources under `brain/core/**` are already managed).
- [x] 5.3 Confirm (no code change — verification note): re-read `managed-paths.test.mjs` in full; it contains
      NO assertion requiring backend files (`brain/scripts/harness/backends/*.mjs`) to be listed as explicit
      literals — every backend file is reachable via the existing `brain/scripts/**` glob (confirmed against
      the `home-index.mjs` REQ-7 precedent test in the same file, which asserts glob-coverage via
      `matchesAny`, not literal inclusion). This closes design's open question — `antigravity.mjs` needs NO
      new literal.

## Phase 6: the baptism runbook — Fork A permissions + hygiene rules (deliverable doc only)
> REQ-B2-3, REQ-B2-6. This phase writes a DOCUMENT. It does NOT execute the baptism — Half 2 (`#247`) is
> downstream, human-operated, Antigravity-alone (REQ-B2-5), out of scope for this checklist beyond this doc.

- [x] 6.1 Write `openspec/changes/issue-256-b2/runbook-baptism.md` (budget-free under `openspec/changes/**`)
      documenting, per REQ-B2-6: the pre-declared circuit permission set (`npm test`, `git commit`, `git
      push`, `gh pr create`) via Antigravity `settings.json`, using design's Fork A proposed shape
      (`tools.allowed` entries), EXPLICITLY FLAGGED "TO-VERIFY against real Antigravity at runbook time —
      Gemini-CLI inheritance is PARTIAL (#601/#604), this is the proposed shape, not confirmed live"; the
      exact rollback steps (record pre-existing `settings.json` or its absence; after `#247` merges, remove
      exactly the 4 added allow-entries, or restore the saved copy / delete the file if absent; nothing else
      touched).
- [x] 6.2 In the same runbook, document the two measured hygiene rules (REQ-B2-6 scenarios, #604 Exp 2/3):
      (a) verify every slash-command with `/help` before use — the namespace is shared with plugins and
      matching is LAX (measured: `/memory show` mis-resolved to a chrome-devtools plugin skill); (b) there is
      no native `/memory show|reload` in Antigravity CLI 1.1.1 — the sentinel-prompt-in-a-fresh-session is
      the ONLY context-inspection instrument to use during the baptism.
- [x] 6.3 In the same runbook, document the REQ-B2-3 composition statement as MEASURED fact, host-scoped: on
      host `gandalf` (Antigravity CLI 1.1.1, #604 Exp 4), Antigravity reads `AGENTS.md` + any repo-local
      `GEMINI.md` and composes them with host-level globals (`~/.gemini/GEMINI.md`, engram MCP,
      chrome-devtools plugin) — explicitly stated as a property of THIS pre-configured host, never presented
      as a factory-default Antigravity guarantee. Cross-reference this same caveat in `AGENTS.md`'s own
      preamble (Phase 3's compiled banner area) OR here in the runbook — pick ONE canonical location and
      have the other point to it (apply-time judgment, see Open Items).
- [x] 6.4 In the same runbook, state REQ-B2-5's acceptance bar for the (not-yet-executed) baptism: `#247`
      MUST complete through Antigravity alone, human operator, Claude Code non-implementing; a governance
      gate blocking Antigravity is a STOP-finding to report, never a gate weakened to pass. This is guidance
      for Half 2 — no gate file is touched by this PR.

## Phase 7: gate baseline + CP-B2 (stop-and-declare)
> Spec Gate. Includes the ONE inaugural human/reviewer full read of `AGENTS.md` (#601 Pin 4).

- [ ] 7.1 `npm test` green (0 failures, including every new `*.test.mjs` from Phases 1–5) · `brain:repo:check`
      · `brain:nav` · `brain:change:verify` — no new `brain:audit` failure introduced by this slice (spec
      Gate).
- [ ] 7.2 Budget check: sum the counted lines actually added (`parseDiffNumstat` + the real, post-4.1
      `ignoreList`) across `antigravity.mjs`, `managed-paths.mjs`, `brain.config.json`, and the
      `diff-size-count.mjs` doctrine-comment extension — confirm the total lands near the ~150–205 estimate
      and stays under 400 (`AGENTS.md`, all `*.test.mjs`, and `openspec/changes/**` are free). If it exceeds
      400, apply a labeled `size:exception` on the counted files ("bulk is the reviewed emitter + its
      reviewed chain-guard scaffolding"), per the design's Open Questions guard — do NOT motivate widening
      `AGENTS.md`'s own classification any further to fix a budget overrun (that would be self-serving
      gate-weakening, explicitly warned against in design's Open Questions).
- [ ] 7.3 **CP-B2 inaugural read (#601 Pin 4 — binding, not optional):** ONE full human/reviewer read of the
      generated `AGENTS.md` end-to-end before the PR is approved — a one-time debut act. State explicitly in
      the CP-B2 declaration that this read happened, by whom, and that it found no drift from the 5 source
      docs (or names what it found). The drift-guard (Phase 3) covers all FUTURE regenerations; it does not
      substitute for this one inaugural read of the FIRST emitted file.
- [ ] 7.4 `memory:share` before push, per house convention.
- [ ] 7.5 **STOP at CP-B2** — declare the full Half-1 package for the orchestrator: `antigravity.mjs` +
      `compileAgentsMd` + `SOURCE_DOCS`, the generated `AGENTS.md`, the drift-guard, the `governance.ignoreList`
      classification + extended doctrine line, the `managed-paths.mjs` literal, the baptism runbook doc, gate
      green, and the inaugural-read confirmation (7.3). Do NOT begin Half 2 (the `#247` baptism itself) — that
      is downstream, human-operated, Antigravity-alone, tracked separately.

## Open items where spec/design left a choice for apply time

- **Verbatim scoping granularity** (task 1.2): REQ-B2-2 binds the `agent-authorities.md` Tier-1/2/3 TABLE to
  be verbatim; design's fixture-level test (1.1) treats the whole injected doc content as the verbatim unit.
  Whether the real compiler splices the ENTIRE `agent-authorities.md` file or just the tier-table section is
  left to apply-time judgment — either satisfies REQ-B2-2's scenario as long as the table text itself is
  reproduced unmodified.
- **Phase 2.4 sequencing** (real dispatch test vs. the real generation call in Phase 3.1): design does not
  pin whether the end-to-end dispatch test target the real repo root (folding into Phase 3's generation) or
  a scratch/temp root (kept separate) — left to apply-time judgment; either satisfies REQ-B2-1 scenario 1 as
  long as `cli.mjs` stays unmodified and the assertion is against the REAL dispatch path.
- **Composition-caveat canonical location** (task 6.3): whether the REQ-B2-3 host-scoped composition caveat
  lives in `AGENTS.md`'s own compiled preamble, the runbook, or both with one canonical — left to apply-time
  judgment.
- **Half 2 `settings.json` exact shape/location** (Fork A, task 6.1): explicitly NOT resolved here — flagged
  TO-VERIFY against real Antigravity at runbook/baptism time, per design and #604's partial-Gemini-CLI-
  inheritance caveat.
- **Exp 5 (`@path` memport in Antigravity)** — cheap, pending, non-blocking human experiment; does not gate
  any task above (COMPILE was already decided by portability, not by Exp 5's outcome).

## Out of scope

- **Half 2 — the `#247` baptism itself** (REQ-B2-5): downstream, human-operated, Antigravity-alone, Claude
  Code non-implementing. Not executed by this checklist; only the runbook (Phase 6) prepares it.
- **B3** — deferred, no speculative third adapter.
- **Any governance gate change for Antigravity** — a gate blocking Antigravity during Half 2 is a STOP-finding
  to report, never a workaround, and never touched by this PR.
- **`CLAUDE.md` unification** — an F2 follow-up. This slice emits `AGENTS.md` only.
- **F2's general cross-agent generator** (`brain:context:build`) — this emitter stays Antigravity-scoped and
  minimal by construction.
- **`VALID_OPS` expansion / any `cli.mjs` change** — the dispatcher stays single-op (`init`); this slice adds
  a backend, not an op.
- **Promoting `AGENTS.md`'s classification into `config-migrations.mjs`'s shipped defaults** — #601's ruling
  is this-repo-local policy (same as B1's `**/*.golden.json`), not a brain-wide migration default.
