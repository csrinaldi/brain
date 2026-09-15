# Explore: #961 — rename the seven managed memory:* scripts to brain:memory:*

Base: `origin/main` @ `29b2702d`, worktree `/home/gandalf/IA/brain-script-prefix`, branch `refactor/managed-memory-scripts-brain-prefix`.

## 1. Live references to the seven names (excluding `.memory/records/**` and `openspec/changes/archive/**`)

Exact word-bounded matches for `memory:save|index|share|pull|resolve-index|audit|ship`: **349** outside records and archive, plus **409** in `openspec/changes/archive/**`. Of the 349, **72 are literal `npm run memory:X` invocations**. Most of the rest are copy-paste command names in tables or backticks, treated as command references. True concept prose, such as `brain/core/config-migrations.mjs:69` ("fail-closed memory:share secret scanner (issue #214)"), names the feature rather than instructing a run.

By category:
- `brain/core/**` doctrine: 8 `.md` files plus `brain/core/config-migrations.mjs:69` (prose, `.mjs`) = **28 refs**. `anti-patterns/README.md:22`, `methodology/agent-authorities.md:22`, `methodology/consolidation-protocol.md:190,191,192,194,197,200,202`, `methodology/harness-contract.md:32-36`, `methodology/memory-format.md:234,247,256,260,340`, `methodology/memory-backend-contract.md:45,46,63,82,97,98,154`, `methodology/feature-working-memory-contract.md:145`.
- `brain/project/**` ADRs: 5 `.md` plus `brain/project/check-refs-rules.mjs:81` (comment, `.mjs`) = **25 refs**. `adr-0002-memoria-git-based-dos-capas.md:28,30,31,32,51,83,86`, `adr-0017-memory-format-owned-by-brain.md:186,187,212,330,391,450`, `adr-0034-memory-travels-on-its-own-lane.md:9,12,91,136,143,159,167,184,207`, `adr-0011…:37`, `adr-0014…:65`.
- `brain/scripts/**` production (excluding tests): **47 refs** across 20 files, notably `brain-save.mjs:33`, `bootstrap.sh:334`, `hooks/pre-push` (3 lines), `hooks/post-merge:57`, `memory/cli.mjs` (8), `memory/backends/engram.mjs` (5), `memory/lib/{audit,audit-io,secret-scrub,backend-selection,duplicates,format,upstream-records}.mjs`, `harness/backends/plain.mjs:18`, `vcs/contributor-scaffold.mjs`, `i18n/en.mjs` (7), `i18n/es.mjs` (7).
- `brain/scripts/**` tests: **48 refs** in 18 files, e.g. `memory/cli.audit.test.mjs` (7), `vcs/contributor-scaffold.test.mjs` (6), `memory/cli.ship.test.mjs` (5), `brain-save.test.mjs` (4), `memory/capture-reachable.test.mjs` (4), `hooks/pre-push.test.mjs` (1), `i18n/coverage.test.mjs` (2).
- User-visible CLI strings (subset of the above): `brain/scripts/i18n/en.mjs:76,103,201,203,294,452,470` and the `es.mjs` mirror build `{pm} run <key>` or say "Do NOT run memory:save again" / "npm run memory:reindex". These must change verbatim.
- `docs/**`: **10 refs**: `docs/workflow-guide.md:86`, `docs/methodology-map/index.html:825,863,867,1026`, `docs/inbox/AGENT-PRIORITY-HANDOFF.md:71`, `docs/inbox/memory-audit-handoff-2026-09-10.md:69,183,199`, `docs/inbox/workflow-governance-layer.md:184`. `docs/inbox/**` is ungoverned per the #922 tripwire's own exclusion.
- `openspec/specs/**`: **16 refs**: `governance/spec.md:687,691,695,701,831`, `feature-working-memory/spec.md:53,58,64,169,177,184,185`, `governance-v3/spec.md:988,1014,1020,1027`.
- `README.md:193,194`; `CHANGELOG.md:523,525,532` (a log of what shipped under the old name; arguably left as is).
- `AGENTS.md:61,131,227,228,229,230,231`: all compiled output, never hand-edited (see §5).
- `.github/PULL_REQUEST_TEMPLATE.md:135` (`memory:save --issue N`) is a real reference. `.github/workflows/governance.yml:133` (`memory:index-lag`) is a **false positive**: a CI step label for `brain/scripts/memory/index-lag.mjs`, run with `node`. A naive replace would corrupt it.
- `.claude/settings.json`, `.gemini/**`: **0 refs**; both hooks already call `brain:session:start` and `brain:memory:session-end`.
- `package.json:65-74`: the seven script-key definitions themselves, the rename target.
- **Not in the issue's table**: `openspec/changes/**` outside `archive/`: **155 refs** across about 35 shipped-but-unarchived change folders (e.g. `issue-641-memory-verbs-reach-a-working-backend/proposal.md` has 8). Sampled ones have `tasks.md` fully checked: completed, unarchived history with the same "true when written" character as the archive. The issue's rule exempts only `archive/**`; a gap for the proposal.

