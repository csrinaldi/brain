# Tasks: #814 — engine adapter, config verb, first first-party role

Chain strategy: **stacked-to-main** (cached, the #557 precedent). Three PRs,
each an independent work unit, each with a closable approved issue —
`issue-link` refuses `Part of #N` on the default branch, the #816 lesson.

```
PR1  brain:config verb        (closes #823 — C4's orphaned deliverable)
PR2  adapter + instructions   (closes #814 — the tripwire dies here)
     + Adversary + parity        depends on: nothing from PR1
PR3  brain:engines discovery  (closes #824) — depends on PR1 AND PR2
```

Strict TDD throughout: every unit lands RED first against the real module,
then the implementation turns it green. No test is written after its code.

## PR1 — the config verb (T1) · closes #823 · ~230 countable lines

- [ ] 1.1 RED: `config-verb.test.mjs` — `planConfigWrite` refuses an unknown
      path naming the nearest known family; accepts a known path; plans
      pending migrations before the write; JSON-first-then-bare-string values.
- [ ] 1.2 GREEN: `brain/scripts/config/config-verb.mjs` — pure;
      `KNOWN_PATHS` derived from `config-migrations.mjs` defaults.
- [ ] 1.3 RED: `cli.test.mjs` — `get` prints resolved value; `set` writes the
      planned result atomically; exit codes; refusal text.
- [ ] 1.4 GREEN: `brain/scripts/config/cli.mjs` + `brain:config` script line.
- [ ] 1.5 Migration draft `brain-drafts/config-migrations-1.4.0.md`
      (`sdd.engines: {}`; #806 numbering, renumber at land if the package moved).
- [ ] 1.6 Work-unit commit; `repo:check`, `nav`, full suite.

## PR2 — the port grows, the debt dies (T2+T3+T4+T6) · closes #814 · ~740

Unit 1 — the field (T3):
- [ ] 2.1 RED: contract/port tests — `instructions` absent → throw naming
      stage+field; `null` accepted as the checked no-prompt state; non-empty
      string carried through verbatim.
- [ ] 2.2 GREEN: `role-port.mjs` validation clause; `plain.mjs` declares
      `instructions: null` on every stage.

Unit 2 — the adapter (T2):
- [ ] 2.3 RED: gentle-ai contract assertions — every resolved stage answered
      (custom included, marked `derived`); `_provenance` recorded; tiers per
      D4; `chooses_model: false`; runs with no tool installed.
- [ ] 2.4 GREEN: `gentle-ai.roles.mjs` (recorded data) + `declareRoles` in
      `gentle-ai.mjs`.

Unit 3 — the Adversary and the assembler (T4):
- [ ] 2.5 RED: `first-party` tests — `firstPartyRole('cold-review')` returns
      the role; no protocol literal in the text (tag/fields/severities
      asserted ABSENT); no routing-shaped key (neutrality, ADR-0019 Am.1 c.2).
- [ ] 2.6 RED: `assemble-review-prompt` tests — ports the existing
      cold-review-prompt suite: worked example parses via
      `readFindingsArtifact`; refused-fields invariant; artifactRoot split.
- [ ] 2.7 GREEN: `roles/first-party/{adversary-cold-review,index}.mjs`;
      `review/lib/assemble-review-prompt.mjs`; `run-cold-review-stage.mjs`
      hands the role in.
- [ ] 2.8 DELETE `cold-review-prompt.mjs` + its test + `ROLE_DEBT_TICKET`;
      update the `resolve-challenger.mjs` debt header.

Unit 4 — parity (T6):
- [ ] 2.9 `INHABITANTS` += gentle-ai (the one line). TRIPWIRE goes RED.
- [ ] 2.10 Delete the tripwire + parity-debt statements per their own
      instructions. Suite green over BOTH inhabitants.
- [ ] 2.11 Work-unit commits (one per unit); gates; the PR body records that
      #814 closes because the tripwire FAILED.

## PR3 — discovery (T5) · closes #824 · ~140

- [ ] 3.1 RED: `engines-cli` tests — reports both engines per stage; a
      refusing engine is a row, not a crash; `--record` writes
      `sdd.engines.<name>` through `config-verb.mjs` (asserted: no second
      writer); re-run prints drift against the recorded entry.
- [ ] 3.2 GREEN: `brain/scripts/harness/engines-cli.mjs` + `brain:engines`.
- [ ] 3.3 Work-unit commit; gates.

## Review Workload Forecast

| | |
|---|---|
| Estimated countable lines (whole change) | **~1110** (excl. tests/openspec per ignoreList) |
| Tier budget (`lite`, #496) | 1000 |
| **Chained PRs recommended** | **Yes** — PR1 ~230 · PR2 ~740 · PR3 ~140, each under budget |
| 400-line-budget risk | n/a — tier-resolved budget is 1000 |
| **Decision needed before apply** | **Yes** — RESOLVED 02/09/2026 — the maintainer approved the 3-PR chain ("la cadena de 3"); issues #823 (PR1) and #824 (PR3) created, awaiting `status:approved` |

Dependencies: PR2 ⊥ PR1 (parallel-safe); PR3 → PR1+PR2. The T3/T4 coupling is
honored INSIDE PR2 — the field and its consumer land together.
