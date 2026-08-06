# Design — terminal states of the post-merge audit (#466 + #474)

**Status**: proposed · **Issues**: #466, #474 · **Base**: `main` @ `e812d04`

These two are one change. #474 asks "what does the run do when a merge cannot be
evaluated?"; #466 asks "what does the run do when a merge failed but cannot be
remediated?". Both are questions about *terminal states with no handler*, both
route to the same alarm mechanism, and answering either one alone produces a fix
that contradicts the other. The policy is decided here, before any code.

---

## 1. The terminal states `brain-audit` can actually reach

Enumerated from `brain/scripts/brain-audit.mjs` at `e812d04`, not from the docs.
There are exactly five, reached from four `process.exit` sites plus
`crossCheckExit`.

| # | State | Where | Exit | Stdout | Workflow today | Should be |
|---|-------|-------|------|--------|----------------|-----------|
| T1 | Range uncomputable — `listMerges` threw | `brain-audit.mjs:213-215` | 2 | `[FAIL] governance:audit-uncomputable — could not compute merge range …` | `uncomputable` step files the alarm, exits 2 | unchanged |
| T2 | Window genuinely empty | `:216-219` | 0 | `[INFO] No merge commits found in range: …` | `advance` step moves the cursor | unchanged |
| T3 | Clean — every merge PASS or legitimately SKIP | `crossCheckExit(0,0,0)` | 0 | `[PASS]`/`[SKIP]` lines | `advance` step moves the cursor | unchanged |
| T4 | Failures exist, **≥1 auto-revert-nominable** | `crossCheckExit(n>0, m>0, k>0)` | 1 | `[FAIL]` + ≥1 `[FAIL-SHA]` | `revert` step reverts the parsed offenders, cursor stays pinned | unchanged |
| **T5** | **Failures exist, ZERO auto-revert-nominable** | `crossCheckExit(n>0, 0, 0)` | **1** | `[FAIL]`, **no `[FAIL-SHA]`** | **`revert` step calls it "incoherent" and exits 2. The alarm step is gated `steps.audit.outputs.code == '2'` and the audit code is `1`, so it never runs. Red, nothing reverted, no alarm, cursor frozen.** | **halt: file an alarm, pin the cursor, exit non-zero (§3)** |
| T6 | Mid-emission coherence break (`nominable XOR emitted`) | `crossCheckExit`, `:102` | 2 | `[FAIL] governance:audit-uncomputable — tree-keyed⟺[FAIL-SHA] coherence violated …` | `uncomputable` step files the alarm | unchanged |
| T7 | Any throw below the top level | `:329-335` | 2 | `[FAIL] governance:audit-uncomputable — <msg>` | `uncomputable` step files the alarm | unchanged |

T5 has two disjoint producers, and both are documented, correct audit states:

- **T5a** — every surviving failure is `issueLink` or `memoryPresence`. Those
  classes are not tree-keyed, so they never emit `[FAIL-SHA]` at all
  (`TREE_KEYED_CHECKS`, `merge-walk.mjs:49`). Pinned by two existing tests
  (`brain-audit.test.mjs:621`, `:638`).
- **T5b** — a tree-keyed failure survives but §15.5 resurrection-suppression
  denies it nomination, because reverting it would put back a payload absent at
  HEAD (`nominable = survivesTreeKeyed && !revertResurrectsAt(...)`,
  `merge-walk.mjs:376`). This is the A11/A12 cleanup shape.

**The root cause is a contract the workflow does not believe.**
`brain-audit.mjs:70-72` states its own contract explicitly:

> exit 1 ⟺ failCount ≥ 1 (any class). A `[FAIL-SHA]` count of 0 on exit 1 is
> **LEGITIMATE** (all violations are issueLink/memoryPresence — non-auto-revertible).

`governance-postmerge.yml:198-201` encodes the *superseded* invariant — the
pre-§15.5 "any violation ⟹ ≥1 `[FAIL-SHA]`" coherence guard that
`crossCheckExit`'s docblock says was **replaced**, not retained:

```yaml
if [ "${#offenders[@]}" -eq 0 ]; then
  echo "code was 1 but the tested parser yielded no [FAIL-SHA] offenders — incoherent, failing closed."
  exit 2
```

