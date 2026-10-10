# Explore — #1076: do consumers need every vendored test suite in the tarball?

Phase: sdd-explore (read-only). Worktree `/home/gandalf/IA/brain-issue-1076`, off `main` (d30c8303).
Date: 2026-10-07. Measurements via `npm pack --dry-run --json` on this worktree.

## TL;DR

- **No consumer-side path executes a vendored brain test.** Not install, not `brain:upgrade`, not `brain:check`/`brain:ship`, not hooks, not the shipped CI templates. Every `npm test` / `node --test` reference is gated to the brain source repo (`.brain-source` marker, never managed, never shipped), or runs against the consumer's OWN `test` script, which brain does not inject.
- So option **(A) ship no tests** is safe for the runtime. Measured: **10.40 -> 4.04 MiB unpacked (-61%), 932 -> 438 files, 2.87 -> 1.32 MiB packed.** `files` negations work (verified on a scratch copy).
- Two real costs: (1) consumers already installed keep ~469 stale test files forever unless pruned, and the existing `RETIRED_PATHS` mechanism cannot express this as-is (exact list; its own guard demands "absent from brain"); (2) one runtime tool, `brain:port:coverage`, reads `contract.test.mjs` and would degrade in a consumer (it is not a managed script key, so only reachable by hand).
- Shipping tests is also a latent **negative** for consumers: a bare `node --test` / vitest in a consumer repo auto-discovers `brain/scripts/**/*.test.mjs` and `test-*.mjs` files (see Q2/Q5).

## 1. Why tests ship today

