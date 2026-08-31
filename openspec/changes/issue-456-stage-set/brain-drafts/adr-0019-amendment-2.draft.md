# ADR-0019 Amendment 2 — Amendment 1's citations named line numbers and two wrong counts (issue #456)

> Drafted during #456 slice A. Amendment 1 is correct in every ruling it makes;
> this touches only how it CITES the tree it rules over. It is a numbered
> amendment rather than an edit because ADR-0019 is signed, and this repo does
> not silently rewrite signed artefacts — `brain:promote` refuses the shortcut
> by construction, which is how this draft found its own shape.

```brain-amendment/1
target: brain/project/decisions/adr-0019-harness-port.md
amendment: 2
issue: 456
home-summary: Amendment 1's evidence-contract citations named line numbers and two counts that were already wrong when written — corrected to symbols, #456
body: ## Amendment 2 — the citations, corrected to symbols (issue #456)
body-end: ### What this amendment does NOT touch
```

```amend-find
sdd-layout.mjs:28-32   ARTEFACT_FILE = { proposal: 'proposal.md', spec: 'spec.md',
                                         design: 'design.md',     tasks: 'tasks.md' }
sdd-layout.mjs:96-99   openspec/changes/issue-<id>-<slug>/<file>
```

```amend-replace
sdd-layout.mjs  ARTEFACT_FILE = { proposal: 'proposal.md', spec: 'spec.md',
                                  design: 'design.md',     tasks: 'tasks.md',
                                  verification: 'verify-report.md' }
sdd-layout.mjs  artifactPaths()   openspec/changes/issue-<id>-<slug>/<file>
```

```amend-find
Twelve modules import that layout. Three of them are gates on every pull request —
```

```amend-replace
Ten production modules import that layout, eighteen counting tests. Three of them are gates on every pull request —
```

---

## Amendment 2 — the citations, corrected to symbols (issue #456)

**Signed**: — Cristian Rinaldi

### What changed

Three citation defects in Amendment 1's *"What the evidence contract actually
is"* section. The rulings above them are untouched.

1. **`ARTEFACT_FILE` was quoted with four entries.** The tree has **five** —
   `verification: 'verify-report.md'` was already there when Amendment 1 was
   written and was left out of the quoted block. The section's whole purpose is
   to say *once* what the evidence contract is, so a short quotation of it is
   the one error that matters most there.

2. **"Twelve modules import that layout" was never true.** Measured during
   #456: **ten** production modules import `sdd-layout.mjs`, eighteen counting
   test files. Twelve is neither number.

3. **Both citations named line numbers.** `sdd-layout.mjs:28-32` and
   `sdd-layout.mjs:96-99`. They now name symbols — `ARTEFACT_FILE` and
   `artifactPaths()`.

### Why line numbers, specifically, are the defect that reproduces

`reviewer-protocol.md` §2 already carries this rule and the incident behind it
(#580): a doctrine citation pointed at a source line that, within one release
cycle, had become an unrelated JSDoc block while the mechanism moved elsewhere.
A doctrine that points at a moving target sends its own verifier to the wrong
text.

Amendment 1 cited line numbers anyway, and #456 slice A is precisely the change
that would have invalidated them: `LIFECYCLE_STAGES` and `resolveStageSet` land
above `ARTEFACT_FILE` in that file, pushing every cited line down. The rule and
the violation are eleven days apart in the same repository.

### Why this is an amendment and not an edit

ADR-0019 is signed. A correction to a signed artefact is a new, numbered,
signed act — the same reasoning `memory-format.md` applies to durable records,
where corrections are new records carrying `supersedes` rather than mutations
of the original.

This draft was first written as a prose note proposing a direct edit. The
promotion verb refused it — an ADR target requires `amendment: N`, a
`home-summary` for the `brain/HOME.md` index, and a `body`. The refusal was
right and the note was wrong: it is what turned an unnumbered edit into this
amendment.

### What this amendment does NOT touch

The four conditions under which a lifecycle stage may be routed, the definition
of the evidence contract, and the boundary in *"What this amendment does NOT
authorise"* — all unchanged. This is a citation-accuracy correction. Nothing
here reopens Amendment 1's rulings, and #456 slice A was built against those
rulings as written.

### Notes for the promoter

The second `amend-find` pair is a single line and must match exactly, including
the trailing em-dash and space before the line break.