**Precision hazard**: `brain:memory:ship` already appears as prose in `adr-0002-memoria-git-based-dos-capas.md:31,86` and `adr-0034-memory-travels-on-its-own-lane.md:136,143`, naming a future lane-trigger concept. A blind `memory:ship` → `brain:memory:ship` substitution would double-prefix those to `brain:brain:memory:ship`. None of the other six names has this collision.

## 2. The four unmanaged repo-only scripts

`memory:reindex`, `memory:split-records`, `memory:collect`, `memory:migrate-v1`: **112 refs** excluding records and archive. Doctrine pairs them with the managed ones in single clauses: `brain/core/methodology/memory-format.md:256,260` ("`memory:reindex` / `memory:share` MUST NOT produce whole-file churn"); `adr-0017…:186,187,212,330` has the same pairing. `package.json:69,72,73,75`. Tests are heavy: `memory/cli.collect.test.mjs` (14), `cli.reindex-duplicates.test.mjs` (4), `duplicates.i18n.test.mjs` (3), `i18n/en.mjs` and `es.mjs` (3 each). Renaming only the seven leaves visibly mixed-prefix sentences — evidence toward renaming all eleven.

## 3. Existing bare-alias mechanics

Each existing alias is a **byte-identical duplicate command string**, not `npm run brain:...`. `package.json:33` `"env:init": "bash ./brain/scripts/bootstrap.sh"` and `:41` `"brain:env:init": "bash ./brain/scripts/bootstrap.sh"`. `brain/scripts/session-start-config.test.mjs:34,39` pins exactly this, asserting both `pkg.scripts['brain:session:start']` and `pkg.scripts['session:start']` equal `'node ./brain/scripts/session-start.mjs'`. No test pins the seven memory scripts this way yet.

## 4. Doctrine promotion mechanics

Promotable `.md` targets (`brain/scripts/lib/amendment-draft.mjs:116` accepts only `brain/**/*.md`): all 8 core files and all 5 ADRs above. Not promotable, hand-applied by the maintainer: `brain/core/config-migrations.mjs:69` and `brain/project/check-refs-rules.mjs:81`, both single-line comments.

ADR convention, verified on two amended ADRs: **appended, numbered, signed Amendment sections, never in-place edits**. `adr-0002…:3` reads "Status: Accepted · amended 09/09/2026 (Amendments 1-2 — see below)", with `## Amendment 1` at `:53` and `## Amendment 2` at `:77`; old text gets an inline "SUPERSEDED by Amendment 1" marker (e.g. `:41`) rather than deletion. `adr-0017…:3` has the same shape (`## Amendment 1` at `:273`, `## Amendment 2` at `:358`). `adr-0034` has no amendments yet.

## 5. AGENTS.md generation

