# Changelog

All notable changes to brain. Distributed as **`@logikas/brain`** on the npm
registry (ADR-0030, superseding ADR-0006's git tags); consumers upgrade with
`npm run brain:upgrade -- <tag>`. Read this file for **renames / breaking
changes** before upgrading — additive `brain.config.json` migrations apply
automatically, but renames need manual action.

## v1.6.0 — memory travels on its own lane, and three gates become required at every tier

**Manual steps — read all four before upgrading.** Unlike v1.5.0, this release asks
something of you.

1. **Re-run `npm run brain:protect`** if you have branch protection armed. Three new
   status contexts ship — `lane-paths`, `lane-scrub` and `base-branch` — and
   `brain:protect` derives the required set from your tier. Without the re-run, the
   three run unenforced on GitHub and block on GitLab, which has no protection layer
   to hide them.
2. **`standard`/`regulated` with a diverged `governance.yml`:** add `VCS_TOKEN`,
   `PR_NUMBER` and `PR_BODY` to the `memory-gate` step's `env:` (see the vendored job
   for the exact form). Nothing to do at `lite`.
3. **Remove two inert leftovers:** `git rm .memory/manifest.json` and
   `git config --unset merge.engram-manifest.driver`. The upgrade already drops the
   `merge=engram-manifest` attribute, so git never runs the old driver again.
4. **`brain:memory:migrate-v1 --rollback` is removed** and refuses with a reason.
   Forward `migrate-v1` and `--dry-run` are unchanged.

### Why a minor and not a patch

Eleven of the 55 shipping changes add capability a consumer can rely on, and one
dormant migration becomes reachable — `1.6.0`, `memory.lane.enabled` (#906, ADR-0034
L5). `migrateConfig` applies only entries at or below the installed package version,
so at 1.5.0 that entry was code no consumer could reach. It runs now, and **its
default is `false` on every tier, always**. Flipping it is a maintainer act, never a
migration default, so no consumer's behaviour changes silently when the migration
lands: the lane's triggers read the flag before they spawn anything, and an absent
flag already meant `false`.

