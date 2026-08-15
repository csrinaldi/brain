---
status: draft
issue: 671
---

# Tasks — issue 671

## Done

- [x] **T1** — Measure before deciding: 28/264 commits on `main` carry the
      trailer; `CLAUDE.md` does not exist; `tranche.mjs` reads `prBody` for a
      rule about commits.
- [x] **T2** — ADR draft (`brain-drafts/adr-0031-…`), carrying the reason, the
      counter-argument, and the provenance-is-not-authorship distinction.
      **Not moved into `brain/`** — Tier 3 for the agent; the maintainer moves,
      reviews and signs it, and owes `brain/HOME.md` an index entry
      (`decision-gate`).
- [x] **T3** — The check in `hooks/commit-msg` and `hooks/pre-receive`
      (REQ-671-1/2), before the ticket-ref exemptions.
- [x] **T4** — `hooks.attribution-parity.test.mjs`: one corpus, three
      implementations (REQ-671-3).
- [x] **T5** — `cites-resolve.test.mjs` extended to `*.md` filenames (REQ-671-4).
- [x] **T6** — `tranche.mjs` repaired (REQ-671-5).

## What the parity guard caught — twice, both times on this change's own work

**First run:** `Claude-Session:` was added to both hooks and **not** to
`tranche.mjs`, so the reviewer would have reported clean on a form the hook
rejects.

**Second run:** after the pattern was made vendor-neutral, the hooks recognised
Copilot, Cursor, Gemini and the rest while `tranche.mjs` still knew only one
vendor. Same drift, one axis over.

Both were caught before the change was pushed rather than by a reader months
later, which is the whole argument for the guard existing.

## The vendor-neutrality correction

The first cut hardcoded a single vendor. **brain ships into other people's
repositories**: a hook that only knew the agent this repo happens to use would
enforce the rule here and silently exempt every consumer using another — the
rule is stated generically and would have been implemented specifically.

Broadening it created a second risk the corpus now pins: `cursor`, `codex` and
`gpt` are ordinary words. Three near-misses are **must-accept**, including
`"generated with cursor pagination"` and a human co-author surnamed
`Copilotti`. A gate that fires on innocent input teaches people to bypass it.

Also corrected: the parity test originally **scraped** `tranche.mjs`'s source
for its regex. A guard that parses the file it guards fails open the moment the
declaration is reformatted. The pattern is now exported and imported.

## Evidence — mutation testing

Each shown to **land** (anchor asserted to match exactly once before writing,
then grep-confirmed), to turn the suite **red**, and to revert **byte-identical**.

| # | mutation | result |
|---|---|---|
| 1 | restore the dead `CLAUDE.md` citation | the `.md` guard names the exact file and line |
| 2 | narrow the hooks' agent list back to one vendor | the parity corpus goes red on the other vendors |

Suite and checks reported in the PR.

## Not done, deliberately

- [ ] **The 28 commits on `main`.** Rewriting published history is the Tier-3
      prohibition three bullets above this rule. The cost — dead session URLs in
      a public package's history — is already paid, and the rule binds forward.
- [ ] **A general AI-attribution detector.** The pattern is a list of observed
      spellings. No such list is complete, and one claiming to be would be the
      apparent protection #499 refuses. Stated in the ADR's Consequences.
