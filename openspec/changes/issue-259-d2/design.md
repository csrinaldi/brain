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
| **2** | The cursor lives at `refs/governance/audit-cursor` and is read with a local `git rev-parse` | `actions/checkout@v4` fetches `refs/heads/*` + tags **only**. Custom namespaces are never fetched, and no step fetches them. The ref is unreadable on every run. "Cursor absent on origin" and "cursor exists on origin but was not fetched" are **indistinguishable** — which is exactly what made the F2 test tautological. | **Explicit fetch + remote-authoritative tri-state** (§2). `ls-remote --exit-code` is the oracle that separates *absent* from *unknown*. |

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
invisible to tests. The core now returns a tri-state, and **the remote is the authority**:

```
syncCursor({ git })     → git fetch --prune origin '+refs/governance/*:refs/governance/*'
                          (the step the v1 design never had — checkout does NOT do this)

readCursor({ git })     → { state: 'present', sha }   ls-remote --exit-code = 0 AND local rev-parse resolves
                        → { state: 'absent'  }        ls-remote --exit-code = 2  (git's documented
                                                      "no matching refs" status — a POSITIVE proof of
                                                      absence on origin, not a failure to look)
                        → { state: 'unknown' }        ls-remote any other status (network/auth/permission),
                                                      OR ls-remote says present but the local ref does not
                                                      resolve after a successful fetch (an inconsistency —
                                                      never silently downgraded to 'absent')
```

| State | Meaning | Wrapper action |
|---|---|---|
| `present` | Origin has the cursor and we have it locally | Audit `cursor..HEAD` |
| `absent` | **Proved** absent on origin | Exit 2 · loud issue **with the init command** · never audit · never revert · never create |
| `unknown` | We could not determine the cursor's state | Exit 2 · loud issue **with NO init command** (bootstrapping on a guess is the original sin) · never audit · never revert |

`absent` and `unknown` are different issues with different bodies and different labels
(`governance:cursor-missing` vs `governance:cursor-unknown`). Conflating them is what let a
never-fetched ref masquerade as a never-initialized one for an entire release cycle.

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
   1. syncCursor()                                  ← fetch, always
   2. c = readCursor()
      absent  → { state: 'absent'  }                ← exit 2, loud, no audit
      unknown → { state: 'unknown' }                ← exit 2, loud, no audit
   3. verify c.sha is an ancestor of head           ← force-push / rewritten main / stale cursor
      not an ancestor → { state: 'unknown', reason: 'cursor is not an ancestor of HEAD' }
   4. → { state: 'present', base: c.sha, range: `${c.sha}..${head}`, head }
```

`eventName` and `github.event.before` are **gone**. Push and schedule run the identical code path. The
audited interval and the advance interval are now **the same interval by construction** — this is a
theorem about the design, not a check bolted onto it.

Steady-state cost is zero: on a healthy repo the previous push advanced the cursor, so `cursor == before`
and the window is exactly what it is today. A pinned cursor grows the window — which is correct: the job
is already RED and a human is already being paged. See R-4 for the bound.

### 2.3 Advance = atomic compare-and-swap, in the CORE

`advanceCursor` in v1 called a bare `git update-ref <ref> <new>`, which **creates the ref if absent**. The
"never auto-create" invariant was enforced in the YAML — so a GitLab wrapper would ship the bug verbatim.

```
advanceCursor({ git, from, to })
   guard:  `from` is REQUIRED and must be 40-hex   → throws otherwise
           (no `from` ⇒ no advance ⇒ the ref can never be created by this function)
   guard:  merge-base --is-ancestor <from> <to>     → the cursor only ever moves FORWARD
   local:  git update-ref refs/governance/audit-cursor <to> <from>
           ── git fails the update if the ref's current value ≠ <from>.
              An ABSENT ref has the null OID, which can never equal a 40-hex <from>.
              ⇒ "never auto-create" is now a property of git's own CAS, in the core.
   remote: git push --force-with-lease=refs/governance/audit-cursor:<from> \
                    origin <to>:refs/governance/audit-cursor
           ── the lease is a REMOTE CAS: the server verifies the old value.
              ⇒ two concurrent runs cannot both advance; the loser fails, loud.
              ⇒ the cursor can NEVER move backward, regardless of the forge's
                 fast-forward policy on non-refs/heads namespaces.
