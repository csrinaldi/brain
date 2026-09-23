# Exploration: issue-1086-audit-pr-resolution

## Current State (measured 2026-09-20 by the orchestrator, not inferred)

The `release` workflow run 35481391558 for `v1.6.0` failed its audit gate with four
`[UNCOMPUTABLE]` merges, all carrying `(#978)`:

- `d4cb7f8 feat(setup): add conditional Codex readiness and routing (#978)`
- `789f6c2`, `c6ab10c`, `4d47e2f` — the three Codex archive commits

Measured facts:

- `gh pr view 978` → `Could not resolve to a PullRequest with the number of 978`.
- `gh issue view 978` → issue 978, CLOSED. The trailing `(#N)` is the ISSUE.
- `gh api repos/csrinaldi/brain/commits/d4cb7f8/pulls` → `991`, the real PR.

Code path:

- `parsePrNumber` (`brain/scripts/lib/audit-helpers.mjs:14-23`) reads `Merge pull request #N`
  or a trailing `(#N)` as the PR number. It cannot know the number is an issue.
- `prView` (`brain/scripts/vcs/providers/github.mjs:407`) never throws and returns
  `{labels: null, body: null}` for ANY failure, so a 404 and an outage are the same answer.
- `fetchPrMeta` (`brain/scripts/lib/merge-walk.mjs:298-330`) reads that sentinel as REQ-CIC-2
  uncomputable and fails closed. Correct behaviour on the evidence it has; the evidence is
  wrong.
- `brain-audit.mjs:281` lets `uncomputableCount` dominate the exit code (exit 2), and
  `.github/workflows/release.yml` tags only after the audit exits 0.

Consequence: the four merges are on `main` and cannot be rewritten, so every future release
audit over a window containing them fails the same way. #996 recorded the symptom as a
transient outage and advised re-running; that advice can never work here.

## Options

| Option | Description | Pros | Cons |
|---|---|---|---|
| **(a) Resolve the PR from the commit SHA (recommended)** | Add a port verb that answers "which PRs contain this commit" and use it when the parsed number turns out not to be a PR | Reads the real evidence; fixes the class, not the instance; GitHub and GitLab both expose it | New port surface, so a `vcs-contract.md` Tier 2 draft and contract tests |
| (b) Distinguish 404 from outage inside `prView` | Teach the provider to report "absent" separately from "unreadable" | Smaller | Still leaves the audit with no evidence for those merges: it would fall back to the commit body, where `Closes #N` never lives, and issue-link would render a confident FAIL instead |
| (c) Move `governance.auditBaseline` to `v1.5.0` | One config line | Immediate | Silences the window instead of reading it; ADR-0025 pins the baseline at `v1.0.0` for legacy merges only |
| (d) Tag by hand | Unblocks today | The gate exists to prevent exactly this | 

**Recommendation: (a), with (b) folded in** — the SHA lookup only makes sense once the provider
can say "that number is not a pull request" rather than "I could not read". Both halves ship
together or the fallback fires on a real outage, which would be a fail-open.

## Fail-closed contract

- Number parsed, PR exists → audit it, exactly as today.
- Number parsed, provider says the number is NOT a PR → resolve PRs for the merge SHA.
  - Exactly one PR → audit that PR.
  - None → no PR contains this commit: audit from the commit body, the existing
    "subject references no PR" state.
  - More than one → uncomputable, never a guess.
- Provider could not read (any transport failure) → uncomputable, as today.

## Tests

- Unit, with a fake port: each of the five branches above, including that a transport failure
  still fails closed and never reaches the SHA fallback.
- Contract tests for the new verb on both providers, with fixtures, following the `mrList`
  precedent from #930.
- A regression pin on the real shape: subject `… (#978)` where 978 is an issue.

## Risks

- A fallback that fires on an outage would turn an uncomputable into a verdict. The provider
  must distinguish absent from unreadable, or the fallback must not run.
- `brain/core/methodology/vcs-contract.md` is Tier 3: the new verb's row travels as a Tier 2
  draft for the maintainer, never written by an agent.
- #996 should be corrected or closed by this change; its recorded advice is wrong.

## Ready for Proposal

Yes.
