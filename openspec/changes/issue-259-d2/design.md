# Design — Rung-3 Auto-Revert Guardrails (Track D / slice D2)

> **Status:** REVISED after judgment-round-1 (engram #899) · **Phase:** design (HOW, architectural) · **Issue:** #259
> **Base branch:** `feature/v2.0.0` · **Worktree:** `/home/gandalf/IA/brain-issue-259`
> **Reads:** [proposal.md](proposal.md) (#878) · fork rulings (#879, PINNED) · checkpoint rulings (#886) ·
> **judgment-round-1 (#899) — the binding input for this revision**
> **Language:** English (ADR-0009). **Docs zone:** untouched by D2 (draft-only, §9).
> **Revision:** v2. The v1 design shipped two mechanisms that are wrong at the architectural level. This
> document replaces them, states a fail-closed principle the v1 design never had, and RE-SLICES the
> delivery — the remediation does not fit the old 2-slice split.

---

## 0. What changed and why (read this first)

A blind dual adversarial review reproduced two bypasses in the built Slice 1. Neither is a patch-level
typo; both are the design being wrong.

| # | v1 mechanism | Why it is wrong | v2 replacement |
|---|---|---|---|
| **1** | A revert is proved by a `This reverts commit <sha>.` trailer + `merge-base --is-ancestor` | On a linear `main`, **every** commit merged after the offender is its descendant. Ancestry rules out only a fork made *before* the offender — a shape that never occurs in PR flow. An attacker lands one ordinary PR carrying the trailer and reverting nothing: `[SKIP] resolved by revert`, no revert PR, cursor advances past the offender forever, payload still on disk. | **Tree-effect proof** (§3). A revert is proved by the *state of the files*, never by a message. |
| **2** | The cursor lives at `refs/governance/audit-cursor` and is read with a local `git rev-parse` | `actions/checkout@v4` fetches `refs/heads/*` + tags **only**. Custom namespaces are never fetched, and no step fetches them. The ref is unreadable on every run. "Cursor absent on origin" and "cursor exists on origin but was not fetched" are **indistinguishable** — which is exactly what made the F2 test tautological. | **Remote-authoritative tri-state, no local fetch at all** (§2). `ls-remote --exit-code` is the oracle that separates *absent* from *unknown*, and its own stdout carries the sha — nothing local is ever read, fetched, or relied upon. |

Three further structural defects are fixed here, not deferred:

- **The audited interval and the advanced interval were different intervals** (§2.2 — the skip-over,
  adjudicated below). Now identical **by construction**, not by a check.
- **There was no fail-closed principle** (§5). Five independent paths turned an error into a green job.
- **The "never auto-create" invariant lived in the YAML** — directly contradicting this design's own rule
  that all decision logic lives in the platform-neutral core. A GitLab wrapper would have re-introduced
  the bug verbatim. It now lives in the core, as an atomic compare-and-swap (§2.3).

---

## 1. Cross-cutting theme — the m3-coupling test (unchanged, and now enforced harder)

D2 is the slice that **LIFTS** the standing "no postmerge to GitLab" restriction. It does not do the
port; it makes the port possible. The governing constraint on every choice:

> *Is this logic born coupled to GitHub (`GITHUB_OUTPUT`, `gh`, Actions cache, `github.sha`, `outcome`,
> `github.event.before`)? If yes and it is REUSABLE CORE, it is wrong — push it into a platform-neutral
> `.mjs` the future GitLab wrapper consumes UNCHANGED.*

| Layer | Coupling allowed? | Where |
|---|---|---|
| **Reusable core** — git seam, cursor state machine, window, CAS advance, revert resolution, failing-SHA parser, exit-code mapping | **NO** | `brain/scripts/governance/postmerge/*.mjs` + `brain-audit.mjs` |
| **Thin CI wrapper** — calls the core, then runs `git revert` + `gh pr create` | **YES** | `.github/workflows/governance-postmerge.yml` |

**v1 violated its own rule twice**: the never-auto-create invariant and the cursor fetch were both left
in the wrapper. v2's acceptance test for the rule is mechanical: *delete the YAML, write a GitLab wrapper
that calls the same exported functions — is any safety property lost?* If yes, that property is in the
wrong layer. `github.event.before` disappears entirely in v2 (§2.2), which removes one more coupling.

---

## 2. The cursor — remote-authoritative, tri-state, compare-and-swap

### 2.1 The state machine (replaces `readCursor → sha | null`)

`null` was the whole bug. It collapsed three genuinely different worlds into one, and the collapse was
invisible to tests. The core now returns a tri-state, and **the remote is the sole authority — there is no
local fetch, no local rev-parse, and no `syncCursor` step at all**:

```
readCursor({ git })     → git ls-remote --exit-code origin refs/governance/audit-cursor   (ONE call, total)

                        → { state: 'present', sha }   status = 0. `ls-remote`'s own stdout ("<sha>\t<ref>")
                                                      IS the sha — parsed directly from that answer, never
                                                      from a local `rev-parse`. A never-fetched local ref
                                                      (the v1 shape) is simply irrelevant: nothing local is
                                                      ever consulted.
                        → { state: 'absent'  }        status = 2  (git's documented "no matching refs"
                                                      status — a POSITIVE proof of absence on origin, not
                                                      a failure to look)
                        → { state: 'unknown' }        status is anything else (network/auth/permission),
                                                      OR status = 0 but the sha parsed from `ls-remote`'s
                                                      stdout is malformed/missing (an inconsistency —
                                                      never silently downgraded to 'absent')
```

| State | Meaning | Wrapper action |
|---|---|---|
| `present` | Origin has the cursor; the sha is read directly off `ls-remote`'s own answer | Audit `cursor..HEAD` |
| `absent` | **Proved** absent on origin | Exit 2 · loud issue **with the init command** · never audit · never revert · never create |
| `unknown` | We could not determine the cursor's state | Exit 2 · loud issue **with NO init command** (bootstrapping on a guess is the original sin) · never audit · never revert |

`absent` and `unknown` are different issues with different bodies and different labels
(`governance:cursor-missing` vs `governance:cursor-unknown`). Conflating them is what let a
never-fetched ref masquerade as a never-initialized one for an entire release cycle — the remote-only
read removes the local-fetch failure mode as a class, rather than papering over it with a fetch step.

### 2.2 The window is ALWAYS `cursor..HEAD` — the skip-over fix

**ADJUDICATION of the single-judge SUSPECT finding: CONFIRMED.** Evidence:

- `cursor.mjs:43-50` — `resolveWindow` on a push returns `${before}..${head}` and **never reads the cursor**.
- `governance-postmerge.yml:145-150` — the advance step fires on `code == '0'` and writes `${{ github.sha }}`.
- `git log A..B` is exclusive of `A`.

So: push P1 lands offender `M` → window `before..M` (includes `M`) → exit 1 → cursor stays at `C`. Push P2
lands a clean merge → window `M..P2` → **excludes `M`** → exit 0 → cursor jumps `C → P2`, **over `M`**.
Every future schedule window is `P2..HEAD`. `M` is never audited again. If the revert PR is never merged,
the offender is permanently laundered.

The structural defect: **the interval that was audited (`before..head`) and the interval the cursor was
advanced across (`cursor..head`) were different intervals**, and a clean verdict on the first was used to
bless the second. No amount of extra checking fixes a design that compares two different things.

**v2: one rule, every trigger.**

```
resolveWindow({ git, head })
   1. c = readCursor()                               ← the single ls-remote call (§2.1); no fetch step
      absent  → { state: 'absent'  }                ← exit 2, loud, no audit
      unknown → { state: 'unknown' }                ← exit 2, loud, no audit
   2. verify c.sha is an ancestor of head           ← force-push / rewritten main / stale cursor
      not an ancestor → { state: 'unknown', reason: 'cursor is not an ancestor of HEAD' }
   3. → { state: 'present', base: c.sha, range: `${c.sha}..${head}`, head }
```

`eventName` and `github.event.before` are **gone**. Push and schedule run the identical code path. The
audited interval and the advance interval are now **the same interval by construction** — this is a
theorem about the design, not a check bolted onto it.

Steady-state cost is zero: on a healthy repo the previous push advanced the cursor, so `cursor == before`
and the window is exactly what it is today. A pinned cursor grows the window — which is correct: the job
is already RED and a human is already being paged. See R-4 for the bound.

### 2.3 Advance = atomic compare-and-swap, REMOTE ONLY, in the CORE

`advanceCursor` in v1 called a bare `git update-ref <ref> <new>`, which **creates the ref if absent**. The
"never auto-create" invariant was enforced in the YAML — so a GitLab wrapper would ship the bug verbatim.

```
advanceCursor({ git, from, to })
   guard:  `from` is REQUIRED and must be 40-hex   → throws otherwise
           (no `from` ⇒ no advance ⇒ the ref can never be created by this function)
   guard:  merge-base --is-ancestor <from> <to>     → the cursor only ever moves FORWARD
   remote: git push --force-with-lease=refs/governance/audit-cursor:<from> \
                    origin <to>:refs/governance/audit-cursor
           ── the lease is the SOLE CAS: the server verifies the ref's current value
              equals <from> before accepting. An ABSENT ref on origin can never equal
              a 40-hex <from>, so the ref can never be created by this path either —
              "never auto-create" is the remote lease's own property, not a local check.
              ⇒ two concurrent runs cannot both advance; the loser fails, loud.
              ⇒ the cursor can NEVER move backward, regardless of the forge's
                 fast-forward policy on non-refs/heads namespaces.
```

**No local governance ref is ever read or written by `advanceCursor`.** A plain checkout (or a fresh clone,
exactly like `actions/checkout`) has none, and a local `update-ref` CAS here would only mask the remote
lease's own guarantee — worse, it would make the human `accept` path (§2.4) fail on precisely the
plain-checkout shape it exists to serve, since that checkout has no local ref to CAS against. The remote
lease is not a fallback for a local check; it is the only check.

`from` is the exact cursor value `readCursor` returned inside `resolveWindow`. One value, threaded through:
**what we audited from is what we advance from.** The remote CAS closes three findings at once — auto-create,
the backward-move race, and the skip-over's second half.

`concurrency: { group: governance-postmerge, cancel-in-progress: false }` is added to the workflow as
*defence in depth*. The CAS is the actual guarantee; the concurrency group merely stops two runs from
wasting effort racing on the same revert branch.

### 2.4 Human acceptance — the ONLY non-tree resolution path

**R-1 is REPLACED, not refined (owner ruling, supersedes #886).** The dual path survives in *shape* only:
there are exactly two ways an offender leaves the flagged set, and the trailer is not one of them.

```
1. AUTOMATIC — TREE EFFECT ONLY (§3). A later first-parent merge in the window contributes the
               exact patch-inverse of the offender's first-parent contribution
               (normDiff(R,R^1)==normDiff(O^1,O), both non-empty), with the anti-vacuity guard.
               No message, no ancestry.
2. HUMAN GATE — a registered, recorded acceptance:
   node brain/scripts/governance/postmerge/cursor.mjs accept <from-sha> <to-sha> --reason "<justification>"
     → acceptManually({ git, from, to, reason }) — `from` is the CALLER's (the human's) explicit
       assertion of the cursor value they reviewed, NOT read from the live cursor. Requires a
       non-empty `reason` and a 40-hex `from`, echoes the reason to stdout, then performs the SAME
       CAS advance as the automatic path. This is what gives the CAS its function on the human
       path: if the live cursor moved between the human's review and this call (e.g. an automatic
       advance ran in between), the CAS fails loud instead of silently advancing from wherever the
       cursor now is — fail-closed, so the human re-evaluates instead of unknowingly skipping an
       interval they never reviewed.
```

There is no third path. The commit trailer and the ancestry check are **deleted from the design as
discriminators** — not a hint, not a pre-filter, not a tiebreaker (§3.0). The human gate is the escape
hatch for every offender class automatic tree-effect deliberately refuses (§3.3, §3.5).

---

## 3. Revert resolution — proved by TREE EFFECT, never by a message

### 3.0 The hard rule (absolute — owner ruling, R-1 REPLACED)

> **A revert is a claim about the tree, and only the tree can prove it.** Automatic revert-resolution is
> **TREE EFFECT ONLY**: a later first-parent merge in the window contributes the **exact patch-inverse** of
> the offender's own first-parent contribution — `normDiff(R, R^1) == normDiff(O^1, O)`, both non-empty
> (§3.2) — proved by whole-commit first-parent diff-inversion, not by path identity. Subject to the
> anti-vacuity guard (§3.2). The **only** other way an offender is resolved is the **human gate** (§2.4).
> There is no third path.

Removed from the design, permanently and entirely, as discriminators of resolution:

- **The commit trailer** (`This reverts commit <sha>.`) — a message is free text; an attacker writes it
  and reverts nothing. It is not a hint, not a pre-filter, not a tiebreaker. `brain-audit` reads **no
  commit body** for resolution.
- **Ancestry** (`merge-base --is-ancestor`) — on a linear `main`, **every** commit merged after the
  offender is trivially its descendant, so ancestry is satisfied by construction and proves nothing.

`isRevertedInRange`, `findTrailerCandidates`, and `trailerRegex` are **deleted** from `cursor.mjs`. Any
future reintroduction of a message- or ancestry-based resolution signal is a design regression, and the
adversarial fixtures in §7.1 (A1) exist to catch exactly that.

### 3.1 The options — judged on which direction they fail

The v1 table ranked options by *robustness*. That was the wrong axis. For a resolution predicate the only
axis that matters is **which direction does it fail?**, because the two failures are catastrophically
asymmetric:

- A false **"resolved"** advances the cursor and masks the violation **forever** — the exact catastrophe
  D2 exists to prevent.
- A false **"not resolved"** pins the cursor → a LOUD issue → a human runs `acceptManually`. Annoying, SAFE.

An option that can fail **OPEN** is disqualified no matter how robust; an option that only ever fails
**CLOSED** is admissible even when fragile, because its fragility lands on the safe side. Re-judged on that
axis (this reverses the v1 rejection of inverted-diff: it was rejected for *brittleness*, an axis that does
not disqualify a fail-closed mechanism):

| Option | Proves | Which direction does it fail? | Verdict |
|---|---|---|---|
| **Trailer + ancestry** (v1) | The candidate is a descendant of the offender — true of *every* commit on a linear main | **OPEN.** The trailer is free text an attacker writes; a descendant that reverts *nothing* is marked resolved → cursor advances → violation masked forever. | **REJECTED — fails open, reproduced bypass** |
| **Naive text-inversion** — compare the raw `git diff` text of `O^1..O` against the candidate's reversed patch text, byte-for-byte including `@@`/`index` | The candidate's patch text is the exact byte-inverse of the offender's *at identical hunk offsets* | **CLOSED.** Any intervening commit shifts hunk offsets (`@@` line numbers, surrounding `index` oids); `git revert` rebases the inverse onto new context so the *text* legitimately differs → false "not resolved" → cursor pins → human gate. High false-NEGATIVE rate, but every failure is SAFE. | **REJECTED — brittle, but the v1 rejection weighed the wrong axis; refined into normDiff below** |
| **`git patch-id --stable` inversion** | The offender and candidate patches collide under git's canonical patch identity (offset-tolerant for free) | **OPEN on whitespace.** patch-id strips leading/indentation whitespace with **no off-switch** — `add "PAY"` and `add "        PAY"` hash IDENTICAL (ws.mjs) → an indentation-borne payload (YAML/Python) is laundered as its own revert → cursor advances. A relaxation beyond position with no floor. | **REJECTED — fails open on indentation, uncontrollable (ws.mjs)** |
| **Bot author / verified signature** | That a commit came from an identity | **OPEN.** Author is a free-text field an attacker sets; a signature needs key material in the runner (new infra, forge-specific). Provenance marks resolution with zero tree fact → cursor advances. | **REJECTED — fails open, provenance ≠ proof, forge-coupled** |
| **Revert must be a merge of `auto-revert/<sha>`** | That the revert came through our own PR flow | **OPEN.** Forgeable by naming a branch → cursor advances. Also excludes a human's hand-rolled revert and hard-couples resolution to the GitHub PR model → m3 fail. | **REJECTED — fails open, forgeable + coupled** |
| **normDiff inversion** (hardened command, §3.2) ✅ | **That ∃ a later first-parent merge whose first-parent contribution is the *exact patch-inverse* of the offender's contribution** — offset-tolerant (strips `@@`/`index`) yet whitespace-EXACT (keeps `+/-` bytes, modes, `diff --git` paths, `--binary` blocks). Nothing to forge. | **CLOSED.** Anything short of an exact inverse — partial revert, rename, copy, re-add, bundled change, near-hunk drift within U3 — is not resolved → human gate. The residual fragility (offset drift inside the U3 blast radius) is the naive-inversion fragility, kept on the safe side. | **CHOSEN** |

### 3.2 The predicate (`postmerge/resolution.mjs`)

The mechanism is **whole-commit first-parent diff-inversion**: an offender is resolved iff a later
first-parent merge contributes the *exact patch-inverse* of the offender's own first-parent contribution.
It compares **normalized diffs**, not path sets.

```
normDiff(a, b)  →  the offender/candidate's contribution, rendered under a fully-pinned command
                   and normalized to be position-tolerant but content-exact:

  git -c diff.algorithm=myers -c diff.renames=false -c core.attributesFile=/dev/null \
      diff --no-textconv --no-ext-diff --no-renames --binary -U3  <a> <b>
    | drop only lines matching /^@@ / and /^index /, keep EVERYTHING ELSE byte-exact

  (--binary is the F-4 defense: it renders even a `-diff`-attributed file as a content-bearing
   base85 patch. NO .git/info/attributes write — a read predicate must not mutate the environment;
   see §3.2 rendering-surface note and judgment-day Round 1.)

diff(X) := normDiff(X^1, X)        ← FIRST-PARENT contribution of commit X

isResolvedAt(offender, tip, { git }) → boolean
   dO = diff(offender) = normDiff(offender^1, offender)
   if dO is EMPTY  →  { resolved: false, reason: 'offender has no first-parent contribution' }
                      ◄── EXPLICIT anti-vacuity guard, RE-ESTABLISHED for this mechanism
                          (not inherited): git emits NOTHING for an empty diff, so an unguarded
                          `'' == ''` would resolve garbage (F-1). Refused, loudly, first branch.
   resolved  ⟺  ∃ first-parent merge R ∈ (offender, tip] :  diff(R) == dO
                (R ranges over the `--first-parent --merges` commits brain-audit already tracks —
                 no new enumeration mechanism; the revert lives as one of those merges)
```

**Why first-parent (mandatory, not a preference).** brain merges PRs with `--merge`, so the offender is a
merge commit and `git show <merge>` (the combined diff) is **EMPTY** for every clean merge — "¬(full diff
of O)" is undefined for the dominant production case. `diff(X) := X^1..X` recovers the merge's first-parent
contribution to main (non-empty). Candidate reverters `R` range over the same first-parent merges, because
a revert PR is itself merged `--merge`.

**Diff rendering is a security surface (F-4, forged in forge6/insp4).** `git diff` output is **not** a pure
function of the tree pair — it is governed by config, part of which lives IN THE REPO (`.gitattributes`) and
is therefore attacker-controlled, and git reads attributes from the **checked-out tip**. So a
`.gitattributes` landed *after* an old offender could rewrite how THAT offender's diff renders:

- **Attack confirmed (insp4):** `*.md -diff` planted at the tip makes `git diff O^1 O` render the old
  payload as an opaque `GIT binary patch` (`check-attr` → `diff: unset`).
- **Defended by `--binary` ALONE (measured, forge6/forge_forkb2):** with `--binary`, even a `-diff`-attributed
  file emits a base85 `GIT binary patch` that **carries the literal content**, so two distinct payloads stay
  distinct → the attack is dead. `--binary` is the load-bearing F-4 defense. The rename PAIR `--no-renames` +
  `diff.renames=false` renders a rename as delete+add (F-4c: exposes *both* paths, vs. `rename from/to` which
  hides content) — behaviorally tested, but only the PAIR reddens (git's default is `renames=true`, so either
  half alone still disables renames; see line 301).

> **REJECTED (judgment-day Round 1, both judges forged): a `.git/info/attributes = "* diff"` override.**
> It was (1) INERT in a linked worktree — it writes to `git rev-parse --absolute-git-dir` (the per-worktree
> gitdir) while git reads `info/attributes` from `--git-common-dir`; **brain mandates worktree-per-task, so
> it is inert in the real topology**; (2) DESTRUCTIVE — an unconditional overwrite clobbers a human's
> pre-existing `.git/info/attributes` (git-crypt filters and all), never restored; (3) REDUNDANT — `--binary`
> already kills the attack. A read predicate that MUTATES the environment to measure has already lost. **The
> predicate is pure-read.**

**Two of the pinned flags are load-bearing content/environment defenses (behaviorally tested):** `--binary`
(attacker content, §above) and **`--no-ext-diff`** — a GLOBAL `diff.external` helper applies to every path
regardless of attributes and OVERRIDES `--binary`'s rendering entirely, collapsing distinct contents to the
helper's output, so `--binary` does NOT cover it; dropping `--no-ext-diff` reddens the HOSTILE-ENV safety
test (judgment-day R2, both judges + author forged). The rename PAIR `--no-renames`+`-c diff.renames=false`
is also behaviorally tested (only the pair reddens; git's default is `renames=true`).

**The remaining THREE pins are DETERMINISM, not content** (`-c diff.algorithm=myers`,
`-c core.attributesFile=/dev/null`, `--no-textconv`). These do NOT defend against attacker *content* —
`--binary` does that — and do NOT redden: they guarantee the verdict does **not depend on the ambient git
config of the machine the predicate runs on** — the "green that depends on the environment" failure class D2
exists to kill (the CP-PR1/B6 lesson). Forged under an adversarial `GIT_CONFIG_GLOBAL`
(forge_forkb2/forge_forkb3): **given `--binary`, dropping any one of these three does not flip a verdict**
(`--binary` bypasses the textconv driver; the algorithm is run-consistent) — so they are honestly labelled
**defense-in-depth / determinism, NOT behaviorally reddenable**, never "reddens-on-drop". They are kept
(cheap; load-bearing only if `--binary` is ever weakened). The behavioral robustness test asserts the
predicate returns correct verdicts *under* a hostile ambient config.

**RULE:** every flag and config that affects rendering is pinned **explicitly** in the command, NEVER
inherited from env or repo. The `.gitattributes` at the tip is untrusted repo content — but the predicate
neutralizes it by READING (`--binary`), never by WRITING.

**The two relaxations, each justified and attack-fixtured** (everything else is kept byte-exact):

- **`/^@@ /`** — the hunk position header (pure line numbers). Stripping it makes the comparison tolerant of
  offset drift from intervening commits (forge_final drift case → resolved).
- **`/^index /`** — blob-identity metadata, REDUNDANT to the `+/-` content which is already compared
  byte-exact. Stripping it lets a hunk match across an unrelated surrounding-blob change without weakening
  content comparison.

Kept byte-exact (each backed by a forge fixture): `diff --git a/… b/…` paths (F-3), `old/new mode` lines
(a chmod +x on a payload is visible), `+/-` content **including whitespace** (indentation-borne payload
fails closed — the one thing patch-id could not guarantee, ws.mjs), and `--binary` GIT-binary-patch blocks
(F-2: without `--binary`, git emits only "Binary files … differ" with no content, so different binary
payloads collide). Validated 11/11 in `forge_final.mjs`.

Anchor: `tip` is always `HEAD` — guaranteed by §2.2 (every window ends at HEAD).

**What this deliberately refuses** (all fail **closed** — the offender stays flagged, the cursor stays
pinned, the job stays red, and the human uses `accept --reason`; the exhaustive adversarial set is §7.1):

| Situation | Outcome | Why refusing is right |
|---|---|---|
| A partial revert (some of the offender's paths restored, not all) | NOT resolved | `diff(R) != diff(O)` — the whole contribution was not inverted. Half the payload is still on disk. |
| A rename / copy / equivalent-content rewrite that relocates the payload | NOT resolved | The candidate's contribution is not the inverse of O; the payload survives at a new path. |
| A legitimate revert **bundled** with an unrelated edit in one commit | NOT resolved | Whole-commit inversion: `diff(R)` carries the extra edit → `!= diff(O)`. Fail-closed on the safe side (R-2). |
| The payload is reverted and then **re-introduced** by a later commit | NOT resolved *at that tip* | The predicate is anchored at the tip; the re-add is a NEW offender for its own audit (§3.6). |
| The offender merge changed nothing (empty first-parent diff) | NOT resolved | Anti-vacuity guard (F-1). Never a free pass. |

### 3.3 The reverter-skip — closing the revert-of-revert loop

**Adjudicated: the loop is REAL, and it is narrow.** Auditing the auto-revert merge `R` itself:

| Check | Verdict on `R` | Why |
|---|---|---|
| `diffSize` | pass | The revert PR carries `size:exception` |
| `issueLink` | pass | The revert PR body carries `Part of #144` |
| `memoryPresence` | pass | Repo-level check, not per-merge |
| `adrPresence` | **FAIL — iff the offender's own violation was `adrPresence`** | `adr-presence.mjs:12-19` fails only on `hasAdr XOR hasHome`. Reverting a merge that added an ADR without `brain/HOME.md` removes exactly that ADR → `hasAdr XOR hasHome` again → the revert is flagged → an auto-revert of the auto-revert. |

Fix — **reuse the same mechanism, no new signal**:

```
A failing merge R in the window is [SKIP] "revert of <M>" iff there exists a merge M in the
SAME window such that:
      isReverterOf(M, R)  ⟺  diff(R) == diff(M)      (both non-empty)
                          i.e. normDiff(R, R^1) == normDiff(M^1, M)
      ← R's first-parent contribution is the EXACT patch-inverse of M's contribution,
        so R is demonstrably what undid M — no message, no ancestry, no identity read.
```

Non-forgeable (a pure tree property). **A pure rename's contribution is not the inverse of M** → the
renamer is *not* crowned reverter → it earns no self-exempt `[SKIP]` (PR3): a launder that relocates the
payload still fails closed. Evaluated **only for merges that already failed**, so the cost is
zero on the happy path. And the design is closed: `M` and `R` always co-occur in the same window, because
the cursor cannot advance past `M` until the window containing `M` goes clean — and the window that first
goes clean is the one `R` landed in.

### 3.4 Record framing — a standing invariant

The v1 `%H\x1f%B\x1e` framing was not injection-proof (git permits `\x1e`/`\x1f` in commit messages). v2
**deletes the message parse entirely** — tree-effect resolution reads no commit bodies — so the specific
defect evaporates. The rule it taught survives as an invariant:

> **Any multi-record `git log` parse MUST frame with NUL (`-z` / `%x00`).** NUL is the only byte git
> cannot store in a commit message. A drift-guard test asserts no `\x1e`/`\x1f` framing constant exists
> under `governance/postmerge/`.

---

### 3.5 Does tree-effect cover EVERY violation class? (answered, not assumed)

**No — and pretending it did would be the next fail-open.** Tree-effect proves exactly one thing: *the
offender's contribution to the tree is undone.* That is the correct proof for a **revert**, whatever the
check measured. It is **NOT** a proof for a **forward-fix** (adding a missing file, adding a label,
adding a repo-global artifact), because a forward-fix leaves the offender's own contribution on disk.

`brain-audit.mjs` flags exactly four violation classes (the `results` object, `brain-audit.mjs:254-262`).
Each is mapped below to exactly one automatic mechanism, or explicitly to the human gate / exit-2. **A
class whose real-world resolution is a forward-fix falls to the human gate — never to a false "resolved."**

| Class (source) | What it measures | Input mutability | Automatic tree-effect (revert)? | Forward-fix resolution | Terminal mapping |
|---|---|---|---|---|---|
| **`diffSize`** (`diff-size.mjs`) | Line count of **M's own diff** `parent1..M` vs 400 | **Immutable** (M's diff) — except the `size:exception` **label**, fetched fresh via `prView` | **YES.** A revert whose contribution inverts M's → `diff(R)==diff(M)` → tree-effect skip. Correct: M's own diff stays >budget forever, so the skip is the only settle-by-revert path. | Add `size:exception` label → `prView` re-fetch → check **PASSES on re-eval** (true `[PASS]`, mechanism **A**, no skip). Or genuinely shrink via a **new** merge (that new merge is audited on its own). | **automatic tree-effect** (revert) **or automatic re-eval** (label) **or human gate** |
| **`issueLink`** (`issue-link.mjs`) | Issue ref in the **PR body** (`prView`) with fallback to the **commit body** | PR body **mutable** via `prView`; commit-body fallback **immutable** | **YES** for the revert case (payload gone → tree-effect skip). | Edit the merged PR's description to add `Closes/Part of #N` → `prView` re-fetch → **PASSES on re-eval** (mechanism **A**). Commit body itself is immutable. | **automatic tree-effect** (revert) **or automatic re-eval** (PR-body edit) **or human gate** |
| **`adrPresence`** (`adr-presence.mjs`) | `hasAdr XOR hasHome` over **M's own changed files** | **Immutable** (M's diff) — there is **no** mutable input | **YES for revert ONLY.** A revert whose contribution inverts M's (removing the ADR / restoring HOME) → `diff(R)==diff(M)` → skip; the substance (an ungoverned ADR) is gone. | **THE OWNER'S CASE: tree-effect CANNOT prove it.** Adding the missing `brain/HOME.md` (or the missing ADR) is a **forward add** — no later merge inverts M's contribution → **no exact inverse** → tree-effect returns **not-resolved (fails closed, correct)**. M's own diff re-flags `adrPresence` **forever**, so re-eval never clears it either. **The forward-fix resolution has NO automatic path.** | **automatic tree-effect** (revert) **or HUMAN GATE** (forward-fix). Never a false "resolved." |
| **`memoryPresence`** (`memory-presence.mjs`) | ≥1 `session_summary` in **HEAD** `.memory/` — **repo-global**, identical for every merge | **Mutable & global** (read at HEAD, not tied to M's paths) | **Irrelevant.** Tree-effect on M's paths cannot prove a repo-global property. It never fires *for this reason* (though a reverted M is skipped wholesale before this check runs — see note). | Add a `session_summary` at HEAD → **every** merge PASSES `memoryPresence` on the next run (mechanism **A**). The global gap is enforced through every un-reverted merge until it is filled. | **automatic re-eval** (add summary). **Never tree-effect, never a false "resolved."** |

Mechanisms referenced above:

- **A — automatic re-evaluation (true PASS):** the check reads a **mutable** input (HEAD working tree, or
  PR labels/body via `prView`). The forward-fix makes the check **pass** on the next run. M becomes a real
  `[PASS]` — it never touches the skip class, so there is no path to a false "resolved."
- **B — automatic tree-effect skip (settled-by-revert):** the check reads M's **immutable** contribution
  and a later first-parent merge contributes its **exact patch-inverse** (`normDiff(R,R^1)==normDiff(M^1,M)`,
  §3.2). This is the ONLY use of the tree-effect skip.
- **C — human gate:** the offender is neither reverted nor clearable by re-evaluation (the `adrPresence`
  forward-fix; a content over-budget that is neither reverted nor label-exempted). Tree-effect **fails
  closed** and the human runs `accept --reason`.
- **D — exit-2:** the class could not be computed (git/adapter/config failure). Never a resolution.

**Plainly stated:** `adrPresence` is the class with **no automatic forward-fix path** — its non-revert
resolution is human-gate only, and tree-effect is engineered to fail closed on it rather than fake a pass.
`memoryPresence` self-heals only through re-evaluation, never through tree-effect. Only `diffSize` and
`issueLink` have a revert-shaped automatic path *and* a mutable-input re-eval path. No class is resolved by
a message, and no class is ever falsely marked resolved.

> **Note (skip precedence):** the tree-effect skip is a **pre-evaluation** skip (like the pre-baseline
> skip). A reverted M is skipped before any of the four checks run — including `memoryPresence`. That is
> correct: M is settled; the repo-global memory gap is still enforced on every **un-reverted** merge and on
> the revert commit R itself, so the window cannot go clean while a real global gap remains.

### 3.6 The soundness claim — what the predicate PROVES (C4)

State the claim exactly, because the last review's core finding was a **documentary lie**: the v1 §3.1
claimed tree-effect *"proves the payload is not on disk"* when the mechanism only proved *"path P returned
to its prior state"*. Repeating that phrase — in any form — is the failure being fixed here.

**What the predicate proves:** *∃ a later first-parent merge `R` whose first-parent contribution is the
exact patch-inverse of the offender's own first-parent contribution* (`normDiff(R,R^1) == normDiff(O^1,O)`,
both non-empty). That is: O's exact contribution to main was undone by a recognized inverse commit.

**What it does NOT prove:** that the payload's *content* is absent from the tree. These are different
statements, and the predicate makes only the first.

**Written counterexample (correct behaviour, not a bug).** `R` reverts `O` exactly → the predicate says
**resolved** (correct — O's contribution was inverted). A *later* commit `X` re-adds the same payload. The
payload **is now on disk**, yet the predicate still reports O as resolved — and that is **correct**, because
the re-add `X` is a **NEW offender for its own audit** (the predicate is anchored at the tip; §7.1 A5 pins
the re-add at *its* tip). Resolution is a statement about O's contribution, never a whole-tree content scan.

**Where the unproven cases fall.** Anything that is not an exact inverse — partial revert, rename, copy,
split, merge, equivalent-content rewrite, bundled revert, near-hunk drift, an empty offender — yields
`resolved = false` → the **human gate** (`acceptManually`) or **exit-2** when the diff is uncomputable.
Fail closed. The predicate never guesses in the OPEN direction.

> **Invariant for this document:** the phrase *"proves the payload is not on disk"* (or any equivalent
> whole-tree absence claim) must NOT appear as a description of what automatic resolution proves. That claim
> is false and is the exact defect this redesign removes.

## 4. The git seam must return status, not throw

The v1 seam was `try { execFileSync(...) } catch { /* false */ }`. **That shape is the mother of every
fail-open in this change.** It cannot distinguish `git ls-remote` exit 2 ("no such ref — proved absent")
from exit 128 ("cannot reach origin"), or `git diff --quiet` exit 1 ("differs") from exit 128 ("bad rev").

```
// postmerge/git-seam.mjs — the ONE git primitive the whole core is built on
gitTry(argv) → { status: number, stdout: string, stderr: string }   // NEVER throws on non-zero
gitOrThrow(argv) → string                                            // throws with status attached
```

Every core function maps `status` explicitly. **An unmapped status is `uncomputable`, never a verdict.**
This is a design-level rule, not a coding style: a boolean seam structurally cannot express the tri-states
this design depends on.

---

## 5. FAIL-CLOSED — the principle the v1 design never stated

> **No error may become a PASS. Absence of evidence is never evidence of a clean audit. Every path that
> cannot produce a verdict must produce exit 2 — loudly, and it must fail the job.**

### 5.1 The exit-code contract

| Code | Meaning | Emitted by | Wrapper MUST |
|---|---|---|---|
| **0** | The window was computed, every merge in it PASSed or was legitimately SKIPped | `brain-audit` | Advance the cursor (CAS from the audited base). Job green. |
| **1** | ≥1 genuine governance violation, with ≥1 `[FAIL-SHA]` line on **stdout** | `brain-audit` | Auto-revert exactly those SHAs. **Never** advance. Job red. |
| **2** | **Uncomputable** — infra/git/config failure; the verdict is UNKNOWN | `brain-audit` (incl. its top-level catch) | Loud issue. **Never** revert, **never** advance. Job red. |
| **anything else** (3+, 127, 137/SIGKILL, empty) | The audit produced no verdict at all | — | **Normalize to 2** in the step, then treat as 2. Job red. |

### 5.2 The five fail-open paths, and how each is closed

| # | Fail-open (v1) | Closure (v2) |
|---|---|---|
| **a** | The window step's `node -e` promise chain has no `.catch()` under `set +e`. Any throw → empty stdout → `result` is not `"MISSING"` → the step writes `missing_cursor=false` and an **empty range** → `brain-audit ""` falls back to `origin/main..HEAD` → empty range on main → exit 0 → **"clean audit" + cursor advance.** | The window step becomes a **CLI on the core** (`cursor.mjs window`) that prints exactly one of `PRESENT <base> <head>` / `ABSENT` / `UNKNOWN <reason>` and exits 0/2/2. The wrapper has an explicit `case … *)` arm: **any unrecognized output is `UNKNOWN` → exit 2.** The "not MISSING ⇒ assume a range" inference is deleted. An empty range can never be produced. |
| **b** | `brain-audit`'s top-level catch exits **1** and writes to **stderr**, which `out=$(node …)` does not capture → zero parsed offenders → the loop body never runs → **green**. | Top-level catch → **exit 2**. The uncomputable message goes to **stdout** (captured). The wrapper captures `2>&1` so a crash's stderr lands in the loud issue body. |
| **c** | `set -o pipefail` does **not** propagate out of process substitution `< <(…)`, so a failing `parse-failures.mjs` leaves `mapfile` at status 0 with an **empty array**. | Process substitution is **banned** in this workflow. `offenders=$(node parse-failures.mjs <<<"$AUDIT_STDOUT")` — a plain command substitution, which **does** trip `set -e`. Then `mapfile -t offenders <<<"$offenders"`. |
| **d** | Exit codes ≥3 / SIGKILL match no `if:` → **every** step is skipped → **green job**. | (i) The audit step normalizes any unmapped code to `2` before writing `code=`. (ii) A final `if: always()` **terminal-state assertion** step fails the job unless `steps.audit.outputs.code` is exactly `0`, `1`, or `2` — which also catches "the audit step was killed and never wrote an output at all". |
| **e** | A crash yielding **zero** parsed offenders on `code == 1` would revert nothing and go green. | **Cross-check:** `code == 1` ⇒ the parser MUST return ≥1 offender. Zero offenders on code 1 is itself an uncomputable state → loud issue → exit 2. This closes the same hole from the other side. |

### 5.3 The loud path must actually be loud

`gh label list` returns only `size:exception`. `governance:cursor-missing` and
`governance:audit-uncomputable` **do not exist**, `gh issue create --label <nonexistent>` **fails**, and
all three call sites are `|| true`'d. The alert vanishes silently. The push-path cursor-missing branch has
`|| true` **and no `exit 1`** → green job, zero signal.

**Decision: labels are created idempotently in-step, and NOTHING on a loud path is `|| true`'d.**

```
set -euo pipefail
gh label create "$LABEL" --color B60205 --description "…" --force   # idempotent; no || true
printf '%s' "$BODY" > "$RUNNER_TEMP/body.md"                        # untrusted text via FILE, never argv
gh issue create --title "…" --label "$LABEL" --body-file "$RUNNER_TEMP/body.md"
exit 1                                                              # ALWAYS. Every loud path is red.
```

Rationale for in-step creation over a provisioning prerequisite: a prerequisite that a fresh clone / a new
fork / a GitLab port silently lacks is a *new* fail-open. `--force` makes creation idempotent and free.
And if `gh` fails anyway, the step fails → **the red job is itself the loud signal**. The alert is never
allowed to vanish. Alert-fatigue guard: before creating, `gh issue list --label "$LABEL" --state open` —
if one is already open, comment on it instead of minting a 366th issue.

**Every loud path exits non-zero. There is no loud path that leaves the job green.**

---

## 6. The auto-revert loop — PR-keyed, bounded, and never silently partial

| v1 defect | v2 |
|---|---|
| Idempotency keyed on the **branch**, and the branch is pushed **before** `gh pr create`. A failed PR creation leaves an orphan branch that **permanently suppresses** the revert PR while the job stays green. | **Key on the PR:** `gh pr list --head "auto-revert/<sha>" --state all`. If `gh pr create` fails, **delete the pushed branch** (`git push origin --delete`) so no orphan can suppress a retry, record the offender as failed, and continue. |
| A `git revert` conflict aborts the **whole loop** under `set -euo pipefail`. Offenders 2..N are silently dropped, no `--abort`, and it re-conflicts on every rerun. | **Per-offender failure boundary.** Each offender runs in its own subshell with its own trap. A conflict → `git revert --abort` → reset to a clean detached HEAD → record in `failed[]` → **continue to the next offender**. |
| No policy for "the revert cannot be applied automatically". | **Stated policy:** after the loop, if `failed[]` is non-empty → one loud `governance:revert-blocked` issue naming every offender that could not be auto-reverted, with the manual revert command → **exit 1**. The cursor is pinned anyway (code 1). A blocked revert is a *named, visible, human-owned* state — never a silent drop. |
| `grep -c '^parent '` on `git cat-file -p` also matches commit-**message** lines beginning with `parent ` → inflated parent count → wrong `-m 1` decision. | `git show -s --format=%P <sha>` — parents only, no message. Count the fields. |
| `git checkout main; git reset --hard <sha>` mutates the local `main`. | `git checkout --detach "$HEAD_SHA"` per offender. No branch is ever clobbered. |

**A closed revert PR is a human decision.** `--state all` means a revert PR that a human *closed without
merging* is never re-opened. The offender then stays flagged, the cursor stays pinned, the job stays red,
and the human's exit is `accept --reason`. This is the stop-the-line invariant working, not a bug.

---

## 7. What an adversarial test MUST CONSTRUCT (the meta-lesson, made binding)

The prior pass shipped tests that encoded **the fixer's threat model, not the attacker's**. The F3 tests
only ever built the one shape the fix handled (a branch forked *before* the offender), so they went green
against a fix that does nothing. The F2 test asserted `rev-parse` fails in a repo with no ref — **which is
exactly what the broken production path also produces.** Tautological. Self-confirming tests are worse than
no tests: they convert "unverified" into "verified green" while the hole stays open.

**Therefore: every security-relevant requirement below states what a test must CONSTRUCT — the fixture, not
the assertion. A test that does not construct the adversary's shape does not count as coverage.**

### 7.0 Binding doctrine (engram `doctrine/adversarial-test-derivation`, #900)

Three rules govern every fixture in this section. They are acceptance criteria, not guidance:

1. **The fixture is derived from the ATTACK, not the fix.** The shape a test constructs comes from how the
   system is broken, never from what the patch happens to handle.
2. **The bar is "reddens against the prior plausible-but-wrong fix," not merely "fails on un-fixed code."**
   Every resolution fixture below (A1–A6, and C1) **MUST be shown to REDDEN against the ancestry-only fix**
   — the shipped v1 `merge-base --is-ancestor` code (commit `eff4560`), not just against pre-fix code. A
   test that stays green against the ancestry fix is **not a proof**; it is the same self-confirming
   failure the review caught. Concretely: land the fixture, run it against `eff4560`'s `cursor.mjs`, and
   record the RED. Only then is it a valid regression test for the tree-effect design.
3. **The patch author does NOT author the adversarial fixtures.** The finder or an independent third party
   derives them. The author writes tests from their own threat model — the same blind spot that produced
   the broken fix — so the test and the code agree while the hole stays open.

### 7.1 Revert resolution (§3)

**Topology contract for every row.** The offender `O` and every candidate reverter `R` are `--no-ff` merge
commits (brain merges PRs with `--merge`), so the predicate reads first-parent contributions
`normDiff(X^1, X)`. A genuine reverter is built as `git revert -m 1 <O>` on a branch off `main`, then merged
`--no-ff`. Each row states what the predicate reports, why that is SAFE, the forge scenario it derives from,
and the **mutation bar** (the code mutation that MUST redden the row — proving the test kills that mutant).

| ID | The test MUST construct | Must prove (verdict + why safe + forge + mutation bar) |
|---|---|---|
| **A1** | Offender merge `O` (adds a payload file). Then an **ordinary merge `X` forked AFTER `O`** (a real descendant, the realistic linear-main shape) whose body contains `This reverts commit <O>.` but whose contribution **does not invert `O`**. | `O` still `[FAIL]`ed, no `[SKIP]`, exit 1. **Safe:** a free-text trailer is never read; only `normDiff(X,X^1)==normDiff(O^1,O)` skips, and it is false. **MUST redden against `eff4560`** (ancestry PASSES because `X` descends `O`, so the v1 code wrongly skips). **Mutation bar:** re-introducing any trailer/ancestry read reddens this. |
| **A2** | The **real D2 loop**: offender merge `O` → `git revert -m 1 O` on a branch → revert PR merged `--merge` as `R`. | `[SKIP] … resolved by revert`, exit 0, payload gone. **Safe/liveness:** the mechanism must recognize its own revert or it is theatre with the sign flipped. **Forge:** forge_final #1 (C2). **Mutation bar:** dropping the `∃R: diff(R)==diff(O)` clause reddens (nothing ever resolves). |
| **A3** | `O` touches `a.md` and `b.md`; a later merge reverts **only `a.md`**. | `O` still `[FAIL]`ed. **Safe:** `diff(R) != diff(O)` (b.md payload survives) → not resolved. **Forge:** forge_final #5 (partial revert). **Mutation bar:** comparing only a shared subset of hunks (instead of whole-diff equality) reddens. |
| **A4** | `O` is a merge with an **empty first-parent diff** (no-op). | Automatic resolution does **NOT** fire. **Safe:** git emits nothing for an empty diff, so an unguarded `''==''` would resolve garbage; the non-empty guard (F-1) refuses it. **Forge:** forge_final #8. **Mutation bar:** removing the `dO non-empty` guard reddens (empty offender falsely resolves against any empty candidate). |
| **A5** | `O` reverted by `R`; then a **later merge re-adds the payload** to the same path. | `O` reports resolved at `R`'s tip, but the re-add is flagged as a **new offender at its own tip** — it is **NOT** silently `[SKIP]`ped. **Safe:** resolution is a statement about O's contribution, not a whole-tree scan (§3.6). **Forge:** derived from forge_final #1 + a re-add merge. **Mutation bar:** anchoring resolution anywhere but the tip reddens. |
| **A6** | An `adrPresence` offender `O` and its auto-revert `R` in the same window; separately, a merge that merely *claims* to revert `O` with no inverting contribution. | `R` is `[SKIP] revert of O` (no revert-of-revert); the mere-claim merge is **not** skipped. **Safe:** `isReverterOf(O,R)` is `diff(R)==diff(O)`, a pure tree property (§3.3). **Forge:** forge_final #1 for the true `R`; A1 shape for the claim. **Mutation bar:** reading the commit body to crown a reverter reddens. |
| **T1** | Pure rename: a later merge does `git mv payload.md moved.md`. | NOT resolved. **Safe:** the renamer's contribution (`--no-renames` → delete+add at two paths) is not the inverse of `O`; payload survives at `moved.md`. **Forge:** forge_final #2 (this fixture stays green under either single flag/config drop). **Mutation bar:** dropping the PAIR `--no-renames` + `diff.renames=false` (git's default re-enables `rename from/to`, which hides content) reddens the dedicated `MUTATION GUARD (--no-renames)` test — NOT this row's fixture, and NOT either half alone. |
| **T2** | Rename + one byte: `git mv payload.md moved.md` then append `#x`. | NOT resolved. **Safe:** contribution differs from `¬O` on content and path. **Forge:** forge_final #3. **Mutation bar:** any blob-OID-only comparison (which would call the moved payload "absent") reddens. |
| **T3** | Copy launder: `cp payload.md keep.md` then `git rm payload.md`, merged. | NOT resolved. **Safe:** the payload content survives at `keep.md`; the contribution is not `¬O`. **Forge:** forge_final #4. **Mutation bar:** path-set-only resolution (`P∩D=∅`, the old v1 mechanism) reddens — it would falsely resolve. |
| **T4** | Split: a later merge deletes the offender's file and writes its payload lines into two new files. | NOT resolved (payload survives in both new files). **Safe:** the split contribution is not the byte-inverse of `O`. **Forge:** forge_splitmerge.mjs T4 (dedicated fixture — offender adds `p.md` with two payload lines; splitter writes `p1.md`+`p2.md`, `git rm p.md`; verified `resolved=false`, both payloads survive). **Mutation bar:** hunk-subset matching reddens. |
| **T5** | Merge-files: a later merge appends the offender's payload file into an existing file and deletes the original. | NOT resolved (payload survives in the host file). **Safe:** contribution `!= ¬O`. **Forge:** forge_splitmerge.mjs T5 (dedicated fixture — offender adds `p.md`; merger folds it into `host.md`, `git rm p.md`; verified `resolved=false`, payload survives). **Mutation bar:** hunk-subset matching reddens. |
| **T6** | Equivalent-content rewrite: a later merge rewrites the payload to semantically-equal but byte-different text. | NOT resolved. **Safe:** whitespace/byte-exact `+/-` comparison; "equivalent" is not "inverse". **Forge:** forge_splitmerge.mjs T6 (`value = 42` → `value=42 # same`; verified `resolved=false`, payload survives), backed by ws.mjs (content bytes kept exact). **Mutation bar:** normalizing content whitespace (patch-id behaviour) reddens. |
| **T7** | F-2 binary: (a) a later merge writes a **different** binary payload to the same path; (b) a **genuine** `git revert -m 1 O` of a binary offender. | (a) NOT resolved; (b) resolved. **Safe:** with `--binary`, base85 blocks carry content so different payloads stay distinct, yet a true binary revert still matches. **Forge:** forge5 / forge_final #9. **Mutation bar:** dropping `--binary` (git emits only "Binary files … differ") reddens (a) into a false resolve. |
| **T8** | F-3 path-in-header: identical payload **content** committed at two different paths, as two independent offenders. | Distinct normDiff → neither is the other's reverter. **Safe:** the `diff --git a/… b/…` header carries the path and is kept byte-exact. **Forge:** insp4/forge6 setup (same content, different paths). **Mutation bar:** stripping the `diff --git` path line reddens. |
| **T9** | F-4 attribute rendering: attacker plants `.gitattributes` (`*.md -diff`) at the tip, then attempts to launder two distinct payloads as one revert. | NOT resolved (payloads stay distinct). **Safe:** `--binary` renders even a `-diff`-attributed file as a content-bearing base85 `GIT binary patch`, so distinct payloads stay distinct — `--binary` ALONE defeats F-4. **The `.git/info/attributes = "* diff"` override was REMOVED** (judgment-day R1, both judges forged: inert in a linked worktree — writes `--absolute-git-dir`, git reads `--git-common-dir`; destructive to human config; redundant with `--binary`). **Forge:** forge6 / insp4 (attack) + forge_forkb2 (`--binary` alone keeps distinct). **Mutation bar:** dropping `--binary` reddens (payloads collapse → false resolve). |
| **T10** | Whitespace: the payload differs only by **indentation** (0 vs 4 spaces vs tab) from its purported inverse. | NOT resolved. **Safe:** `+/-` bytes kept exact → an indentation-borne payload (YAML/Python) cannot be laundered — the exact guarantee `git patch-id` could not give (ws.mjs). **Forge:** forge_final #10, ws.mjs. **Mutation bar:** switching the mechanism to patch-id reddens. |
| **T11** | Liveness / blast radius: a genuine revert preceded by an **intervening merge editing near the offender hunk**, tried at distances 1..8 lines under `-U3`. | Distance **1** → `git revert` itself CONFLICTS → human gate; distance **2–3** → normDiff mismatch → human gate; distance **≥4** → auto-resolves. **Safe:** every pre-auto case fails CLOSED. **Blast radius = 3 lines** — the expected human-gate load (any pre-revert merge touching within 3 lines of an offender hunk). **Measured frequency (brain `git log`, this branch):** 105 first-parent merges, **0** `This reverts commit` trailers, 2 merges with "revert" in the subject → observed human-gate load from this vector ≈ **0** (reverts are ≤2/105 and land fast, so the pre-revert window rarely admits an adjacent edit). A number, not an adjective. **Forge:** blast.mjs. **Mutation bar:** widening context beyond `-U3` or normalizing offsets into content shifts the boundary and reddens the distance assertions. |
| **T12** | Determinism under a HOSTILE ambient config: run the full predicate with `GIT_CONFIG_GLOBAL` pointing at an adversarial config (hostile `diff.<d>.textconv`, `diff.external`, global `core.attributesFile`, `diff.algorithm=histogram`; `GIT_CONFIG_SYSTEM=/dev/null`). | Genuine revert → resolved; content-launder → NOT resolved. **Safe:** the verdict is INDEPENDENT of the machine's git config — the CP-PR1/B6 "green that depends on the environment" class. **Forge:** forge_forkb3. **Honest note:** `--no-ext-diff` IS behaviorally load-bearing here — a global `diff.external` overrides `--binary`, so dropping `--no-ext-diff` reddens THIS row's safety assertion (judgment-day R2). The OTHER three determinism pins (`--no-textconv`, `core.attributesFile`, `diff.algorithm`) do NOT defend against attacker content (`--binary` does) and do NOT flip a verdict when dropped given `--binary` → **defense-in-depth / determinism, NOT "reddens-on-drop"** (kept; load-bearing only if `--binary` is weakened). So this row is BOTH a positive robustness assertion AND the redden-on-drop coverage for `--no-ext-diff`. |
| **T13** | J-2 liveness gap: a genuine revert lands as a **squash-merge**, rebase-merge, or **direct non-merge push** rather than a first-parent merge. | NOT resolved → human gate. **Safe (fail-CLOSED — liveness, not security):** candidate enumeration is `git rev-list --first-parent --merges` only, so a non-merge revert is not a candidate. brain merges PRs with `--merge` (§6), so its revert PRs ARE first-parent merges and are seen; a repo using "Squash and merge"/"Rebase and merge" for revert PRs routes **100%** of genuine reverts to `accept --reason`. Documented in `resolution.mjs` itself, not only here. **Forge:** j2.mjs (both judges). |

### 7.2 The cursor (§2)

| ID | The test MUST construct | Must prove |
|---|---|---|
| **B1** | A **bare "origin" repo with the cursor ref set on it**, cloned by a plain `git clone` (which, exactly like `actions/checkout`, fetches `refs/heads/*` + tags only). **First assert the local `rev-parse` FAILS** — proving the fixture reproduces the production shape. | `readCursor()` then returns `{ state: 'present', sha }`, because it reads `ls-remote`'s own answer directly — the never-fetched local ref is never consulted at all. This is the test the tautological F2 test could not be: it distinguishes "correctly gated" from "the ref was never fetched, so the gate always trips". |
| **B2** | A bare origin with **no** cursor ref. | `{ state: 'absent' }` → exit 2 → loud issue **with** the init command. |
| **B3** | An origin URL pointing at a **nonexistent path** (unreachable). | `{ state: 'unknown' }` → exit 2 → loud issue **without** init instructions. **MUST NOT** be reported as `absent`. |
| **B4** | An origin with **no** cursor ref; call `advanceCursor` with a 40-hex `from`. | It **throws** (the remote lease rejects a `from` that cannot match an absent ref), and the ref **still does not exist on origin** afterwards. Asserted in the **CORE**, not against the YAML. |
| **B5** | Two **independent clones** of the same origin, both observing the cursor at the same `from`; one clone's `advanceCursor` call already succeeded. | The other clone's call **fails**, and the rejection comes from the **remote push** itself — there is no local ref to check. The cursor cannot move backward or be double-advanced. |
| **B6** | A cursor sha that is **not an ancestor of HEAD** (rewritten main). | `{ state: 'unknown' }`. Never a silently enormous window. |

### 7.3 Skip-over and fail-closed (§2.2, §5)

| ID | The test MUST construct | Must prove |
|---|---|---|
| **C1** | Cursor at `C`. Offender `M` lands (exit 1). Then a **clean merge `P2`** lands. | The window for the `P2` run is `C..P2` — it **still contains `M`** — so the run exits 1 and the cursor **does not move**. Against v1 this fixture shows the cursor jumping to `P2` over `M`. |
| **C2** | The window resolver's node process **throws / is killed / prints garbage**. | The wrapper produces **exit 2**, never an empty range and never a green job. |
| **C3** | `brain-audit` **crashes** (injected throw). | Exit **2** (not 1), the message is on **stdout**, and no revert and no cursor advance occur. |
| **C4** | `brain-audit` exits with **code 3** (or is SIGKILLed). | The terminal-state assertion step **fails the job**. |
| **C5** | `parse-failures.mjs` **fails** while the audit reported `code == 1`. | The job fails. `mapfile` never silently yields an empty array. |
| **C6** | `code == 1` but the audit stdout contains **zero** `[FAIL-SHA]` lines. | Exit 2 + loud issue. No silent no-op. |

### 7.4 Test-harness isolation (a defect in the tests themselves)

`release-postmerge-workflows.test.mjs` extracts a `run:` block that **includes the workflow's
`git config user.name "github-actions[bot]"` lines** and executes it via `spawnSync('bash', …)` **with no
`cwd`** — so it runs **in the repository**. It has already mis-authored 3 real commits on this branch.

**Binding isolation contract for any test that executes an extracted workflow script:**

```
cwd: mkdtempSync(...)                      ← NEVER the repo worktree
env: {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  HOME: <the same temp dir>,
  GH_TOKEN: undefined,                     ← never inherit a real token
}
```

| ID | The test MUST construct | Must prove |
|---|---|---|
| **D1** | A meta-test (drift-guard) over the test file itself. | Every `spawnSync`/`execFileSync` that runs an extracted workflow script passes a `cwd` **outside the repo** and sets `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM`. A future author cannot regress this silently. |
| **D2** | The full suite, run twice. | The repo's `git config user.name`/`user.email` are **unchanged** afterwards. |

---

## 8. Module layout (v2)

New/changed under `brain/scripts/governance/postmerge/` — all platform-neutral core:

| File | PR | Exports | Status vs v1 |
|---|---|---|---|
| `git-seam.mjs` | 1 | `gitTry` (status-returning), `gitOrThrow` | **NEW** (§4) |
| `cursor.mjs` | 1 | `readCursor` (tri-state, single `ls-remote` call, no fetch), `resolveWindow` (always `cursor..HEAD`), `advanceCursor` (remote-only CAS), `acceptManually`, `window`/`accept` CLI | **REWRITTEN** — `isRevertedInRange`, `findTrailerCandidates`, `trailerRegex` **DELETED**; no `syncCursor` (there is no local fetch step) |
| `resolution.mjs` | 2 | `normDiff`, `isResolvedAt`, `isReverterOf` | **NEW** (§3) |
| `parse-failures.mjs` | 3 | `parseFailingShas` + CLI | **SURVIVES AS-IS** (the only clean module in v1) |
| `exit-codes.mjs` | 5 | `EXIT`, `resultToExit` | Unchanged from v1 design |

Modified:

| File | PR | Change |
|---|---|---|
| `brain-audit.mjs` | 3 | Emit `[FAIL-SHA]`; swap `isRevertedInRange` → `isResolvedAt`; add the reverter-skip; top-level catch → **exit 2** with the message on **stdout**; keep the v1 `gitOrThrow` range-load exit-2 (that fix was correct) |
| `.github/workflows/governance-postmerge.yml` | 4 | Full rewrite against the v2 core: fetch the cursor ref, window CLI, fail-closed branching, loud-and-red issue paths, PR-keyed revert dedup, per-offender boundary, `concurrency:`, terminal-state assertion |
| `run-check.mjs` | 5 | `uncomputable:true` on infra fail-closed returns; `main()` via `resultToExit` |

---

## 9. RE-SLICING — the old split is dead

**The binding constraint.** Slice 1 as built is **397 counted lines against a 400 limit** (independently
confirmed by both judges; `governance.ignoreList` excludes `**/*.test.mjs` and `openspec/changes/**`).
**Three lines of headroom.** Every fix in this document **adds** code. `size:exception` is forbidden by the
proposal. **The remediation cannot fit in the current slice split.** The pre-named 2-slice plan was scoped
on a wrong understanding of the problem; it is a plan, not a law.

### 9.1 Chain strategy: stacked, each PR into `feature/v2.0.0`

Per `chained-pr`: >400 total, and **each slice can land independently** → **Stacked PRs** (here, stacked to
`feature/v2.0.0`, the change's base). A feature-branch-chain with a tracker is **REJECTED**: the tracker's
integration PR would be a single ~700-line diff into `feature/v2.0.0`, which needs a `size:exception` — the
exact thing the proposal forbade. Stacking keeps the diffSize gate satisfied **per PR**, with no exception,
which is the whole point of the budget.

### 9.2 The chain

```
feature/v2.0.0
   └── PR 1  cursor core (git seam + cursor state machine + CAS)          ~155
        └── PR 2  revert resolution (diff-inversion)                     ~150
             └── PR 3  brain-audit: emission + skip classes + exit-2      ~100
                  └── PR 4  the workflow wrapper (the only GitHub-coupled) ~235
                       └── PR 5  0/1/2 contract across all evaluators      ~105
```

| PR | Deliverable (one work unit) | Counted lines | Coherent end state |
|---|---|---|---|
| **1** | `git-seam.mjs` + `cursor.mjs`. Remote-authoritative tri-state, always-`cursor..HEAD` window, CAS advance that cannot create or rewind the ref. Tests **B1–B6**. | **~155** | Core is tested and **unused**. The pre-D2 workflow is untouched and behaves exactly as it does today. |
| **2** | `resolution.mjs`. Whole-commit diff-inversion proof. Tests **A1–A6, T1–T11**. | **~150** | Still unused. **This is the security-critical PR** — kept as small as the hardened predicate allows so it can earn a hostile review that answers exactly one question: *can this be forged?* |
| **3** | `parse-failures.mjs` + `brain-audit.mjs` (emission, resolved-skip, reverter-skip, catch → 2 on stdout). Tests **A1–A6 end-to-end, C3, C6**. | **~100** | The core goes **live via the CLI**: `npm run brain:audit` now emits `[FAIL-SHA]`, skips genuinely-reverted offenders, and reports uncomputable honestly. No workflow change yet. |
| **4** | The workflow rewrite: **fetch the cursor ref**, window CLI, fail-closed branching, loud-and-red issues + label creation, PR-keyed dedup, per-offender boundary, orphan-branch cleanup, `concurrency:`, terminal-state assertion. Tests **C1, C2, C4, C5, D1, D2** (D1/D2 fixed + proved here — born isolated from first RED; generalized into a standing registry in PR 5, §14 Plan Deviation). | **~235** | **The mechanism is live and correct.** The only GitHub-coupled PR in the chain; a GitLab wrapper is now a pure translation of this one file. |
| **5** | `exit-codes.mjs` + `run-check.mjs` + the both-fixtures drift-guard + the STANDING harness-isolation registry (generalizes PR 4's D1/D2 fix — never re-fixes it; §14 Plan Deviation). | **~105** | The 0/1/2 contract holds across **every** evaluator, enforced by a guard. |

**Headroom is deliberate.** The largest PR is ~235 against 400. After a review whose central finding was
"3 lines of headroom is itself a signal that the slice is packed too tight", every slice in this chain is
sized so that a *further* finding can be fixed **inside** its own PR without re-slicing again.

**PR 1 + PR 2 could be merged into one (~240, still legal).** I recommend against it: PR 2 is the entire
security thesis of this change, and it deserves an isolated review that cannot be diluted by a state
machine sitting next to it.

**Accepted tradeoff:** PRs 1–2 leave tested-but-unimported modules on `feature/v2.0.0` for two PRs. That is
the price of a reviewable chain, and it is cheap. PR 3 makes them live.

### 9.3 What happens to the 8 commits on the branch

**Recommendation: reset `feat/issue-259-fixgovernance-d2-rung-3-auto-revert-guar` to `feature/v2.0.0` and
re-land as the 5-PR chain.** Fix-forward is not viable: the two rewritten mechanisms are `cursor.mjs`'s
entire contract and the workflow's entire control flow, and a fix-forward diff would *add* the v2 code on
top of the v1 code's deletions — inflating the counted diff at the exact moment the budget has 3 lines
left. A reset also cleans the mis-authored commits for free.

| Commit | Disposition |
|---|---|
| *(3 earliest — the original apply batch: cursor core, `[FAIL-SHA]` emission, workflow wiring)* | **REWORKED.** `parse-failures.mjs` is **cherry-picked verbatim** (PR 3) — it is the one module the review found clean. The `[FAIL-SHA]` emission and the `gitOrThrow` range-load exit-2 are **salvaged** into PR 3. `cursor.mjs` and the workflow are **rewritten**. |
| `b213aab` docs(sdd): D2 planning artifacts + GitLab-porting constraint draft | **SURVIVES.** The `brain-drafts/` constraint doc is untouched by every finding. Re-land with PR 1 (0 counted — `openspec/changes/**` is ignored). |
| `2636892` docs(sdd): check off Slice 1 tasks | **DROPPED.** The checked-off tasks describe work that is being withdrawn. `tasks.md` is rewritten (§10). |
| `eff4560` fix(governance): harden revert resolution with ancestry verification | **DROPPED ENTIRELY.** This is the security theater — `findTrailerCandidates`, `trailerRegex`, and the `merge-base --is-ancestor` loop are the reproduced bypass. Its tests are dropped with it: they are **self-confirming** and would go green against a fix that does nothing. Superseded by §3. *(One genuine discovery inside it survives as knowledge, not code: `git revert -m 1` on a merge writes a comma-terminated trailer. It is now irrelevant — v2 reads no trailers.)* |
| `5a6ee2b` fix(governance): route audit stdout via env, gate cursor auto-create, full-sha dedup | **SPLIT.** ✅ **KEEP** the CWE-94 fix (`AUDIT_STDOUT` via `env:`, never `${{ }}`-spliced into a `run:` block — judges confirmed this is genuinely fixed) and the **full-sha** branch key. ❌ **DROP** the `cursor-precheck` step and the duplicate push-path loud-issue step: both are obsoleted by the unified always-`cursor..HEAD` window (§2.2), and the invariant they tried to enforce now lives in the core's CAS (§2.3). Both survivors are re-landed **inside PR 4's rewrite**, not as a separate commit. |
| `2be6177` docs(sdd): correct REQ-D2-5 slice label | **DROPPED.** Moot — `spec.md` is being re-sliced (§10). |
| *(git identity)* | **3 commits on this branch were mis-authored as `github-actions[bot]`** by the leaking test harness (§7.4). The reset resolves this. Re-land under the human's identity, with the D1/D2 isolation guards in place **before** the suite is run again. |

---

## 10. Consequent drift in `spec.md` and `tasks.md`

### `spec.md` — 4 requirements amended, 6 added

| REQ | Action |
|---|---|
| **REQ-D2-1** | **AMEND.** The window is `cursor..HEAD` on **every** trigger, not just `schedule`. `github.event.before` is not used. The advance is a **CAS from the cursor value the window was resolved from** — the audited interval and the advanced interval are the same interval by construction. |
| **REQ-D2-2** | **AMEND.** Cursor state is a **tri-state** (`present`/`absent`/`unknown`), **remote-authoritative** via `ls-remote --exit-code`. `absent` and `unknown` are distinct exit-2 outcomes with distinct issues; only `absent` carries init instructions. |
| **REQ-D2-3/4** | **AMEND.** Revert idempotency is keyed on the **PR** (`gh pr list --head --state all`), not the branch. A failed `gh pr create` deletes the pushed branch. Per-offender failure boundary. |
| **REQ-D2-5** | **UNCHANGED.** One parser, zero inline grep. Lands in PR 3. |
| **REQ-D2-6** | **AMEND.** Add: unmapped exit codes normalize to 2; `code == 1` ⇒ ≥1 parsed offender or it is uncomputable; a terminal-state assertion step fails the job when no recognized state was reached. |
| **REQ-D2-7/8/9** | **UNCHANGED.** |
| **REQ-D2-10** *(new, R-1 REPLACED)* | Automatic revert resolution MUST be proved by **tree effect ONLY**. A commit trailer, ancestry (`merge-base --is-ancestor`), an author identity, a signature, or a branch name MUST NEVER be sufficient — not as a hint, pre-filter, or tiebreaker. The **only** non-tree resolution path is the recorded human gate (`accept --reason`). An offender with an empty changed-path set MUST NOT be auto-resolved. |
| **REQ-D2-10a** *(new)* | Every violation class `brain-audit` emits (`diffSize`, `issueLink`, `adrPresence`, `memoryPresence`) MUST map to exactly one resolution mechanism: automatic tree-effect (revert), automatic re-evaluation (mutable input), human gate, or exit-2. A class whose real-world resolution is a **forward-fix** (e.g. `adrPresence` resolved by adding the missing file; `memoryPresence` resolved by adding a summary) MUST NOT be resolvable by tree-effect; it falls to re-evaluation or the human gate, and tree-effect MUST fail closed on it. See design §3.5. |
| **REQ-D2-11** *(new)* | Cursor state MUST be resolved directly from the remote — one `ls-remote --exit-code` call, **no local governance-ref fetch, read, or `rev-parse`, ever**. A run MUST NOT bootstrap on `unknown`. |
| **REQ-D2-12** *(new)* | **Fail-closed.** No error path may produce a PASS verdict or a cursor advance. Every loud path exits non-zero. No `|| true` on a loud path. |
| **REQ-D2-13** *(new)* | The revert loop MUST have a per-offender failure boundary; an offender that cannot be auto-reverted is a **named, loud, human-owned** outcome, never a silent drop. |
| **REQ-D2-14** *(new)* | **Adversarial-test contract** (§7, doctrine #900): every security-relevant requirement names the fixture a test must **construct**. Each resolution fixture (A1–A6, C1) MUST be shown to **redden against the prior plausible-but-wrong fix (the ancestry-only `eff4560` code), not merely against un-fixed code** — a test that stays green against the ancestry fix is not a proof. Adversarial fixtures are derived from the attack and authored by the finder or an independent third party, **never by the patch author**. **Plus the harness isolation contract** (§7.4), split **PR 4** (fix + proof, born isolated) / **PR 5** (generalized into a standing registry) — see §14 Plan Deviation. |
| **REQ-D2-15** *(new)* | The cursor MUST be advanced by an atomic compare-and-swap, **remote-only** (`push --force-with-lease`; NO local `update-ref`). It can never be created and never move backward. A `concurrency:` group is defence in depth, not the guarantee. |

### `tasks.md` — Slice-1 phases are withdrawn

Phases **1, 3, 4, 5** are invalidated (they encode the v1 mechanisms). Phase **2** (`parse-failures.mjs`)
survives verbatim. Phases **8–13** survive as **PR 5**. `tasks.md` must be regenerated against the 5-PR
chain in §9.2, with §7's fixture table driving the RED-first tasks. **The Review Workload Forecast's
"Chained PRs recommended: Yes / 2 slices" is superseded by "5 slices, stacked".**

---

## 11. Design decisions (ADR-style)

- **D-1 (cursor = custom git ref):** UNCHANGED and still right. *Rejected:* Actions cache (ephemeral +
  GitHub-only), committed marker file (postmerge-writes-to-main noise), release tag (the original bug).
- **D-2 (window is ALWAYS `cursor..HEAD`):** makes the audited interval and the advanced interval identical
  **by construction**, killing the skip-over as a class rather than as a case. Also deletes the
  `github.event.before` coupling. *Rejected:* keeping `before..head` on push and adding a guard "advance
  only when `before == cursor`" — it works, but it leaves two intervals in the design and therefore leaves
  the *possibility* of the bug in the next author's hands. Prefer the theorem to the check.
- **D-3 (resolution by TREE EFFECT ONLY — R-1 REPLACED):** the only signal in the system an attacker
  cannot author. The trailer and ancestry are **deleted as discriminators** entirely (§3.0) — a revert is
  a claim about the tree, and only the tree can prove it. The one non-tree path is the recorded human gate.
  Tree-effect does **not** cover forward-fix resolutions (§3.5): `adrPresence` forward-fix and
  `memoryPresence` are handled by the human gate / re-evaluation respectively, with tree-effect failing
  **closed** rather than faking a pass. See §3.1 for the full rejected-alternatives table (trailer+ancestry
  — reproduced bypass; inverted-diff — brittle, breaks liveness on real reverts; bot-author/signature —
  provenance is not proof, forge-coupled; `auto-revert/*` branch merge — forgeable, m3 fail).
- **D-4 (cursor tri-state, remote-authoritative):** `ls-remote --exit-code` gives git's own documented
  proof-of-absence (status 2), which is what separates *absent* from *unknown*. *Rejected:* local
  `rev-parse` (the v1 bug — cannot distinguish the two, and made the F2 test tautological).
- **D-5 (CAS advance, REMOTE-ONLY, in the CORE):** git's own `push --force-with-lease` alone gives
  never-create, never-rewind, and race-safety in one primitive — and a GitLab wrapper inherits all three
  for free. A local `update-ref` CAS was deliberately dropped, not merely omitted: it would fail on a plain
  checkout (which has no local governance ref at all) and specifically break the human `accept` path on
  exactly that shape. *Rejected:* a local `update-ref` CAS in addition to the remote lease (redundant, and
  breaks `accept` on a plain checkout); enforcing the invariant in YAML (v1 — contradicts this design's own
  layering rule and would be re-introduced verbatim by any port).
- **D-6 (status-returning git seam):** a throw-only boolean seam **structurally cannot** express
  `absent`/`unknown` or `differs`/`bad-rev`. It is the shape that produced every fail-open here.
  *Rejected:* try/catch → boolean (v1).
- **D-7 (fail-closed principle + normalize-unmapped-to-2 + terminal-state assertion):** an audit that
  cannot reach a verdict must be indistinguishable, from the outside, from an audit that failed.
  *Rejected:* per-site patching of the five fail-opens without a stated principle — the sixth one gets
  written next week.
- **D-8 (labels created in-step, no `|| true`, every loud path red):** an alert that depends on
  out-of-band provisioning is a fail-open waiting for a fresh clone. *Rejected:* a provisioning
  prerequisite; `|| true` anywhere on a loud path.
- **D-9 (reverter-skip via the same predicate):** one predicate, two uses; no new mechanism, no forgeable
  signal. *Rejected:* skipping merges whose branch is named `auto-revert/*` — anyone can name a branch,
  which would hand every check a free bypass.
- **D-10 (stacked PRs, 5 slices):** the only shape where every PR clears 400 counted lines with no
  `size:exception`. *Rejected:* feature-branch-chain (the tracker's integration PR would be ~700 lines →
  needs the forbidden exception); fix-forward on the current branch (3 lines of headroom).
- **D-11 (adversarial-test contract is normative — doctrine #900):** the review's central lesson — the
  last pass's tests encoded the fixer's threat model, so they went green against a fix that does nothing.
  Fixtures are specified as *shapes to construct*, derived from the attack, authored by the finder or a
  third party (never the patch author), and each MUST **redden against the ancestry-only fix** — passing
  against un-fixed code is not enough, because the ancestry fix was the plausible-but-wrong one that
  already shipped. *Rejected:* trusting "we'll write good tests" (that is exactly what was said last time),
  and accepting "fails on un-fixed code" as the coverage bar.

---

## 12. Risks and open items

- **R-1 — Window growth under a pinned cursor.** With the window always `cursor..HEAD`, an unresolved
  offender makes every subsequent run re-audit a growing range, and `brain-audit` makes one `prView` call
  per merge. Bounded by the fact that the job is RED the whole time and a human is being paged. *Optional
  hardening (cheap, recommend for PR 3):* a `maxWindowMerges` guard — exceeding it is **exit 2
  uncomputable + loud**, never a slow silent grind and never a truncated window.
- **R-2 — Legitimate reverts bundled with unrelated changes will not auto-resolve.** The predicate compares
  the offender's WHOLE first-parent contribution against the candidate's whole first-parent contribution
  (§3.2). A revert commit that also carries an unrelated edit has `normDiff(R,R^1) != normDiff(O^1,O)` → no
  exact inverse → fails **closed** → the human uses `accept --reason`. Same fail-closed direction covers a
  legitimate revert landing after an intervening edit within the U3 blast radius of an offender hunk (§7.1
  T11). Accepted: fragility on the safe side. Watch the rate. If `accept` becomes routine, the predicate is
  too strict and the *design* needs revisiting — do not weaken it in a patch.
- **R-3 — Dead code on `feature/v2.0.0` for two PRs.** Accepted (§9.2). Confirm no repo lint forbids an
  unimported module.
- **R-4 — `--force-with-lease` behavior on `refs/governance/*` must be verified against the real remote
  in PR 1**, not assumed. **There is no local fallback** (§2.3 — `advanceCursor` deliberately has no local
  `update-ref` CAS; the remote lease is the SOLE guarantee). PR 1's suite validates git's own lease
  compare-and-swap semantics against a local bare-repo "origin" (a two-clone cross-runner race: one clone
  advances and wins, the other's stale `from` is rejected by the push). What that does **not** prove is
  whether GitHub itself honors `--force-with-lease` rejection identically on a non-`refs/heads` namespace —
  if it silently diverges, there is no local CAS left to catch it, and the `concurrency:` group (workflow
  serialization, not a compare-and-swap) is the only remaining mitigation. This MUST be confirmed against
  the real GitHub remote, not assumed from the local-bare-repo test alone.
- **R-5 — 3 mis-authored commits** (`github-actions[bot]`) on the current branch, caused by the leaking
  test harness of D2's own discarded v1 work (§7.4). Resolved by the reset (§9.3): the reset branch's
  `release-postmerge-workflows.test.mjs` is the clean 145-line base (no poisoning `spawnSync`), so running
  the suite from this point is **safe immediately** — confirmed with file:line git evidence (owner Ruling 1,
  engram #902). D1/D2 harden PR 4's OWN new workflow-extracting tests at the moment they are authored; they
  are not a precondition for running the pre-existing suite.
- **R-6 — Pre-existing, out of scope:** `npm run brain:change:verify` fails on a dangling
  `brain/scripts/lib/chunk-reader.mjs` reference (deleted by issue-247/#257; a static gate-file list in
  `verify-change.mjs` still names it). Present on the base branch. Not D2's to fix — but it means "verify
  is green" is not currently an available gate signal.

---

## 13. Doc-zone discipline (pattern #216) — unchanged

The GitLab-porting constraint stays **DRAFTED** under `openspec/changes/issue-259-d2/brain-drafts/`. The
HUMAN co-promotes it into the canonical doc zone (ADR / `brain/core/…` / the PLAN) via a **separate** MR.

> **Any D2 commit that writes into ADR / `brain/core` / core methodology / `PLAN` is a STOP-finding.**

---

## 14. Plan Deviation Log

### 2026-07-14 — PR4/PR5 split for the harness-isolation guard (REQ-D2-14, fixtures D1/D2)

**What was wrong:** this document's own §9.2 chain table placed the ENTIRE harness-isolation guard —
both the fix/proof (fixtures D1, D2) and its generalization into a standing registry — inside **PR 4**'s
test list, while `spec.md`'s Gate table bound the same D1/D2 fixtures entirely to **PR 5**. The two
artifacts disagreed on where the guard formally lands. That is doc-drift: a reader of `spec.md` alone would
plan PR 4 without the isolation fix, and a reader of `design.md` alone would expect PR 5 to duplicate work
PR 4 already did — exactly the kind of silent disagreement the next reader inherits and has to untangle by
re-deriving intent from code.

**Reconciled split (owner-confirmed, matches the house detection→prevention ladder already used for the
both-fixtures exit-code drift-guard, §5.3/5.4):**

- **PR 4 — detect + prove.** The workflow-extracting tests this PR adds are born isolated (`cwd` outside the
  repo, `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM`/`GIT_CONFIG_NOSYSTEM`, isolated `HOME`, no inherited
  `GH_TOKEN`) from their first RED — never written un-isolated and patched later. Fixture D1 is a narrow
  drift-guard proving THIS PR's own test file complies; fixture D2 is the real-repository
  identity-unchanged regression proof.
- **PR 5 — generalize to prevention.** `tasks.md` Phase 5.4 promotes PR 4's narrow D1 guard into a
  **standing registry** (the same shape as Phase 5.3's `CHECKS` registry) that globs every `*.test.mjs`
  file, so a FUTURE author adding a new workflow-extracting test cannot silently regress the isolation
  contract. PR 5 does not re-fix or duplicate PR 4's isolation work — it only registers what PR 4 already
  proved and extends the check to files that do not exist yet.

**Why this split, not one PR doing both:** it mirrors the repo's own detection→prevention escalation
pattern (fix the instance first, generalize the guard second) and keeps each PR a single reviewable work
unit. It costs nothing in the 400-line budget either way: both fixture sets live in `.test.mjs` files,
already excluded from counted lines by `governance.ignoreList`, so the split is a pure clarity/reviewability
decision, not a line-shifting one — the Review Workload Forecast and the PR footprint table
(`tasks.md` § Review Workload Forecast, `design.md` §9.2) are unchanged by this deviation.

**Where corrected:** `design.md` §9.2 (PR 4 and PR 5 deliverable rows) and §10 (REQ-D2-14 mapping row);
`spec.md` Gate table (REQ-D2-14 column for PR 4 and PR 5) and the REQ-D2-14 requirement body; `tasks.md`
Phase 4.0 (rewritten to state the born-isolated acceptance criterion, replacing the earlier "introduce
test, then fix isolation later" framing) and Phase 5.4 (already matched this split — cross-referenced here
for findability).
