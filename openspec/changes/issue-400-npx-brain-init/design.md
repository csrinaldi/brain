---
status: design
issue: 400
epic: 313
artifact_store: openspec
topic_key: sdd/issue-400-npx-brain-init/design
---

# Design — `npx brain init` (issue #400)

## D1 — `init` reuses the merge; it does not reimplement alias-writing

`mergePackageJsonScripts` already implements exactly the semantics `init` needs —
consumer-wins, no reordering, no-op write when unchanged — and it is already tested and
already the path `brain:upgrade` uses for the other nine verbs. `init` passes it a
one-entry map. **One writer, two callers**, not a second package.json writer that can
drift from the first.

## D2 — only ONE alias is written, and the reason is recorded in code

`init` writes `brain:upgrade` alone. The other nine arrive from the upgrade it then runs.
Writing all ten would work but would hide the paradox that motivates this whole ticket and
would duplicate `MANAGED_SCRIPT_KEYS` at a second site — the exact drift class
`verb-contract-drift-guard` exists to catch elsewhere. The comment at the write site names
why `brain:upgrade` is un-injectable, so the next reader does not "fix" the omission in
`MANAGED_SCRIPT_KEYS`.

## D3 — the tag comes from the installed package

`node_modules/brain/package.json`'s `version` is what the consumer actually resolved, so
it is the only source that cannot disagree with what is on disk. Reading the dependency
**spec** from the consumer's `package.json` instead would be wrong: `git+https://…#v1.0.0`,
`^1.0.0` and a branch ref all denote different things, and none of them is guaranteed to
be what npm installed. Refusing when unreadable (REQ-400-4) beats defaulting, which would
silently install a version the consumer did not pin.

## D4 — `init` stops before the interactive step

`brain:env:init` (`bootstrap.sh`) prompts. Chaining it would make `init` hang in CI or in a
TTY-less container — the very environments an adoption script runs in. `init` prints the
command instead. This is a deliberate boundary: **`init` is the non-interactive half of
onboarding.**

## D5 — `cli-entry.mjs` dispatches, it does not implement

The entry parses a subcommand and delegates: `init` → the init module, `--help`/none →
the verb list. Keeping logic out of the bin file means the behaviour is unit-testable
without spawning a process, while the e2e still proves the spawned path (the two-level
discipline `installer-journal.integration.test.mjs` established: cheap unit cases plus one
real-process case that is the point of the slice).

## D6 — OPEN, for a human answer: registry / mirror / public repo

The ticket folds in an unresolved distribution question. It does **not** block this work —
`npx brain <cmd>` resolves against the installed `node_modules/brain` regardless of where
the package came from. But it does bound the promise: `npx brain init` in a repo that has
**not** yet installed brain cannot work from a private git dep the way a registry package
could. Q2-adjacent (#356). **Recorded here for a decision; not decided by this change.**

## D7 — the e2e is edited, not added to

`test/fresh-install/in-container.sh` already runs the real flow across four package
managers. #400 replaces its hand-written alias line with the new verb rather than adding a
parallel test — otherwise the fixture would keep proving the old path works while the
README documents a different one, which is how documentation and behaviour drift apart
(the `whoami` row, #428, one week earlier).

## Alternatives rejected

- **`postinstall`/`prepare` lifecycle hook** — breaks pnpm on git deps (#86). The ticket
  already ruled it out; recorded so it is not revisited as a "simplification".
- **Add `brain:upgrade` to `MANAGED_SCRIPT_KEYS`** — does not solve anything: the merge
  only runs during an upgrade, which cannot start without the alias.
- **Have `init` write all ten aliases** — see D2.
- **Have `init` run `brain:env:init`** — see D4.