So this is not a missing branch. It is a stale invariant that survived the §15.5
rewrite in a file the rewrite did not touch. The word "incoherent" is factually
wrong.

### Why the failure is *silent* and not merely wrong

Three gates have to line up, and they do:

1. `revert` runs (`if: steps.audit.outputs.code == '1'`) and exits 2 — but a
   **step's** exit code is not the **audit step's output**.
2. `uncomputable` is gated on `steps.audit.outputs.code == '2'`. That output was
   written by the `audit` step and is `1`. The alarm does not run.
3. `terminal` runs `if: always()`, reads `code` = `1`, matches `0|1|2`, prints
   `terminal audit code: 1` and exits **0**.

The job is red only because `revert` failed, and nothing anywhere files an issue.
Observed live on 2026-08-06, run `31094912872` over `c724942`.

---

## 2. Where #474 loses the signal

`lib/merge-walk.mjs:237-239`:

```js
} catch {
  // VCS call failed — proceed without PR metadata (audit normally)
}
```

`prLabels`/`prBody` stay `null`, which is the *correct* value
(REQ-CIC-2 — `null` means uncomputable, `[]`/`''` mean genuinely empty), and
`brain-audit.mjs` even carries a source-scan guard forbidding anyone from
re-fabricating `[]`/`''` over them (`brain-audit.test.mjs:507`).

The discipline is half-built. The nulls survive to the pure helpers — and then
`selectIssueLinkBody(null, commitBody)` falls back to the auto-generated merge
commit body, where `Closes #N` never lives, and `issueLink` renders a **confident
FAIL**. "I have no evidence" and "the evidence says no" become the same verdict
one layer below where anyone is looking. That is
`brain/core/anti-patterns/evidence-reader-empty-on-failure.md` exactly, in the
authentication layer, and it is what made #467 report a governance verdict
instead of an outage.

Note the compounding: an unauthenticated run turns **every** PR-shaped merge into
an `issueLink` FAIL, which is T5a, which is the #466 deadlock. #467's token fix
removed the cause that fired this week; the two defects remain wired in series.

---

## 3. Policy call — #466 (failure with nothing revertible)

### Constraining authorities

- **ADR-0015**, rung 3: *"bad state does not persist"*.
- **ADR-0015**, Never-do: *"a REQUIRED gate must never exit 0 without
  evaluating"*. `issue-link` and `diff-size` are in `REQUIRED_JOBS`.
- **ADR-0015**, REQ-HONESTY-1/-2: gates never render the weakest state as
  passing/neutral, and never lie about which rung is active.
- **REQ-D2-10a / design §15.6a** — the designed remediation for a
  non-auto-revertible failure already exists and is a **human keystroke**:
  `cursor.mjs accept <sha> --reason "<why the ungoverned ADR is accepted>"`.
  `brain-audit.mjs:296-300` prints it on the `[FAIL]` line itself.
- **REQ-D2-6 / design §15.5** — the published 0/1/2 exit contract.
- **#466's stated invariant** — no terminal state may be both red and silent.

### Elimination

**Option B — accept-with-notice (advance the cursor, file an issue naming the
unrevertible failure). EXCLUDED**, by two independent authorities:

- *REQ-D2-10a / §15.6a.* The repo has already decided what "accept an
  unrevertible failure" means: a human runs `cursor.mjs accept` and **writes a
  reason**. An automatic advance performs that human gate with no reason and no
  human. Adding a machine path around a gate the design deliberately made manual
  is new doctrine, not an implementation choice.
- *ADR-0015 rung 3.* Advancing the cursor past a merge that **failed** the audit
  moves it permanently behind the cursor: the window is `cursor..HEAD`, so that
  merge is never re-audited. "Bad state does not persist" becomes "bad state
  persists, with a note".

**Option A — halt (file an alarm, pin the cursor, exit non-zero, wait for a
human). SURVIVES.** It is the same disposition the design already gives every
other state it cannot auto-remediate (T1, T6, T7), and it is what makes the
`cursor.mjs accept` path reachable — the human is told there is something to
accept.

Exactly one option survives → this is a ruling, not an escalation
(`reviewer-protocol.md` §5.3).