Not a major: nothing a consumer had is renamed or removed. The eleven `memory:*` →
`brain:memory:*` names (#961) are not a rename a consumer sees — consumers never had
those scripts, and they arrive here for the first time under their `brain:` names.

(Measured 24 feat / 31 fix / 44 internal by commit prefix, which is not the same split
as the prose below: #961 carries a `refactor` prefix and #922 a `chore` one, and both
are listed as capability because what they changed for a consumer is which verbs exist
in their `package.json`.)

### What you can do that you could not before

- **Run the verbs the doctrine has been telling you to run.** `MANAGED_SCRIPT_KEYS`
  went from 9 to 33 (#922). `brain:upgrade` now injects 24 more keys into your
  `package.json` — `brain:audit`, `brain:check`, `brain:config`, `brain:metrics`,
  `brain:next`, `brain:promote`, `brain:protect`, `brain:review`, `brain:review:board`,
  `brain:ship`, `brain:start`, `brain:upgrade`, `brain:governance-status`, `brain:nav`,
  `brain:adopt`, `brain:change:archive`, and the seven `brain:memory:*` verbs plus
  `brain:memory:session-end`. The catalog is reconciled against every `npm run …`
  mention in governed doctrine by a drift-guard test, so doctrine can no longer
  recommend a script the installer never delivers. `brain:memory:session-end` matters
  most: the compiled SessionEnd hook runs that script, and without the key every
  adopter's hook printed an npm "missing script" error to a surface the agent shows the
  user.
- **Let a memory record travel on its own branch.** ADR-0034's lane ships whole, across
  nine slices: a pure planner that groups records, breaks C2 ties and names the ref
  (#897); a collector that writes one local ref with a secret scan before the write and
  a CAS on `update-ref` (#887); `shipLane`, which pushes `--no-verify` behind a diverged
  pre-check, finds or creates the lane PR and arms by tier (#901); the `memory:ship` op
  itself, reading `BRAIN_MEMORY_TOKEN` once into the port identity, with `--dry-run` and
  `--json` (#888); and the triggers — a SessionEnd hook on both platforms and a
  `day:start` sweep, inert until `memory.lane.enabled` (#906). `mrAutoMerge` (#886) arms
  auto-merge only at exactly zero required reviews, never throws, and hardcodes squash.
  **All of it is off by default.**
- **Stop rebasing to satisfy `memory-gate`.** Scoped evidence now unions the PR's
  checked-out tree with `origin/<default>`, deduped by record `id`, PR tree winning a
  collision (#1024). Since ADR-0034 a record reaches `main` on its own lane PR, usually
  after the feature PR opens — such a record used to count as MISSING. It no longer
  does. If the default branch is unreadable and the PR tree has a scoped hit, the gate
  still passes on that hit; if neither has one it fails closed with an explicit "default
  branch unreadable" reason. A read failure never produces a silent pass. Every run now
  prints the path it took (`path=presence|retrieval|skipped`), including a clean pass,
  which printed nothing before. `skip:memory-gate` is honored per tier — accepted at
  `standard` from an actor who is neither the PR author nor a listed review/agent actor,
  refused at `regulated`, noted but not consulted at `lite`. `brain:metrics`'s column
  for it is now `raw/honored`, with an honored-usage-by-author table mirroring
  `size:exception`'s.
- **Ask what the memory actually contains.** `brain:memory:audit` (#870) answers epic
  #864's five numbers as one command, from records and git alone. `brain:snapshot`
  (#879) serves the whole read model as one JSON shape.
- **Correct a record instead of contradicting it.** `brain:memory:save --supersedes
  <id>` (#805) carries the correction chain, local-first and fail-closed, refused before
  any write rather than half-written.
- **Trust a record's provenance.** Actor is the configured handle, never the branch;
  `actorKind` is measured rather than guessed; `issue` is derived, never fabricated
  (#738). A known agent marker means agent, never human, and W4 now refuses a
  fabricating `source` (#939, #461).
- **Review with Codex or Gemini.** The `cold-review` stage routes to `claude`, `codex`
  or `gemini` (#978, #1017) — transport backend, output wiring, conditional readiness
  and routing. There is deliberately no default engine: a silent fallback to `claude`
  would be a degradation nobody could see.
- **Declare an epic's tracker as data.** The `brain-issue-graph` block declares it, the
  verb resolves it, and a gate refuses a slice aimed at `main` while its epic is in
  flight (#967). `brain:ticket:start` already enforced this at creation; `base-branch`
  is the backstop for a PR that reached the forge anyway.
- **See the work.** A local Brain UI ships behind `node brain/scripts/ui/server.mjs` —
  an SSE stream and a DAG canvas with an inspector drawer (#881), the six-tab surface
  with lanes, the SDD view and the reviews timeline (#998), the management views for
  roadmap, decisions, anti-patterns, history and by-actor (#882), the maintainer's
  design built region by region with a harness that runs it (#1059), and lanes that
  group by epic now that kind, parent and tracker are data (#1032). Note: `brain:ui` and
  `brain:snapshot` are **not** managed script keys — the files travel with
  `brain/scripts/**`, the npm scripts do not.

### Three gates that are required at every tier

This is the loudest change in the release, and `lite` is not exempt.

- **`lane-paths`** (#905) — a lane branch may touch only lane paths.
- **`lane-scrub`** (#905) — a non-waivable secret scan over every added
  `.memory/records/*.jsonl` path, on **every** PR, lane or not. It never imports the
  tier module at all: non-waivability is a property of the code, not of a matrix a
  future tier edit could soften. It fails closed on an unreadable secret config, an
  unreadable record, an invalid pattern, or an uncomputable diff.
- **`base-branch`** (#967) — a slice PR's base must be its epic's declared tracker. A
  consumer who declares no `brain-issue-graph` block passes untouched; a block that
  cannot be parsed is uncomputable and refuses, never a silent pass.

`GOVERNANCE_JOBS` is 3 entries longer than it was — 11 total — and `brain:audit` now
prints `[LANE]` for a lane merge while `local-checks` warns on index lag without
mutating anything (#889).

### What was repaired

- **An unreadable `brain.config.json` refuses instead of assuming defaults** — across
  four surfaces that each got it wrong independently: the memory scan (#712), the
  deny-list readers (#942), the release gate (#962), and the strict loader, which now
  also rejects a config that parses to something that is not a JSON object (#975).
- **`ship` refuses unless its caller declares itself** (#1012). `cli.mjs ship` refuses,
  before any credential read or VCS call, unless `--invoker` is `hook`, `sweep` or
  `manual`, and refuses independently whenever `NODE_TEST_CONTEXT` is set even with a
  valid invoker. `--dry-run` and `BRAIN_VCS_TEST_MODULE` are the only bypasses. This
  closes #1007, where `npm test` reached the real port because nothing on the call path
  checked who was calling. A meta-test now enforces a closed allowlist over every test
  that spawns a `brain/scripts/**` runtime entrypoint.
- **The lane reconciles its own branches** (#936, #930, #920). A half-finished delivery
  from a previous run is reconciled rather than repeated (#920). When today's local ref
  was already squash-merged, the next ship checks by content whether its records are all
  on `origin/main` and, if so, parents the new commit on `origin/main` — the PR diff
  stops listing records already merged; partial or unreadable delivery keeps appending,
  fail closed. After a successful ship (never under `--dry-run`) a cross-day sweep
  visits every other `memory/<host>-*` ref of this host with no age cutoff: fully
  merged refs are deleted locally, pending refs are re-shipped without collecting
  today's records into them, remote-only refs are reported and never touched. A sweep
  failure never turns a successful ship into a failure — it reports `sweep.failed`.
  **Behaviour change (#920 R8 reversed):** a lane PR closed without merge is no longer
  reopened. The lookup runs before the push; the ship reports and stops, every run,
  until an operator deletes the local ref. `mrList` now carries `state` and `merged` on
  both providers, with an optional `headBranch` filter that queries all states and fails
  closed on a full page; unfiltered calls send exactly the request they always did.
- **The engram adapter heals its own duplicate rows.** `brain:memory:heal-duplicates`
  (#1061, `engram`-only) groups a live export by `rec-`-prefixed `topic_key` and, for a
  key with exactly two live rows whose content, title and type agree, keeps the lower
  observation id. Report-only unless you pass `--apply`; it refuses, deleting nothing,
  when copies diverge, when a key has more than two live rows, when the engram version
  is outside the tested `1.20.x` range, or when the export shape is unrecognized.
  Deletion is hard — measured against engram 1.20.0, a soft delete leaves the row in the
  export with `deleted_at` set, which the audit would still count as live. It never
  reads or writes `.memory/records/` or the index.
- **The chunk read-back became an enforced boundary** (#247) — an allowlist guard, two
  pins and #874's deletion ledger — and `memory:save` under engram now writes the record
  first and hydrates one record afterwards (#924), with `share()` committing what is
  already true rather than exporting (#874).
- **Two importers through one snapshot yield one write** (#820): a non-blocking
  hydration guard makes the second importer skip and say so.
- **A worktree that could not be inspected is reported, not dropped** (#921, #923).
- **Reindex parity between the two backends is pinned** rather than assumed (#361).
- **The cold reviewer honors `size:exception` exactly as the diff-size gate does**
  (#1072) — the two had diverged.
- **The review run stopped writing into its own candidate**, and a symlink is now hashed
  by its target (#1019).
- **A prose `Parent:` declares the reference it names**, not every issue on the line
  (#1030).
- **The suite stopped touching the real repository.** `archive.test.mjs` sandboxes in
  tmp with a guard that keeps the class closed (#1022), the suite no longer reindexes
  the real memory index and the guard learned to see a defaulted root (#1058),
  `session-end-ship`'s real-config test holds for both lane flag states and never spawns
  for real (#1013), and the suite's verdict no longer depends on the shell (#714, #638).

### Retirements

- **The feature-PR memory surfaces are gone** (#890). The five surfaces `pre-push` and
  `ticket.nextSteps.step3` used are retired; the lane is where a record travels.
- **Engram's transport artifacts are gone** (#955). `session:start`, `day:start` and
  `brain:memory:pull` no longer restore a manifest; `brain:memory:share` no longer
  creates the `.engram` symlink (`brain:env:init` / `cli.mjs setup` still does).
  `brain:memory:migrate-v1 --rollback` is removed.
- **The manifest, its merge driver and share's symlink self-heal are gone** (#958).
- **`dualWriteRecords` is gone**, and five comments stopped citing it (#1060).

### Doctrine

ADR-0034 (*memory travels on its own lane*) was ruled and promoted with three
amendments, plus consolidation-protocol §5 and openspec README rule 3 (#862, #892), and
gained Amendment 4 with a `vcs-contract` `mrList` row for #936 (#1080). The backend
contract was ruled — records are the concept, engram is an adapter — across six promoted
drafts (#863, #876). The evidence-reader doctrine gained direction (deny readers fail
closed, #959) and names `brain:audit` as fixed and `approved-label` as an exemption
(#976). Five ADR errata corrected #961's amendments, which had annotated a body they
claimed was untouched (#973). The memory scripts are `brain:memory:*` throughout
doctrine and the ADRs (#961), and `memory-presence`'s header now cites ADR-0034, names
the export trigger and bounds the backend-to-file lag (#795).

## v1.5.0 — the governance surface stops trusting what it cannot measure

**No manual step.** No migration was promoted since v1.4.0, so nothing is
dormant and nothing is renamed or removed. `brain:upgrade` is enough.

### Why a minor and not a patch

Three of the eight changes add capability a consumer can rely on — a capability
report, a coverage measurement, and a release-debt line — and the remaining five
repair the verification surface itself. Nothing is removed, so the number moves
right.

(The eight split 4 feat / 4 fix by commit prefix, which is not the same split:
#124 carries a `feat` prefix but is listed below as a repair, because what it
changed for a consumer is that a gate stopped being theatre.)

### What you can do that you could not before

- **Ask what your forge account actually allows.** brain now reports the
  capability it HAS rather than the plan the platform sells. Where a control
  (required reviews, protected branches) is unavailable on the account tier,
  it is reported as unavailable and the ruling is *ratify and report* — brain
  states the gap instead of assuming a control it cannot verify, so the
  agent–human operating flow degrades honestly across GitHub and GitLab.
- **Measure the port instead of asserting it.** `brain:vcs:coverage` walks the
  exported verbs, folds their provenance and reports per-verb coverage with
  consumer counts, excluding itself from its own walk.
- **See release debt in `brain:status`.** A line now names dormant migrations
  (declared above the published version and therefore unreachable) and ordinary
  drift since the last tag. When a fact cannot be read it says so — the report
  never claims health from evidence it did not read, on either channel.

### Repairs to the verification surface

- **An approval can no longer be granted by the identity it governs.** An agent
  may act under an approval and may never grant one: the deny set is the union
  of `governance.reviewActors` and `governance.agentActors`, compared
  case-folded, and one exported predicate now answers for both the gate and the
  approve CLI — the two had diverged twice.
- **The tier decides the exit code, and decides it once.** `run-check.mjs` —
  which owns `memory-gate`, `decision-gate`, `issue-link` and `diff-size` —
  never called `mapDetectionToWarning`, so a gate whose lite policy is
  *detection* still exited 1. GitHub's branch protection hid this; GitLab has
  no such layer, so a lite consumer there was blocked by a gate that REQ-TIER-3
  says must warn. This is the fix consumers on GitLab want most.
- **The publish guard checks the right thing.** It asserted `tag === HEAD` and
  so called ordinary post-release history a failure, red on every maintainer
  checkout while the published state was correct. It now asserts the tag is ON
  this history — and it no longer returns early in CI, where it had been inert.
- **The container harness stopped waiting on a service it does not use.** The
  danger-paths scenarios install a zero-dependency package from a local
  `git+file://` remote and spent minutes in npm's audit call: 17m57s end to end
  before, 59s after.
- **Dogfooding got a boundary.** Configuring `sdd.map` turned 26 tests red, so
  the repository could dogfood the router or the reviewer and never both.

## v1.4.0 — the SDD pipeline becomes composable (M5 + M8)

**No manual step.** Unlike v1.1.0, this release is additive: `brain:upgrade`
migrates `brain.config.json` for you and nothing is renamed or removed.

### Why the number jumps 1.1.0 → 1.4.0

Three config migrations were promoted and signed between the two releases, and
`migrateConfig` applies a migration only when its version is **at or below the
installed package version** (`installer.mjs`). At 1.1.0 all three were dead
code for every consumer. The package meets its migration tail, so they run:

| migration | key it adds | default |
|---|---|---|
| 1.2.0 | `sdd.stages` — the declared stage set | `{}` |
| 1.3.0 | `sdd.configs` — per-stage agent and enabled state | `{}` |
| 1.4.0 | `sdd.engines` — what each SDD engine declared when last interrogated | `{}` |

Every default is an **empty object**, and that is the design: an absent
declaration keeps today's behaviour exactly. A stage you never declared runs as
it always did; an engine nobody recorded stays honestly absent rather than
reading as "interrogated and declared nothing".

### What you can do that you could not before

- **Compose the SDD pipeline per stage.** `sdd.map.<stage> = { engine, model? }`
  routes who PRODUCES each stage's artefact. Two engines ship wired: `plain`
  (manual handoff) and `gentle-ai` (runs on the platform). Who VERIFIES stays
  neutral — no gate can name an engine, and a test guards that.
- **Declare a stage of your own.** A stage beyond the four lifecycle stages is
  scaffolded by `brain:project:feature`, walked by `phase-order` in its declared
  position, and carried into the archive like any other. Declaring it is the
  demand: the gate then requires its artefact.
- **One config verb.** `brain:config get|set` is the single writer for
  `brain.config.json`, running pending migrations as part of the write.
- **Roles as a port.** Each stage declares its agent, model tier and
  instructions through one interface, with four archetypes on it.

### Refusals you may meet if you declare stages

`sdd.stages` is validated when read, and a malformed declaration is refused
with a message naming what is wrong — never silently normalised. It refuses:
omitting one of the four lifecycle stages (the set is additive-only),
reordering them relative to each other, a custom artefact impersonating a
lifecycle file, a reserved vocabulary name, one of the four renaming its own
artefact, two stages sharing one file, a stage name that is not a plain kebab
identifier, and an artefact that is not a bare `.md` filename.

### Also in this release

- `brain:promote` grows a migration arm: adding a config migration is a
  declarative draft the human signs, and the verb proves the candidate imports
  and migrates before it shows a plan.
- `brain:status` reports stranded feature branches — a tracker ahead of the
  default branch with no open PR is a signal, not silence.
- `tasks.md` may carry a `brain-slice-scope/1` block declaring a slice's claims
  and its terminal PR; `check-refs` refuses a malformed one repo-wide.
- Test fixtures no longer leak: every temporary directory lives under one
  per-run root that dies with the process, with a pre-suite sweep for runs that
  were killed.

## v1.1.0 — BREAKING: the package is now `@logikas/brain` (#655)

**If brain is already installed in your repo, do not upgrade with
`brain:upgrade`.** Reinstall by hand. This is a one-time step and it is the
only way across.

### Why the usual verb cannot do it

Your checkout carries brain's **previous** `brain-upgrade.mjs`, and that code
resolves `node_modules/brain`. It installs the new version, npm reads the new
`package.json`, the tree lands in `node_modules/@logikas/brain`, and the old
code then finds nothing and stops. Nothing written today reaches code that is
already in your repository (#625).

**Nothing is damaged if you try it.** Measured: the stop happens 19 lines before
any managed path is written, and the lock is released on exit. Your `package.json`,
lockfile and `node_modules` are updated; no brain file in your tree is touched.
You land exactly where the two commands below start.

### The migration

```bash
npm i -D @logikas/brain@<version>
node node_modules/@logikas/brain/brain/scripts/brain-upgrade.mjs <version> --no-install
```

The second command runs the **new** upgrader from its new location, and it
migrates your `brain:upgrade` alias — which points at the old path and would
otherwise stay broken, because brain never overwrites a script value you set.
If you customised that alias yourself, it is kept and you update it by hand.

`npm uninstall brain` afterwards, if you want the old directory gone.

### Behind a mirror or an air-gapped registry

The git URL still installs the same allowlisted bytes into the same directory,
and is a supported fallback rather than a retired path (ADR-0030 Amendment 1):

```bash
npm i -D "git+https://github.com/csrinaldi/brain.git#<tag>"
```

## v1.0.0 — first stable (controlled pilot) (#319)

First stable tag. **1.0 is a controlled-pilot release** — intended for repos the
maintainer controls, not yet open external adoption. Read `docs/KNOWN-LIMITATIONS.md`
before relying on it: `brain:upgrade` has no rollback and is not yet safe for
uncontrolled adopters, the external reviewer's flow-guarantees are inert in prod
(#317), distribution needs a manual `package.json` step, and rung-2/3 governance is
GitHub-only. The remaining path (1.1 line) is tracked in the epic #313 and
`docs/inbox/MASTER-PLAN-1.0.md`; the hard gate before external adoption is
auto-update-safety (rollback / clobber-safety / lockout).

Highlights of the v2 line landing as 1.0: three-axis decoupling
(`AGENT_PLATFORM` · `SDD_ENGINE` · `MEMORY_BACKEND`, ADR-0024), git-native durable
team memory (engram + plainfiles), VCS-agnostic PR-time governance (GitHub + GitLab),
the external cold reviewer (security boundary sound), and the SDD artifact contract.

## v0.9.5 — consumers no longer run brain's internal unit suite (#211)

Closes the portability treadmill v0.9.4 started down. v0.9.4 made two coupled
test files hermetic, but the governance CI job `local-checks` (vendored,
merge-blocking) runs `npm test` — brain's **entire** internal unit suite —
inside consumer repos, and two more tests coupled to brain-repo state surfaced
immediately in an `es` consumer. Those tests validate brain's own tooling, not
the consumer's integration; making each one portable is endless. **CI/config
only — no runtime or CLI change.**

- **`local-checks` runs `npm test` only in the brain source repo.** The step is
  now gated on the `.brain-source` marker (present only in brain source, never a
  managed path, so never vendored). Consumers run `repo:check` + `brain:nav` —
  which validate the consumer's own `brain/` state — and skip brain's internal
  suite. Since `governance.yml` is a managed path, every consumer picks this up
  on `brain:upgrade`.

Upgrade note: nothing to do beyond `brain:upgrade -- v0.9.5`. A consumer whose
CI was red solely from vendored brain unit tests goes green after upgrading.
The two tests that surfaced this (`brain/scripts/harness/backends/gentle-ai.test.mjs`,
`brain/scripts/check-refs.test.mjs`) remain brain-CI-only by design and are not
made portable.

## v0.9.4 — consumer-portable unit test suite (#206)

Fixes a merge-blocking regression for consumers on v0.9.3: the governance CI job
runs `npm test` (brain's whole vendored suite) inside consumer repos, but five
tests assumed they ran inside the brain source repo and failed there — red CI
blocked every consumer PR (surfaced on a `docs.language: es` monorepo).
**Test-only + additive i18n seam — no renames, no breaking changes, no CLI
behavior change.**

- **i18n gains an explicit-locale seam.** `t()` accepts an optional `{ locale }`,
  and a new exported `loadCatalog(lang)` resolves a catalog without touching the
  ambient `brain.config.json` or the module-level cache; `resolveSessionStrings`
  forwards it. The CLI path is unchanged (still reads the ambient locale). The
  affected tests pin `'en'` instead of the consumer's ambient language.
- **Brain-source-only tests skip in consumers.** Tests asserting on files that
  are never vendored (`.claude/commands/**`, `README.md`, the deprecated bare
  `session:start` alias) skip when the `.brain-source` marker is absent. One
  module-scope read that threw at import in a consumer moved inside its test.

Upgrade note: nothing to do beyond `brain:upgrade -- v0.9.4`. A consumer whose
CI was red on v0.9.3 solely from these tests goes green after upgrading.

## v0.9.3 — install-time HOME.md scaffold + agnostic ADR-index helper (#184)

Closes the fresh-consumer onboarding gap: adopting brain now creates a
`brain/HOME.md` at `brain:env:init`, and the auto-ADR flow can index accepted
ADRs into it. **Additive — no renames, no breaking changes.**

- **`brain:env:init` scaffolds `brain/HOME.md`** (create-if-absent; never
  overwrites an existing one) from a new managed template
  `brain/core/templates/HOME.template.md`. Fresh installs get a nav-clean entry
  point instead of the missing-HOME stopgap warning.
- **New agent-agnostic `brain/scripts/lib/home-index.mjs`** — inserts an ADR
  link into HOME.md's `### Architecture decisions` section (idempotent,
  CRLF-safe, fail-safe when the anchor is absent). The `project-bootstrap-adrs`
  flow now calls this helper instead of re-implementing the patch in prose, so
  any agent adapter reuses the same agnostic logic (enforced by a neutrality
  source-scan test).
- **`check-brain-nav`** excludes `brain/core/templates/` from the nav walk.

Upgrade note: `brain:upgrade` never touches your `brain/HOME.md` (it is
consumer-owned). To scaffold a HOME.md on an existing repo that lacks one, run
`brain:env:init`.

## v0.9.2 — upgrade self-host guard hardening (#180)

Fixes a lockout hazard for consumers stranded by a **pre-v0.8.0** upgrade.

- **No more false-positive lockout.** A pre-v0.8.0 upgrader plain-copied brain's
  `package.json`, clobbering the consumer's `name` → `brain`; that tripped
  `brain:upgrade`'s own `name === 'brain'` self-guard and locked the consumer out of
  every future upgrade. The self-host guard now keys on a `.brain-source` marker (present
  only in the brain source repo, never distributed) instead of the package name — a
  clobbered consumer can upgrade to recover; the old name check remains only as a
  non-fatal warning.
- **`package.json` locked into specialMerge** — a regression test pins it so it can never
  revert to a plain copy that would clobber consumer identity again.
- New anti-pattern doc: `brain/core/anti-patterns/pre-v0-8-0-upgrade-clobber-lockout.md`
  (mechanism + recovery).

Recovery for an already-locked-out consumer: restore your `package.json` name, then run
`node node_modules/brain/brain/scripts/brain-upgrade.mjs -- v0.9.2` (or `--force` once).

## v0.9.1 — upgrade/distribution robustness (#176)

Three bugs found by a real v0.9.0 upgrade test of a vendored + pnpm-workspace
consumer. **Upgrade to v0.9.1 if you are on v0.9.0** — the v0.9.0 L2 workflows did
not actually distribute.

- **L2 workflows now distribute.** `.github/workflows/release.yml` and
  `.github/workflows/governance-postmerge.yml` were missing from `managed[]`, so
  rung-2/rung-3 enforcement never reached consumers on `brain:upgrade` (the v0.9.0
  CHANGELOG claim was aspirational). They are now managed and arrive on upgrade.
- **pnpm workspace support.** `brain:upgrade` on a pnpm **workspace root** aborted
  with `ERR_PNPM_ADDING_TO_ROOT`; the installer now passes `-w` when
  `pnpm-workspace.yaml` is present (never for non-workspace pnpm or other PMs).
- **`brain:nav` fails gracefully** on a missing `brain/HOME.md` (incomplete
  adoption) — clear message + exit 1 instead of a raw ENOENT stack trace.

**No action beyond `brain:upgrade -- v0.9.1`.** Additive; no renames.

## v0.9.0 — governance v3: fail-closed substrate ladder (#144)

Governance v3 makes brain's load-bearing workflow discipline **fail-closed over
observable CI/git/PR evidence**, harness-agnostic, and capability-aware. See
[ADR-0015](brain/project/decisions/adr-0015-governance-v3-substrate-ladder.md).

### New CI gates (six enforcement levels)

`.github/workflows/governance.yml` gains, alongside `issue-link` / `diff-size`:

| Job | Level | Tier |
|-----|-------|------|
| `local-checks` | L1 — `repo:check` + `brain:nav` + `npm test` in CI | required |
| `memory-gate` | L3 — engram dumped before close | required |
| `decision-gate` | L3 — ADR ships with a `brain/HOME.md` change | required |
| `phase-order` | L4 — SDD phase order (spec/design present, monotonic status, no code before a checked task) | detection |
| `actor-check` | L5 — no self-approval of `status:approved` (PR author *or* issue author) | detection |
| `brain-writes-reviewed` | L6 — `brain/core|project` writes reviewed by a non-author human | detection |

Detection jobs **run and report but do not block merge**; promote one by moving its
name from `DETECTION_JOBS` to `REQUIRED_JOBS` in `governance-checks.mjs`.

### New managed files (arrive automatically on `brain:upgrade`)

- `.github/workflows/release.yml` — rung-2 fail-closed release gate (audits `PREV_TAG..HEAD` on a tag push).
- `.github/workflows/governance-postmerge.yml` — rung-3 post-merge auto-revert (idempotent).
- `.github/CODEOWNERS` — optional rung-1 enhancement (ships with a placeholder reviewer; set your real team).

### Substrate ladder

Every gate enforces at the **highest rung its substrate allows** (branch protection →
release script → post-merge auto-correct → detection floor) and **never lies about the
active rung**: `brain:governance-status` reports the rung and the remedy to climb higher.

**No breaking renames.** Additive gates + managed paths only. Note: the new detection
gates run in your CI on the next PR; on a solo-dev repo `actor-check` /
`brain-writes-reviewed` may show red (self-approval) — that is honest detection, not a
merge blocker. This tag also carries the previously untagged v0.8.0 / v0.8.1 content.

## v0.8.1 — brain:session:start canonical verb (#154)

### New canonical verb

`session:start` (added in v0.8.0 as a bare verb) is now prefixed under the
`brain:` namespace per the convention established by #137:

| New canonical verb       | Deprecated alias |
|--------------------------|------------------|
| `brain:session:start`    | `session:start`  |

The `session:start` alias continues to work — it shipped in v0.8.0 and will not
be removed before the next MAJOR version.

### Automated consumer migration on `brain:upgrade`

`brain:upgrade` now injects `brain:session:start` into the consumer's
`package.json` alongside the existing 8 `brain:*` verbs (via `MANAGED_SCRIPT_KEYS`
in `brain/core/managed-paths.mjs`). Consumer-wins rule applies: if
`brain:session:start` already exists in the consumer's scripts, it is not
overwritten.

The `.claude/settings.json` `SessionStart` hook now uses `npm run brain:session:start`.
Consumers whose hook still says `session:start` remain functional via the alias.

**No action required**: `brain:upgrade` handles injection automatically.

## v0.8.0 — brain:* verb namespace + automated consumer migration (#137)

### New: 8 `brain:*` canonical verbs

All harness commands now have a `brain:`-prefixed canonical name alongside the
original verb, which continues to work as a deprecated alias:

| New canonical verb      | Deprecated alias   |
|-------------------------|--------------------|
| `brain:env:init`        | `env:init`         |
| `brain:day:start`       | `day:start`        |
| `brain:ticket:start`    | `ticket:start`     |
| `brain:project:feature` | `project:feature`  |
| `brain:project:status`  | `project:status`   |
| `brain:tracker:board`   | `tracker:board`    |
| `brain:repo:check`      | `repo:check`       |
| `brain:change:verify`   | `change:verify`    |

Both forms invoke the **same direct `node` target** — no indirection, no
subprocess, no name-coupling. Old verbs are functional in 0.8.0 and will not
be removed before the next MAJOR version.

### New capability: automated `package.json` migration on `brain:upgrade`

`brain:upgrade` now **additively injects** all 8 `brain:*` script keys into
the consumer's `package.json`. Rules:

- **Consumer-wins**: if a key already exists in the consumer's `scripts`, its
  value is never overwritten.
- **Additive only**: no existing key is deleted, renamed, or reordered.
- **Idempotent**: running `brain:upgrade` a second time leaves `package.json`
  byte-identical — no mtime churn.
- **Non-scripts fields** (`version`, `dependencies`, etc.) are never touched.
- Implemented via the `specialMerge` path in `copyManaged`, the same
  mechanism already used for `.claude/settings.json`. Controlled by
  `MANAGED_SCRIPT_KEYS` in `brain/core/managed-paths.mjs` (single source of
  truth — keys and targets are never hardcoded in two places).

**No action required**: `brain:upgrade` handles migration automatically on
the first upgrade to 0.8.0.

## v0.7.2 — core→project link fix + nav guard

- `check-brain-nav` now flags any `brain/core/**` link that resolves into
  `brain/project/**`. Core is generic and shipped to consumers; `brain/project/**`
  is consumer-owned and varies — so a core→project link resolves in brain's own
  self-hosting but **breaks every consumer's `brain:nav`**. Fixed the one offender
  (`core/methodology/workflow-governance.md` referenced `ADR-0014` by path → now by
  name). Discovered dogfooding the catastro/plataforma-scit adoption. (#126)

## v0.7.1 — maintenance

- `gitlab.capabilities()` now returns a `detail` field on the `unknown` outcome,
  so `brain:governance-status` can surface the underlying glab error (parity with
  the other outcomes). No config or behavior changes for consumers.

## v0.7.0 — BREAKING: scripts/ → brain/scripts/ namespace migration (#97)

### BREAKING CHANGE — Manual action required on upgrade

Brain's managed harness directory has moved from the consumer repo root
(`scripts/`) into the `brain/` namespace (`brain/scripts/`). This eliminates the
namespace collision where `brain:upgrade` could overwrite consumer-owned scripts
living at the root `scripts/` path.

**Required migration steps (in order):**

1. **Upgrade brain**: `npm run brain:upgrade -- <new-tag>`
   After this step, `brain/scripts/` is populated with the new harness.

2. **Delete the orphaned root `scripts/`**: the installer never deletes files —
   your old `scripts/` directory remains at the repo root and is now ORPHANED
   (brain no longer manages it). Delete it manually:
   ```bash
   rm -rf scripts/
   ```
   Do NOT delete it before upgrading if you have consumer-owned files there.

3. **Update your `package.json` aliases** (if you seeded them from the README):
   ```json
   {
     "brain:upgrade": "node node_modules/brain/brain/scripts/brain-upgrade.mjs",
     "env:init":      "bash ./brain/scripts/bootstrap.sh",
     "day:start":     "node ./brain/scripts/day-start.mjs"
   }
   ```
   Note the double `brain/` in `node_modules/brain/brain/scripts/...` — this is
   intentional: the installed package is `node_modules/brain/`, and the harness
   now lives at `brain/scripts/` within it.

4. **Run `day:start` after `brain:upgrade`** to self-heal `core.hooksPath`:
   `brain:upgrade` does not write git config. Between the upgrade and the next
   `day:start`, your `core.hooksPath` still points at the old `scripts/hooks`
   (which no longer exists). `day:start` detects this and reconfigures
   `core.hooksPath = brain/scripts/hooks` automatically. During this one-run
   window, git hooks are inactive — run `day:start` promptly.

### Summary of changes

- `scripts/**` → `brain/scripts/**` in the managed-paths manifest.
- `core.hooksPath` reconfigured from `scripts/hooks` → `brain/scripts/hooks`
  by `day:start` on first run after upgrade (self-healing, one-time).
- All npm script aliases in `package.json` updated to `./brain/scripts/...`.
- Bootstrap install path changes from `node_modules/brain/scripts/brain-upgrade.mjs`
  to `node_modules/brain/brain/scripts/brain-upgrade.mjs`.



## v0.6.1 — 2026-06-28

### Fixed

- **pnpm install** (#86): removed the `prepare` script that triggered
  `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` — pnpm 11 blocks git-hosted deps with
  build scripts. brain now installs cleanly via **npm / pnpm / yarn / bun**. The
  `prepare` was useless for consumers (it ran in brain's temporary clone on a
  git-dep install); `core.hooksPath` is configured by `env:init` and self-healed
  by `day:start`.

## v0.6.0 — 2026-06-28

### Added — Workflow governance (ADR-0014, #67)

A **tool-agnostic** governance layer enforcing the 4 load-bearing invariants
(approved ticket · PR ≤400 · memory dumped · ADR for decisions):

- **The floor** (always-on, tool-independent): the generic checks library
  (`scripts/governance/checks/`), the client-hook suite (`commit-msg`,
  `pre-commit`, a reliable `pre-push`), and **`brain:audit`** — re-verifies the
  invariants on merged history (the universal teeth).
- **The hard gate** (additive, capability-aware): `brain:protect` +
  `branchProtect` adapter verb (GitHub; GitLab Phase 3); **`brain:governance-status`**
  reports per-consumer what enforcement the platform/tier actually supports.
- **The golden path**: `brain:start` / `brain:check` / `brain:save` / `brain:ship`
  / `brain:next` — self-gating verbs unifying human + agent.
- **`--no-verify` policy**: a `repo:check` prohibited-reference + a Claude Code
  PreToolUse hook (`.claude/settings.json`).

### Changed

- `pre-push` `.memory/` check is now a **WARNING**, not a hard block — the
  reliability precondition for the `--no-verify` policy (the hook re-materializes
  memory, which churns, so a hard block self-blocked the push).
- New npm scripts: `brain:audit`, `brain:protect`, `brain:governance-status`,
  `brain:start`, `brain:check`, `brain:save`, `brain:ship`, `brain:next`.

### Notes

- **L1 hard enforcement** (branch protection / rulesets) requires **GitHub Pro
  for private repos, a public repo, or self-hosted** — run `brain:governance-status`
  to see your repo's capability. The **floor (hooks + audit) works on every repo,
  tier, and platform**. Activation (`brain:protect`) is a one-time per-repo admin step.

## v0.5.0 — 2026-06-27

### Added

- **Auto-ADR onboarding** (ADR-0013, #53): the bootstrap notices when
  `brain/project/decisions/` has no ADRs and points to the new
  `/project:bootstrap-adrs` agent command, which explores the consumer repo and
  drafts **descriptive** starter ADRs (Stack, Testing, Build) into
  `openspec/changes/auto-adrs/brain-drafts/` (Tier 1). The human accepts each into
  `brain/` via per-action **Tier 2** confirmation; the agent never auto-commits and
  never invents rationale (`Context`/`Consequences` stay `<TODO>` stubs).
- **`memory:import`** verb — `engram sync --import` only (no `git pull`).
- **`post-merge` git hook** — re-imports engram after any pull/merge.

### Fixed

- **Cross-machine `memory:pull` churn** (#59): `engram sync --export` rewrites
  `.memory/manifest.json` and leaves it dirty, blocking a `git pull`
  (*"local changes would be overwritten"*). `memory:pull` is now churn-resilient
  (restore the regenerable manifest → `git pull` → import). The manifest stays
  **committed** — it is engram's authoritative chunk index (see ADR-0002 note);
  gitignoring it would silently lose memory on every fresh machine.

### Changed

- `memory:pull` now performs a safe `git pull` (restore + pull + import), not just
  an import. Use the new **`memory:import`** for the old import-only behavior.

## v0.4.1 — 2026-06-27

### Fixed

- `brain-upgrade` (and the install flow) now use `git+https://…#<tag>` instead of
  npm's `github:` shorthand, which resolved to SSH and failed for the **private**
  brain repo on HTTPS-only consumers (CI / containers without an SSH key).
  `package.json` gains a `repository` field; the install URL is derived from it
  and normalized to `git+https`. (#44)

## v0.4.0 — 2026-06-27

### ⚠ BREAKING

- **VCS credential env var is now generic `VCS_TOKEN`** (was provider-specific
  `GITHUB_TOKEN` / `GITLAB_TOKEN`). **Action for consumers**: rename the variable
  in your `.env` to `VCS_TOKEN`, then re-run `npm run env:init` to refresh the git
  credential helper. (#33)

### Added

- **CLI output i18n** — harness output externalized to message catalogs
  (`scripts/i18n/`) with an English canonical fallback, driven by `docs.language`. (#11)
- **Feature-scoped working memory** — a second memory layer that travels with the
  feature branch (`openspec/changes/<feature>/resume.md` + `feature-checkpoint` /
  `feature-resume` verbs), hydrated into local engram, never merged to `main`.
  (ADR-0011, #16)
- **Harness-init adapter** — each SDD harness defines its own `init` via
  `scripts/harness/`; `bootstrap.sh` dispatches instead of an inline `case`.
  (ADR-0012, #27)
- **`env:init` bootstraps `brain.config.json`** for a fresh consumer: creates it
  from the schema and derives `vcs.provider` + `gitHost` + `slug` from the git
  origin (interactive provider confirm on a TTY). (#41, #35)

### Changed

- Restored the `.memory/` ↔ `.engram` abstraction: `.memory/` is the committed
  canonical directory, `.engram` a local symlink. The pre-push memory guard now
  actually works. (#234)
- The feature-working-memory contract is promoted to `brain/core/`. (#26)

### Fixed

- `feature-checkpoint` resolves the single active change that has a `resume.md`
  in multi-change repos. (#25)
- The harness SDD-context check resolves the engram project as the bare repo
  name (no spurious "context not found" notice). (#37)
- Stale `ADR-0003` references corrected; `package-lock.json` gitignored
  (zero-dependency repo). (#23, #28)

## v0.1.0

Initial versioned release: NX monorepo, VCS provider adapter, versioned
installer with managed paths + additive migrations, memory backend adapter,
check-refs engine.
