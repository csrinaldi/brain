# Issue #976 — the evidence-reader doctrine names brain-audit as fixed and approved-label as an exemption (#962 follow-up)

## Status
Applied (see `apply-progress.md`).

## Intent

`brain/core/anti-patterns/evidence-reader-empty-on-failure.md`'s "Applied at"
paragraph is stale on two counts:

1. It still says a sixth DENY-direction reader, `brain-audit.mjs`'s
   `loadConfig`, "still swallows the failure and is tracked in issue #962."
   PR #969 fixed that reader (it now delegates to `loadBrainConfigOrThrow`,
   propagating a read/parse failure instead of swallowing it to `{}`) and
   merged, closing #962. The paragraph describes a defect that no longer
   exists.
2. It lists `approved-label.mjs` among the ALLOW-direction readers "left
   unchanged, deliberately, because empty is already the strict answer for
   them." But `governance.approvedLabel` is a single string, not a list, and
   `approved-label.mjs`'s `main()` degrades a config-read failure to the
   ratified constant `DEFAULT_APPROVED_LABEL = 'status:approved'`, never to
   `[]`/`''`. That is the fixed-fallback "Exemption" shape the doc already
   carves out for `governance-tiers.mjs`'s `resolveTier`, not an ALLOW-list
   reader.

The fix already exists as a draft on `main`:
`openspec/changes/issue-962-release-gate-deny-reader/brain-drafts/deny-readers-roster-sixth.draft.md`.
Its contract says `issue: 962`, which is now CLOSED — the issue-link gate
needs an open, approved issue — so the draft is copied under #976 (opened for
exactly this promotion) rather than being re-targeted at a closed issue.

## Scope

- Create this change folder (`openspec/changes/issue-976-evidence-reader-roster/`)
  carrying the copied draft, with `issue: 976` in its contract and a preamble
  that is true as of this branch (off `origin/main`, 2026-09-16): #962 closed,
  PR #969 merged and fixed `brain-audit.mjs`, and the known gap #975 tracks
  (a non-object config shape still degrading DENY readers) is noted as OPEN
  and NOT fixed by this paragraph.
- Verify every reader the rewritten paragraph names against source, with
  file:line, before trusting the draft's claims — see "Reader classification"
  below.
- No agent edits `brain/core/**`, `brain/project/**`, `brain/HOME.md`, or
  `AGENTS.md` (hard constraint): the apply batch produced a draft and nothing
  else. The maintainer then ran `brain:promote` on this branch, and that
  promotion is commit `4310d1b1` in this PR.
- No edits to the `openspec/changes/issue-962-release-gate-deny-reader/`
  folder — its draft stays as a historical record of what #962's own apply
  batch produced; this change does not touch it. After this promotion lands,
  that copy still reads "Not yet promoted" and its own promote command would
  refuse (`assessEdit` reports `done`, `free: 0`, because the anchor no longer
  occurs), which is the intended end state for a historical draft.

