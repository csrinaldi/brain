# Upgrade-safety integration test

Verifies that upgrading brain in a consumer repo **updates the managed core** but
**never touches the consumer's project-specific files** — the read-only-core
contract ([ADR-0003](../../brain/project/decisions/adr-0003-split-core-project-self-hosting.md) /
[ADR-0006](../../brain/project/decisions/adr-0006-distribucion-installer-versionado.md)).

Maintainer/CI test; not part of `brain/core` and not part of `npm test`.

## Run

```bash
npm run test:upgrade -- v0.4.0 v0.4.1   # explicit FROM → TO
npm run test:upgrade                     # second-latest → latest tag
```

## Requirements

- **Docker**, and a **github token** (`VCS_TOKEN` or `gh auth token`) with read
  access to the private brain repo (never logged).

## What it does

1. Installs brain @ **FROM** in a clean container, seeds the managed paths + runs `env:init`.
2. Adds consumer customizations: a `brain/project/` ADR, a `.env` variable, a custom
   `brain.config.json` value (`project.owner`), and an `openspec/changes/` dir.
3. Upgrades to **TO** (re-install `git+https` + `brain:upgrade`).
4. Asserts (exits non-zero on any breach):
   - brain is now at **TO** and the managed scripts/core were updated;
   - the `brain/project` ADR, the `.env` var, the custom `brain.config.json` value,
     and the `openspec/changes/` dir **all survive**.

## Note

