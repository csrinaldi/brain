---
status: draft
issue: 675
---

# Spec — brain:promote validates before it signs (issues 675, 674)

## REQ-675-1 — An ADR destination carrying ≠ 1 `**Status**:` line is refused

Before anything is written, `brain:promote` checks the text each write would
produce. A destination matching `ADR_TARGET_RE` must carry **exactly one**
`**Status**:` line; zero and two are both refusals.

The check is `checkSingleStatusLine`, called — not copied — from
`lib/amendment-draft.mjs`, which is where the rule already lived. The amendment
path refuses to *touch* a file with two Status lines; the promote path is what
created one. One rule, one implementation, two callers.

## REQ-675-2 — The refusal names the DRAFT's defect and the shape expected

The message states the count, the destination, and that the verb prepends the
signature header itself — so a `**Status**:` line in the draft body is the
cause. It then shows the preamble blockquote the house drafts use:

```
> **status:** proposed — pending human promotion | **date:** <date> | **owner:** <handle>
```

That convention exists today only in `transformDraft`'s docstring — a function
the draft's author never reads. A refusal that named the symptom alone would
leave the fix to be rediscovered.

## REQ-674-1 — Shipped-file guards run against the DESTINATION path

`shipped-hostnames` runs over the content of every write whose destination is a
text file under `brain/` — the package `files` allowlist entry that puts bytes
on a consumer's disk.

Keying on the **destination** is the requirement. The identical bytes at the
draft path are correctly green: `openspec/changes/**` is not shipped. That is
why the defect survived `npm test`, `brain:repo:check` and CI, and surfaced only
on the signing commit.

The classifier was extracted from `shipped-hostnames.test.mjs` into
`lib/shipped-hostnames.mjs` as a **pure move**. The test still walks `brain/**`;
the verb asks the same module about one artefact.

## REQ-675-3 — The refusal arrives before the confirmation, not after

The guards run in the existing read-only precondition slot — after the plan is
computed, **before** it is shown and before `PROMOTE` is read. Nothing is
written, nothing is staged, and the rollback path is never reached.

Proven by construction rather than by inspection: the end-to-end tests supply a
`readLineFn` that **throws**, so a guard that fired after the prompt fails the
suite instead of passing it.

## REQ-674-2 — "Could not check" is never reported as "checked clean"

Two consequences, both deliberate, both from the
`evidence-reader-empty-on-failure` family:

- A guard that **throws** refuses the run, naming the guard and the error. A
  reader that reports nothing when it failed is indistinguishable from one that
  found nothing.
- The plan states which guard/file pairs actually ran — and when the answer is
  **none**, says so in those words. A silent clean run and a run where nothing
  was applicable must not look the same to the human about to sign.

## REQ-675-4 — Each guard declares which destinations it is about

`applies(relPath)` is per-guard. `single-status-line` is scoped to ADR
destinations: `brain/HOME.md` correctly carries no `**Status**:` line, and a
guard applied to every write would refuse the cascade it is meant to protect.

## REQ-675-5 — The verb's lock-2 scan is closed over its own half

`brain-promote.locks.test.mjs` classified only `brain-promote.mjs`'s **direct**
imports, so a module reached one hop further — through a module already
classified as the verb's own — was neither scanned for `process.env` reads nor
named. That is the #509 gap re-opened one level down, and `promote-guards.mjs`
arrives through exactly that door: it decides whether the verb refuses.

The classification now walks transitively over `OWN_IMPORTS`, and keys on the
**resolved repo-relative path** rather than the import specifier — `lib/`
modules import siblings as `./x.mjs` while the entry point says `./lib/x.mjs`,
and a list keyed on the raw string reads one module as two.
