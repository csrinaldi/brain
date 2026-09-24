# ADR-0036 — A change is done when it works on a fresh consumer install, at a cost one person can pay

> **status:** proposed — pending human promotion | **date:** 2026-09-24 | **owner:** @crinaldi
> **relates to:** ADR-0015 (enforcement honesty), ADR-0026 (tiers), ADR-0027 (upgrade rollback), ADR-0030 (distribution), ADR-0035 (a rule earned by observable evidence); epic #1121 rulings 1 and 4

> **Tier 2 draft.** `brain/project/decisions/**` is human-promoted (`agent-authorities.md` Tier 2).
> Promote with `npm run brain:promote -- <this path>`: the verb writes the house header, adds the
> `brain/HOME.md` entry `decision-gate` requires, regenerates `AGENTS.md` and stages all three.
> Committing them is the signature. The number `0036` was free on `origin/main` at 1.7.0 (highest: 0035).

## Context

Brain is a product other repositories install. Its tests run in brain's own repository, and
brain's repository has preconditions no consumer has: every script alias, an `openspec/changes/`
directory, a `.gitignore`, a configured `vcs.provider` and `project.name`, a long-lived memory
store, and no consumer edits to lose on upgrade. A defect that depends on one of those
preconditions is invisible to brain's suite by construction. It keeps shipping:

| Instance | What broke in consumers | The precondition only brain had |
|---|---|---|
| v0.9.5 (#211) | The vendored `local-checks` job ran `npm test`, brain's whole internal suite, inside consumer repositories; tests coupled to brain's repository state went red there | brain's repository state |
| #397 | `brain:upgrade` plain-copied five consumer-editable managed files and overwrote the consumer's edits; only two were merged | a tree with no consumer edits |
| #1094 | The shipped workflow ran `npm run repo:check`, a script no consumer receives | brain's own `package.json` aliases |
| #1113 | The archive sweep crashes when `openspec/changes/` does not exist, and its alarm names the wrong cause | an `openspec/changes/` directory |
| #1112 | A fresh consumer's `init` can publish a credential (`.env` not ignored; a PAT reached tracked `brain.config.json`) and reports success over failures it saw | a `.gitignore`, a validated provider, a non-empty `project.name` |
| #1116 | A fresh engram 2 store rejects brain's import sessions, so a deferred record never reaches engram | a memory store that is not fresh |

The #1081 consumer demonstration (`@logikas/brain@1.7.0` installed from npm into a new, empty
repository) found **ten** defects in the consumer path, F1 to F10, and its exit report on #864
states it directly: *none of them shows in brain's own repository*. Two of them (F1, F2) can
publish a credential; three (F6, F8, F9) break the one column memory exists for.

The two checks brain already has do not close the class, for measurable reasons:

