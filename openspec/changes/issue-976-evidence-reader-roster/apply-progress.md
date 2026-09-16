# Apply progress — issue #976

## Mode
Standard (doc-only change: no production code is modified, so the strict-TDD
RED/GREEN/REFACTOR cycle does not apply. The equivalent verification for this
artifact type is the promotion simulation in Phase 3, mirroring the precedent
set by `issue-962-release-gate-deny-reader` and `issue-973-adr-r6-erratum`).

## Completed tasks
- [x] 1.1 Created `openspec/changes/issue-976-evidence-reader-roster/` with `brain-drafts/`
- [x] 1.2 Copied the draft, set `issue: 976`, rewrote the preamble to be true now
- [x] 1.3 Verified `amend-find` is byte-identical to the current target paragraph
- [x] 1.4 Did not touch `openspec/changes/issue-962-release-gate-deny-reader/`
- [x] 2.1 Classified every named reader (file:line, direction, failure behavior)
- [x] 2.2 Checked lane-scrub.mjs / engram.mjs / plainfiles.mjs — different category, correctly excluded
- [x] 2.3 Classification table recorded in `proposal.md` and mirrored below
- [x] 3.1 Wrote throwaway simulation scripts in the scratchpad, importing the real `amendment-draft.mjs`
- [x] 3.2 Confirmed parse ok, edit pending/free:1, applyEdits succeeds, no leftover stale claim, no other line changed
- [x] 3.3 Computed the promotion commit subject via the real `amendmentCommitSubject()`
- [x] 3.4 Recorded simulation table, promote command, commit subject, maintainer checklist (below)
- [x] 4.1 Full suite run recorded (below)
- [x] 4.2 `brain:repo:check` run recorded (below)
- [x] 5.1 Commit(s) recorded (below)
- [x] 5.2 Record-first commit recorded (below)

## Reader classification — every reader the rewritten paragraph names

Verified by reading each file directly on this branch (`docs/issue-976-…`,
fresh off `origin/main`), not assumed from the #962 draft's prior
verification.

