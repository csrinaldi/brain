# Tasks — ADR-0006 Amendment 2 (issue #729)

## 1 · Measure before writing

- [x] 1.1 Enumerate every `@csrinaldi/brain` occurrence in ADR-0006 (3 live + 1 dated row)
- [x] 1.2 Probe the registry: `@csrinaldi/brain` → `404`, `@logikas/brain` → `200` at `1.1.0`
- [x] 1.3 Re-measure each clause of `### The accepted loss` against `main` — all four expired
- [x] 1.4 Decide what is NOT in scope: the rows under `measured on main @ 3dfbdd4` (D4)

## 2 · Draft

- [x] 2.1 Write the `brain-amendment/1` contract (target, amendment 2, issue, home-summary, body, body-end)
- [x] 2.2 Verify each `amend-find` anchor occurs EXACTLY once in the target (D2)
- [x] 2.3 Write the three `amend-find`/`amend-replace` pairs
- [x] 2.4 Write the appended `## Amendment 2` section, including the `**Signed**:` placeholder line

## 3 · Verify without promoting

- [x] 3.1 `parseAmendmentDraft` — contract parses, 3 edits found
- [x] 3.2 `planAmendment` — plan resolves clean
- [x] 3.3 Inspect the planned artefact: Status line, HOME marker, signed stamp, `### Notes for the promoter` excluded
- [x] 3.4 Confirm every surviving `@csrinaldi/brain` mention is legitimate (A2 marker, dated row, A2 prose)

## 4 · Promotion — maintainer, Tier 3

- [x] 4.1 Maintainer runs `brain:promote` against the draft and reads the rendered plan
- [x] 4.2 Maintainer commits — that commit is the signature (ADR-0028)

## 5 · Evidence

- [x] 5.1 `npm test` — 4057/4057, 0 fail
- [x] 5.2 `npm run brain:repo:check` — clean
- [x] 5.3 `npm run brain:nav` — clean
- [x] 5.4 Corpus-wide single-status-line census — all 31 ADRs at exactly 1
- [x] 5.5 Confirm the promotion commit is authored by the maintainer, not an agent
