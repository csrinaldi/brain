---
status: draft
issue: 676
---

# Design — how `test/adr-status-line-single.e2e.test.mjs` reads the tree (issue 676)

## Technical approach

One file. Three module-level functions and five `test()` blocks. The rule is
never re-derived: membership comes from `ADR_TARGET_RE` and the verdict from
`checkSingleStatusLine`, both already exported from
`brain/scripts/lib/amendment-draft.mjs` and both already used by the WRITE path
in `brain/scripts/lib/promote-guards.mjs` (line 32). Read path and write path
therefore share one definition of *which files this rule is about* and one
definition of *what the rule says* — the disagreement between the two halves of
one verb is what #675 was.

## D1 — The reader is `readdirSync`, not `git ls-files`

| Option | Cost | Verdict |
|---|---|---|
| `readdirSync` on one dir | sweeps untracked files too | **chosen** |
| `git ls-files` | membership becomes *tracked-ness* | rejected |
| glob dependency | a dependency for one `readdir` | rejected |

`adr-citation-resolves.e2e.test.mjs` uses BOTH readers and the split is
principled: `git ls-files` for the whole-tree citation scan (its limit 1 — a
filesystem walk there means re-implementing `.gitignore`), `readdirSync` for
`signedAdrNumbers()` at line 174, which asks this exact question. One
non-ignored directory with an anchored filename does not carry the walk's cost.

The untracked scratch file is a **feature here**. `ADR_TARGET_RE` keys on the
destination path, never on tracked-ness; if the read path exempted untracked
files it would answer a question the write path never asks. A file named
exactly `adr-NNNN-slug.md`, sitting in the signed decisions dir, is a claim —
malformed and unstaged, the operator wants to hear it *before* the commit.

**The consumer question is settled by the manifest, not by argument.** `test/`
appears in neither `package.json` `files` (lines 12–24) nor
`brain/core/managed-paths.mjs`. This suite does not ship and is not
STRATEGY.COPY'd. Its subject is unambiguously brain's own 30 ADRs, and a
vendoring consumer's `brain/project/` is never read. Declared limit: consumers
get no on-disk ADR check from this work — that is a separate ticket, not a
silent gap.

## D2 — Repo root, copied not invented

`join(dirname(fileURLToPath(import.meta.url)), '..')` — copied verbatim from
`test/adr-citation-resolves.e2e.test.mjs:46`. Correct because the file sits one
level under the root, cwd-independent, no process spawn. `git rev-parse
--show-toplevel` is rejected: a spawn for a value the module URL already knows.

One deviation, stated: paths resolve with `resolve(REPO_ROOT, dir)` rather than
`join`, because `join('/repo', '/tmp/x')` yields `/repo/tmp/x` while `resolve`
honours an absolute argument. That single word is what makes D5's seam work.

## D3 — Vacuity is a THROW first, an assertion second

Three layers, in order of what cannot itself be vacuous:

1. **`readSignedAdrs` throws** `${dir} holds no ADR — the sweep cannot run` on
   an empty enumeration. A deleted assertion still leaves a green suite; a
   reader that throws makes the sweep unable to run at all.
2. **`assert.throws(() => readSignedAdrs('test/fixtures'), /holds no ADR/)`** in
   its own `test()` — `test/fixtures/` exists and holds no ADR. This is the
   shape of `adr-citation-resolves.e2e.test.mjs:243-246`, driving the branch
   rather than asserting about it.
3. **Count floor** `assert.ok(adrs.length >= 25)`, catching a reader that
   under-reads rather than empty-reads.

## D4 — One sweep, not a subtest per ADR

Per-ADR subtests are rejected on the vacuity argument alone: a broken
enumerator registers **zero** tests, and `node --test` reports zero tests as a
pass. The shape that gives precise failure names is the shape that fails
silently. The sweep also reports every offender in one run —
`promote-guards.mjs:210-216` makes exactly this argument for `renderFindings`.

What the operator sees:

