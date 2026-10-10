# Spec (#1206)

- REQ-1: `ticket:start` exits 1 when the issue has no `type:*` label, before resolving the base, creating a branch or a worktree.
  - Scenario: labels `[status:approved]` yields refusal key `ticket.error.noTypeLabel` naming the issue and the labels found.
- REQ-2: The verdict is `findTypeLabel`'s (`lib/branch-type.mjs`); no second implementation of the `type:` vocabulary. GitHub `type:x` and GitLab `type::x` both pass.
- REQ-3: The message is provider-agnostic (no hardcoded forge CLI), is in both catalogs, and names the fix (add a `type:*` label, example forms).
