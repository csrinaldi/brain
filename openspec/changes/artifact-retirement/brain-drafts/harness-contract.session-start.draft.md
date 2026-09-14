# Amendment draft — `harness-contract.md`, `session:start` stops restoring a manifest (issue #955)

> **Tier 2 draft. Not yet promoted.** `harness-contract.md` is a promoted Tier-2 file
> (`brain/core/methodology/`). The maintainer promotes it AFTER slice A's PR merges —
> never before, and never by an agent (agents never edit `brain/core/**`):
>
> ```
> npm run brain:promote -- openspec/changes/artifact-retirement/brain-drafts/harness-contract.session-start.draft.md
> ```
>
> `harness-contract.md` is one of the five `SOURCE_DOCS` compiled into `AGENTS.md`
> (`brain/scripts/harness/backends/antigravity.mjs:36-42`). Promotion regenerates and stages
> `AGENTS.md` (§1d act 3) — `AGENTS.md:222` and `AGENTS.md:291-296` change THROUGH this
> promotion, never by hand (`antigravity.drift.test.mjs:42` is a byte-equality guard).

```brain-amendment/1
target: brain/core/methodology/harness-contract.md
issue: 955
```

## Edit 1 — the `session:start` verb row (`harness-contract.md:27`)

```amend-find
| `npm run brain:session:start` | `session:start` | — | Session context loader: restores `.memory/manifest.json` churn (step 1 — required by `openspec/specs/session-start/spec.md` REQ-3 today; the manifest is the engram adapter's artifact per ADR-0002 Amendment 1, and #864 task 2.4 retires the step and amends REQ-3 together), hydrates the active memory backend from `.memory/records/`, resolves the active change and ticket memory, reports memory recency. Read-only, local-only, no network. |
```

```amend-replace
| `npm run brain:session:start` | `session:start` | — | Session context loader: hydrates the active memory backend from `.memory/records/`, resolves the active change and ticket memory, reports memory recency. Read-only, local-only, no network. (Its manifest-churn restore was the engram adapter's and retired with #864 task 2.4, #955; `openspec/specs/session-start/spec.md` REQ-3 is marked Removed.) |
```

## Edit 2 — the implementation note (`harness-contract.md:97-101`)

```amend-find
its chunk directory are gitignored and created by `setup`/`share`; its manifest is **still
tracked today**, with its merge driver still registered in `.gitattributes`, and `session:start`
still restores it (REQ-3). Rule 3 forbids any reader of the records from depending on them;
#864 task 2.4 untracks the manifest, removes the driver, confines the symlink to `setup` and
amends REQ-3. ADR-0002 records the memory model.
```

```amend-replace
its chunk directory are gitignored; `setup` alone creates the symlink, and nothing writes the
chunk directory any more. Its manifest and merge driver were retired by #864 task 2.4 (#955),
and `session:start` restores nothing (REQ-3 removed). Rule 3 forbids any reader of the records
from depending on the adapter's files. ADR-0002 records the memory model.
```

### Notes for the promoter

Both anchors verified against `origin/main` 32b70db9 to occur exactly once in the target
(`assessEdit` → `free === 1`, `k === 0`). The only other draft anchoring this target,
`openspec/changes/issue-863-backend-contract/brain-drafts/harness-contract.draft.md`, quotes the
pre-#863 wording of both passages, which no longer exists (`f === 0`), so it cannot collide.
Edit 2 is required by §1c act 2 even though R10 named only row :27: leaving :97-101 would
leave "its manifest is still tracked today" standing in signed doctrine.
