---
status: draft
issue: 405
epic: 313
artifact_store: openspec
topic_key: sdd/issue-405-inline-review-comments/brain-drafts/reviewer-protocol-anchor
---

# DRAFT for human promotion — the `file`/`line` anchor in `reviewer-protocol.md` §6

`brain/**` is Tier 2 (human-only). This is the agent's draft; a human promotes it.

Found by the cold review of PR #490, round 2 (C-6). The change drafted the `vcs-contract.md`
row and the ADR amendment and drafted **nothing** for the document §6 itself names as the
schema authority — *"both are defined in this section"* — while adding two per-finding fields
to that schema.

## The correction the round also forced

REQ-405-2 said the anchor is *"on a `/2` finding"*. Measured, it is not gated on protocol:

```
$ node -e "buildVerdict({headSha:'abc123', conclusion:'REVISE',  /* no protocol → /1 */
           findings:[{id:'anchored', severity:'blocker', evidence:'e', cites:'c', file:'a.mjs', line:42}]})"
protocol: brain-review/1
findings:
  - id: anchored
    …
    file: a.mjs
    line: 42
```

That is **correct behaviour and a wrong requirement**, and the repo already settled the
question one field over. `renderVerdict` emits `evidence_class`/`causal_disposition` on the
same terms — `if (f.evidence_class)`, never gated on protocol — and `cli.mjs` records why:
gating on protocol is not what keeps `/1` output unchanged; **not emitting the field** is.
No evaluator emits an anchor, so `/1` output is byte-for-byte what it was, and the day one
does, the anchor is as meaningful on `/1` as on `/2`.

So REQ-405-2 is corrected in the spec rather than the code being gated to match it. This
draft records the schema half of that decision.

## §4 — the verb table, and the return-shape sentence above it

Found by the FOURTH review round. §4 is the **third** copy of this signature — after
`vcs-contract.md:41` (drafted as T11b) and `ADR-0020:107` (drafted as Amendment 2) — and
was the only one with no draft, in the very file this change had already opened a draft
for. The reason it matters is the argument the contract-row draft already makes: *the row
is where a future reader checks what may reach `event`.*

**Line 121** currently reads:

```markdown
| `prReviewComment` | `({ project, number, body })` | `event: 'COMMENT'` **hardcoded** — no APPROVE path exists in code (lock 2) |
```

Replace with:

```markdown
| `prReviewComment` | `({ project, number, body, comments? })` | `event: 'COMMENT'` **hardcoded** — no APPROVE path exists in code, and `comments` does not reach it (lock 2, asserted against a hostile `event` argument). `comments` is an optional array of `{ path, line, body }` anchors; absent ≡ empty |
```

**Line 116** currently reads *"Normalized returns match the port's existing
`{ url } | { url: null, error }` / never-throws discipline"*. The return set gained a third
member. Replace with:

```markdown
returns match the port's existing `{ url } | { url: null, error }` / never-throws
discipline, plus `{ url, inlineDropped }` when a provider accepted the verdict and refused
some or all of its inline anchors (#405 — the count is ABSENT when nothing was dropped,
never 0)
```

## §6.1 `brain-review/1` — add after the `head_sha` bullet

```markdown
- **`file` / `line` are OPTIONAL, on both protocols** (issue #405). When a finding in
  `findings[]` carries both, the poster anchors an inline comment at that position on the
  diff; a finding with neither, or with only one of them, posts exactly as it did before
  and is unaffected in every other respect. **An anchor on a `follow_ups[]` entry renders
  but is never posted inline** — see the §6.2 note below. Like `evidence_class`, they are not gated on protocol — a `/1`
  verdict simply omits them, which is what keeps `/1` output unchanged, and the emitter has
  no protocol branch to drift.
```

## §6.2 `brain-review/2` — add to BOTH yaml blocks

`findings[]` and `follow_ups[]` alike, since `renderVerdict` emits the pair in both branches:

```yaml
    file: "<path as it appears in the diff>"     # optional, #405
    line: <integer>                              # optional, #405 — both or neither
```

And after the `causal_disposition` bullet:

```markdown
- **`file` / `line`** anchor the finding to a position in the diff. Both or neither: a half
  anchor is not an anchor, and the poster drops it rather than spend the un-anchorable
  fallback on a comment already known not to attach. The value travels as a scalar through
  the same `yamlScalar`/`unyamlScalar` pair as `cites`, so `line` comes back from
  `parseVerdict` as TEXT — consumers coerce, and `deriveInlineComments` does.
- **A `follow_ups[]` anchor renders and is NOT posted inline.** The renderer emits the pair
  in both branches; the poster receives only `findings[]`. That is deliberate and it
  follows from the admission rule directly above: a follow-up is `pre-existing` or
  `base-only`, which is the verdict's own statement that it is not this change's doing.
  Anchoring it would put a comment on a line in this author's diff about a defect the same
  verdict says they did not introduce. The follow-up stays in the summary block, where the
  annotation that makes it non-blocking travels with it.
  (An earlier version of this draft said the opposite — that anchors work in both blocks —
  while the shipped poster did what is described here. Found in round 4; the behaviour was
  right and undocumented, and the document about to become authority was wrong.)
```

## What this draft deliberately does NOT add

No statement that a developer sees inline comments today. **No evaluator emits an anchor**
(#408 owns the first producer, ruled by the maintainer), so the schema is the port's, not
yet the reviewer's. Writing it the other way would put in the authority document the exact
claim REQ-405-8 had to be corrected for making.
