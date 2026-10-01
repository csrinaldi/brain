# Spec: commit-msg first-commit exemption (#1161)

- REQ-1: While `git rev-list -n 1 --all` is empty inside a git repository, `commit-msg` accepts a Conventional Commit without `#N` and prints one line stating the reason.
- REQ-2: Conventional-Commit format and AI-attribution checks still apply to that commit; only the ticket requirement is exempt.
- REQ-3: Once any ref reaches a commit, a commit without `#N` is refused. An orphan branch in a repository with history is NOT exempt.
- REQ-4: `pre-commit` and `commit-msg` share ONE predicate (`brain/scripts/hooks/no-commit-yet.sh`). It fails closed: outside a repo, on a git error, or with the helper missing, the exemption does not apply.

Scenarios (real git fixtures, `commit-msg.first-commit.test.mjs`): (a) first `chore: adopt brain` accepted with message; (b) second commit without `#N` refused; (c) non-Conventional first message refused; (d) orphan-branch commit with history refused.
