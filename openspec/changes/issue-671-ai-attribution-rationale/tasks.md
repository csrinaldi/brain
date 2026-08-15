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

Then a second, sharper correction: **a broadened list is still not agnostic.**
`opencode` and `antigravity` are not in it, and a consumer would have to wait
for a brain release to enforce their own rule against their own tooling. The
vocabulary moved to `git config brain.aiAgents`, with the baked list demoted to
a fallback — `git config` because it is the only dependency `pre-receive` has,
installed as it is into a bare repo as one self-contained file.

Also corrected: the parity test originally **scraped** `tranche.mjs`'s source
for its regex. A guard that parses the file it guards fails open the moment the
declaration is reformatted. The pattern is now exported and imported.

And the config read introduced its own hazard, caught before it shipped: outside
a repository `git config` resolves against GLOBAL scope, so the corpus would
have measured the developer's machine. Neutralised, with a positive control
asserting the shipped default fires with no configuration at all — verified by
setting a decoy global key and re-running green (#657's shape).

## Evidence — mutation testing

Each shown to **land** (anchor asserted to match exactly once before writing,
then grep-confirmed), to turn the suite **red**, and to revert **byte-identical**.

| # | mutation | result |
|---|---|---|
| 1 | restore the dead `CLAUDE.md` citation | the `.md` guard names the exact file and line |
| 2 | narrow the hooks' agent list back to one vendor | 3 tests red |
| 3 | drop the `git config` read from one hook | the same-key parity test goes red |

Suite and checks reported in the PR.

## Doctrine draft — `agent-authorities.md` generalisation

Requested by the maintainer after the mechanism landed, and drafted rather than
applied: `brain/core/**` is Tier 3, prohibited **even if explicitly asked**, and
the request does not move that boundary.

`brain-drafts/agent-authorities.tier-lists.amendment.md` proposes three repairs,
each measured:

| defect | evidence |
|---|---|
| Tier 3 names ONE vendor | `harness/backends/` ships `antigravity`, `claude`, `gentle-ai`, `plain`; this session runs `antigravity`. The doctrine is compiled **verbatim** into every consumer's `AGENTS.md` (`SOURCE_DOCS`, "Tier table VERBATIM"), so consumers read a rule naming a tool they do not use. |
| Tier 3 says "Publish **JARs**" | `@logikas/brain` is an npm package; `JAR` is a Java artefact. |
| Tier 2 cites `npm run backend:deploy` | **zero occurrences** in `package.json` — a citation that reads as verified and resolves to nothing, the same shape as `CLAUDE.md`. |

The wording is now the *only* vendor-specific part left: the enforcement reads
`git config brain.aiAgents` and is agnostic.

Applying it also owes the **`AGENTS.md` regeneration** — `brain-promote.mjs`
treats that as its own act because a previous change lost it on the human's side.

## The mechanism blocked the commit that documents it

Not a hypothetical: the first attempt at the doctrine-draft commit was **rejected
by the hook this ticket added**, because the message quoted the prohibited
trailer verbatim while explaining the rule.

It is a real limitation of a lexical gate, and the people most likely to hit it
are the ones working on governance. **No exemption was added.** "A message that
merely discusses the rule" is not a distinction `grep` can draw, and a gate that
can be talked out of firing by context is the hole that swallows the gate.
Quoting the form generically passes, costs nothing, and is what the doctrine
draft asks for anyway.

Recorded here and in the ADR's Consequences rather than only in a commit
message, because the next person to hit it will search the change folder.

## Not done, deliberately

- [ ] **The 28 commits on `main`.** Rewriting published history is the Tier-3
      prohibition three bullets above this rule. The cost — dead session URLs in
      a public package's history — is already paid, and the rule binds forward.
- [ ] **A general AI-attribution detector.** The pattern is a list of observed
      spellings. No such list is complete, and one claiming to be would be the
      apparent protection #499 refuses. Stated in the ADR's Consequences.
