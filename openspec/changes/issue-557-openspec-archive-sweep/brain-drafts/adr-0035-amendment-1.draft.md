# ADR-0035 Amendment 1 — draft (issue #557 slice S5)

> **Tier 3 target. Not promoted, and not promotable by an agent.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-557-openspec-archive-sweep/brain-drafts/adr-0035-amendment-1.draft.md
> ```
>
> Run it on a branch that also carries the `archive-sweep.mjs` code fix, so the amendment
> lands in the same pull request as the fix it records. The verb renders the plan, waits for
> the typed word, performs §1c's acts, writes the `brain/HOME.md` marker and a regenerated
> `AGENTS.md`, stages them, and stops. **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0035-archive-sweep-issue-link-exemption-is-content-earned.md
amendment: 1
issue: 557
home-summary: residual risk 2 is CLOSED — no added file under `openspec/changes/archive/**` is ever exempt, at any destination, under any condition, #557
body: ## Amendment 1 — residual risk 2 is closed: zero added files under `archive/**` are ever exempt (issue #557)
body-end: ### Notes for the promoter
```

```amend-find
2. **An added file** that is either `openspec/specs/<capability>/spec.md` or any path under
   `openspec/changes/archive/<dest>/`.
```

```amend-replace
2. **An added file** that is `openspec/specs/<capability>/spec.md` — the ONLY added file this
   predicate ever accepts. **As of Amendment 1 (#557): no added file under
   `openspec/changes/archive/<dest>/` is ever accepted, at any `<dest>`, under any condition.**
   Before Amendment 1, this category also admitted any path under `archive/<dest>/` (later,
   briefly, gated by a same-folder rename check); both were holes. See Amendment 1 for what
   they allowed and why closing the category entirely costs nothing.
```

```amend-find
Refusing `A` under `archive/` unless it pairs with a rename is
   the follow-up that closes it. This ADR records the predicate as it runs, not as it was
   described.
```

```amend-replace
Refusing `A` under `archive/` unless it pairs with a rename is
   the follow-up that closes it. This ADR records the predicate as it runs, not as it was
   described.
   **[Amended by Amendment 1 (#557) — CLOSED, not narrowed. `classifySweepDiff` refuses every
   added file under `archive/**` unconditionally: no real `archiveChange` run ever adds one
   there, so there was never a legitimate case an exemption would protect. An interim
   "pairs with a rename" rule was tried first and found still gameable by a same-folder
   smuggle; it was removed rather than tightened further. See Amendment 1.]**
```

## Amendment 1 — residual risk 2 is closed: zero added files under `archive/**` are ever exempt (issue #557)

**Signed**: DD/MM/YYYY — <Name>

Residual risk 2, as this ADR named it, was real and demonstrable: `classifySweepDiff`
exempted **any** added file under `openspec/changes/archive/<dest>/`, provided the same
diff carried at least one valid archive rename **anywhere** — not necessarily into
`<dest>`. A minimal proof:

```
classifySweepDiff({
  nameStatusLines: ['R100\topenspec/changes/issue-9-x/spec.md\topenspec/changes/archive/9/spec.md',
                    'A\topenspec/changes/archive/anything/payload.sh'],
  numstatLines: ['0\t0\topenspec/changes/{issue-9-x => archive/9}/spec.md',
                 '40\t0\topenspec/changes/archive/anything/payload.sh'] })
→ exempt: true, offending: []
```

A hand-made `auto-archive/<date>` branch carrying one genuine rename could land arbitrary
content under `archive/anything/` on `main` with no linked issue and no closing keyword.

### What was checked before choosing the fix

Two questions the maintainer asked before any code changed, answered from
`archive-logic.mjs#archiveChange` and `sdd-layout.mjs`:

1. **Does a real archive run ever ADD a file under `archive/<iid>/`?** No. `archiveChange`
   writes under `destDir` in exactly one way: `fs.rename(srcDir, destDir)` — a whole-folder
   move with content untouched, so git's `-M100%` detector reports every file that lands
   there as an R100 rename, never an `A`. The only other write the function performs is
   `fs.mkdir('openspec/changes/archive')`, a directory, not a file. `sweep.mjs`'s markdown
   report — the one place an "archive report" might have been added under `archive/**` — is
   written to `$RUNNER_TEMP/sweep-body.md` and used only as the PR body; the workflow's
   `git add -A` step never touches it. Measured directly against the real 2026-09-23 phase-6
   backfill (`fdca7970...a3bb5b02`, 612 diff lines): every `A` line is
   `openspec/specs/<capability>/spec.md`; zero `A` lines appear anywhere under
   `openspec/changes/archive/`.
2. **Is `archivePath(iid)` always numeric?** No. `archiveChange` uses the raw `changeId` as
   the destination segment for a grandfathered change (`isGrandfathered`), and
   `openspec/changes/archive/` carries real, current, non-numeric folders today —
   `auto-adrs`, `cli-i18n`, `feature-working-memory`, `governance`, `installer-versionado`,
   `install-home-scaffold`, `managed-paths-namespace`, `vcs-adapter` — plus several
   date-prefixed legacy folders predating this convention. A fix that required `<dest>` to
   match `^\d+$` would refuse those.

Together, (1) and (2) point past a shape rule: there is no filename, extension, or numeric
pattern that separates a legitimate archived file from an illegitimate one, because there
is no legitimate ADDED file at all. Anything present under `archive/**` that is not a
rename is, by (1), evidence of something other than a real sweep.

### The interim fix, and why it still had a hole

The first fix tried was narrower: require the added file's destination FOLDER to be, in the
same diff, the destination of at least one already-valid archive rename. That refused the
proof case above, but not this one — one genuine rename into `archive/9/`, plus an unrelated
file added into that SAME folder:

```
classifySweepDiff({
  nameStatusLines: ['R100\topenspec/changes/issue-9-foo/proposal.md\topenspec/changes/archive/9/proposal.md',
                    'A\topenspec/changes/archive/9/payload.sh'],
  numstatLines: ['0\t0\topenspec/changes/{issue-9-foo => archive/9}/proposal.md',
                 '3\t0\topenspec/changes/archive/9/payload.sh'] })
→ exempt: true (under the interim, folder-pairing rule)
```

The pairing checked the FOLDER a rename landed in, never the specific file being added — so
a forged branch needed only one genuine rename to unlock arbitrary content anywhere inside
that rename's own destination folder. Confirmed by the maintainer directly against
`archive-sweep.mjs` before this amendment was rewritten.

### The fix

Given §"What was checked": no real `archiveChange` run ever adds a file under `archive/**`
at all, so there was never a legitimate case the interim pairing rule — or any narrower
carve-out — needed to protect. The tightest correct rule is therefore the simplest one:
`classifySweepDiff` refuses **every** added file under `openspec/changes/archive/**`,
unconditionally, regardless of what renames exist anywhere in the diff. The only added file
this predicate accepts anywhere is `openspec/specs/<capability>/spec.md` — the genuinely
legitimate case `archiveChange#mergeSpecs` produces via `fs.mkdir` + `writeFile`, unrelated
to `archive/**`.

Both proof cases above (the original cross-folder smuggle and the same-folder smuggle) are
now refused, naming the offending file. The real phase-6 backfill diff, re-run against the
tightened predicate, is still `exempt: true` — the fix changes nothing about a genuine
sweep, because a genuine sweep never had an `A` under `archive/**` to lose.

`brain/scripts/governance/checks/archive-sweep.mjs` (this branch,
`feat/issue-557-s5-sweep-added-files`) carries the implementation and its test suite
(`archive-sweep.test.mjs`), including both proof cases above and the real backfill check.

### What this does not change

Residual risk 1 (the `<iid>` destination not being cross-checked against the source
folder's own issue number) is untouched by this amendment and remains open, exactly as
this ADR already named it.

### Notes for the promoter

- Two `amend-find`/`amend-replace` pairs, each anchor verified to occur **exactly once** in
  the target via `assessEdit` before this draft was written, and `planAmendment` reports the
  full cascade `pending` (all acts, none blocked, none partially applied) against the
  pre-amendment target.
- The second replacement keeps the original sentence and appends a bracketed note, the same
  pattern ADR-0032 Amendment 1 used: the superseded claim stays legible, its resolution is
  attached rather than substituted.
- The `brain/HOME.md` marker is §1c's fourth act and the one with no gate behind it (#516) —
  confirm it landed before committing.