Out of scope: fixing the non-object-config-shape gap (#975) — that is a
separate, still-open issue and this paragraph does not claim it is fixed.

## Acceptance criteria (copied from issue #976)

- The "Applied at" paragraph names `brain-audit.mjs` as a fixed DENY reader,
  not as tracked, and classes `approved-label.mjs` as a fixed-fallback
  exemption.
- Every reader the paragraph names exists at the cited location on `main`,
  with the stated direction.
- Full suite green, and `AGENTS.md` unchanged or byte-equal per the drift
  test.

## Reader classification — every reader the rewritten paragraph names

Verified by reading each file directly on this branch (fresh off
`origin/main`), not assumed from the #962 draft's prior verification.

| Reader | File:Line | Direction | Failure behavior | Disposition in this draft |
|---|---|---|---|---|
| `defaultReadDenyActors` | `brain/scripts/approve/cli.mjs:123-125` | DENY | `approvalDenySet(loadBrainConfigOrThrow(root))` — no catch, propagates | Unchanged — already in the fixed-reader list (#942 R1) |
| `defaultReadAgentActors` | `brain/scripts/approve/cli.mjs:138-141` | DENY | `loadBrainConfigOrThrow(root)` — no catch, propagates | Unchanged — already listed (#942 R1) |
| `defaultReadDenyActors` | `brain/scripts/vcs/actor-check.mjs:1108-1110` | DENY | `approvalDenySet(loadBrainConfigOrThrow(cwd))` — no catch, propagates | Unchanged — already listed (#942 R1) |
| `defaultReadBotAllowlist` | `brain/scripts/vcs/brain-writes-reviewed.mjs:257-262` | DENY | `loadBrainConfigOrThrow(cwd)` — no catch, propagates | Unchanged — already listed (#942 R1) |
| `defaultReadApprovalActors` | `brain/scripts/vcs/brain-writes-reviewed.mjs:282-287` | DENY | `loadBrainConfigOrThrow(cwd)` — no catch, propagates | Unchanged — already listed (#942 R3) |
| `loadConfig` | `brain/scripts/brain-audit.mjs:159-182`, feeding `botAllowlist` at `:370` | DENY (`governance.reviewActors`) | Delegates to `loadBrainConfigOrThrow(cwd)`; no local catch — throw reaches the top-level `.catch`, exits 2 before any merge is evaluated | **MOVED into the fixed list by this draft** — fixed by PR #969 (#962), previously the "sixth reader … tracked in #962" |
| `defaultReadBotAllowlist` (approvalActors reader) | `brain/scripts/vcs/actor-check.mjs:1059-1068` | ALLOW | `try { JSON.parse(...) } catch { return []; }` | Unchanged — stays in the ALLOW-reader list |
| `defaultReadAgentActors` (agentActors reader) | `brain/scripts/vcs/actor-check.mjs:1148-1157` | ALLOW | `try { JSON.parse(...) } catch { return []; }` | Unchanged — stays in the ALLOW-reader list |
| `ignoreList` consumer | `brain/scripts/brain-audit.mjs:201-203` | ALLOW/exemption | `Array.isArray(config?.governance?.ignoreList) ? … : []` | Unchanged — stays in the ALLOW-reader list |
| `resolveApprovedLabel` / `main()` | `brain/scripts/governance/approved-label.mjs:19` (constant), `:30-38` (resolver), `:52-62` (`main`, catch) | **Exemption** — ratified fixed fallback, not a deny/allow list | `main()` catches a config-read failure, sets `config = {}`; `resolveApprovedLabel({}, provider)` then falls back to `DEFAULT_APPROVED_LABEL = 'status:approved'` — never `[]`/`''` | **RECLASSIFIED by this draft** — moved OUT of the ALLOW-reader bullet list into the same Exemption category as `resolveTier` |
| `resolveTier` | `brain/scripts/vcs/governance-tiers.mjs:327-336` | Exemption — ratified fixed fallback `'standard'` | Absent `governance.tier` → `'standard'` (REQ-TIER-10); an explicit unrecognized value throws (fail-closed) | Unchanged — this is the doc's pre-existing Exemption example; this draft edits only the "Applied at" paragraph above it |

### Checked, and deliberately NOT added to the roster

Three more `brain.config.json` readers were checked because the task asked
for them explicitly. All three read `governance.memorySecret*` keys (secret
patterns for the memory scanner), not an actor deny/allow/exemption list —
a different reader category the doc's "Applied at" paragraph does not cover:

| File | What it reads | Failure behavior |
|---|---|---|
| `brain/scripts/governance/lane-scrub.mjs:171-182` | `governance.memorySecret*` via `readConfig()` | `try { config = readConfig(); } catch (err) { … }` builds `{ pass: false, uncomputable: true, reason: 'lane-scrub: cannot read the secret config — failing closed (uncomputable): …' }`, logs the reason and returns `resultToExit(result)` — explicit, named, fail-closed |
| `brain/scripts/memory/backends/engram.mjs` (secret-scrub config reader) | same keys | Same category — not an actor list |
| `brain/scripts/memory/backends/plainfiles.mjs` (secret-scrub config reader) | same keys | Same category — not an actor list |

No change to the paragraph is warranted for these three — they are out of
scope for the DENY/ALLOW/Exemption roster this paragraph documents.

## Known, unfixed gap (issue #975 — not claimed as fixed here)

`loadBrainConfigOrThrow` (`brain/scripts/lib/brain-config.mjs:77-91`) accepts
JSON that parses but is not a plain object (`null`, `[]`, `42`, a bare
string) and returns it as-is; every DENY reader above then reads through
optional chaining and degrades as if the config were empty on that shape —
the #942 class, reached through a shape gap rather than a read/parse error.
Issue #975 (OPEN, `status:approved`) tracks this; it is NOT fixed by PR #969
or by this draft. The draft's preamble notes this explicitly so a future
reader does not assume the roster paragraph covers it.

## Promotion (run by the maintainer, `4310d1b1`)

```
npm run brain:promote -- openspec/changes/issue-976-evidence-reader-roster/brain-drafts/deny-readers-roster-sixth.draft.md
```

Proven to parse and assess as `pending`, `free: 1` against the real target
file with a throwaway script that imports the real
`brain/scripts/lib/amendment-draft.mjs` (see `apply-progress.md` for the
run and the simulated-result diff). No agent invoked `brain:promote`: the
maintainer ran the command above on this branch after a pre-promotion
adversarial review verdicted PROMOTE-READY, and the promoted file is
byte-identical to the simulated result.
