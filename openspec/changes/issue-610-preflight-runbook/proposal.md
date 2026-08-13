---
status: draft
issue: 610
---

# Proposal — preflight-runbook (issue 610)

## What

The #435 pre-flight as an executable runbook the maintainer runs on a full
clone, plus the go/no-go block they sign into the ticket.

## Why

#435 calls the pre-flight *"before anything else"* and makes it the gate on an
irreversible act. **The act already happened** — the repo is public
(`private: false`, measured) and #94 closed on the branch-protection it enabled
— and the audit has no artifact anywhere: no comment on #435, no change dir, no
draft.

So the audit is owed, and its purpose has changed. It is no longer authorisation;
it is finding out what is exposed and rotating it.

> Delivery ticket **#610**, split out of **#435** so this can close on its own.
> #435 stays open for the scoped name, `private: false`, the install-spec move
> and the ADR-0006 supersession. The `issue-link` gate refuses `Part of #N` on a
> PR targeting the default branch — correctly: a PR to `main` that closes
> nothing lets a ticket accumulate merges and never close.

## Scope

- **In:** the runbook (`preflight-runbook.md`) and the signed record format.
- **Out:** executing it. It runs on the maintainer's machine, on a full clone,
  and its output is credential material — not an agent's to handle. Also out:
  everything the pre-flight unblocks (scoped name, `private` off, install spec,
  README, ADR-0006), which stays #435's.

## The reframing this records

Three consequences of the switch having already happened, stated in the runbook
because they change what a finding means:

1. **There is no no-go left.** Publication is not undoable; `forks: 0 · stars: 0`
   bounds the exposure without undoing it.
2. **A history rewrite is not containment.** `filter-repo` rewrites your copy and
   nothing anyone else already holds. **Rotation is the remedy.**
3. **The §2b judgment call was made by omission** — 2177 session records are
   public now. The runbook converts that into a decision actually taken.
