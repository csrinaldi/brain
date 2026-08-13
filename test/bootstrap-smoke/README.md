# bootstrap smoke — the three verbs every adopter runs (issue #458)

```bash
node test/bootstrap-smoke/smoke.mjs           # run it
node test/bootstrap-smoke/smoke.mjs --keep    # keep the fixture for inspection
```

No docker, no GitHub token, no network. Runs in well under a minute.

One entry point, and it is node rather than a `run.sh` wrapper. Its two siblings
are `run.sh` + `in-container.sh` pairs because they need a container; this one
does not, so a wrapper would be a second place to keep in sync for a banner and
two `command -v` checks. It also failed `auditWorkflowAuth`'s step reader —
`bash` is not on its inert list, so a `bash …/run.sh` step reads as reaching the
server with no credential declared and the drift-guard fails the workflow.
Measured. The right fix is one entry point it can classify, not a wider list.

## What it asserts

| # | assertion |
|---|---|
| 1 | `brain:env:init` exits 0 **and** the tree it leaves is complete — `brain.config.json` with the full schema and the identity derived from the fixture's origin, `brain/HOME.md`, `AGENTS.md`, `.env`, `core.hooksPath` |
| 2 | `brain:session:start` exits 0 |
| 3 | `brain:day:start` exits 0 **and reaches its last step**, not just an early exit |
| 4 | a second `brain:env:init` exits 0 and changes nothing |

Assertion 1 is two assertions on purpose. #446 exited 127 **after** writing
`brain.config.json` and `HOME.md` and before doing anything else, so a partial
bootstrap is the shape to catch — and a variant that skips a step while still
exiting 0 would pass an exit-code check alone. Proven: skipping the harness init
and returning 0 turns assertion 1 red on `AGENTS.md` (mutation C, below).

## Why a fixture, and why no container

The fixture is the repo copied into a scratch dir with `.brain-source` removed —
the marker several verbs branch on, which a consumer never receives. It is
seeded by **copy**, never by running the verb under test: a broken bootstrap
must not be able to produce the baseline its own assertions compare against
(`test/upgrade`'s reasoning, reused).

`HOME` is redirected into the scratch dir, so nothing touches the runner's home.

Its two siblings pay for docker because they need it: `test/fresh-install`
installs from a published tag and needs `VCS_TOKEN`; `test/upgrade` builds a git
remote and runs real `npm i`s. This suite runs three verbs that are supposed to
work with nothing available, so a container would buy isolation already obtained
and would make the suite unrunnable on a machine without a docker daemon —
which is where a maintainer usually is when a bootstrap breaks.

It is not wired into `npm test`: that is the fast gate `local-checks` runs on
every PR, and this spawns four full verb runs against a copied tree. It runs in
its own workflow, beside `m4-danger-paths` in cost and in character, and is
**not a required status context**.

## Red-proof

Each mutation was applied, its diff printed, the file re-read from disk, the
suite run, then reverted and verified byte-identical.

| # | mutation | result |
|---|---|---|
| A | **the #446 replay** — `memory.import.stateUnreadable` renamed back to `memory.import.state-unreadable` in `en.mjs` | `brain:env:init` exits **127**, 6 assertions red, with exactly the partial-bootstrap signature: config and HOME.md present, `AGENTS.md`/`.env`/hooksPath missing |
| C | `env:init` skips the harness init but still exits 0 | 1 red — the `AGENTS.md` post-condition. Exit 0 is not enough, and this proves it |
| D | `brain:session:start` throws | 1 red |
| E | `brain:day:start` aborts mid-sequence | 2 red — the exit code and the reached-its-end check |
| F | `env:init` appends a timestamp to `HOME.md` on every run | 1 red — the idempotency manifest |
| G | the `.env` set comparison degenerates to an empty set | 1 red — the guard that stops the one relaxation becoming "accept anything" |

## The one relaxation, and the finding behind it

`.env` is compared as a **set** of `KEY=value` lines rather than byte-for-byte.
Measured: a second `brain:env:init` writes the same three keys in a different
order — `AGENT_PLATFORM` moves from the first line to the third. Same keys, same
values, different bytes.

That is a real non-idempotency in `brain/scripts/bootstrap.sh`. It is recorded
here and on #458's PR rather than repaired, because that file is outside the
change's file claim. A key gained, lost or re-valued still fails; mutation G
proves the relaxation cannot widen past that.
