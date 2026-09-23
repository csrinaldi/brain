---
status: draft
issue: 480
epic: 313
---

# Proposal — the guard derives its requirement from the code, not from a spelling

## What was wrong

The guard #480 describes shipped in PR #476, which was **closed as a duplicate** of the
merged #470. The token fix reached `main`; the guard did not. That is why #479 measured it
as absent: it was never there to extend.

It was written as a property — *"any step whose `run:` reaches the API must declare
`GH_TOKEN`"* — and implemented as an allowlist of literal command spellings. #480 measured
**seven escapes**, and every one is the same mistake: a spelling outside the list read as
*"this step does not reach the API"*, so the checker's inability to recognise a command
became the gate's approval. That is `evidence-reader-empty-on-failure` one layer up.

Plus three defects in the same guard: a **factually wrong rationale** (it claimed Actions
does not inherit env into a step — it does), a pin on the **expression form** rather than
the credential (rejecting `${{ secrets.GITHUB_TOKEN }}`, the literal remediation text of
#467), and a **named pin broken by a style-only key reorder**.

## The design call the ticket asks to record

> Whether this should be a YAML-parsing check rather than regex over text is the design
> call to make and record.

**It is neither.** YAML parsing does not answer the question either:

```yaml
run: node brain/scripts/cursor.mjs        # only touches git
run: node brain/scripts/brain-audit.mjs   # reaches the port
```

Identical shape, opposite answers. A perfect YAML parser still has to guess.

So the requirement is **derived from the code the step invokes**. The YAML says which script
runs; the script's own import closure says whether it can reach a server. Spelling is used
only to *find* the entry point — and when it cannot be found, the guard says so loudly
instead of answering "nothing to report".

That inverts the polarity, which is the actual fix. **Undecidable is a violation**, the same
rule `filesOverlap` follows in `status/epic-graph.mjs`: an approximate checker that resolves
ambiguity toward "fine" grants exactly the permission it exists to withhold. The inert
command list is a safe-side list — absence from it costs a false alarm, never a miss.

## Measured against #480's own matrix

The guard shipped in #479 (PR #534) was written before this ticket and closed A1, A2, A3,
A8, A9 and A10. Driven against the full matrix it **escaped A4, A5, A6 and A7** — the
command-surface shapes. That measurement was taken first, and it is why this ticket exists
as more than a rename.

All ten now meet the bar: A1–A7 caught, A9 not flagged.

## One rule, one implementation

`lib/workflow-auth.mjs` is the rule; `release-postmerge-workflows.test.mjs` imports it
rather than restating it. A second copy is the defect #340 records — two implementations of
one rule disagree, and the one CI runs is not the one anybody reads.

## What is deliberately NOT covered, and why it is filed instead

An import closure is exact for a single-purpose script and coarse for a **multiplexer**.
`governance/run-check.mjs` dispatches `issue-link`, `diff-size`, `memory-gate`,
`decision-gate` and more; only `issue-link` calls `getVcs`, yet the closure is per FILE, so
the port appears for every subcommand.

Pointed at `governance.yml`, this guard therefore correctly flags four steps that really do
carry #479's coupling in the required PR gate — **and also flags `memory-gate` and
`decision-gate`, which reach nothing.** Shipping that would be false alarms on two required
jobs, and a guard that cries wolf is a guard someone switches off.

So the finding is filed as **#535** with its measurement, together with the per-subcommand
resolution needed to defend the fix. The alternative — fixing `governance.yml` here with no
guard able to hold it — is exactly how #467's fix went unguarded for a month.
