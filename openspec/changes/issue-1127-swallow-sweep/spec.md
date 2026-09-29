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
