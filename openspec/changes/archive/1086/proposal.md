# Proposal: the audit resolves a merge's pull request from the commit, not only from the subject (#1086)

## Intent

The `v1.6.0` release gate failed with four `[UNCOMPUTABLE]` merges, all carrying `(#978)`.
`978` is an ISSUE, not a pull request (`gh pr view 978` → "Could not resolve to a
PullRequest"; the real PR is `991`, from `commits/d4cb7f8/pulls`). `parsePrNumber`
(`audit-helpers.mjs:14-23`) cannot tell the two apart, and `prView`
(`github.mjs:407-409`) answers a 404 and an outage with the same
`{labels:null, body:null}`, so `fetchPrMeta` (`merge-walk.mjs:331-333`) fails closed on
evidence that is simply wrong. Those merges are on `main` and cannot be rewritten, so
every future window containing them fails the same way. #996 recorded this as a transient
outage and advised re-running; that advice can never work.

## Scope

### In Scope

- A new VCS port verb resolving the pull requests that contain a commit, on both providers.
- `prView` additively distinguishing "that number is not a pull request" from "I could not read".
- A fail-closed fallback in the shared evidence layer: exactly one PR is audited, none falls
  back to the commit body, more than one is uncomputable, and any transport failure stays
  uncomputable and never reaches the fallback.
- Audit output that lets an operator tell the three outcomes apart.
- A Tier 2 `vcs-contract.md` row draft under `brain-drafts/`.
- Correcting #996's recorded advice.

### Out of Scope

- Rewriting history, or moving `governance.auditBaseline` off `v1.0.0` (ADR-0025).
- Tagging `v1.6.0` by hand.
- Changing `parsePrNumber`'s grammar, the exit-code ladder, or any governance gate's semantics.
- Fixing the release window by widening the ignore list or adding a per-merge accept.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `openspec/specs/**` carries no VCS-port or audit capability entry (#920/#936
precedent); the port's contract lives in `vcs.contract.test.mjs` and the audit's in
`brain-audit.test.mjs`. This change uses a flat `spec.md`.

## Approach

Exploration option (a) with (b) folded in. The provider gains a definitive "absent" signal;
only that signal opens the commit-SHA lookup. The lookup lives in `fetchPrMeta`
(`merge-walk.mjs:298`), the layer `brain:audit` and `brain:metrics` share, so measurement and
enforcement cannot diverge. When exactly one PR contains the merge, the audit re-reads that
PR through the existing `prView` path — no second evidence shape is introduced.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `brain/scripts/vcs/providers/{github,gitlab}.mjs` | Modified | New verb; `prView` gains an additive field |
| `brain/scripts/vcs/lib/uncomputable-cause.mjs` | Modified | One shared not-found predicate |
| `brain/scripts/vcs/cli.mjs` | Modified | `VERBS` gains the new verb |
| `brain/scripts/lib/merge-walk.mjs` | Modified | The fallback and its fail-closed gate |
| `brain/scripts/{brain-audit,brain-metrics}.mjs` | Modified | Reporting and the sha argument |
| `brain/scripts/vcs/fixtures/` | New | Contract fixtures for both providers |
| `brain/core/methodology/vcs-contract.md` | Modified (Tier 2) | One verb row — drafted, human-landed |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The fallback fires on an outage and turns an uncomputable into a verdict | Med | It is gated on a definitive negative only; a test asserts the lookup is never called on a transport failure |
| A guessed PR produces a confident wrong verdict | Med | More than one containing PR is uncomputable, never a choice |
| The new verb's contract row is Tier 3 and blocks the drift guard | High | The row is drafted and landed by the maintainer before the PR can go green |

## Rollback Plan

Revert the change. `prView`'s widening is additive and the fallback is the only new decision
path, so reverting restores the pre-change behaviour exactly: the four merges become
`[UNCOMPUTABLE]` again and the release gate blocks, which is the current state. No data, no
config and no history is touched.

## Dependencies

- A maintainer landing the `vcs-contract.md` verb row (Tier 2), without which
  `verb-contract-drift-guard.test.mjs` fails.

## Success Criteria

- `brain:audit "v1.5.0..HEAD"` evaluates `d4cb7f8`, `789f6c2`, `c6ab10c` and `4d47e2f` and
  reports a real verdict for each instead of `[UNCOMPUTABLE]`.
- A simulated transport failure on the same merges still exits 2, with the lookup never called.
- Two containing pull requests stay uncomputable.
- `governance.auditBaseline` is unchanged at `v1.0.0`.