**Decision: HALT.** T5 files a `governance:audit-unrevertible` alarm naming the
merges and the surviving check classes, does not revert, does not advance, and
fails the job.

### The third sub-question — does `brain-audit` need a distinct exit code?

**No.** Reasons, in order of weight:

1. **It does not restore the invariant.** "No terminal state may be both red and
   silent" is a property of the *workflow*, not of the script. A fourth code
   makes one more state enumerable; the next unenumerated state breaks the
   invariant again. Enumeration is precisely what failed here — the alarm was
   gated on a three-value enumeration and a state inside `1` was missed. The fix
   must be structural (§5), and once it is, the extra code buys nothing.
2. **The fact is already available at the point of decision.** The `revert` step
   is *required* to run `parse-failures.mjs` anyway (REQ-D2-5, the ONE tested
   parser). An empty offender list from the tested parser on exit 1 **is** T5,
   established by the sanctioned mechanism rather than by pattern-matching
   stdout.
3. **It changes a published contract for five consumers at no gain** — REQ-D2-6,
   `governance/postmerge/exit-codes.mjs` (the ONE source: a fourth code means
   editing `EXIT` and `resultToExit`, which every evaluator maps through),
   `exit-code-contract-drift-guard.test.mjs` (asserts every evaluator reaches
   both 1 and 2), `release.yml`'s rung-2 gate, and the local
   `npm run brain:audit` CLI. Note also that `governance-postmerge.yml:152-156`
   normalizes any code outside `{0,1,2}` to `2` — so an unmigrated consumer would
   silently relabel this state as "uncomputable", which is a lie: T5 is perfectly
   computed. Honesty (REQ-HONESTY) argues against the code, not for it.
4. **After §4, exit 2 already carries every "cannot compute" state**, leaving
   exit 1 as purely "computed violations exist". The remaining distinction
   (revertible vs not) is a property of the *output*, which the parser reads.

The exit contract therefore stays **0/1/2, unchanged in shape**.

---

## 4. Policy call — #474 (a merge that cannot be evaluated)

### The fork

One PR in the window is unfetchable. Does it poison the whole window to exit 2,
or is uncomputability per-merge so the window advances past the merges that *were*
evaluable?

### Elimination

**Option P — per-merge: skip the unfetchable merge with a loud record, evaluate
the rest, advance the cursor to HEAD. EXCLUDED**, by three independent
authorities:

- *ADR-0015 Never-do* — the window would exit **0** while a member merge was
  never evaluated. `issue-link`/`diff-size` are REQUIRED_JOBS; this is the
  literal text of "a REQUIRED gate must never exit 0 without evaluating".
- *`evidence-reader-empty-on-failure.md`* — *"Consumers apply their class policy
  on `null` — **REQUIRED gates fail closed**"*. Not "warn and continue"; that
  disposition is reserved there for DETECTION gates.
- *ADR-0015 rung 3* — the cursor advancing past an unevaluated merge means it is
  never re-audited. Unevaluated becomes permanently accepted.

And decisively, from the module that *is* the exit contract —
`brain/scripts/governance/postmerge/exit-codes.mjs`, "the ONE source of the
governance exit contract (REQ-D2-6)":

> **`uncomputable` DOMINATES**: an infra-failed result is 2 regardless of any
> pass/false also present — an uncomputable check must never read as clean or as
> a mere violation.

Dominance *is* window-poisoning, already written down as the contract. Option P
does not merely lack support; it contradicts the single source of the exit
contract it would have to route through.

**Option W — window-level fail-closed: exit 2, alarm, no revert, no advance.
SURVIVES.**

### The "new permanent-halt class" objection, and why it does not survive contact

#474 and #476 both raise it: a transient 502 or a rate limit becomes a governance
outage needing a human. Checked against the workflow rather than assumed:

- `governance-postmerge.yml:22-26` runs on **every push to main** *and* on a
  **daily cron** (`0 6 * * *`).
- The window is recomputed from the cursor each run (`cursor..HEAD`), so a pinned
  cursor is re-audited on the next push and at worst within 24 hours.
- The alarm path already dedupes: `gh issue list --label … --state open` then
  `gh issue comment` instead of `gh issue create` (`:296-302`). A halt that
  persists for three runs is one issue with three comments, not three issues.

