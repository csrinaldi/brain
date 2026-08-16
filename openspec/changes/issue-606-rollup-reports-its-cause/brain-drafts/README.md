# brain-draft — one row of `vcs-contract.md`, awaiting a human

**This change edits the `prStatusRollup` contract row. An agent may not land that edit.**

`brain/core/methodology/vcs-contract.md` is the knowledge half. `agent-authorities.md`
puts committing to `brain/core/**` at **Tier 3 — prohibited, even if explicitly asked**,
and modifying anything under `brain/` at **Tier 2 — the agent drafts, the human moves it**.
The apply run wrote the row directly and committed it (`89c9f99`); that commit's effect on
`brain/core/` has been reverted and the intended edit lives here instead, which is the door
that exists for it.

Nothing about the code change is in question — only who is allowed to sign the doctrine
that describes it.

## What is here

`vcs-contract-prStatusRollup-row.patch` — the exact diff, one table row, as produced by the
apply run.

## Why the row has to change at all

The row currently promises the failure arm is bare `null`:

> `` -> Promise<Array<{ name, status, conclusion }>|null> `` … `null` = uncomputable (fetch
> failed), never a fabricated `[]`.

After this change that is false. The failure arm is a frozen `{uncomputable, reason, detail}`
built by the single constructor in `vcs/lib/uncomputable-cause.mjs`. A contract row that
describes a return shape the code no longer returns is the drift this repo already tracks —
so leaving it unamended is not the safe option, it is just a different wrong answer.

## What the human does

1. Read the patch and the code it describes (`brain/scripts/vcs/lib/uncomputable-cause.mjs`,
   both providers' `prStatusRollup`).
2. Apply it, or write your own wording:
   ```bash
   git apply openspec/changes/issue-606-rollup-reports-its-cause/brain-drafts/vcs-contract-prStatusRollup-row.patch
   ```
3. Commit it under your own name, in this PR or a follow-up.

## Two claims in the row to check before you sign

- **"`reason` is one of the module's seven enum values."** Count them in
  `UNCOMPUTABLE_REASONS`. If the enum grew or shrank after this draft was written, the row
  is stale on arrival.
- **"the declared destination for the 13 remaining cause-discarding sites."** That count came
  from the proposal. The apply run flagged that `gitlab.mjs:360` in the filed-sites list now
  falls **inside `prStatusRollup` itself** — the site this change fixes, not a remaining
  sibling. **Re-derive the list against HEAD before publishing a number**, here or in the
  follow-up ticket.
