# ADR-0032 Amendment 2: the `brain-graph/1` block names any declared level (issue #1251)

> **Tier 2 target. Not promoted, and an agent may not promote it.** Promote it after ADR-0039,
> which decides what it records.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1251-ticket-hierarchy/brain-drafts/adr-0032-amendment-2.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0032-graph-block-declared-by-its-tag.md
amendment: 2
issue: 1251
home-summary: the `brain-graph/1` block's vocabulary widens with ADR-0039 — `kind` names any declared level (`milestone` included), `tracker:` is honoured on any level that declares `integration`, and `TRACKER_GRAMMAR` admits the hierarchical scheme in a repository that declared a hierarchy while keeping `feature/…`; the block gains no name key and the tag rule is unchanged, #1251
body: ## Amendment 2 — the `brain-graph/1` block names any declared level (issue #1251)
body-end: ### Notes for the promoter
```

```amend-find
The row is corrected rather than quietly reversed: D1's `brain-graph/1` entry moves to
the second family with a pointer to this ADR, so the next reader inherits the reason
instead of finding two documents that disagree.
```

```amend-replace
The row is corrected rather than quietly reversed: D1's `brain-graph/1` entry moves to
the second family with a pointer to this ADR, so the next reader inherits the reason
instead of finding two documents that disagree. **[Amended by Amendment 2 (#1251,
ADR-0039): what the tag declares widens — `kind` names any level the repository declares,
`tracker:` is honoured on any integrating level, and `TRACKER_GRAMMAR` admits the
hierarchical scheme. How a block is recognised, the tag, is unchanged. See Amendment 2.]**
```

## Amendment 2 — the `brain-graph/1` block names any declared level (issue #1251)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0039 names this ADR in "Amendments this requires". The block's keys stay the same; what two of
them may say widens.

- **`kind` names any declared level**, not only `epic`. With `vcs.hierarchy` declared, the levels
  are the config's (`milestone` included, ruling Q4). Without it, the implicit model is `epic` and
  `ticket` (ruling C4). A `kind` that names no level is a reported divergence, never a refusal.
- **`tracker:` is honoured on any level that declares `integration`**, not only on `kind: epic`.
  `tracker-without-kind-epic` becomes "tracker on a level that does not integrate".
- **`TRACKER_GRAMMAR` admits the hierarchical scheme** (`release-1300/tracker`,
  `release-1300/epic-878/tracker`) in a repository that declared a hierarchy, and keeps `feature/…`:
  that form is the implicit model's grammar and is never removed for a repository without one
  (ruling N2). In a repository with a hierarchy it is accepted while any open branch or PR uses it.
- **The block gains no name key** (ruling C6). Branch segments come from issue numbers; a
  milestone's human name lives in the issue title and the native milestone mirror.

### Why

ADR-0039 makes the hierarchy declared data, and the block is where an issue declares its own place
in it. The tag decision is untouched: the widening is in the vocabulary, not in how a block is
found.

### What this does NOT change

The fence-tag declaration, the hidden-declaration refusal, the delimiter-aware splitter, and every
key other than `kind` and `tracker`.

### Notes for the promoter

One in-place annotation at the end of the Decision, plus this section.
