---
status: draft
issue: 528
epic: 313
---

# Proposal — brain can open an issue, and still cannot approve one

## What was wrong

The VCS port could **read** an issue, **list** issues and **open a merge request**. It could
not open an issue.

So the first step of brain's own workflow was the one step brain did not support: `issue-link`
refuses any PR to `main` without a `Closes|Fixes|Resolves #N` whose target carries
`status:approved`. Every ticket in this repository was created by hand in the web UI or by an
agent calling the raw provider API — bypassing the adapter, the contract and every convention
brain enforces on everything else it writes.

## What lands

`issueCreate` on both providers, `brain:ticket:new` as the consumer verb, and a refusal.

## The refusal is the load-bearing half

**A verb that can attach labels to a NEW issue is one config key away from letting an agent
open its own ticket, approve it, and satisfy `issue-link` on a PR nobody ruled on.** #124 and
reviewer-protocol §9 reserve that label for a human; `actor-check` already refuses it from a
review identity on the read side. This is the write-side twin.

Three decisions inside it, each of which a plausible implementation would have got wrong:

**It lives at the PORT, not the caller.** Guarding at `brain:ticket:new` would leave every
other caller unguarded, and a comment saying *"do not pass this label"* is not a guard. Both
providers call `assertNoApprovalLabel`, and a lock test pins that both do.

**It RESOLVES the label rather than hardcoding it.** `governance.approvedLabel` is
consumer-owned and GitLab maps it to a scoped form. A literal `'status:approved'` would have
been defeated two ways without anyone noticing — a consumer who renames it, and *every* GitLab
consumer, for whom the scoped form simply would not match. That is "green in test, inert in
production", the class epic #335 exists to close, and it is the rule #454 settled for
`agentActors`: the product must not hardcode what the consumer declares.

**It THROWS rather than filtering.** Silently dropping the label would create the issue and
report success while the caller believed it had approved something. A caller must learn its
request was refused, not discover later that half of it was ignored.

## One deliberate divergence from `mrCreate`

`mrCreate` never throws — a transport failure normalises to `{ url: null, error }`.
`issueCreate` keeps that for transport, and makes the approval refusal the exception. A caller
handed `{ error }` may reasonably retry; a caller that tried to self-approve must not be handed
something retryable.

## A smaller call worth stating

GitHub's `gh issue create` prints a URL, not a number. The number is parsed from it, and is
`null` when it does not parse. A guessed number would link a PR to somebody else's ticket via
`Closes #N` — worse than having no number at all.
