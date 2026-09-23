# Spec — delta requirements (#466 + #474)

Delta over `openspec/changes/issue-259-d2/spec.md` (REQ-D2-*). The 0/1/2 exit
contract of REQ-D2-6 is **narrowed, not widened**: no new code, one new producer
of exit 2.

---

## REQ-TS-1: An unreachable PR fetch is uncomputable, never a verdict

`fetchPrMeta` MUST return a fourth field `prMetaError` carrying the failure
reason when the `prView` call throws, and `null` when it does not. It MUST NOT
throw (its existing never-crash contract is preserved).

A merge with `prMetaError !== null` MUST NOT be evaluated by `evaluateMerge`:
rendering a verdict from evidence the evaluator could not read is the defect.

### Scenarios

- **A failed PR fetch does not produce a governance verdict.** Given a merge whose
  `prView` call fails, when `brain-audit` runs, then no `[FAIL]` line naming
  `issueLink` is emitted for that merge, and an `[UNCOMPUTABLE]` line naming the
  merge and the fetch failure is emitted instead.
- **The signal is not fabricated.** `prMetaError` is `null` on every successful
  fetch, and on every path that never attempted one.

---

## REQ-TS-2: Uncomputable dominates the window (fail-closed)

When ≥1 merge in the audited window is uncomputable per REQ-TS-1, `brain-audit`
MUST exit **2**, regardless of the pass/fail verdicts of the other merges. It MUST
NOT exit 0 (never-evaluated read as clean) and MUST NOT exit 1 (never-evaluated
read as a violation).

This is `governance/postmerge/exit-codes.mjs`'s "`uncomputable` DOMINATES" rule
applied at window scope.

### Scenarios

- **One unfetchable merge among passing merges → exit 2.** Given a window of three
  merges where two pass and one is uncomputable, then the run exits 2 and does not
  exit 0.
- **The cursor does not advance.** Given exit 2, the workflow's `advance` step
  (`if: … == '0'`) does not run, so no unevaluated merge is moved behind the cursor.

---

## REQ-TS-3: Two "no evidence" states that are NOT uncomputable

`prNum === null` (the merge subject references no PR) and `vcs === null` (no VCS
adapter configured) MUST NOT be treated as uncomputable. Both are evaluated
normally from commit-body evidence.

`vcs === null` MUST emit exactly one `[WARN]` for the run naming the degradation,
so a silently unconfigured adapter is loud rather than invisible.

### Scenarios

- **A squash/direct merge with no PR reference still audits.** Exit code is
  unchanged from today's behavior.
- **An unconfigured adapter warns once, not per merge.**

---

## REQ-TS-4: "Failed, nothing revertible" is a handled halt, never silence

When the audit exits 1 and the tested parser (`parse-failures.mjs`, REQ-D2-5)
yields zero offenders, the workflow MUST:

1. **NOT** describe the state as incoherent — it is documented and legitimate
   (§15.5, `brain-audit.mjs:70-72`).
2. File a `governance:audit-unrevertible` alarm naming the failing merges.
3. **NOT** revert and **NOT** advance the cursor.
4. Fail the job.

### Scenarios

- **An `issueLink`-only failure files an alarm.** Given `AUDIT_STDOUT` containing
  `[FAIL]` lines and no `[FAIL-SHA]` line, when the shipped `revert` step runs,
  then `gh issue create` (or `gh issue comment`) is invoked with the
  `governance:audit-unrevertible` label, and the step exits non-zero.
- **The alarm is deduped.** A second run comments on the open issue rather than
  opening a second one.

---

## REQ-TS-5: No terminal state may be both red and silent (the invariant)

Every workflow path that files an alarm MUST record that it did so in
`$GITHUB_OUTPUT`. The `if: always()` terminal step MUST file a backstop alarm and
fail the job whenever the job is failing and no alarm was recorded.

This requirement is deliberately stated over the **job outcome**, not over an
enumeration of exit codes: an enumeration is what failed in #466.

### Scenarios

- **A red job with no recorded alarm files a backstop alarm.** Given the terminal
  step runs with a failing job status and no `alarm=` in the step outputs, then
  `gh issue create` is invoked and the step exits non-zero.
- **A red job that already alarmed does not double-file.** Given `alarm=…` was
  recorded, the terminal step files nothing new.
- **A green job files nothing.**

---

## REQ-TS-6: The exit contract keeps both codes reachable

`brain-audit` MUST still be able to reach exit 1 and exit 2 from distinct causes,
so `exit-code-contract-drift-guard.test.mjs`'s both-fixtures requirement
(REQ-D2-7) continues to hold. `crossCheckExit`'s signature and the
NOMINABLE⟺`[FAIL-SHA]` invariant are unchanged — REQ-TS-2 is decided **before**
`crossCheckExit`, never inside it.
