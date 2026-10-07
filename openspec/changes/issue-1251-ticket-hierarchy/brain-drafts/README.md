# brain-drafts for #1251 — promotion order

Every draft here is Tier 2: a human promotes it with `npm run brain:promote -- <path>`, and the
commit is the signature (ADR-0028). Promote them in this order, one per signing commit. ADR-0039
goes first because every other draft cites it, and `brain/HOME.md` must already list it.

| # | Draft | Target | Kind | planAmendment against `main` (`fe27c260`), 2026-10-07 |
|---|---|---|---|---|
| 1 | `adr-0039-a-declared-ticket-hierarchy-one-resolver-and-integration-opened-by-ticket-start.md` | `brain/project/decisions/adr-0039-…md` | **new ADR** (new document; number 0039 free) | n/a (new-ADR shape; filename and H1 numbers match) |
| 2 | `agent-authorities-hierarchy-close.draft.md` | `brain/core/methodology/agent-authorities.md` | amendment: section (close workflow, `brain:gc`'s acts at their tiers) + 2 in-place edits | ok:true |
| 3 | `adr-0026-amendment-11.draft.md` | `brain/project/decisions/adr-0026-governance-doctrine-tiers.md` | ADR Amendment 11 (last on `main`: 10) | ok:true |
| 4 | `workflow-governance-integration-ready.draft.md` | `brain/core/methodology/workflow-governance.md` | amendment (section + 1 in-place edit) | ok:true |
| 5 | `adr-0029-amendment-1.draft.md` | `brain/project/decisions/adr-0029-two-sources-one-graph.md` | ADR Amendment 1 (none on `main`) | ok:true |
| 6 | `adr-0032-amendment-2.draft.md` | `brain/project/decisions/adr-0032-graph-block-declared-by-its-tag.md` | ADR Amendment 2 (last on `main`: 1) | ok:true |
| 7 | `adr-0035-amendment-2.draft.md` | `brain/project/decisions/adr-0035-archive-sweep-issue-link-exemption-is-content-earned.md` | ADR Amendment 2 (last on `main`: 1) | ok:true |
| 8 | `adr-0018-amendment-1.draft.md` | `brain/project/decisions/adr-0018-gitlab-governance-fragment.md` | ADR Amendment 1 (none on `main`) | ok:true |
| 9 | `harness-contract-ticket-start-hierarchy.draft.md` | `brain/core/methodology/harness-contract.md` | amendment: section + 4 in-place edits (`ticket:start`, `day:start`, `session:start` rows annotated; a new `brain:gc` row) | ok:true |

Only ADR-0039 creates a new document. `brain:gc` is a new verb, not a new document: it enters
doctrine as a row in `harness-contract.md` (draft 9). Every other draft amends a signed document that already
exists on `main`.

Re-run `planAmendment` before each promotion if `main` has moved: an anchor that moved makes the
verb refuse, and the draft must be re-anchored, never applied to something adjacent.
