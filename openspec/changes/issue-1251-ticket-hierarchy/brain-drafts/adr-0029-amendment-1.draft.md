# ADR-0029 Amendment 1: hierarchy fields take a precedence, sub-issues are read for drift, and `epic:map` stops writing bodies (issue #1251)

> **Tier 2 target. Not promoted, and an agent may not promote it.** Promote it after ADR-0039,
> which decides what it records.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1251-ticket-hierarchy/brain-drafts/adr-0029-amendment-1.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0029-two-sources-one-graph.md
amendment: 1
issue: 1251
home-summary: Decision 2's union stays for blocking edges; hierarchy fields (ADR-0039) take block > label > default with every disagreement reported, and native containment (GitHub sub-issues, GitLab epics and work items, the native milestone) is read for drift only, never into the blocking graph; Decision 3's body write moves from `brain:epic:map`'s repo-wide region to ADR-0039's generated children region, written by the same proven region writer from the close workflow and `brain:gc`, #1251
body: ## Amendment 1 — hierarchy fields take a precedence, sub-issues are read for drift, and `epic:map` stops writing bodies (issue #1251)
body-end: ### Notes for the promoter
```

```amend-find
- **GitHub sub-issues.** Containment is not ordering. A slice is *part of* its epic, not a
  blocker on it; feeding sub-issues into a blocking graph would make every slice of #313
  appear to block #313.
```

```amend-replace
- **GitHub sub-issues.** Containment is not ordering. A slice is *part of* its epic, not a
  blocker on it; feeding sub-issues into a blocking graph would make every slice of #313
  appear to block #313. **[Amended by Amendment 1 (#1251, ADR-0039): sub-issues, GitLab epics
  and work items, and the native milestone are now READ — for hierarchy drift only, compared
  with the declared parent and reported, never fed into this blocking graph and never used to
  resolve a parent. See Amendment 1.]**
```

```amend-find
- **`brain:epic:map` stays read-only reporting** (`brain:metrics`' character, M9). Nothing it
  emits can block a merge. Slice 2 adds a write to an issue body and no gate anywhere.
```

```amend-replace
- **`brain:epic:map` stays read-only reporting** (`brain:metrics`' character, M9). Nothing it
  emits can block a merge. Slice 2 adds a write to an issue body and no gate anywhere.
  **[Amended by Amendment 1 (#1251, ADR-0039): `brain:epic:map` no longer writes its repo-wide
  region into issue bodies; it prints (`--dry-run`) and feeds the UI. The same proven region
  writer, `replaceMapRegion` under `outsideRegion`, now writes ADR-0039's generated children
  region instead. See Amendment 1.]**
```

## Amendment 1 — hierarchy fields take a precedence, sub-issues are read for drift, and `epic:map` stops writing bodies (issue #1251)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0039 names this ADR in "Amendments this requires".

**Decision 2.** The union, "neither wins", stays exactly as it is for blocking edges. ADR-0039
resolves a different set of fields, the hierarchy (`level`, `parent`, `children`, `tracker`,
`milestone`), and for those it sets a precedence:

- `level` comes from the block, then a `level:*` label, then the declared default (rulings Q2 and
  C1, 2026-10-07). `parent` comes from the block or its prose `Parent: #N` line only.
- **Every disagreement between sources is still reported**, whichever wins. The report is what
  this ADR's union argument rested on, and it is kept.
- **Native containment is read, for drift only** (ruling Q11, 2026-10-07): GitHub sub-issues,
  GitLab epics and the work-item hierarchy, and the native milestone. A disagreement with the
  declared hierarchy is a divergence. Native data never resolves a parent or a level, and never
  enters the blocking graph, so "containment is not ordering" holds unchanged.
- An unsupported provider or tier is "unmeasured", never "no children", the rule this decision
  already applies to an unreadable `issueRelations`.
- A union source for the hierarchy is named as a later upgrade, by a new decision.

**Decision 3.** `issueUpdate` still writes `body` only, and every write is still proven contained
first. What it writes changes (ruling C8, 2026-10-07):

- `brain:epic:map` stops writing its repo-wide region into issue bodies. The repo-wide graph is a
  printed report (`--dry-run`) and the UI.
- ADR-0039's generated children region replaces it in parent bodies, written by the same
  `replaceMapRegion`/`outsideRegion` writer. The close workflow rewrites it in the step that
  closes an issue, and `brain:gc` regenerates it as the safety net (rulings N5, M4 and T1-gc).
- The region is not a contract: no brain tool reads its contents.

### Why

Blocking edges and hierarchy answer different questions. "Can this start now" is safer with every
edge either source knows about. "Where does this sit" needs one answer per field, or `ticket:start`
cannot pick a base, so the declared source wins and the other is reported. The repo-wide map in an
epic body was the slowest artefact brain wrote (3m35s for #878, 2026-10-07) and showed issues
outside the epic.

### What this does NOT change

The union and its report for blocking edges; `issueUpdate`'s single writable field; the
containment proof before every write.

### Notes for the promoter

Two in-place annotations, Decision 2's sub-issues bullet and Decision 3's `epic:map` bullet, plus
this section.
