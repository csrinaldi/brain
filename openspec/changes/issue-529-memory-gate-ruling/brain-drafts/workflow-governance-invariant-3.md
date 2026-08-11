# Draft — the ruling on `memory-gate`'s scope (issue #529)

**Tier-2 promotion required.** `brain/core/methodology/workflow-governance.md` is human-signed
(zone map: *"if the destination is `brain/`, the signature is human"*). This draft carries the
ruling and the exact replacement text; a human promotes it.

---

## THE RULING

**Option (1) — correct the prose — now, and its cost is that the gate still cannot notice the
next outage; what it buys is that no one reads it as a per-change guarantee while it cannot be
one.**

Sequenced, not final: **(2) recency lands after #530 makes the writer a mechanism**, and it may
not land before `skip:memory-gate` is implemented in code.

Everything below is the evidence for that ordering and the text that carries it.

---

## What was measured, 2026-08-11

| | |
|---|---|
| `session_summary` records in `.memory/records/` | **205** |
| newest one | **2026-08-04T13:58:29Z** — 7 days ago |
| commits touching `.memory/records/` since 2026-08-05 | **0** |
| merges to `main` in that window | **34** |
| `memory-gate` verdict on all 34 | **green**, correctly, by its own definition |

The gap grew by a day between #529 being filed ("six days") and this ruling being drafted.
That is not a rhetorical point: it is the measurement re-taken, and it moved in the wrong
direction while the question sat open.

## Why (2) and (3) cannot go first, measured rather than argued

**Option (2) — fail when the newest summary predates the PR's base — would have blocked all 34
merges.** Not "most": the newest record predates every one of them.

And the escape hatch the doctrine promises **does not exist**. `workflow-governance.md`'s own
caveats already record it:

> **`skip:memory-gate` is documented, not enforced.** The label is named in `AGENTS.md` and this
> file, but no code path anywhere checks for it or exempts anything on its presence.

So (2) today would not merely block; it would block **with no override**, and the only way to
land anything would be to revert the gate. A protection whose first act is to be removed teaches
that gates are obstacles. That is worse than the silence it replaces.

**Option (3) — per-change capture — is the right destination** and is what #368 was reaching for.
It cannot precede a reliable writer for the same reason, only more so.

## The precondition, and why it is a different ticket

`command -v engram` **fails** in the remote agent environment where most of this week's work
happened. Materialisation is a deliberate human act: `git log -- .memory/records/` shows every
record arrived in a dedicated `chore(memory): materialize …` commit or bundled by hand into a
feature PR. A habit, not a mechanism.

That is **#530**, and keeping it there is deliberate — a ruling that also fixed the writer would
be two subjects, and the second would decide the first by default.

## What the doctrine says today, and why both halves are false

`workflow-governance.md`'s invariant table, row 3:

| # | Invariant | CI job (`name:`) | Skip label | Character |
|---|-----------|-----------------|------------|-----------|
| 3 | Memory dumped before closing (proxy) | `memory-gate` _(S4)_ | `skip:memory-gate` | Hard with override |

- *"Memory dumped before closing"* reads as **per-change**. The check asks whether the repository
  has **ever** captured a `session_summary`. `(proxy)` is doing more work than one word can.
- *"Hard with override"* — it is not hard (permanently satisfied by 205 historical records, and
  green through a seven-day outage) and the override is **not implemented**.

The file already contradicts itself: the metrics caveats state the repo-global scope plainly,
120 lines below the table. **The table is where a reader forms the belief**, and a correction
that lives only in the caveats is one nobody reaches in time.

---

## REPLACEMENT TEXT

### 1 — the invariant table row (currently line 23)

Replace:

```
| 3 | Memory dumped before closing (proxy) | `memory-gate` _(S4)_ | `skip:memory-gate` | Hard with override |
```

with:

```
| 3 | `.memory/` has EVER held a session summary (repo-scoped) | `memory-gate` _(S4)_ | _(none — `skip:memory-gate` is named but unimplemented)_ | Soft — see §Invariant 3 scope |
```

### 2 — a new subsection, immediately after the table

```markdown
### Invariant 3 scope — what `memory-gate` does and does not check

**It is repo-scoped and it is permanently satisfied.** `memoryPresence` asks whether ANY
`session_summary` observation exists in `.memory/records/`. There are 205. The gate therefore
passes on every PR regardless of whether that PR captured anything, and it will keep passing if
nothing is ever captured again.

**Nothing enforces per-change capture.** The PR template's *"Memory materialized before closing"*
is a promise the checklist makes and no gate keeps. Read invariant 3 as *"this repository has a
memory layer"*, never as *"this change was remembered"*.

Measured 2026-08-11 (issue #529): `.memory/records/` went **seven days** without a new record
while **34 merges** landed. `memory-gate` was green on all of them — correctly, by the definition
above. That is the gap this scope note exists to stop hiding.

**`skip:memory-gate` does not exist in code.** No path checks for it. It is listed here and in
`AGENTS.md` as documentation of an intent, and `brain:metrics` counts its usage raw without ever
subtracting it. Applying the label changes nothing.

**This is a ruling, not a resting place** (issue #529). The sequence is: #530 makes capture a
mechanism rather than a habit → `skip:memory-gate` becomes real → invariant 3 tightens to
recency. Tightening it before the writer is reliable would block every PR with no override,
which is how a gate teaches people that gates are obstacles.
```

### 3 — the caveat 120 lines below, now redundant

The bullet beginning *"**`memoryPresence`/`memory-gate` is repo-global, not per-merge.**"* can
keep its metrics-specific sentence but should point at the scope subsection rather than restate
it — one statement of a rule, in the place a reader meets it first.

---

## What is NOT in this draft, deliberately

No change to `memoryPresence` itself. Option (1) is prose by definition, and the function's
docstring already carries the scope note (#521). Changing behaviour here would pre-empt the
ruling this ticket exists to make.
