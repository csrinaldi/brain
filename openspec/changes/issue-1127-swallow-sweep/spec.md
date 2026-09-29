---
status: draft
issue: 1127
---

# Spec

## REQ-1127-1 — every swallow in the scoped paths carries a written verdict

Every JS `catch` / `.catch(` whose body neither throws nor exits, and every shell/YAML `|| true`,
`|| :`, `|| echo`, `|| exit 0`, `|| warn`, `set +e` or `continue-on-error`, in the install,
bootstrap, upgrade, memory-CLI and post-merge paths, MUST carry one of `swallow-ok: <reason>`,
`surfaced: <how>` or `follow-up: slice-X <what>` in or directly above it, with a reason of at
least 15 characters.
**Falsifiable by**: adding `try { x(); } catch { }` to any scoped file and observing
`swallow-guard.test.mjs` pass.

## REQ-1127-2 — a verdict that guards nothing, or an owned-elsewhere entry that matches nothing, fails

An orphan marker (no swallow site claims it) and a stale `OWNED_ELSEWHERE` entry (its owner
landed) MUST fail the guard, so the inventory cannot rot into a list of claims about code that is
gone.

## REQ-1127-3 — `archive.mjs --backfill` treats a missing `openspec/changes/` as zero entries

It MUST read the changes root through `listChangeFolders()` (the reader the post-merge sweep uses
since #1113): `ENOENT` on the root is `[]`, any other read failure still throws.
**Falsifiable by**: running `archive.mjs --backfill` in a repo with no `openspec/changes/` and
observing an uncaught `ENOENT` and exit 1.

## REQ-1127-4 — `feature-resume` rejects when files were not projected

`featureResume` MUST attempt every file, then throw naming each file that did not land (or, when
the change directory cannot be read at all, throw). A partial hydration MUST NOT exit 0.
**Falsifiable by**: an `_engramSave` that throws for one file, with `featureResume` resolving.

## REQ-1127-5 — the scanner itself is proven a detector

The scanner MUST be exercised against synthetic sources: unmarked catch, marked catch,
throwing catch, weak reason, `follow-up` without a slice, `.catch(`, shell lines, owned entry,
and a source it cannot mask (loud failure, never a silent miss).

The synthetic evasion set MUST include: an adjacent catch (no inherited marker), a conditional
`throw`, an `exitCode` identifier, a throw in an uncalled nested function, `process.exit(0)`,
shell `|| return 0` / `|| log` / `|| printf` / `|| /bin/true` / `; true` / `|| { :; }` /
`set +o errexit` / `||`-newline-`true`, and JS embedded in shell (`node <<'TAG'`, `node -e`, `node -p`).

## REQ-1127-6 — a corrupt input is never read as an absent one on the upgrade path

`brain:upgrade` MUST treat only ENOENT on `brain.config.json` as "first run"; any other error MUST
refuse before any write, naming the file. An unreadable installed `package.json` MUST be reported as
a degraded downgrade guard. A migrations module that exists but fails to load MUST refuse before any
write. `featureCheckpoint` MUST NOT replace an existing `resume.md` it could not read.
**Falsifiable by**: a corrupt `brain.config.json` with the upgrade proceeding past the guard.

## REQ-1127-7 — a partial `feature-resume` still shows the operator's summary

`tryFeatureResume` MUST return the printed summary followed by a `projection incomplete: <files>`
line when the verb exited non-zero after printing one, and `null` only when nothing was printed.

## REQ-1127-8 — `install-tools.sh` neither guesses the provider nor over-claims

An unreadable `brain.config.json` MUST be refused (only an ABSENT one keeps the gitlab default), and
a failed `gentle-ai install` MUST end the run `INCOMPLETE` with exit 1 before the summary.

## REQ-1127-9 — the guard reads JS embedded in shell and rejects inherited or conditional verdicts

Sites inside `node <<'TAG'` heredocs and `node -e/-p` strings are scanned with the JS classifier; a
marker is honoured only inside its own catch or on a standalone comment line directly above; only an
unconditional top-level `throw` / `die(` / `process.exit(<non-zero>)` / non-zero `process.exitCode`
counts as self-explaining. `install-tools.sh` is in scope.

## REQ-1127-10 — the incoming migrations module is load-checked before the copy, on every path

`brain:upgrade` MUST import the INCOMING package's `config-migrations.mjs` before `copyManaged`;
a load failure MUST refuse with "No managed path was written". In the downgrade guard, only the
module itself being absent counts as "not installed"; a missing import inside it is a broken module.
**Falsifiable by**: an ordinary (non-downgrade) upgrade with a syntactically broken incoming module
that copies before failing.

## REQ-1127-11 — the guard covers the round-2 shell forms and per-catch windows

`|| true` / `|| :` followed by a quote, brace or paren, `|| { true; }`, `|| (true)`,
`if ! cmd; then :; fi` (one line or spread) are sites; two catches on one line each need their own marker.
