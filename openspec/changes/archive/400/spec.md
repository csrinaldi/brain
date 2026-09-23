---
status: spec
issue: 400
epic: 313
artifact_store: openspec
topic_key: sdd/issue-400-npx-brain-init/spec
---

# Spec — `npx brain init` (issue #400)

Requirements are tagged `REQ-400-N`. Per the epic's standing M4 rule, **every requirement
that touches the install path is pinned by a test that drives the real CLI** — a suite that
never runs the command a consumer runs carries no information about it (#396's lesson).

## REQ-400-1 — `brain` is executable without any consumer alias

`package.json` MUST declare `bin: { "brain": "brain/scripts/cli-entry.mjs" }`, and the
entry MUST be executable (shebang + mode) so `npx brain` resolves in a consumer repo that
has brain installed and **no** `brain:*` script.

## REQ-400-2 — `init` writes the bootstrap alias, and only what is missing

`npx brain init` MUST merge `brain:upgrade` into the consumer's `package.json` `scripts`
through `mergePackageJsonScripts` — consumer value wins, no key reordered, no other field
touched. Running it twice MUST leave the file byte-identical the second time (the existing
no-op-write discipline).

## REQ-400-3 — a consumer's own `brain:upgrade` is never overwritten

A consumer who already defines `brain:upgrade` (any value) keeps it. This is the same
consumer-wins rule the merge already guarantees; pinned here because `init` is the one
call site where clobbering it would be silent and total.

## REQ-400-4 — `init` resolves the installed tag rather than asking for it

The tag passed to `brain:upgrade` MUST be derived from the **installed** package
(`node_modules/brain/package.json`'s `version`), not from an argument the operator must
remember and not from a hardcoded default. An explicit `npx brain init <tag>` MAY override
it. If the version cannot be read, `init` MUST refuse with the reason — never guess a tag,
which would silently install a different version than the one the consumer pinned.

## REQ-400-5 — `init` refuses outside a consumer repo, and inside brain itself

No `package.json` in cwd → refuse with the remedy (`npm init -y` first). Running inside
brain's own checkout (the `.brain-source` marker `brain:upgrade` already honors) → refuse:
`init` would rewrite brain's own scripts.

## REQ-400-6 — `init` reports the next step; it does not run the interactive one

After a successful upgrade, `init` MUST print the `brain:env:init` next step. It MUST NOT
invoke it: `bootstrap.sh` is interactive, and a non-interactive context (CI, a container
without a TTY) would hang or half-configure. Recorded as a decision, not an omission.

## REQ-400-7 — `npx brain --help` lists the verb surface

`--help` (and bare `npx brain` with no subcommand) MUST list the available verbs and the
`AGENT_PLATFORM` / `plain` escape hatch, exit 0, and write nothing.

## REQ-400-8 — exit codes are honest

`init` exits non-zero when the upgrade it delegates to fails, so a scripted adoption
cannot report success over a failed install. An unknown subcommand exits non-zero with the
verb list.

## REQ-400-9 — the fresh-install e2e proves the new flow on all four PMs

`test/fresh-install/in-container.sh` MUST replace its hand-written alias step
(`in-container.sh:118`) with `npx brain init`, and keep its existing consumer-customization
assertion (a consumer-set `brain:day:start` survives). Green on npm, pnpm, yarn and bun.

## REQ-400-10 — the documented flow matches the tested flow

README's install section MUST describe exactly what the e2e runs. The pre-#400 manual path
stays documented as a fallback, explicitly labelled as such.
