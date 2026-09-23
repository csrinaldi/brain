---
status: design
issue: 397
epic: 313
artifact_store: openspec
topic_key: sdd/issue-397-clobber-asymmetry/design
---

# Design — Per-path upgrade strategy (#397)

## §1 — Measured surface

13 managed globs. 2 merged (`.claude/settings.json`, `package.json`), 11 plain-copied.
Of those 11, four are brain-owned by contract (`brain/core/**`, `brain/scripts/**`,
`.gitattributes`) and seven are things a consumer legitimately curates.

## §2 — Three-way detection

The existing check answers "do these bytes differ", which is not the question. The
question is "did the CONSUMER change this", and answering it needs the previous
canonical copy. That copy exists, free, until the install overwrites it:

```
before install:  node_modules/brain/<path>   = what brain shipped LAST time
after  install:  node_modules/brain/<path>   = what brain ships NOW
```

Read the outgoing copy before step 1 — the same move #398 makes for its migration list
— and the two facts separate cleanly.

**Degraded mode:** under `--no-install` there is only one tree, so outgoing == incoming
and consumer-modification cannot be established. REQ-397-1 Scenario 3 requires saying so.
A check that silently weakens is worse than one that is absent.

## §3 — Why `AGENTS.md` is a different category

Not "a file with a merge strategy" but a **build output whose inputs straddle the
ownership line**. `brain/HOME.md` is consumer-owned; the four methodology docs are
brain's. Copying the artifact instead of rebuilding it substitutes brain's inputs for
the consumer's. Regeneration is the only correct answer, and brain already has the
generator and a drift-guard for it.

## §4 — `--force-managed` mirrors `--skip-merge`, with the opposite polarity

| flag | effect on the named path |
|---|---|
| `--skip-merge <p>` (#399) | leave it ALONE — routes to `local` |
| `--force-managed <p>` (#397) | OVERWRITE it deliberately |

The lesson from #399 applies directly and inverted: there, dropping a path from the
merge map silently sent it to the plain-copy set, so "skip" nearly became "clobber".
Here the danger is the mirror image — a refused path must never quietly end up written.
Both flags must be validated against the real classification, not accepted as free-form
globs.

## §5 — The classification is data

Per REQ-397-5 the strategy belongs beside the manifest it describes, in
`brain/core/managed-paths.mjs`. That is what makes this a **Tier-2 change** and why no
code ships before the draft is signed: the classification IS the decision, and the code
is only its execution.

## §6 — Interaction with what already shipped

- **#396 restore point:** unchanged. A refusal happens before the snapshot, like #398's
  and #399's, so nothing is written and nothing needs rolling back.
- **#399 pre-flight:** the merge pre-flight grows one entry when `.gemini/settings.json`
  becomes a merge target — it must be parsed up front like the other two.
- **#398 downgrade guard:** independent; both read the outgoing package before install,
  so the read is shared rather than duplicated.