- `package.json:17-30` `files` lists `brain/core`, `brain/scripts` (whole directory) plus literal root files. No exclusion for tests. `_files_note` (line 16) says the list is "derived from `managed` ... every path whose strategy needs BRAIN'S BYTES".
- `brain/core/managed-paths.mjs:79` `'brain/scripts/**'` is managed; `:202` `'brain/scripts/**': STRATEGY.COPY`. A glob, not a list: whatever the incoming package contains under `brain/scripts/` is copied by `copyManaged` (`brain/scripts/lib/installer.mjs:1030`). Nothing in `installer.mjs`/`brain-upgrade.mjs` filters `.test.mjs` (rg: only hits are comments or the `retired` machinery).
- Allowlist test `test/publish-allowlist.e2e.test.mjs`:
  - `:1-25` header: the tarball "carries every byte a consumer needs, and nothing else" (#607). The rule is derived from `managed`, so a copy glob over `brain/scripts/**` pulls tests in by construction, not by a decision about tests.
  - `:42-48` `MUST_NOT_SHIP` entry `test`: *"brain's own suites; the consumer runs the ones vendored under brain/scripts/**"*. This is the ONLY statement that the consumer runs vendored suites. It is unsupported (see Q2).
  - `:66` `SIZE_CANARY_MB = 10.4`, raised 8 -> 9 (#936) -> ... -> 10.4; the comment itself says "*.test.mjs is 6.24 MiB of it — #1076 is the real fix". Current measure on this worktree is 10.40 MiB, i.e. at the canary edge; the next feature raises it again.
- `brain/scripts/lib/retired-paths.mjs` (78 lines): exact-path list of files brain stopped shipping (#1141); relevant to Q5.
- Net: tests ship because the managed glob is directory-wide, and the allowlist comment rationalised it. Not a recorded decision (no ADR; see Q6).

## 2. What a consumer actually executes (exhaustive sweep)

Commands: `rg -n -e '--test|node:test|\.test\.mjs|test/' --glob '!*.test.mjs' --glob '!**/__fixtures__/**' brain/scripts .github hooks brain/core package.json`, plus a non-comment-only variant. Findings:

| Surface | What it does | Runs vendored tests in a consumer? |
|---|---|---|
| Consumer `package.json` injection | `MANAGED_SCRIPT_KEYS` (`managed-paths.mjs:33-67`, 33 `brain:*` keys) | **No.** There is no `test` key; `mergePackageJsonScripts` (`installer.mjs:1407`) only adds listed keys |
| `.github/workflows/governance.yml` `local-checks` | `:121-146` comment: the unit suite "exercises brain's own tooling against brain-repo state ... a consumer does not have ... portability treadmill (#206, #211)". `:144-146` `npm test` has `if: hashFiles('.brain-source') != ''` | **No** (marker is never managed/shipped) |
| `brain/scripts/ci/gitlab-governance.yml` `local-checks` | `:140` `... && npm test` | Runs the **consumer's own** `npm test`, not brain's: brain injects no `test` script, so it is whatever the consumer defined. Comment `:107` ("`node --test "brain/scripts/**/*.test.mjs"` needs Node 21+") is about brain's own repo / stale |
| `brain:check` | `brain/scripts/brain-check.mjs:199,251-264,337` runs `npm test` only if `npmTestApplicability().applicable` (`brain/scripts/lib/local-gate-context.mjs:61-78`): requires `.brain-source` marker AND a `test` script; otherwise reported "not applicable" (#1187) | **No** in a consumer |
| `brain:ship` | `brain/scripts/brain-ship.mjs:5` delegates to `brain:check` | **No** (same gate) |
| `brain:change:verify` | no `--test`/test-file execution found | No |
| Hooks (`brain/scripts/hooks/*`) | rg for test invocation in pre-push/pre-commit/commit-msg/post-merge: none; hits are comments pointing at parity tests | No |
| `brain:upgrade` / `brain init` / `adopt` | no test execution; `brain-upgrade.mjs:485-486` only imports `retired-paths.mjs` | No |
| Cold review | `brain/scripts/review/lib/base-comparison.mjs:100-104` re-runs `node --test brain/scripts/**/*.test.mjs test/**/*.e2e.test.mjs` only when the base worktree has `.brain-source`; `review/evaluators/checkpoint.mjs:299-307,453-454` runs the PR's CHANGED `*.test.mjs` files (the reviewed repo's own) | **No** vendored brain suite; consumer's own changed tests only |
| Repo-only workflows | `bootstrap-smoke.yml`, `upgrade-smoke.yml`, `m4-danger-paths.yml`, `publish.yml:121` (`npm test`), `test:fresh-install`/`test:upgrade` | Brain repo only, not managed (not in `files`) |

Conclusion for Q2: the set of vendored suites a consumer executes is **empty**. Option B's "subset" degenerates to the empty set.

## 3. Test-support files that are not `*.test.mjs`

Inventory in the tarball (measured):

| Class | Files | Size |
|---|---|---|
| `*.test.mjs` (469 under `brain/scripts`, 0 under `brain/core`) | 469 | 6.27 MiB |
| `__fixtures__/` non-test files (`brain/scripts/__fixtures__`, `memory/__fixtures__`, `lib/adopt/__fixtures__`, `roles/first-party/__fixtures__`) | 14 | 0.03 MiB |
| `ui/test-support/` (`load-app.mjs`, `git-remote-fixture.mjs`, `git-worktree-fixture.mjs`) | 13 incl. assets | 0.06 MiB |
| Helper modules: `lib/hermetic-box.mjs`, `lib/test-brain-home.mjs` (the `--import` preload), `lib/test-tmp.mjs`, `test-hygiene.mjs` | 4 | ~9 KB |

Would excluding break a runtime import? Checked: rg `from '...(__fixtures__|\.test\.mjs|test-...)'` and dynamic `import(` over non-test, non-fixture modules, plus an importer scan per helper name:

- `hermetic-box`, `test-brain-home`, `snapshot-tree`, `pull-fixture`, `load-app`: **zero non-test importers**.
- `test-tmp.mjs`: importers are only `test-hygiene.mjs` (the `pretest` hook, `package.json:65`) and test-support files. `lib/tmp-tree.mjs` (imported by runtime `memory/lane/collect.mjs:28`) is a different, runtime file: **keep it**.
- `memory/cli.mjs:58` `FIXTURE_ROOT = brain/scripts/memory/__fixtures__`: a path-containment guard for the `BRAIN_VCS_TEST_MODULE` test seam (`:480-510`). Only dereferenced when that env var is set (tests). Excluding `__fixtures__` leaves the guard pointing at a missing dir, which is a refusal, the intended failure mode. No runtime import.
- `check-brain-nav.mjs:51` skips `__fixtures__` md files; unaffected.
- **One runtime reader of tests:** `brain/scripts/vcs/port-coverage.mjs:302,314-322` reads `axes/vcs/contract.test.mjs` and every `*.test.mjs` under `brain/scripts` to compute contract coverage (`package.json:64` `brain:port:coverage`). It is NOT in `MANAGED_SCRIPT_KEYS`, so a consumer has no script for it, but the module ships and `node brain/scripts/vcs/port-coverage.mjs` would find no tests. This is a brain-maintenance verb, not a consumer verb; maintainer decides whether to exclude the module too or leave it degrading (Q-D below).
- Tests that run FROM the brain repo and COPY the tree (`hermetic-box.mjs` copies `brain/`, `brain-ship.fresh-consumer.e2e`) copy from the repo checkout, not the tarball, so `files` does not affect them. `test/fresh-install` and `test/upgrade` install a published tag and run no vendored tests (rg: no `node --test` in their scripts).

## 4. Measurements

All from `npm pack --dry-run --json` (worktree at main d30c8303):

| Variant | Files | Unpacked | Packed (tgz) |
|---|---|---|---|
| Today | 932 | 10.40 MiB | 2.87 MiB |
| Exclude `*.test.mjs` only | 463 | 4.13 MiB | n/m |
| + exclude non-test `__fixtures__` | 449 | 4.09 MiB | n/m |
| + exclude `ui/test-support` + 4 helper modules (full test infrastructure) | 435 | 4.04 MiB | n/m |
| **Verified**: `files` += `!brain/scripts/**/*.test.mjs`, `!brain/scripts/**/__fixtures__`, `!brain/scripts/**/test-support` (scratch copy, `npm pack --dry-run`) | **438** | **4.04 MiB** | **1.32 MiB** |

(The 438 vs 435 delta is the 4 helper modules plus 1 file I did not enumerate by name; helpers need an explicit negation each if wanted.) Negation globs in `files` are honoured by npm; zero test/fixture entries remained in the scratch pack. Tests are ~60% of unpacked bytes and ~54% of the compressed download. Fixtures are 0.03 MiB, so excluding them is hygiene, not size.

Scratch artifacts: `/tmp/claude-1000/-home-gandalf-IA-brain/d53d5a1f-10c9-4e27-a1f9-7dd5af425ce9/scratchpad/{pack.json,c}` (not in the repo).

## 5. Consequences for consumers already installed

1. **Stale copies stay.** `copyManaged` walks the INCOMING package (`installer.mjs:1030`; comment at `retired-paths.mjs:3-6`). Files the new release stops shipping are never visited, so ~469 test files (6.27 MiB) remain in each consumer's tree, committed in their git, never updated, progressively wrong against the updated modules.
2. **Existing retirement mechanism does not fit as-is.**
   - `RETIRED_PATHS` is an exact list (`retired-paths.mjs:18`); removal in `installer.mjs:1155-1160` requires each path to match a managed glob, not be `local`, not be REFUSE/MERGE, absent from the incoming package, and be a file in the consumer.
   - Its guard `installer.retired.test.mjs` (last test) asserts every entry has `existsSync(join(REPO_ROOT, rel)) === false` ("declared retired but brain still has it"). Brain still HAS these tests (the issue's out-of-scope clause: we keep testing brain). So listing them breaks the guard; it would need a second list/rule (e.g. `NEVER_SHIPPED`/`UNSHIPPED_PATHS` with a different invariant: "excluded by `files`") or a relaxed guard.
   - Why exact and not a glob (`installer.retired.test.mjs` header, "A consumer file in the SAME directory is not brain's and must survive"): a `**/*.test.mjs` prune under `brain/scripts/**` would delete a consumer's own test file placed there. Under `--no-install` the outgoing package is gone, so brain cannot read "what I shipped last time" off the tree. An exact generated list (~469 paths, ~30 KB `.mjs`, regenerated by a script/test at release) is the safe form. Cost: it ships in the package and must be kept in sync with the exclusion by a guard test.
   - Cheaper alternative: **do not prune.** Stale tests are inert (nothing runs them, see Q2). The only harm is dead weight and test-runner discovery noise (below). Acceptable if the maintainer prefers no new mechanism; note it as a release-note line.
3. **Does anything break in a consumer when tests stop shipping?** No. `node --test "brain/scripts/**/*.test.mjs"` with no match exits **0** with `tests 0` (Node v22.13.0, scratch run: glob-nomatch exit=0, bare `node --test` exit=0). And no consumer-side job runs that glob anyway (Q2). Engines are `>=22` (`package.json:13-15`), so the Node 22 behaviour is the relevant one.
4. **Latent upside for consumers.** Node's default `node --test` discovery matches `**/*.test.?(c|m)js` and `**/test-*.?(c|m)js` (Node docs; empirically confirmed: a bare `node --test` picked up `brain/scripts/lib/test-tmp.mjs` in a scratch dir and reported `tests 1`). A consumer whose `test` script is bare `node --test` (or vitest, default include `**/*.{test,spec}.?(c|m)[jt]s?(x)`) would pick up brain's vendored suites and helpers today, which is exactly the "portability treadmill" `governance.yml:121-130` describes. Shipping no tests removes that for NEW installs; for existing installs stale copies keep the exposure unless pruned (weakens "do not prune"). I did not run a consumer's real runner; this is from docs + the node scratch run.

## 6. Approaches

### (A) Ship no tests (exclude all test infrastructure)
- `package.json` `files`: `"!brain/scripts/**/*.test.mjs"`, `"!brain/scripts/**/__fixtures__"`, `"!brain/scripts/**/test-support"` (+ explicit helper negations if full infrastructure is to go).
- `publish-allowlist.e2e.test.mjs`: add "no test or fixture ships" assertion (same style as `MUST_NOT_SHIP`, which today checks roots only), rewrite the `test` reason at `:47`, lower the canary to ~4.5 and rewrite its 3-raise comment (it is a 1.8 KB line, `:66`).
- Consumer CI: nothing changes. `local-checks` already skips the suite (GitHub) or runs the consumer's own `npm test` (GitLab).
- Pros: -6.4 MiB unpacked / -1.5 MiB download; canary stops being raised for test growth (the issue's trigger); removes runner-discovery pollution on new installs; matches the existing doctrine in `governance.yml:121-130` that consumers do not run the suite.
- Cons: stale copies in installed consumers (Q5.1-2); `port-coverage.mjs` degrades in a consumer; consumers lose the ability to run brain's suites against their vendored tree as an ad-hoc integrity check (nothing in brain documents or uses that ability; and `brain:upgrade` already has its own rollback/verification, ADR-0027).

### (B) Ship only the subset consumers execute
- The measured subset is **empty** (Q2). B collapses into A, unless the maintainer wants an "install self-check" suite (a NEW feature, not found today). Not recommended as a framing.

### (C) Keep all, document canary raises as expected growth
- Zero risk, zero migration; the issue's second branch ("If every suite is needed, say so"). But the evidence says not every suite is needed; the rationale in the allowlist comment is factually wrong today. Canary has been raised 3+ times; a 6 MiB dead payload continues growing ~70 KB per feature. Not recommended.

### Recommendation
**A**, with the stale-copy handling left to the maintainer (prune via a new exact-list mechanism vs. accept inert leftovers). Keep `brain/scripts/lib/tmp-tree.mjs` (runtime). Prefer excluding by pattern in `files` (tests ride on file naming, so new suites are excluded automatically; no list to maintain).

## Maintainer decisions (questions, not decided)

- **Q-A.** Is excluding ALL test infrastructure (`*.test.mjs`, `__fixtures__`, `test-support`, the 4 helper modules) the intended scope, or only `*.test.mjs` (simplest, 88% of the gain)?
- **Q-B.** Stale copies in installed consumers: prune them on the next `brain:upgrade` (needs a new exact-list/guard; ~469 entries; generated) or leave them as inert leftovers with a release-note line?
- **Q-C.** If pruning: acceptable that the retire list is generated and guarded ("excluded by `files` and absent from the packed tarball") instead of reusing the "absent from brain" invariant of `installer.retired.test.mjs`?
- **Q-D.** `brain:port:coverage` / `vcs/port-coverage.mjs` reads tests: leave it degrading in consumers, or exclude the module (and its test) from the package since it is a brain-maintenance tool and no managed script key exposes it?
- **Q-E.** Should the canary be lowered to ~4.5 (re-armed as a real tripwire) or kept as headroom?
- **Q-F.** Does the maintainer want a (new) consumer-side smoke suite shipped on purpose, for example a minimal install-integrity check? If yes, that is a separate change and B's subset becomes non-empty.

## Doctrine / ADR impact

- **ADR-0030** (distribution via scoped registry; `files` allowlist, #607): defines contents by the `files` allowlist and the allowlist test. This change tightens a list inside that mechanism; it does not reverse the decision. Its measurement table (line ~268, "433 files, 5.5 MB") is a point-in-time record, already stale. **No amendment required**; at most a one-line amendment if the maintainer wants "tests never ship" stated as doctrine.
- **managed-paths** (`brain/core/managed-paths.mjs` `brain/scripts/**` COPY): the managed set does not change (managed is a path glob; `files` is the shipped subset, and the existing `NEEDS_BYTES` check keeps passing). The `_files_note` in `package.json` should mention the test exclusion. If a new retire list is added, `retired-paths.mjs` header and `brain/core/methodology` text referencing "ships" may need a sentence. `managed-paths.mjs` is code (Tier 2), not doctrine (Tier 3), per AGENTS.md.
- **`test/publish-allowlist.e2e.test.mjs:47`** states a false premise ("the consumer runs the ones vendored"); must be corrected.
- Doctrine files under `brain/core/**/*.md` or `brain/project/**` would go through brain-drafts and human promotion; none is strictly required here.
- Tier-2 notes for apply: touching `package.json` is allowed on a branch under the usual push/PR rules. Changes to `brain.config.json` are not involved.

## Estimated gated diff (lite budget 1000; `governance.ignoreList` drops `**/*.test.mjs`, `.memory/**`, `openspec/changes/**`)

| Item | Gated lines |
|---|---|
| `package.json` `files` (+3-7 lines) and `_files_note` | ~10 |
| `test/publish-allowlist.e2e.test.mjs` (new "no tests ship" assertion, rewritten comments, canary). It is itself `*.test.mjs`, so ignored | ~0 gated (~40 raw) |
| Option "accept leftovers": release note/doc line | ~5-15 |
| Option "prune": generated exact list `retired-paths.mjs` (+~470 lines) or a smaller `UNSHIPPED_PATHS` generator module | ~100 (generator) to ~480 (checked-in list) |
| Prune: `installer.mjs`/`brain-upgrade.mjs` wiring | ~20-40 |
| Prune: guard tests (ignored) | ~0 gated |
| Optional `port-coverage` handling | ~10-30 |

Totals: **~25-60 gated lines** for A without pruning; **~150-600** with pruning. Both far below 1000 at `lite`. Note the tier is `lite` from `brain.config.json`; at `standard` (400) the checked-in-list prune variant would still fit.

## Evidence trail (commands run)

- `gh api repos/csrinaldi/brain/issues/1076 -q .body` (issue text, 2026-09-19 measurement)
- `rg` sweeps listed in Q2/Q3; `find brain -name '*.test.mjs' | wc -l` -> 469 (0 under `brain/core`)
- `npm pack --dry-run --json` in the worktree, then categorised with a node one-liner; negation verified on a scratch copy (git ls-files copy of `brain`, root files)
- `node --test` no-match / bare / `test-*.mjs` discovery in an empty scratch dir (Node v22.13.0)
- Read: `test/publish-allowlist.e2e.test.mjs:1-66,150-166`, `managed-paths.mjs:28-110`, `installer.mjs:1150-1160`, `retired-paths.mjs`, `installer.retired.test.mjs`, `brain-check.mjs`, `local-gate-context.mjs`, `base-comparison.mjs`, `governance.yml:112-146`, `gitlab-governance.yml:95-140`.