`SOURCE_DOCS` (`brain/scripts/harness/backends/antigravity.mjs:36-41`): `brain/HOME.md`, `brain/core/methodology/agent-authorities.md`, `harness-contract.md`, `sdd-layout.md`, `workflow-governance.md`. Only two mention the seven names: `agent-authorities.md:22` and `harness-contract.md:32-36`. The drift test `antigravity.drift.test.mjs:42-49` requires byte-equality, so `AGENTS.md` regenerates in the same promotion; `brain-promote.mjs:279,333` already does this as act 3.

## 6. The #922 tripwire interplay

PR #954 (branch `chore/issue-922-managed-scripts`, draft) carries `brain/scripts/lib/managed-script-keys-doctrine.test.mjs`, which extracts every `npm run <brain:*|memory:*>` from `DOCTRINE_ROOTS = ['brain/core','brain/project','AGENTS.md','CLAUDE.md','docs']` (excluding `docs/inbox/**`) and requires each in `MANAGED_SCRIPT_KEYS`. #954's draft adds the seven bare names.

Orderings:
- (a) #961 first, then #954's catalog is edited to `brain:memory:*` before merge. Cleanest.
- (b) #954 as-is, then #961. Costs exactly what #961 avoids: seven stale bare keys in every upgraded consumer, no cleanup path.
- (c) #961's doctrine renames land before #954 merges, so the tripwire already extracts `brain:memory:*` and #954 only ever adds `brain:`-prefixed keys; the managed-paths invariant never needs loosening.

## 7. The managed-paths invariant

(Measured on `origin`; the local #954 branch has an unpushed commit that changes this — see the orchestrator's note.)

## 8. Consumer safety

`brain/scripts/lib/installer.mjs:1358-1362` (`mergePackageJsonScripts`): `if (!(k in out.scripts)) out.scripts[k]=v;` — strictly additive, never overwrites or deletes a consumer key. `mergePackageJson:1383-1387` filters to `MANAGED_SCRIPT_KEYS` first. On this base `MANAGED_SCRIPT_KEYS` (`brain/core/managed-paths.mjs:29-40`) has exactly the 10 `brain:*` keys. `config-migrations.mjs` has no script-key rename or removal logic. No consumer can have any of the seven today, and nothing could remove one if it did.

## 9. Size and slicing

`governance.ignoreList` (`brain.config.json:18-29`) excludes `**/*.test.mjs`, `.memory/**`, `AGENTS.md`, `openspec/changes/**`, `openspec/specs/**`, lockfiles. Counted production lines for the seven: roughly 123 touched lines. Doctrine (`brain/core`, `brain/project`) is Tier 2 and cannot be committed by an agent, so:
- **PR 1** (Tier 1): `package.json` rename plus bare aliases, `brain/scripts/**` production, i18n and tests, `docs/**`, `README.md`, `.github/PULL_REQUEST_TEMPLATE.md` — about 115 lines.
- **Drafts** for maintainer promotion: the 8 core `.md` files and 5 ADRs as `brain-amendment/1` blocks, plus the 2 `.mjs` comments flagged for hand edit; `AGENTS.md` regenerates during promotion.
- **Optional**: rename the four unmanaged scripts too.

## Candidate approaches
1. Rename-first: one production PR plus separate doctrine drafts, ordering (c).
2. Rename all eleven together, for prose consistency.
3. Everything in one PR including doctrine — rejected, Tier 2 cannot be agent-committed.

## Open questions for the proposal
- Which ordering in §6.
- Whether the four unmanaged scripts are in scope now.
- Whether the bare `memory:*` aliases are permanent or deprecated on a schedule.
- Whether shipped-but-unarchived `openspec/changes/**` (155 refs) is editable or treated as history like the archive.
- Whether a rename inside an ADR takes a new Amendment section per file, per the §4 convention.
- Whether to add a pinning test for the `brain:memory:*` scripts, mirroring `session-start-config.test.mjs:34,39`.