So this is not a permanent halt — it is a **halt-until-retry, and the retry is
already wired**. It self-heals with no human for exactly the transient cases the
objection is about. What remains genuinely permanent — a PR deleted from a fork,
a revoked token, a permissions change — is precisely the case that *should* reach
a human. The objection is real but bounded to the cases where halting is correct.

Note also what "halt" costs: the cursor does not advance and an issue is filed.
Nothing blocks developers, no merge is prevented, no release is affected beyond
rung 2's existing behaviour. It is a cheap halt.

Exactly one option survives → ruling, not escalation.

**Decision: WINDOW-LEVEL FAIL-CLOSED.** A merge whose PR metadata fetch *failed*
is not evaluated at all — evaluating it is what manufactures the false verdict —
is reported on its own line as uncomputable, and drives the run to exit 2.

### The two states #474 asks about explicitly

Both are "no evidence", for different reasons, and they are **not** the same as a
failed fetch:

| Condition | Meaning | Disposition | Why |
|---|---|---|---|
| `prMetaError !== null` | the fetch was attempted and **failed** | **uncomputable → exit 2** | the evaluator could not reach its evidence; this is the #467 class |
| `prNum === null` | the merge subject references no PR | **evaluate normally** | there is no PR to fetch. Absence of a PR is real evidence, not missing evidence — a squash/direct merge legitimately carries its issue link in the commit body |
| `vcs === null` | no VCS adapter configured | **evaluate normally, warn once** | a deliberate configuration, not an outage. It is *uniform* (every merge, every run) rather than selective, so it is visible rather than silent — unlike a per-PR fetch failure. Making it exit 2 would break every consumer repo that runs `brain:audit` without a VCS adapter |

The `vcs === null` line is a judgement call and is recorded as a **named
residual**, not an oversight: an operator who deletes their VCS config silently
degrades `issueLink` to commit-body evidence. It is mitigated to "loud" by a
one-time `[WARN]` naming it, and left otherwise unchanged because closing it is a
consumer-facing behaviour change outside #474's acceptance. Flagged for the
maintainer.

---

## 5. Do the two answers agree?

Yes, and they have to — the brief is right that if they disagreed one of them
would be wrong.

- #466: a failure the machine **cannot safely remediate** → freeze and tell a
  human.
- #474: a merge the machine **cannot safely evaluate** → freeze and tell a human.

Same disposition, same mechanism, different label so the gate stays honest about
which state it is in (REQ-HONESTY). They differ only in exit code, and that
difference is a statement of fact, not of policy: exit 2 means *"I could not
compute"* (true for #474, false for #466 — T5 is perfectly computed), exit 1
means *"I computed violations"*. Filing #466's halt under
`governance:audit-uncomputable` would be a gate lying about its own state.

They also compose in the right order. #474 removes the mass-producer of T5a (an
unauthenticated run turning every merge into an `issueLink` FAIL), which makes T5
rare. #466 makes the alarm path reachable, which is what makes #474's exit 2 safe
to emit at all. Neither is sufficient alone.

---

## 6. The structural fix — why a named handler is not enough

Adding a T5 branch fixes the state we know about. It leaves the invariant
enumeration-dependent, which is the defect, not the symptom. So the change has
two layers:

- **L1 — named handler.** The `revert` step's zero-offender branch stops calling
  a documented state "incoherent" and files a `governance:audit-unrevertible`
  alarm naming the merges and their surviving check classes.
- **L2 — backstop.** Every alarm path records that it fired. The `terminal` step
  (`if: always()`) fails the job **and files a generic alarm** if the job is red
  and no alarm was recorded. This holds for states nobody has enumerated yet,
  including ones added after this change.

L2 is the load-bearing half. L1 exists so the operator gets a useful message
rather than a generic one.

---

## 7. Blast radius