The FROM managed state is seeded via a managed-paths copy: a pre-v0.4.1
`brain-upgrade` uses the SSH `github:` shorthand and can't run over HTTPS. The
**TO** upgrade uses the real `brain:upgrade` (git+https, #44). Existing
pre-v0.4.1 consumers need a one-time `npm i -D "git+https://…#v0.4.1"` to cross
that boundary; after v0.4.1, HTTPS upgrades work directly.

---

# M4 danger-path suite (#401)

The test above proves the **happy** path against real releases. This one proves
the four **danger** paths epic #313's M4 hard gate names — and is the checkable
form of that gate: external adoption opens when it is green.

```bash
npm run test:danger-paths
```

Requires **Docker**. Needs **no github token and no network access to GitHub**.

| # | path | ticket |
|---|------|--------|
| 1 | a mid-upgrade write failure rolls the tree back byte-identical | #396 |
| 2 | a consumer-edited managed file is refused, never silently clobbered | #397 |
| 3 | a downgrade is refused without `--allow-downgrade` | #398 |
| 4 | corrupt consumer JSON is named up front; `--skip-merge` completes | #399 |

## Why it builds a local git remote instead of using tags

The behaviour under test exists only in code **newer than every published tag** —
`v1.0.0` predates all four safety tickets. A tag→tag run cannot exercise any of
it and would go green while testing nothing.

Worse, the three-way modification detection (#397) reads the **outgoing** package
*before* the install. `run.sh` pre-installs TO and then invokes `brain:upgrade`,
so `outgoing == incoming` there and detection degrades — the REFUSE gate could
never fire in that harness even with the right code.

So this suite packs the **working tree** into a bare git repo inside the
container, tags two versions, and lets `brain:upgrade` run its own real `npm i`
against `git+file:///…`. That keeps the genuine install path (npm cloning a git
remote, `outgoing != incoming`) while making the suite track the **branch** —
which is what #401 requires: red today, green as each ticket lands.

`resolveInstallUrl` passes a `git+file://` URL through unchanged (its
"unknown form, already prefixed" branch), which is what makes this work.

**One place inside this suite still has `outgoing == incoming`, on purpose:**
path 2's *second* invocation, the `--force-managed` one. `brain-upgrade.mjs`
takes the outgoing snapshot, *then* installs, *then* calls `copyManaged` — so by
the time the forced run happens, `node_modules/brain` is already at TO and the
degradation `run.sh` suffers from is back. It is **not** a false pass today: the
REFUSE gate keys on `consumerModified` alone and never reads `brainChanged`
(`installer.mjs`), so the assertion means what it says. Recorded because if that
gate is ever tightened to also require `brainChanged`, this assertion turns green
and silent rather than red — and nobody would know to look here.

## The suite is proven live, not merely green

A passing e2e suite is worth nothing until you have watched it fail. Each
protection was disabled in turn and the suite re-run:

| mutation | result |
|---|---|
| failure thrown **before** `createRestorePoint` | path 1 red (3 assertions) |
| a fail-fast check added to the read-only **pre-flight** | path 1 red (2 assertions) — see below |
| the `.github/CODEOWNERS` **seed** made to fail | seed guard red in all 5 consumers |
| REFUSE early-return removed (`copyManaged`) | path 2 red — *"THE CLOBBER #397 EXISTS TO PREVENT JUST HAPPENED"* |
| downgrade guard disabled | path 3 red (3 assertions) |
| corrupt-JSON pre-flight disabled | path 4 red (`--skip-merge` no longer completes) |

The second and third rows were added by #447, and both were **green before it**:

- The pre-flight mutation — a plausible "fail fast" regression raising the same
  `ENOTDIR` the write loop would raise, inserted above `createRestorePoint` —
  passed **24/24**, printing `✓ the failure happened INSIDE the write loop — the
  restore point was reached` while no restore point was ever constructed. The
  first row's mutation did go red, but only because making `createRestorePoint`
  *itself* throw is the one case that set `beforeAnyWrite`. The class was named in
  this table and not covered. #447 hoisted the flag so the whole read-only phase
  is tagged by construction, and both rows are red now.
- The seed mutation passed **24/24** too, including `✓ negative control: an
  UNTOUCHED CODEOWNERS upgrades without prompting` — over a consumer that had no
  CODEOWNERS at all. `copyManaged` skips the three-way check when the dest does
  not exist, so nothing is `consumerModified`, so the gate cannot fire, so the run
  exits 0 for the wrong reason.

Three of those mutations are worth understanding, because they are the reason the
assertions are written against **bytes and exit codes** rather than messages:

- With the failure moved **before** the restore point, path 1's original pair of
  assertions — non-zero exit, and byte-identity of every managed path — both
  stayed **green**. Any failure earlier than the write loop satisfies them for
  free, so the scenario passed while proving nothing about the rollback it exists
  to prove. Path 1 now asserts the run reached the write loop, that it was not a
  pre-flight refusal, and that the cause was the induced `ENOTDIR`.

- With the REFUSE gate removed, the run **still printed "refused" and still
  exited 1** — it simply wrote the files first. Every message-based assertion
  passed. Only the byte-level check caught it.
- With the pre-flight removed, the corrupt file **still stopped the run and was
  still named** — from a later failure inside the merge. The pre-flight's value
  is not the message; it is failing *early* so `--skip-merge` can work. Only the
  behavioural assertions caught that.

That is the "green in test, inert in production" class M10 taught, reproduced
deliberately so the suite is known to be load-bearing.

## Why its own workflow, not a job in governance.yml

`.github/workflows/m4-danger-paths.yml` — a dedicated workflow, which is the
choice #401 asked to be made and documented.

The first attempt added a job to `governance.yml` and **governance.yml's own
drift-guards rejected it**, which is the machinery working. Two reasons it does
not belong there:

1. That file's job set is a **ratified contract** (ADR-0015). Every job in it is
   a governance gate with a tier-resolved exit policy in `GATE_MATRIX`, and the
   drift-guards assert the YAML job names equal `GOVERNANCE_JOBS` exactly. This
   suite is a maintainer e2e test, not a governance gate — registering it there
   would mean declaring a tier policy for something tiering has no opinion about.
2. `governance.yml` is a **managed path, vendored into every consumer**. A job
   that only ever runs in the brain source repo does not belong in a file every
   consumer carries. `m4-danger-paths.yml` is not a managed path, so it stays here.

Runtime and blast radius point the same way: minutes rather than the seconds
`local-checks` takes, and it is the only workflow needing Docker — so a Docker
failure reads as "the e2e suite broke", not "repo:check is red". Still gated on
`.brain-source` as belt and braces.

## What this gate does and does NOT block

**A red suite does not stop a merge to `main`.** Verified, not assumed:

```bash
gh api repos/csrinaldi/brain/branches/main/protection \
  --jq '.required_status_checks.contexts'
# ["issue-link","diff-size","local-checks","memory-gate","decision-gate"]
```

`m4-danger-paths` is absent, and **cannot be added through `brain:protect`**:
that verb derives its contexts from `checkContexts(tier)` → `requiredJobs(tier)`
over `GOVERNANCE_JOBS`, and this suite deliberately does not belong to that
ratified set (see the section above).

Registering the context by hand is worse than leaving it out. `branchProtect`
issues `PUT …/branches/main/protection`, and that endpoint **replaces the whole
protection object** — so an out-of-band context survives only until the next
`brain:protect` run, then vanishes silently. A gate that disappears on its own
is more dangerous than one that was never armed, because in between it looks
enforced.

**So M4 is a human-read gate, and that is faithful to how epic #313 states it:**
*"external adoption opens when this suite is green."* Opening adoption is a
decision a person makes, not a merge a bot allows. This suite is the evidence
that decision rests on — run it, read it, then decide.

What that costs, stated plainly: **this suite can go red and nothing stops the
merge.** Whoever opens external adoption has to run it on purpose. If that ever
needs to be fail-closed, it needs a durable mechanism (a config-driven extra
context that `brain:protect` arms), which is a governance change with its own
decision to make — not something to bolt on here.
