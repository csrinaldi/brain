---
status: draft
issue: 130
---

# Design

## Measure first

The ticket predates most of what it asks for. Every claim in the proposal's table was checked
against `main` before any code was written — the GitLab fragment, its managed-path entry, the
root `.gitlab-ci.yml` include, and the two existing parity guards. Implementing what already
exists is its own kind of defect.

## The comparison

`githubJobCommands` extracts inline `run:` scalars; `gitlabJobCommands` extracts `script:`
entries; both split `&&` chains so a chain and a step list compare equal (`local-checks`
legitimately differs in shape and not in content).

`run: |` blocks yield nothing on purpose. That is what makes REQ-130-2 enforceable: a bash
re-implementation is *invisible* to the extractor, so the comparison against a non-empty
GitLab list fails. Asserted by teeth, because "two empty lists compare equal" is precisely
how a naive version of this guard would have blessed the divergence it exists to catch.

## Red-proof

| mutant | the lie it would tell |
|---|---|
| M1 issue-link reverts to inline bash | two implementations, one rule |
| M2 the literal `'main'` comparison returns | the wrong policy for non-`main` consumers |
| M3 GitLab runs a different check under the same job name | name parity without behaviour parity |
| M4 the approved label is hardcoded back | a consumer's renamed label ignored |
| M5 `DEFAULT_BRANCH` dropped | red for a reason unrelated to the change |

M5 survived the first pass. Dropping the input makes the check fail **closed**, which is the
correct direction and is not a reason to leave it unguarded — the failure mode it produces is
the one #467 and #475 are both about. All five are red now.

## A test that pinned a mechanism, rewritten to state its requirement

`REQ-A2-3` asserted the job shells out to `approved-label.mjs`. The requirement is *"no
runtime code, bash included, hardcodes the label"*; the subprocess was the mechanism, and it
was the mechanism only because the job was bash and bash has no config parser. `run-check.mjs`
reaches the same resolver directly. The assertion now states the requirement — the label must
not appear in the job's code at all — which is both stronger and true of the new shape.

Full suite: **3037 tests, 0 failures**.
