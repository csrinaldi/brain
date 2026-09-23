---
status: design
issue: 378
artifact_store: openspec
topic_key: sdd/issue-378-brain-promote/design
---

# Design — `brain:promote` (issue #378)

Seven decisions. The first three are about what the locks can and cannot be; the rest
size the slice.

## D1 — the locks are structural where they can be, behavioural where a scan is useless

The issue asks for "a drift-guard test asserting locks 1-3 hold — that the source
contains no auto-accept path." Taken literally that is a source scan, and
`red-proof-blind-along-an-unvaried-axis.md` records the exact case where a source scan
failed: the reviewer's APPROVE lock was a scan for the literal `APPROVE`, and passing the
value as a **parameter** walked past it. Blind by SPELLING.

Worse here: this verb's whole job is to **print a `git commit` command**. The string
`git commit` is in the source *by design*. A scan for it is not merely weak, it is
impossible to write.

So each lock gets the guard its shape admits:

| lock | guard | axis it is blind along, and what covers that |
|---|---|---|
| non-TTY refusal | real child process, piped stdio | exit code alone is blind to "wrote then failed" → also assert the fixture index/worktree are untouched |
| no bypass flags | behavioural: every `-`-prefixed token aborts | blind to an env read → source scan asserts `process.env` occurs **0** times |
| no env bypass | occurrence count over comment-stripped source | blind to a stripper that ate the file → assert sentinels survive stripping |
| never commits | frozen `ALLOWED_GIT_SUBCOMMANDS` + helper throws | blind to a second call site → assert `spawnSync(` occurs **exactly once**, `exec*` zero times |
| never commits | e2e in a real temp repo: `rev-list --count` unchanged | — |

The occurrence counts are asserted as *numbers*, not as booleans, because rule 1 of the
anti-pattern doc is exactly that: enumerate the sites from the code, assert the count, and
refuse to trust a green when it differs.

## D2 — the slice is new-file promotion, and the reason is ordering, not difficulty

Comment 5217778764 measured the two shapes and found the in-place shape is the majority:
three of five open human acts on #405. Choosing the minority is a real cost and the
artefacts say so instead of implying coverage.

It is deferred because of a **dependency, not a size estimate**. The in-place shape
carries an unwritten rule — an amendment to a signed ADR replaces lines in the original
body *and* appends a signed `## Amendment N` section. Its only existence is precedent in
`git show 0f54781`. To make a tool apply it, the rule must first be written down, and
writing doctrine into `brain/core/**` is precisely the Tier 2 act this change exists to
keep human.

Building slice 2 first would therefore require the agent to either (a) infer doctrine from
a commit and encode it — `ia-promueve-sus-propios-artefactos` with extra steps — or
(b) write `brain/core/**` directly, which it may not. The correct move is to draft the
rule and stop: `brain-drafts/amendment-convention.md`. Slice 2 is one human signature
away, and the ordering is the deliverable, not an excuse.

Second, smaller reason, worth recording because it will size slice 2: applying "replace
lines X-Y" instructions from free-form Markdown against a file that has moved since the
draft was written is a merge problem, and a merge problem that silently half-applies to a
signed artefact is worse than the toil it removes.

## D3 — the confirmation is one gate, in one place, and `isTTY` is checked once

Defence in depth is tempting: check `isTTY` at entry *and* inside the confirm function.
Rule 7 of the anti-pattern doc says the opposite — every drift found on PR #490 was
between duplicated predicates. Two copies drift; one cannot.

So: `isTTY` is consulted exactly once, at the top of `runPromote`, before any read.
`confirm()` does one thing — compare the typed line to the word. The guarantee that the
single check cannot be dropped is behavioural (a real non-TTY child process), not a
second copy of the check.

## D4 — the module is a pure core with injected seams; the CLI is the only I/O

House pattern (`brain-save.mjs`, `home-index.mjs`): exported pure functions, side effects
guarded behind `process.argv[1] === fileURLToPath(import.meta.url)`.

