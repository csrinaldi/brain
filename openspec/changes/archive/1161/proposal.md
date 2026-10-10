# Proposal: commit-msg accepts the adoption commit (#1161)

Parent: #1121 (phase 1).

## Problem
In a new repository `commit-msg` refuses `chore: adopt brain` with "message must reference a ticket (#N)", but a repository with no commits has no issues. `pre-commit` already exempts that commit (#1112), so the hooks disagree. The demo worked around it by opening issue #1, a step outside install/bootstrap/upgrade.

## Proposal
`commit-msg` applies the same condition as `pre-commit`: while no ref reaches any commit, a Conventional Commit without `#N` is accepted and one line says why. The predicate is extracted once into a sourced helper, not copied.

## Non-goals
`docs/adoption.md` (describes the published 1.9.0), `brain/core/**`, `brain/project/**`, `pre-receive` (see design).