```

`from` is the exact cursor value read in step 2 of `resolveWindow`. One value, threaded through: **what we
audited from is what we advance from.** The CAS closes three findings at once — auto-create, the
backward-move race, and the skip-over's second half.

`concurrency: { group: governance-postmerge, cancel-in-progress: false }` is added to the workflow as
*defence in depth*. The CAS is the actual guarantee; the concurrency group merely stops two runs from
wasting effort racing on the same revert branch.

### 2.4 Human acceptance — the ONLY non-tree resolution path

**R-1 is REPLACED, not refined (owner ruling, supersedes #886).** The dual path survives in *shape* only:
there are exactly two ways an offender leaves the flagged set, and the trailer is not one of them.

```
1. AUTOMATIC — TREE EFFECT ONLY (§3). The offender's touched paths are byte-identical at HEAD to
               their pre-offender state, with the anti-vacuity guard. No message, no ancestry.
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
> **TREE EFFECT ONLY**: the offender's touched paths are byte-identical at HEAD to their pre-offender
> state, subject to the anti-vacuity guard (§3.2). The **only** other way an offender is resolved is the
> **human gate** (§2.4). There is no third path.

Removed from the design, permanently and entirely, as discriminators of resolution:

- **The commit trailer** (`This reverts commit <sha>.`) — a message is free text; an attacker writes it
  and reverts nothing. It is not a hint, not a pre-filter, not a tiebreaker. `brain-audit` reads **no
  commit body** for resolution.
- **Ancestry** (`merge-base --is-ancestor`) — on a linear `main`, **every** commit merged after the
  offender is trivially its descendant, so ancestry is satisfied by construction and proves nothing.

`isRevertedInRange`, `findTrailerCandidates`, and `trailerRegex` are **deleted** from `cursor.mjs`. Any
future reintroduction of a message- or ancestry-based resolution signal is a design regression, and the
adversarial fixtures in §7.1 (A1) exist to catch exactly that.

### 3.1 The options, and what each can and cannot prove

| Option | Proves | Does NOT prove | Runtime cost | Verdict |
|---|---|---|---|---|
| **Trailer + ancestry** (v1) | The candidate is a descendant of the offender — true of *every* commit on a linear main | Anything about the code. The trailer is free text an attacker writes. | 1 `git log` + N `merge-base` | **REJECTED — reproduced bypass** |
| **Inverted-diff comparison** — compare `diff M^1 M` against the candidate's diff, reversed | That the candidate's patch text is the exact inverse of the offender's patch text | Nothing, when intervening commits shift hunk offsets: `git revert` rebases the inverse patch onto the current context, so the *text* legitimately differs. **High false-negative rate on the real auto-revert path** → a legitimate revert would pin the cursor forever. Liveness break. | 2 `git diff` + normalize + compare | **REJECTED — brittle** |
| **Bot author / verified signature** | That a commit came from an identity | Nothing about the tree. Author is a free-text field; committer+signature needs key material in the runner (new infra, forge-specific). Provenance is not proof. | 1 `git log --format=%G?` + key setup | **REJECTED — provenance ≠ proof, and forge-coupled** |
| **Revert must be a merge of `auto-revert/<sha>`** | That the revert came through our own PR flow | Nothing about the tree, and it is **forgeable by naming a branch**. Also excludes a human's hand-rolled revert, and hard-couples resolution to the GitHub PR model → m3 fail. | 1 `git log --format=%s` | **REJECTED — forgeable + coupled** |
| **Tree effect** ✅ | **That the offender's payload is not on disk.** A pure property of the repository state — nothing to forge, no message to write, no identity to spoof. | *Who* undid it, or *why*. We do not care: the governance question is "is the bad change still here?", not "who removed it". | 2 `git diff --name-only` per offender | **CHOSEN** |

### 3.2 The predicate (`postmerge/resolution.mjs`)

```
changedPaths(rev, { git })        → set of paths from
                                    git diff --no-renames --name-only -z <rev>^1 <rev>
                                    (--no-renames so a rename yields BOTH names, never a
                                     half-tracked path; -z so a path with a newline cannot lie)

isResolvedAt(offender, tip, { git }) → boolean
   P = changedPaths(offender)
   if P is EMPTY  →  { resolved: false, reason: 'offender has no changed paths' }
                     ◄── EXPLICIT anti-vacuity guard. An empty path set makes every
                         set-theoretic test trivially true. This is the exact shape of
                         bug the last review was built to find; it is refused, loudly.
   D = paths differing between <offender>^1 and <tip>
       ( git diff --no-renames --name-only -z <offender>^1 <tip> )
   resolved  ⟺  P ∩ D = ∅
```