| Consumer | Touched by | What changes | Breaks? |
|---|---|---|---|
| `brain-audit.mjs` exit contract (REQ-D2-6, §15.5) | §4 | shape unchanged (0/1/2). Exit **2** gains a producer: ≥1 merge with an unreachable PR fetch. Exit 1 narrows to "computed violations only" | No. `crossCheckExit`'s signature and the NOMINABLE⟺`[FAIL-SHA]` invariant are untouched — the new state is decided **before** `crossCheckExit`, not inside it |
| `lib/merge-walk.mjs#fetchPrMeta` | §4 | returns a 4th field `prMetaError` | No. Additive; existing destructuring of `{ prLabels, prBody }` keeps working |
| `brain-metrics.mjs` (shares the walk) | §4 | must route `prMetaError` into its **existing** `kind: 'uncomputable'` bucket (`brain-metrics.mjs:384/:471`) and must **not** change its exit code | No — but it is a silent divergence if missed: metrics would report a governance verdict for a merge audit refused to evaluate, the exact measurement/enforcement drift the shared-lib extraction exists to prevent (design D1) |
| `.github/workflows/governance-postmerge.yml` | §3, §6 | `revert` step's zero-offender branch; `terminal` step gains the backstop; alarm steps record that they fired | No. **See §8 — interacts with #480** |
| `.github/workflows/release.yml` rung-2 gate | §4 | runs `brain-audit` **unauthenticated** (#475), so today it is exit 1 for the wrong reason; after this it is exit **2** with an honest `[UNCOMPUTABLE]` message | No. The step is bare `node …` under Actions' default `bash -e`, so both 1 and 2 fail the step. It was blocking and stays blocking. The **diagnosis** improves: #475's symptom stops presenting as a governance verdict |
| Local `npm run brain:audit` | §4 | on a machine with no `gh` auth: exit **1 → 2**, with `[UNCOMPUTABLE]` lines instead of false `issueLink` FAILs | **CLI contract change, intended.** It stops lying. Mitigated by an actionable message naming `gh auth login` |
| `governance/postmerge/exit-codes.mjs` (the ONE source) | — | **unchanged** — this is a direct consequence of ruling against a fourth exit code | No |
| `review/evaluators/checkpoint.mjs:267` (`defaultRunAudit`) | §4 | swallows the exit code and folds `brain-audit`'s **stdout** into an `editorial` review finding. It will now surface `[UNCOMPUTABLE]` lines instead of false `issueLink` FAILs | No — strictly more honest evidence in the review package. Named because it is a 4th consumer that a search for exit-code handling does not find |
| `parse-failures.mjs` (REQ-D2-5) | — | unchanged | No |
| `AGENTS.md:568-574` | §4 | already states *"`brain-audit` is fail-closed and exits 2 on an uncomputable merge"* | No — this change makes the existing sentence **more** true; no doc edit needed |
| `crossCheckExit` unit tests, `exit-code-contract-drift-guard.test.mjs`, workflow drift guards | §3, §4 | extended. Both exit 1 and exit 2 stay reachable for `brain-audit`, so the drift guard's both-fixtures requirement (REQ-D2-7) still holds | No |

---

## 8. Interaction with #480 — flagged, not silently absorbed

#480 is rewriting `release-postmerge-workflows.test.mjs`'s API-token drift guard,
which parses `governance-postmerge.yml`'s step structure with regexes. This change
**alters that step structure**: the `terminal` step's body grows and the alarm
steps gain `GITHUB_OUTPUT` writes.

Two concrete interactions, raised rather than adapted to:

1. #480's documented defeat **A3** is "a step whose FIRST key is `run:` is not
   recognised as a step boundary". Every step this change touches or adds keeps
   `- id:` as its first key, so the *current* guard still parses the file. This is
   a deliberate accommodation of a guard #480 has already proven broken — it is
   not an endorsement of the regex.
2. If #480 lands first, its new guard must be re-run against this file. If this
   lands first, #480's acceptance suite gains a step shape it has not seen. Either
   order is fine; **both changing the same regexes simultaneously is not.**

The alarm steps in this change reach the API (`gh issue create`/`comment`/`label
create`) and therefore declare their own `env: GH_TOKEN`, satisfying both the
current guard and #480's stated property.

---

## 9. The invariant, in one testable line

> **No terminal state of the post-merge audit may be both red and silent: if the
> job fails, an alarm issue was filed.**

Testable as a property over the workflow, not over an enumeration of codes — which
is why L2 in §6 is the half that actually restores it.
