---
status: draft
issue: 590
---

# Tasks — adr-0018-gitlab-fragment (issue 590)

- [x] Measure the state on `main` @ `51bbcaa`: 5 sites cite ADR-0018, it does not exist
- [x] Decide write vs renumber → write (`proposal.md`)
- [x] RED FIRST: the citation-resolution check, red before any fix
- [x] Correct the check: self-exclusion + readers that fail loudly
- [x] Mutation proof: 6 mutations, each red, each diff printed and reverted byte-identically
- [x] Two-way probe: with the ADR on disk the suite is fully green
- [x] Write the ADR-0018 draft, re-derived from the tree
- [x] Verify `brain:promote` transforms it (destination, header, commit command)
- [x] Review round: G1 (undefended scan surface), G2 (the ADR misdescribed the
      managed-path mechanism), G3 (`KNOWN_GAPS` overclaimed), G4 (draft links
      unverified until after the signature) — each fixed, each re-proven
- [x] Second review round: H1 (artifacts in the wrong language, ADR-0009),
      H2 (this spec described a surface two commits stale), H3/H4 (untracked
      blind spot and case sensitivity — declared, not fixed)
- [x] Open #599 (ADR-0023) and #605 (the scaffold's hardcoded language)
- [ ] **HUMAN**: `npm run brain:promote -- openspec/changes/issue-590-adr-0018-gitlab-fragment/brain-drafts/adr-0018-gitlab-governance-fragment.md`
      and commit the signature on this branch. Until then `npm test` is red by
      construction.

## Hot micro-decisions

See `design.md` — consolidated there during the flight.

## Out of scope, reported

- `.gitlab-ci.yml:1` states that `phase-order`, `actor-check` and
  `brain-writes-reviewed` are DETECTION via `allow_failure`. The fragment
  carries no `allow_failure` at all (all 3 occurrences are comments). The root
  comment went stale after #358 Phase 5. File outside the claim.
- ADR-0023: cited by two files under `docs/inbox/**`, draft unpromoted at
  `brain-drafts/adr-0023-sdd-role-port.md`. Same class as #590. **Ticket #599.**
- The reviewer's coldness is not verifiable (`whoami` resolves the ambient
  identity behind a credential-injecting proxy; §10 abstention compares
  identity, not provenance). **Ticket #604.**
- `brain:project:feature` scaffolds in Spanish and never reads `docs.language`.
  **Ticket #605.**