```
parseArgs(argv)            -> { ok, draftPath } | { ok:false, error }
transformDraft(text, ctx)  -> { ok, text, number, title } | { ok:false, error }
buildCommitCommand(...)    -> string           (single-quoted, escaped)
renderPlan(plan)           -> string           (pure)
runPromote(ctx)            -> { exitCode, output, wrote[], staged[] }
```

`runPromote` takes every seam: `argv`, `isTTY`, `readLineFn`, `readFileFn`, `writeFileFn`,
`existsFn`, `stageFn`, `gitUserNameFn`, `todayFn`, `write`. That is what lets the accept
path — which needs a TTY in production — be driven end-to-end against a **real** temp git
repo in a test, without a pty. The non-TTY refusal is the one thing that must be proven
against the real process, and it is.

Root is `process.cwd()`, not a path derived from `import.meta.url`. This is a deliberate
difference from `check-brain-nav.mjs`: it is what makes the real-child-process test able
to run against a fixture repo instead of against the developer's own checkout.

## D5 — reuse `insertAdrLink` and `compileAgentsMd`; write neither

`brain/scripts/lib/home-index.mjs` already owns the HOME.md insert (anchor-not-found,
anchor-ambiguous, already-present, insert-after-last-ADR — four branches, already tested).
`harness/backends/antigravity.mjs` already owns the `AGENTS.md` compile, is already pure,
and is already drift-guarded against the committed file.

Calling them means the promoter cannot disagree with the drift guard, because it *is* the
drift guard's compiler. A reimplementation would be a second copy of both rules.

Consequence worth stating: `insertAdrLink`'s `already-present` result becomes a **refusal**
here, not a no-op. In its original CLI, re-running an idempotent patch is fine. Here it
means the ADR is already indexed while its file does not exist — an inconsistent tree the
human should look at, not one a promoter should paper over.

## D6 — `brain:promote` is a repo verb, not a distributed one

`brain/scripts/**` is a managed path, so the script travels to consumers on upgrade. The
`brain:promote` **script key** is not added to `MANAGED_SCRIPT_KEYS`, matching every other
non-golden-path verb (`brain:save`, `brain:review`, `brain:audit` are all absent from
those nine). Injecting a new key into every consumer's `package.json` is a distribution
decision with its own blast radius; it is listed as a pending human act rather than taken
here.

## D7 — red-proof plan

Every protection above gets a mutation applied to the production source, its diff printed,
`node --check` run, the **substitution-site count asserted**, and the mutation confirmed
*live* (the forged value read back off the artefact under assertion) before any red or
green is trusted. Per the anti-pattern doc, each lock is mutated along more than one axis:

| # | mutation | axis | must redden |
|---|---|---|---|
| M1 | delete the `isTTY` refusal | PATH | real-child-process non-TTY test |
| M2 | `if (!isTTY && false)` — same defect, different spelling | SPELLING | same |
| M3 | argument parser skips `-`-prefixed tokens instead of aborting | BRANCH | flag-rejection cases |
| M4 | add a `process.env` auto-accept | SPELLING + FIELD | env-bypass behaviour **and** the `process.env`-count scan |
| M5 | add `commit` to `ALLOWED_GIT_SUBCOMMANDS` | VALUE CLASS | allowlist test |
| M6 | git helper runs a commit after the add | PATH | e2e `rev-list --count` |
| M7 | confirmation compared case-insensitively | VALUE CLASS | the typed-word class |
| M8 | drop the destination-exists check | BRANCH | overwrite refusal |
| M9 | drop the H1/filename number check | BRANCH | mismatch refusal |
| M10 | skip the `AGENTS.md` write | SITE | cascade completeness |
| M11 | double-quote the printed commit command | SPELLING | paste-safety |
| M12 | skip the `HOME.md` write | SITE | cascade completeness |

The liveness step is not ceremony. The anti-pattern doc records two harness failure modes
that both look correct in a printed diff — a semantically inert substitution, and a
substitution that never happened. Both produce greens that mean nothing, and this is a
change where a false green sits between an agent and `brain/`.