- `bootstrap-smoke.yml` (#458) runs the bootstrap verbs cold, but its fixture is **brain's own
  repository copied** into a scratch directory with `.brain-source` removed
  (`test/bootstrap-smoke/README.md`; `smoke.mjs` excludes only `.git`, `node_modules` and
  `.brain-source`). It carries brain's `package.json` aliases, `.gitignore` and
  `openspec/changes/`, three of the preconditions in the table above.
- `test/fresh-install/` installs from the registry into a clean container, but it installs a
  version that is **already published**, and no workflow runs it: it is `npm run
  test:fresh-install`, by hand. It can find a defect only after the version is burned, which
  `publish.yml`'s own header says cannot be cleanly undone.

Green tests in brain's repository are a claim about consumers. They are not the proof. The
maintainer ruled on 2026-09-24 (#1121, rulings 1 and 4) that the proof is a fresh consumer, and
that it gates every publish.

## Decision

**A change is done when it works on a fresh consumer install, at a cost one person can pay.**
Brain's own suite stays necessary. It stops being sufficient.

### "A fresh consumer install", operationally

All five hold, or the install is not fresh:

1. **A new repository.** An empty git repository created for the run, not a copy of brain's
   tree and not a consumer fixture that already carries brain's files.
2. **The packed tarball.** Brain is installed from the output of `npm pack` at the commit under
   test: the bytes the registry would serve (ADR-0030). A workspace link, `npm link`, a `file:`
   path to the source tree, or a copy of `brain/` is not an install.
3. **Install, bootstrap, diagnosis.** The run performs the consumer's own sequence: install the
   package, `npx brain init`, `brain:env:init`, and the diagnosis verb (`brain:doctor` once #1130
   ships; until then, every bootstrap verb's exit code and post-conditions).
4. **The changed behaviour is exercised.** The run reaches the code the change touched, through
   the verb a consumer would call. An install that passes without reaching it proves nothing
   about the change.
5. **Nothing carried over.** No state from brain's repository or the operator's machine: no
   inherited `HOME`, credential, memory store, git config beyond an identity, or environment
   variable the consumer would not have.

### "A cost one person can pay", as three checks

The default path, from install to a green diagnosis:

1. **completes with one maintainer.** No second approver, second account or second identity is
   required by default. At `lite` the platform review count is 0 (ADR-0026 Amendment 6); #1124
   makes `lite` the stated default for new consumers, which is what makes this check satisfiable.
   A consumer that declares `standard` or `regulated` opts into a second person on purpose.
2. **has no unnamed manual step.** Every action the operator must take outside the verbs is
   printed by `init`, `env:init`, `brain:upgrade` or the diagnosis verb, with the command to run.
   A step the run has to perform that no verb's output named is a failure of this check.
3. **needs no ADR to follow.** A verb may cite an ADR as the reason. The instruction itself is in
   its output. An operator who has read no ADR can finish the path.

### The publish gate (implemented by #1136)

Before `publish.yml` releases a version, the gate installs that version's packed tarball into a
fresh consumer, as defined above, for each combination of:

| Axis | Values |
|---|---|
| Agent platform | each supported platform CI can exercise: today `claude` and `antigravity` (#1125) |
| Memory backend | `plainfiles`, `engram` |
| VCS provider | `github`, `gitlab` |

Each run performs install, bootstrap and diagnosis, plus one memory round-trip (#1136). The rules:

- **A covered combination that fails refuses the publish.**
- **A combination CI cannot exercise is reported as `not covered`, never silently skipped.** The
  run summary lists every combination as `passed`, `failed` or `not covered`, and every
  `not covered` entry carries its reason. The not-covered set is declared data, changed in a
  reviewed pull request, never decided at run time.
- **An environment failure is a failure, not `not covered`.** If a combination is declared
  covered and its setup breaks (engram does not install, a runner dependency is missing), the
  combination failed. Otherwise the gate could turn any red into a quiet gap.
- **"Exercise a platform" means brain's install, bootstrap and diagnosis for that platform's
  projection.** A live agent session is not exercised, and the summary says so rather than
  implying it.
- **The gate counts only after it has been shown red.** Before #1136 is accepted, the gate must
  fail on at least one replayed defect from the Context table, the same mutation discipline
  `bootstrap-smoke` was held to.

A gate that reported success over a combination it knows it did not run would be the
overclaim ADR-0015 forbids, and would let a coverage gap mask a failure, which ADR-0026's
"neither may mask the other" forbids for its own two axes.

### Until #1136 lands

This ADR records the bar before a machine enforces it, and says so. Until the gate exists, a
change whose shipped bytes or shipped verbs differ states in its verification how it was
exercised on a fresh consumer, or states that it was not. No gate reads that statement; review
does. A change that touches nothing a consumer receives (brain's own CI, tests, `openspec/`)
meets the bar vacuously and says so in one line.

## How this relates to other decisions

- **ADR-0015** (enforcement honesty). The gate follows its rule: never report a check as
  passing, or as armed, when it did not run. `not covered` is that rule applied to a matrix.
- **ADR-0026** (tiers). The one-maintainer check is satisfiable because `lite` needs no second
  approver. This ADR changes no tier parameter; #1124 changes the default.
- **ADR-0027** (upgrade rollback). The publish gate covers a fresh install, not an upgrade.
  Upgrade from 1.x is #1131, and ADR-0027's restorability stays the rollback contract.
- **ADR-0030** (distribution). The tarball is the distribution unit, so the tarball is what the
  gate installs. `test/publish-allowlist.e2e.test.mjs` already packs for real to check its
  contents; this gate installs the result.
- **ADR-0035** (content-earned exemption). Same shape of rule: the branch name is a claim and
  the diff is the proof there; brain's suite is the claim and the fresh consumer is the proof here.
- **#1123** (autonomy A/B/C). Mode B merges when every gate passes. This bar is what makes
  "every gate passes" say something about consumers, not only about brain's repository.
- **#1124** (`lite` by default) makes check 1 true for new consumers. **#1125** (`claude` by
  default, `antigravity` second) fixes the platform axis of the matrix.

## Consequences

- **Releases get slower.** Up to eight fresh installs (2 × 2 × 2) run before every publish. A
  failure in any covered combination holds the release until it is fixed.
- **CI minutes grow** with every combination, and `engram` must be installable on the runner.
- **Some combinations start as `not covered`.** A GitLab combination needs a forge CI can reach;
  whether it is exercised against a live instance or only against the port's offline surface is
  #1136's design question. What this ADR fixes is that the summary says which.
- **A green gate proves the matrix, not every consumer.** Monorepos, other package managers,
  pre-existing `.gitignore` or hooks, and consumers upgrading from 1.x stay outside it. They are
  named here so the gate is not read as covering them.
- **Doctrine runs ahead of enforcement** until #1136 ships. That gap is stated above, not implied
  away.

## What does NOT change

- Every existing gate: `governance.yml`'s jobs, their tier policies, `bootstrap-smoke`, and the
  post-publish `test/fresh-install` check.
- Brain's own repository keeps running its own suite on every pull request and before every
  publish. The fresh-consumer bar adds to it. It replaces nothing.
- No tier parameter, required status context or branch-protection setting changes in this ADR.

## Rejected alternatives

**Brain's own suite as the bar.** It is the status quo, and the Context table is its record: the
same class, six times, plus ten defects in one demonstration.

**A post-publish check** (what `test/fresh-install` is today). It finds the defect after the
version is burned, and every consumer who upgrades in between receives it.

**Require every combination to pass, with no `not covered` state.** A combination CI cannot run
would then block every release. The cheapest way out would be to delete the combination from the
matrix, which is a silent skip with extra steps.

**A second human approver as the quality bar.** It is not a cost one person can pay, and a
reviewer reading a diff in brain's repository is looking at the same preconditions the suite is.