```
2 signed ADR(s) carry ≠ 1 `**Status**:` line (§1c act 1):
  brain/project/decisions/adr-0029-x.md — 2 line(s), at :7, :142
  brain/project/decisions/adr-0034-y.md — 0 line(s)

  brain:promote's amendment path (applyStatusAct) REFUSES a file in this state,
  so it cannot be repaired by the sanctioned route. Repair is by hand, and
  brain/project/decisions/** is Tier 3 for an agent.
```

Rendered from `count` and `indices` directly. `locateStatusLines` is NOT reused
— proposal decision 3: its guidance is draft-side, and there is no draft here.

## D5 — The mutation plan (the load-bearing one)

**The seam.** `readSignedAdrs(dir = DECISIONS_DIR)` — a directory parameter
defaulting to the real path, the same seam `signedAdrNumbers(dir =
DECISIONS_DIR)` already carries at `adr-citation-resolves.e2e.test.mjs:174`,
for the same stated reason: so the branch is *drivable* rather than merely
asserted about. Membership stays the canonical predicate regardless of which
dir was read: ``ADR_TARGET_RE.test(`brain/project/decisions/${name}`)``.

**Is a transient local write to a signed ADR Tier 3?** No — and the distinction
matters. `agent-authorities.md:49` prohibits *committing* to `brain/project/**`;
`:36` puts *modifying* files in `brain/` at Tier 2, human-confirmed. A working
tree edit is the Tier 2 act, one `git add -A` away from the Tier 3 one. So it
is not forbidden — it is **unrepeatable, human-gated, and gone after the
revert**, which is a poor home for the only evidence that this suite bites.

**Three arms. The first two are automated and permanent; the third is the
human's one-time round.**

| Arm | Bytes | Writes to `brain/**` | Proves |
|---|---|---|---|
| A · fixture dir | `mkdtempSync` under `tmpdir()`, four files: two-Status-in-preamble, two-Status-in-body, zero-Status, one-Status control | none | enumerate → check → render, end to end |
| B · real bytes, in memory | a real ADR read read-only, a second `**Status**:` line spliced into the STRING | none | the fixture is shaped like real doctrine |
| C · REQ-676-6 round | one real ADR, working tree | transient, Tier 2 | the tree itself, once |

Arm A asserts the **rendered report text** names each fixture path with its
count and line numbers, and does NOT name the control — not merely that
something threw. The doctrine's two harness failure modes (an inert
substitution; a substitution that never landed) are only caught by reading the
forged value back off the artefact under assertion.

Arm C protocol, when the human runs it: commit or stash first; mutate ONE file;
run; read the failure back and confirm it names THAT path and THAT count;
`git checkout -- <path>`; then `git status --short` against the intended file
list. Never `cp` from a snapshot.

**The axis arm A cannot close**, stated rather than discovered: that
`DECISIONS_DIR` is the wrong constant, or the real directory is misread. A
fixture dir proves the machinery, never the address. D3's count floor and arm B
are what cover it, and they meet arm A at the shared function.

## File changes

| File | Action | Description |
|---|---|---|
| `test/adr-status-line-single.e2e.test.mjs` | Create | the whole change |

No production code, no dependency, no `package.json` edit — `npm test` already
globs `test/**/*.e2e.test.mjs`.

## Interfaces

```js
const DECISIONS_DIR = 'brain/project/decisions';

/** @param {string} [dir] repo-relative OR absolute. Throws on an empty enumeration. */
function readSignedAdrs(dir = DECISIONS_DIR) // → {name, path, text}[]
function auditAdrs(adrs)                     // → {path, count, lines}[] — offenders only
function renderOffenders(offenders)          // → string
```

## Testing strategy

| Layer | What | How |
|---|---|---|
| Unit | the rule itself | NOT retested — owned by `amendment-draft.mjs`'s suite |
| E2E | 30 real ADRs carry one Status line | the sweep |
| E2E | the reader refuses to under-read | throw + `assert.throws` + count floor |
| E2E | the detector bites | arms A and B |
| Manual | the tree itself | arm C, human, once (REQ-676-6) |

## Migration

No migration required. Rollback is deleting one file.

## Open questions

- [ ] Arm C is Tier 2 — an agent may not perform it unprompted. `sdd-apply`
      must land arms A and B and then STOP and ask the human to run arm C, or
      record it as owed. It must not silently substitute A+B for REQ-676-6.
