# ADR-0024 Amendment 2 — draft (issue #1125)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1125-default-platform-claude/brain-drafts/adr-0024-amendment-2.draft.md
> ```
>
> Run it on THIS branch so the amendment lands in the same pull request as the code that
> implements it. The verb renders the plan and waits for the typed word. It then performs
> §1c's acts, writes the `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them,
> and stops. **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0024-three-axis-decoupling.md
amendment: 2
issue: 1125
home-summary: the default `AGENT_PLATFORM` is `claude` and `antigravity` is the second supported platform; a stated platform still wins on every path, and existing consumers keep the `antigravity` the old bootstrap wrote into their `.env`. The "Known state" pointer to #123 is corrected: #123 closed on 2026-08-13 with `day-start.mjs` still calling `gentle-ai` directly, and #1114 owns that gap now, #1125
body: ## Amendment 2 — `claude` is the default, `antigravity` is the second platform, and the day-start gap moves to #1114 (issue #1125)
body-end: ### Notes for the promoter
```

```amend-find
- Default `AGENT_PLATFORM` is `antigravity`. This is a deliberate default, not neutrality — a
```

```amend-replace
- **[Amended by Amendment 2 (#1125): the default is now `claude`, and `antigravity` is the second supported platform. The sentence below is what this ADR decided on 2026-07-24, kept as the record.]**
  Default `AGENT_PLATFORM` is `antigravity`. This is a deliberate default, not neutrality — a
```

```amend-find
  Tracked as #123 (milestone M2, line 1.1). This ADR documents the axis contract, not full reach.
```

```amend-replace
  Tracked as #123 (milestone M2, line 1.1). This ADR documents the axis contract, not full reach.
  **[Amended by Amendment 2 (#1125): #123 closed on 2026-08-13 without clearing this gap. It
  moved day-start's agent-runtime check onto `resolvePlatform`, and ADR-0030 (#627) moved the
  upgrade check off the fixed remote. Section 3 of `day-start.mjs` still calls `gentle-ai`
  directly, whatever `SDD_ENGINE` says. The gap now belongs to #1114, the cross-axis port
  invariant with a guard.]**
```

## Amendment 2 — `claude` is the default, `antigravity` is the second platform, and the day-start gap moves to #1114 (issue #1125)

**Signed**: DD/MM/YYYY — <Name>

### What changed

**The default `AGENT_PLATFORM` is `claude`.** A repo that states no platform gets `claude`
from every resolver: `harness/platform.mjs#resolvePlatform` and `bootstrap.sh` §6.
`bootstrap.sh` writes `AGENT_PLATFORM=claude` to `.env`, so the default is stated in the repo
and not left implicit.

**`antigravity` is the second supported platform.** It is the other platform available for
testing, and it resolves whenever it is stated. The six inputs that count as stating it are
process-env or `.env` `AGENT_PLATFORM`, `brain.config.json`'s `harness.platform`, and the legacy
`SDD_HARNESS` in any of those three places.

This is the 2026-09-24 ruling on #1121 (the brain 2.0 epic, ruling 3): the MVP support matrix
names `claude` (default) and `antigravity`. `plain` stays a member of the axis and emits no
harness files.

### Why this ADR called `antigravity` deliberate, and what moved

It was deliberate when written, and it named one of two backends that were equal in weight.
The 2.0 epic changes what the default is for: it is the platform a new consumer lands on
without choosing, and the MVP matrix names `claude` as that platform, with `antigravity` beside
it for testing. Under ADR-0036 a default is a promise about a fresh install. The default should
therefore be the platform the product commits to first, and the publish gate (#1136) is where
that promise is checked.

### What this does not change

- **The three axes, their names and their precedence:** process env > `.env` >
  `brain.config.json`, then the legacy `SDD_HARNESS`.
- **Existing consumers.** Before this amendment, `bootstrap.sh` wrote the default into `.env`,
  so every consumer that ran `brain:env:init` states `AGENT_PLATFORM=antigravity` and keeps it.
  Nothing migrates them. A consumer that wants `claude` changes one line.
- **`AGENTS.md`.** It is still compiled by the `antigravity` backend, and `brain:upgrade` still
  regenerates it on every upgrade. What changes is that `brain:env:init` on a `claude` repo does
  not emit it.

### The "Known state" pointer, corrected

This ADR's "Known state at acceptance" handed the `day-start.mjs` hardcoding to #123. #123
closed on 2026-08-13. It delivered the configured agent-runtime check (day-start now resolves
the platform through `resolvePlatform`). ADR-0030 separately moved the upgrade check off the
fixed remote. The `gentle-ai` half never moved: `day-start.mjs` section 3 runs
`gentle-ai --version`, `update`, `upgrade` and `skill-registry refresh` whatever `SDD_ENGINE`
says.

A signed ADR that sends a reader to a closed ticket for an open gap tells them the gap is
handled. It is not, so the pointer moves to **#1114**: every axis is selected by configuration
behind a stable port, and a guard keeps it that way. #1114 is also where the platform's second
resolver retires (see below).

### Known state at this amendment (honest scope)

- **There are still two resolvers.** `bootstrap.sh` §6 resolves the platform in shell before
  `harness/cli.mjs` runs. It now has `resolvePlatform`'s precedence and default, and
  `bootstrap.default-platform.test.mjs` compares the two over a 90-case parity table. That
  parity is enforced by a test, but it is still two implementations. #1114 leaves one.
- **The `env:init` path does not read `brain.config.json`'s `harness` section.** Neither
  `bootstrap.sh` nor `harness/cli.mjs` passes config to the resolver, and a `.env` value outranks
  config wherever config is read. A platform stated ONLY in `brain.config.json` is therefore
  shadowed by the `.env` value `brain:env:init` writes. That was true before this amendment for
  `claude` and is true after it for `antigravity`. #1114 owns declaring the selectors in the
  schema.
- **The `claude` harness init overwrites `.claude/settings.json`.** `brain:upgrade` merges that
  file, but `brain:env:init` on `claude` then writes brain's hooks over the result. A consumer's
  own entries are lost. The same holds for `antigravity` and `.gemini/settings.json`. It
  predates this amendment, but the new default puts every fresh consumer on this path. It was
  measured on a packed-tarball consumer during #1125, and is tracked separately (see #1125's PR).

### Notes for the promoter

- Two `amend-find`/`amend-replace` pairs. Each anchor was checked to occur **exactly once** in
  the target before this draft was written, and `planAmendment` plans the draft cleanly against
  the current target and `brain/HOME.md`.
- Both replacements keep the original sentence and annotate it. Neither deletes it. "A
  deliberate default" was true when it was written, and #123 was the right owner on the day
  this ADR was accepted.
- The `brain/HOME.md` marker is §1c's fourth act, and no gate checks it (#516). Confirm it
  landed before committing.
- The third "Known state" bullet names a follow-up ticket as "see #1125's PR". If that ticket
  exists by the time you promote, replace the phrase with its number before promoting.