| Reader | File:Line | Direction | Failure behavior (verified) | Disposition in this draft |
|---|---|---|---|---|
| `defaultReadDenyActors` | `brain/scripts/approve/cli.mjs:123-125` | DENY | `approvalDenySet(loadBrainConfigOrThrow(root))` — no catch, propagates | Unchanged — already in the fixed-reader list (#942 R1) |
| `defaultReadAgentActors` | `brain/scripts/approve/cli.mjs:138-141` | DENY | `loadBrainConfigOrThrow(root)`, `Array.isArray(...) : []` on the loaded value — no catch on the load itself, propagates a read/parse failure | Unchanged — already listed (#942 R1) |
| `defaultReadDenyActors` | `brain/scripts/vcs/actor-check.mjs:1108-1110` | DENY | `approvalDenySet(loadBrainConfigOrThrow(cwd))` — no catch, propagates | Unchanged — already listed (#942 R1) |
| `defaultReadBotAllowlist` | `brain/scripts/vcs/brain-writes-reviewed.mjs:257-262` | DENY | `loadBrainConfigOrThrow(cwd)` — no catch, propagates | Unchanged — already listed (#942 R1) |
| `defaultReadApprovalActors` | `brain/scripts/vcs/brain-writes-reviewed.mjs:282-287` | DENY | `loadBrainConfigOrThrow(cwd)` — no catch, propagates | Unchanged — already listed (#942 R3) |
| `loadConfig` | `brain/scripts/brain-audit.mjs:159-182`, feeding `botAllowlist` at `:370` | DENY (`governance.reviewActors`) | `function loadConfig(cwd) { return loadBrainConfigOrThrow(cwd); }` — no local catch; the throw reaches the top-level `.catch`, prints `[FAIL] governance:audit-uncomputable`, exits 2 before any merge is evaluated | **MOVED into the fixed list by this draft** — fixed by PR #969 (closed #962); previously "a sixth … reader … still swallows the failure and is tracked in issue #962" |
| `defaultReadBotAllowlist` (approvalActors reader) | `brain/scripts/vcs/actor-check.mjs:1059-1068` | ALLOW | `try { JSON.parse(readFileSync(...)) } catch { return []; }` | Unchanged — stays in the ALLOW-reader list |
| `defaultReadAgentActors` (agentActors reader) | `brain/scripts/vcs/actor-check.mjs:1148-1157` | ALLOW | `try { JSON.parse(readFileSync(...)) } catch { return []; }` | Unchanged — stays in the ALLOW-reader list |
| `ignoreList` consumer | `brain/scripts/brain-audit.mjs:201-203` | ALLOW/exemption | `Array.isArray(config?.governance?.ignoreList) ? config.governance.ignoreList : []` (reached only if `loadConfig` above did not already throw) | Unchanged — stays in the ALLOW-reader list |
| `resolveApprovedLabel` / `main()` | `brain/scripts/governance/approved-label.mjs:19` (`DEFAULT_APPROVED_LABEL` const), `:30-38` (`resolveApprovedLabel`), `:52-62` (`main`, the catch) | **Exemption** — ratified fixed fallback, not a deny/allow list | `main()`: `try { config = loadConfig(); } catch { config = {}; }` (lines 56-59), then `resolveApprovedLabel({}, provider)` computes `base = config?.governance?.approvedLabel \|\| DEFAULT_APPROVED_LABEL` → falls back to `'status:approved'`, never `[]`/`''` | **RECLASSIFIED by this draft** — moved OUT of the ALLOW-reader bullet list into the same Exemption category as `resolveTier` |
| `resolveTier` | `brain/scripts/vcs/governance-tiers.mjs:327-336` | Exemption — ratified fixed fallback `'standard'` | `const raw = config?.governance?.tier; if (raw === undefined \|\| raw === null) return 'standard';` (REQ-TIER-10); an explicit unrecognized value throws (fail-closed, REQ-TIER-1) | Unchanged — the doc's pre-existing Exemption example; this draft edits only the "Applied at" paragraph above it |

### Checked, and deliberately NOT added to the roster

| File | What it reads | Failure behavior (verified) | Why excluded |
|---|---|---|---|
| `brain/scripts/governance/lane-scrub.mjs:171-179` | `governance.memorySecret*` via `readConfig()` | `try { config = readConfig(); } catch (err) { return { verdict: 'uncomputable', reason: 'lane-scrub: cannot read the secret config — failing closed (uncomputable): …' }; }` — explicit, named, fail-closed | Secret-scrub config reader, not an actor deny/allow/exemption list — different reader category the paragraph does not cover |
| `brain/scripts/memory/backends/engram.mjs` | `governance.memorySecret*` via `resolveSecretConfig`/`loadBrainConfigOrThrow` (imported `:65`) | Same secret-config-reader category; not an actor list | Same reasoning |
| `brain/scripts/memory/backends/plainfiles.mjs` | `governance.memorySecret*` via `resolveSecretConfig`/`loadBrainConfigOrThrow` (imported `:24`) | Same secret-config-reader category; not an actor list | Same reasoning |

## Known, unfixed gap (issue #975)

Confirmed OPEN, `status:approved`, on `origin/main` at write time.
`loadBrainConfigOrThrow` (`brain/scripts/lib/brain-config.mjs:77-91`) does
`return JSON.parse(raw);` with no shape check after a successful read — a
`brain.config.json` holding `null`, `[]`, `42`, or a bare string parses
without throwing, and every DENY reader above then degrades via optional
chaining as if the config were empty. PR #969's own description named this
"out of scope" and #975 was opened for it. Neither PR #969 nor this draft
claims it is fixed; the draft's preamble says so explicitly.

## Byte-identical anchor verification

```
$ diff <(python3 -c "print(open('brain/core/anti-patterns/evidence-reader-empty-on-failure.md').read()[…paragraph…])") \
       <(python3 -c "print(open('.../deny-readers-roster-sixth.draft.md').read()[…amend-find block…])")
(no diff — repr() comparison confirmed identical, including em-dash, backticks, and line breaks)
```

## Simulation — promotion proof without promoting

Throwaway script (never committed):
`/tmp/claude-1000/-home-gandalf-IA-brain/71e1249b-9491-4e33-857a-096458f6eeb2/scratchpad/sim-roster-976.mjs`,
importing `parseAmendmentDraft`, `assessEdit`, `applyEdits` directly from the
real `brain/scripts/lib/amendment-draft.mjs`, reading the real draft and the
real target file on disk. `brain:promote` was never invoked.

```
parse: ok
contract: {
  "target": "brain/core/anti-patterns/evidence-reader-empty-on-failure.md",
  "isAdr": false,
  "adrNumber": null,
  "slug": null,
  "amendment": null,
  "issue": "976",
  "homeSummary": null,
  "bodyHeading": null,
  "bodyEndHeading": null
}
edits count: 1
edit 1: {"state":"pending","f":1,"r":0,"k":0,"free":1}
leftover stale claim present ("tracked in issue #962" / "still swallows the failure"): false
OK: draft parses, every edit pending free=1, applyEdits succeeds.
```

Diff of the simulated result against the real target (via a second script,
`diff-check.mjs` + `simulated-result.md`, also throwaway):

```
before length: 5396  after length: 5705
before lines: 99     after lines: 104

90,98c90,103
< [original 9-line "Applied at" paragraph, ending "... and `approved-label.mjs`."]
---
> [replacement 14-line paragraph, ending "... not an empty-list exemption."]
```

Only lines 90-103 differ (the "Applied at" paragraph, which grows from 9 to
14 lines because the replacement is longer). Every other line in the
104-line file — including the "Exemption" paragraph above it and everything
before line 88 — is byte-identical before and after.

## Promote command (for the maintainer — never run by this change)

```
npm run brain:promote -- openspec/changes/issue-976-evidence-reader-roster/brain-drafts/deny-readers-roster-sixth.draft.md
```

## Suggested commit subject (from the real `amendmentCommitSubject()`)

Computed by a throwaway script (`subject-check.mjs`) calling the real
`amendmentCommitSubject({ contract, bodyHeading })` from
`brain/scripts/lib/amendment-draft.mjs` against the parsed draft's contract
(non-ADR target, `issue: 976`, no `body:` heading):

```
docs(brain): amend brain/core/anti-patterns/evidence-reader-empty-on-failure.md (#976)
```

## What the maintainer must check after promoting

1. The promoted file is **byte-identical** to the simulated result above —
   diff the post-promote `evidence-reader-empty-on-failure.md` against
   `/tmp/.../scratchpad/simulated-result.md` (or re-run the simulation
   script against the post-promote tree; it should report `cascadeComplete`
   / every act `done`, not `pending`).
2. The `AGENTS.md` drift test is green (`node --test` on whichever test
   covers `AGENTS.md` regeneration — this change never touches `AGENTS.md`,
   so it should already be green before and after promotion).
3. Full suite green: `GIT_CONFIG_GLOBAL=/dev/null npm test`.
4. `npm run brain:repo:check` clean.
5. The promotion commit itself should NOT be authored by this SDD change —
   `brain:promote` stages and the maintainer commits, per the hard
   constraint that this change never runs `brain:promote`.

## Suite baseline (this change, before any promotion)

| Command | Result |
|---|---|
| `GIT_CONFIG_GLOBAL=/dev/null npm test` | **5361 pass / 0 fail** (0 cancelled, 0 skipped, 0 todo) |
| `npm run brain:repo:check` | `✓ No prohibited references found.` / `✓ Artifact structure is valid.` |

## Files changed by this change

| File | Action | What was done |
|---|---|---|
| `openspec/changes/issue-976-evidence-reader-roster/brain-drafts/deny-readers-roster-sixth.draft.md` | Created | Moved from the #962 folder; `issue:` set to `976`; preamble rewritten to be true now (#962 closed/fixed by PR #969, #975 open/unfixed noted); `amend-find`/`amend-replace` blocks kept byte-identical to the #962 draft (re-verified against the current target). |
| `openspec/changes/issue-976-evidence-reader-roster/proposal.md` | Created | Intent, scope, acceptance criteria, full reader classification table, known-gap note, promote command. |
| `openspec/changes/issue-976-evidence-reader-roster/spec.md` | Created | Delta requirements (WHEN/THEN scenarios) — required by the repo's `lite`-tier artefact gate. |
| `openspec/changes/issue-976-evidence-reader-roster/tasks.md` | Created | Task breakdown, Review Workload Forecast (Low risk, single PR). |
| `openspec/changes/issue-976-evidence-reader-roster/apply-progress.md` | Created | This file. |

No files under `brain/core/**`, `brain/project/**`, `brain/HOME.md`,
`AGENTS.md`, or `openspec/changes/issue-962-release-gate-deny-reader/**`
were modified.

## Deviations from design
None — the task's instructions map directly onto the scope above.

## Issues found
None beyond the doctrine staleness the issue itself flagged (addressed by
moving/updating the draft, per the hard constraint never to promote it).

## Risks
- The draft remains UNAPPLIED. `evidence-reader-empty-on-failure.md`'s
  roster paragraph reads as stale until a human runs `brain:promote` on it —
  deliberate, per the hard constraint never to run `brain:promote` or edit
  `brain/core/**` directly.
- Issue #975's gap (non-object config shape) is unrelated and unfixed;
  anyone reading this paragraph in isolation should not assume it covers
  that case.

## Remaining tasks
None. All tasks in `tasks.md` complete.

## Status
All tasks complete. Commits: `ea8c9cdc` (SDD docs + moved/updated draft),
`3c74332a` (record this file's own SHA), `26c47e9` (record-first commit,
record `rec-8573584eb01dc8bf`). Ready for `sdd-verify`.