**In words:** the offender is resolved iff **every path the offender touched is, at the tip, byte-identical
to what it was immediately before the offender landed.** The payload is gone. That is the only fact that
matters, and it is the only fact that cannot be forged.

Anchor: `tip` is always `HEAD` — guaranteed by §2.2 (every window ends at HEAD).

**What this deliberately refuses** (all fail **closed** — the offender stays flagged, the cursor stays
pinned, the job stays red, and the human uses `accept --reason`):

| Situation | Outcome | Why refusing is right |
|---|---|---|
| A partial revert (some of the offender's paths restored, not all) | NOT resolved | Half the payload is still on disk. |
| A later legitimate commit touches one of the offender's paths for an unrelated reason | NOT resolved | We can no longer see the pre-offender state on that path. Refuse rather than guess. |
| The payload is reverted and then **re-introduced** by a later commit | NOT resolved | The predicate is anchored at the tip, so it sees the re-introduction. This is a *feature* the trailer approach could never have. |
| The offender is superseded by a proper re-land (same content, correct governance) | NOT resolved | Automatic resolution has no opinion on intent. `accept --reason` exists for exactly this. |
| The offender merge changed nothing (empty diff) | NOT resolved | Anti-vacuity guard. Never a free pass. |

### 3.3 The reverter-skip — closing the revert-of-revert loop

**Adjudicated: the loop is REAL, and it is narrow.** Auditing the auto-revert merge `R` itself:

| Check | Verdict on `R` | Why |
|---|---|---|
| `diffSize` | pass | The revert PR carries `size:exception` |
| `issueLink` | pass | The revert PR body carries `Part of #144` |
| `memoryPresence` | pass | Repo-level check, not per-merge |
| `adrPresence` | **FAIL — iff the offender's own violation was `adrPresence`** | `adr-presence.mjs:12-19` fails only on `hasAdr XOR hasHome`. Reverting a merge that added an ADR without `brain/HOME.md` removes exactly that ADR → `hasAdr XOR hasHome` again → the revert is flagged → an auto-revert of the auto-revert. |

Fix — **reuse the same predicate, no new mechanism**:

```
A failing merge R in the window is [SKIP] "revert of <M>" iff there exists a merge M in the
SAME window such that:
      isResolvedAt(M, R)   is TRUE    ← M's payload is absent at R
  AND isResolvedAt(M, R^1) is FALSE   ← M's payload was PRESENT at R's parent
                                        ⇒ R is demonstrably what removed it
```

Non-forgeable (a pure tree property). Evaluated **only for merges that already failed**, so the cost is
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
| **`diffSize`** (`diff-size.mjs`) | Line count of **M's own diff** `parent1..M` vs 400 | **Immutable** (M's diff) — except the `size:exception` **label**, fetched fresh via `prView` | **YES.** Revert restores the paths → `P∩D=∅` → tree-effect skip. Correct: M's own diff stays >budget forever, so the skip is the only settle-by-revert path. | Add `size:exception` label → `prView` re-fetch → check **PASSES on re-eval** (true `[PASS]`, mechanism **A**, no skip). Or genuinely shrink via a **new** merge (that new merge is audited on its own). | **automatic tree-effect** (revert) **or automatic re-eval** (label) **or human gate** |
| **`issueLink`** (`issue-link.mjs`) | Issue ref in the **PR body** (`prView`) with fallback to the **commit body** | PR body **mutable** via `prView`; commit-body fallback **immutable** | **YES** for the revert case (payload gone → tree-effect skip). | Edit the merged PR's description to add `Closes/Part of #N` → `prView` re-fetch → **PASSES on re-eval** (mechanism **A**). Commit body itself is immutable. | **automatic tree-effect** (revert) **or automatic re-eval** (PR-body edit) **or human gate** |
| **`adrPresence`** (`adr-presence.mjs`) | `hasAdr XOR hasHome` over **M's own changed files** | **Immutable** (M's diff) — there is **no** mutable input | **YES for revert ONLY.** Reverting M removes the ADR (or restores HOME) → `P∩D=∅` → skip; and the substance (an ungoverned ADR) is gone. | **THE OWNER'S CASE: tree-effect CANNOT prove it.** Adding the missing `brain/HOME.md` (or the missing ADR) is a **forward add** — M's touched path is still on disk at HEAD → `P∩D≠∅` → tree-effect returns **not-resolved (fails closed, correct)**. M's own diff re-flags `adrPresence` **forever**, so re-eval never clears it either. **The forward-fix resolution has NO automatic path.** | **automatic tree-effect** (revert) **or HUMAN GATE** (forward-fix). Never a false "resolved." |
| **`memoryPresence`** (`memory-presence.mjs`) | ≥1 `session_summary` in **HEAD** `.memory/` — **repo-global**, identical for every merge | **Mutable & global** (read at HEAD, not tied to M's paths) | **Irrelevant.** Tree-effect on M's paths cannot prove a repo-global property. It never fires *for this reason* (though a reverted M is skipped wholesale before this check runs — see note). | Add a `session_summary` at HEAD → **every** merge PASSES `memoryPresence` on the next run (mechanism **A**). The global gap is enforced through every un-reverted merge until it is filled. | **automatic re-eval** (add summary). **Never tree-effect, never a false "resolved."** |

Mechanisms referenced above:

- **A — automatic re-evaluation (true PASS):** the check reads a **mutable** input (HEAD working tree, or
  PR labels/body via `prView`). The forward-fix makes the check **pass** on the next run. M becomes a real
  `[PASS]` — it never touches the skip class, so there is no path to a false "resolved."
- **B — automatic tree-effect skip (settled-by-revert):** the check reads M's **immutable** contribution
  and M has been reverted. §3.2 proves it. This is the ONLY use of the tree-effect skip.
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

| ID | The test MUST construct | Must prove |
|---|---|---|
| **A1** | Offender `M` on `main` (adds a payload file). Then an **ordinary commit `X` on the same lineage** (a real descendant of `M`, i.e. **forked AFTER `M`** — the realistic linear-main shape) whose body contains `This reverts commit <M>.` and whose diff **does not touch any of M's paths**. | `M` is still `[FAIL]`ed. No `[SKIP] resolved by revert`. Exit 1. **This fixture MUST redden against the ancestry-only fix (`eff4560`), not merely against un-fixed code** — `X` IS a descendant of `M`, so `merge-base --is-ancestor` PASSES and the v1 code wrongly skips `M`. Proving RED here is what proves the ancestry approach is defeated; the v1 tests never built this shape (they forked *before* `M`, the one case ancestry handles). |
| **A2** | Offender `M`, then a **real `git revert -m 1 M`** merged onto `main`. | `[SKIP] … resolved by revert`, exit 0. (Liveness — the mechanism must not pin on a genuine revert.) |
| **A3** | `M` touches paths `P1` and `P2`. A revert restores **only `P1`**. | `M` is still `[FAIL]`ed. Partial reverts do not resolve. |
| **A4** | `M` is a merge with an **empty diff** (zero changed paths). | Automatic resolution does **NOT** fire. Never a vacuous pass. |
| **A5** | `M` reverted by `R`; then a **later commit re-adds the payload** to the same path. | `M` is **NOT** `[SKIP]`ped at that tip. The predicate is anchored at the tip and sees the re-introduction. |
| **A6** | An `adrPresence` offender `M` and its auto-revert `R` in the same window. | `R` is `[SKIP] revert of M`. No revert-of-revert. And a merge that merely *claims* to be a revert (no tree effect) is **not** skipped. |

### 7.2 The cursor (§2)

| ID | The test MUST construct | Must prove |
|---|---|---|
| **B1** | A **bare "origin" repo with the cursor ref set on it**, cloned by a plain `git clone` (which, exactly like `actions/checkout`, fetches `refs/heads/*` + tags only). **First assert the local `rev-parse` FAILS** — proving the fixture reproduces the production shape. | `readCursor()` then returns `{ state: 'present' }`, because it **fetched**. This is the test the tautological F2 test could not be: it distinguishes "correctly gated" from "the ref was never fetched, so the gate always trips". |
| **B2** | A bare origin with **no** cursor ref. | `{ state: 'absent' }` → exit 2 → loud issue **with** the init command. |
| **B3** | An origin URL pointing at a **nonexistent path** (unreachable). | `{ state: 'unknown' }` → exit 2 → loud issue **without** init instructions. **MUST NOT** be reported as `absent`. |
| **B4** | A repo with **no** cursor ref; call `advanceCursor` with a 40-hex `from`. | It **throws**, and the ref **does not exist** afterwards. Asserted in the **CORE**, not against the YAML. |
| **B5** | Two `advanceCursor` calls with the **same `from`**, the second after the first succeeded. | The second **fails** (CAS mismatch). The cursor cannot move backward or be double-advanced. |
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
| `cursor.mjs` | 1 | `syncCursor`, `readCursor` (tri-state), `resolveWindow` (always `cursor..HEAD`), `advanceCursor` (CAS), `acceptManually`, `window`/`accept` CLI | **REWRITTEN** — `isRevertedInRange`, `findTrailerCandidates`, `trailerRegex` **DELETED** |
| `resolution.mjs` | 2 | `changedPaths`, `isResolvedAt`, `isReverterOf` | **NEW** (§3) |
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
        └── PR 2  revert resolution (tree effect)                          ~85
             └── PR 3  brain-audit: emission + skip classes + exit-2      ~100
                  └── PR 4  the workflow wrapper (the only GitHub-coupled) ~235
                       └── PR 5  0/1/2 contract across all evaluators      ~105
```

| PR | Deliverable (one work unit) | Counted lines | Coherent end state |
|---|---|---|---|
| **1** | `git-seam.mjs` + `cursor.mjs`. Remote-authoritative tri-state, always-`cursor..HEAD` window, CAS advance that cannot create or rewind the ref. Tests **B1–B6**. | **~155** | Core is tested and **unused**. The pre-D2 workflow is untouched and behaves exactly as it does today. |
| **2** | `resolution.mjs`. Tree-effect proof. Tests **A1–A6**. | **~85** | Still unused. **This is the security-critical PR** — deliberately kept tiny so it can earn a hostile review that answers exactly one question: *can this be forged?* |
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
| **REQ-D2-11** *(new)* | `refs/governance/*` MUST be **explicitly fetched**. A run MUST distinguish "absent on origin" from "not fetched locally", and MUST NOT bootstrap on `unknown`. |
| **REQ-D2-12** *(new)* | **Fail-closed.** No error path may produce a PASS verdict or a cursor advance. Every loud path exits non-zero. No `|| true` on a loud path. |
| **REQ-D2-13** *(new)* | The revert loop MUST have a per-offender failure boundary; an offender that cannot be auto-reverted is a **named, loud, human-owned** outcome, never a silent drop. |
| **REQ-D2-14** *(new)* | **Adversarial-test contract** (§7, doctrine #900): every security-relevant requirement names the fixture a test must **construct**. Each resolution fixture (A1–A6, C1) MUST be shown to **redden against the prior plausible-but-wrong fix (the ancestry-only `eff4560` code), not merely against un-fixed code** — a test that stays green against the ancestry fix is not a proof. Adversarial fixtures are derived from the attack and authored by the finder or an independent third party, **never by the patch author**. **Plus the harness isolation contract** (§7.4), split **PR 4** (fix + proof, born isolated) / **PR 5** (generalized into a standing registry) — see §14 Plan Deviation. |
| **REQ-D2-15** *(new)* | The cursor MUST be advanced by an atomic compare-and-swap (local `update-ref <new> <old>` + remote `--force-with-lease`). It can never be created and never move backward. A `concurrency:` group is defence in depth, not the guarantee. |

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
- **D-5 (CAS advance, in the CORE):** git's own `update-ref <new> <old>` plus `--force-with-lease` gives
  never-create, never-rewind, and race-safety in one primitive — and a GitLab wrapper inherits all three
  for free. *Rejected:* enforcing the invariant in YAML (v1 — contradicts this design's own layering rule
  and would be re-introduced verbatim by any port).
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
- **R-2 — Legitimate reverts that touch shared paths will not auto-resolve.** By design (§3.2): the
  predicate fails **closed** and the human uses `accept --reason`. Watch the rate. If `accept` becomes
  routine, the predicate is too strict and the *design* needs revisiting — do not weaken it in a patch.
- **R-3 — Dead code on `feature/v2.0.0` for two PRs.** Accepted (§9.2). Confirm no repo lint forbids an
  unimported module.
- **R-4 — `--force-with-lease` behavior on `refs/governance/*` must be verified against the real remote
  in PR 1**, not assumed. If the forge rejects the lease form on a non-`refs/heads` namespace, the local
  `update-ref` CAS still holds and the race falls back to the `concurrency:` group — but that MUST be
  discovered by a test, not in production.
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
