# DRAFT — Amendment 1 to ADR-0020 (issue #405)

> **Tier-2 draft.** `brain/**` is human-only. This is the text to append to
> `brain/project/decisions/adr-0020-reviewer-port-verbs-and-two-key-split.md`,
> immediately before its `## References` section. The agent must not write that file.
>
> **Promotion is a three-step cascade** — see `promotion-checklist.md` in this folder.
> Fill in the signature line with the real date and name before promoting.

---

## Amendment 1 — `prReviewComment` carries inline comments; the verb count and lock 2 do not move (issue #405)

**Signed**: DD/MM/2026 — Cristian Rinaldi

M3's exit criterion is *"a developer sees inline code review in the PR, on GitHub and
GitLab."* The four verbs above post a single fenced block and nothing else, so a reviewer
that reports `src/a.mjs:42` inside a YAML block leaves the developer to go find the line
themselves. The milestone does not hold.

**Amended verb contract:**

| Verb | Contract |
| --- | --- |
| `prReviewComment({ project, number, body, comments? })` | `event: 'COMMENT'` **hardcoded** — no APPROVE code path exists. `comments` is OPTIONAL: an array of `{ path, line, body }` posted as line-anchored review comments **in the same provider call** as `body`. |

The verb **count stays four**. No new verb, no new event, no second postable artifact.

### Why widening rather than a fifth verb

Measured, not preferred. GitHub's `POST repos/{project}/pulls/{number}/reviews` — the
endpoint `prReviewComment` already calls — accepts `body`, `event` and `comments[]` in
**one** payload. Widening therefore costs zero additional calls and keeps the verdict
atomic: either the whole review posts or none of it does.

A fifth verb would mean two calls on GitHub, creating a state where the summary posted
and the inline did not — on the provider where that split is otherwise structurally
impossible. It would also create an artifact the anti-loop lock does not count, making
that guarantee depend on ordering rather than on structure.

### Lock 2 (REQ-266-3) is preserved by construction, on both providers

- **GitHub**: `comments` rides the existing payload; `event: 'COMMENT'` remains a
  hardcoded literal with no parameter, flag or branch reaching it.
- **GitLab**: inline requires `POST projects/{enc}/merge_requests/{n}/discussions` with a
  `position` object rather than `…/notes`. A discussion is structurally still a note — it
  cannot become an approval, so no APPROVE path exists here either, for the same reason
  notes have none.

**The contract is symmetric; the implementations are not.** GitLab maps one contract verb
to two endpoints (notes without `comments`, discussions with) and must first read the
MR's `diff_refs` to build `position`. This asymmetry is the shape this port already
absorbs — `prCommits` returns `login: null` for every GitLab entry — and
`vcs.contract.test.mjs` is what keeps it deliberate rather than accidental.

`prView` is **not** widened to carry `diff_refs`: its normalized shape is consumed by
cold-boot, tranche, checkpoint and the poster's anti-stale check, and a provider-shaped
field for one caller does not belong there. The verb fetches what its own transport
needs.

### The failure semantics, which are the point

GitHub returns 422 when a comment targets a line outside the diff; GitLab rejects a stale
`position`. **The verdict is never lost to an inline failure.** On an inline-specific
rejection the summary body posts anyway, the un-anchorable findings are folded back into
it, and the verdict **reports how many anchors were dropped**.

The count is not decoration. Without it, "no inline comments appeared" is
indistinguishable from "the anchors would not attach" — `evidence-reader-empty-on-failure`
relocated from a reader into a poster. Reporting it is what lets the reader tell the two
apart.

Anchors themselves are optional per finding (`file`/`line` on the `/2` schema, both
optional; absent ⇒ no inline comment). Every evaluator shipping today keeps working
unchanged and gains inline coverage only when it starts emitting anchors.

### Consequences

- `brain/core/methodology/vcs-contract.md` — the `prReviewComment` row records the widened
  signature, the two-endpoint GitLab mapping, and the extra `diff_refs` read.
- `brain/scripts/vcs/providers/{github,gitlab}.mjs`, `brain/scripts/review/poster.mjs`,
  `brain/scripts/review/verdict.mjs`, `brain/scripts/review/lib/parse-verdict.mjs`.
- `brain/scripts/vcs/providers/vcs.contract.test.mjs` forces parity **including the
  un-anchorable fallback** — a provider that silently no-ops on `comments` fails.

### What this amendment deliberately does NOT decide

`validateSchemaV2` (`brain/scripts/review/lib/schema-v2.mjs`) is exported and **called
nowhere in production**. Wiring it into `buildVerdict` would change what brain refuses to
post, which is a decision that deserves a ticket where it is the subject rather than a
line item inside a feature. Ruled out of this change by the maintainer (#405 design D6,
option b); the validator's inertness is ticketed separately.
