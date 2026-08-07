---
status: draft
issue: 405
epic: 313
artifact_store: openspec
topic_key: sdd/issue-405-inline-review-comments/brain-drafts/adr-0020-amendment-2
---

# DRAFT for signature — ADR-0020 Amendment 2: Amendment 1 asserted a property GitLab cannot have

`brain/**` is Tier 2 (human-only). Everything below is ready to paste; the signing commit
is the human's. Found by the cold review of PR #490 (finding B1).

## Why this amendment exists

Amendment 1 was signed 06/08/2026 and merged in `697bbf3`, **before** the GitLab half of
#405 was implemented. It asserted:

> `comments` is OPTIONAL: an array of `{ path, line, body }` posted as line-anchored
> review comments **in the same provider call** as `body`.
>
> The verb **count stays four**. No new verb, no new event, no second postable artifact.

Implementing GitLab falsified both sentences. Measured against the shipped verb with two
anchors:

```
provider calls made: 4
 1. POST .../merge_requests/1/notes        {"body":"THE VERDICT BLOCK"}
 2. GET  .../merge_requests/1
 3. POST .../merge_requests/1/discussions  {"body":"anchor 1","position":{...}}
 4. POST .../merge_requests/1/discussions  {"body":"anchor 2","position":{...}}
```

Four calls, three postable artifacts. This is not a defect in the implementation — GitLab
discussions are **one per position**, so N anchors are N+1 calls whatever the order. It is
a defect in the amendment: it took GitHub's atomic payload, which was the only provider
measured at the time, and wrote it down as the port's contract.

The spec (REQ-405-5), the design (D5) and the drafted `vcs-contract.md` row were all
corrected when the implementation falsified them. The ADR that outranks them was not, and
that is the finding: the change corrected every artefact it owned and none of the one with
authority over them.

## The correction

**Replace** the verb-contract row and the sentence under it (currently lines 107 and 109
of `brain/project/decisions/adr-0020-reviewer-port-verbs-and-two-key-split.md`) with:

```markdown
| Verb | Contract |
| --- | --- |
| `prReviewComment({ project, number, body, comments? })` | `event: 'COMMENT'` **hardcoded** — no APPROVE code path exists, and `comments` does not change that. `comments` is OPTIONAL: an array of `{ path, line, body }` line anchors. Absent and empty are the SAME request. GitHub carries them in the SAME payload as `body` (atomic). GitLab CANNOT — discussions are one per position — so it posts the summary note FIRST, then one discussion per anchor, reading the MR's `diff_refs` in between. |

The verb **count stays four**. No new verb and no new event.

**At most ONE payload the provider ACCEPTS carries the verdict body**, on every
provider. That — not "one call" — is the invariant the anti-loop lock needs, because the
lock counts PARSEABLE VERDICTS, not posts: an inline annotation carries finding text and no
`brain-review/N` block, so `cold-boot.mjs`'s `reviews.map(parseVerdict).filter(Boolean)`
never sees it.

The "accepts" is load-bearing and was missing from the first draft of this sentence (round
5). GitHub's fallback SENDS the verdict body twice — the anchored attempt and the bare
retry — and normally only the second lands. A first call that landed server-side but exited
non-zero would post it twice for real. That is bounded rather than denied: the lock reads
the LAST parsed verdict, so a duplicate at the same head still skips. Stating the invariant
without the caveat would put in doctrine a guarantee the provider code is already more
honest about than the document.

Where the calls cannot be atomic, the ORDER follows from one rule: the verdict is the
thing that must already be safe when anything after it fails. GitHub therefore attempts
anchored and retries bare; GitLab posts the summary first and anchors after. Opposite
sequences, same rule.
```

**Then**, in the "Why widening rather than a fifth verb" section, the sentence *"Widening
therefore costs zero additional calls and keeps the verdict atomic"* must be scoped to
GitHub — it is true there and false on GitLab. Suggested: *"Widening costs zero additional
calls on GitHub and keeps its review atomic; on GitLab it costs one `diff_refs` read plus
one call per anchor, which is the floor that provider's API allows."*

**And the anchor's own sentence**, currently line 155:

> Anchors themselves are optional per finding (`file`/`line` on the **`/2` schema**, both
> optional; absent ⇒ no inline comment).

is false about the shipped tree — nothing gates the anchor on protocol. A `lite` repo runs
`brain-review/1`, and a `/1` verdict carrying an anchored finding renders `file:`/`line:`
and posts inline comments. Measured through the real CLI at `lite`:

```
protocol: brain-review/1
KEYS ["body","event","comments"]
COMMENTS [{"path":"big.txt","line":3,"body":"**budget** — … 1200 > 1000 (tier: lite)"}]
```

Replace with:

```markdown
Anchors themselves are optional per finding (`file`/`line`, both optional; absent ⇒ no
inline comment) and are **not gated on protocol** — a `/1` verdict simply omits them, the
same way it omits `evidence_class`. What keeps `/1` output unchanged is that nothing emits
the field, not a protocol branch; adding one would be a second place for the two protocols
to drift. Every evaluator shipping today keeps working unchanged and gains inline coverage
only when it starts emitting anchors.
```

This sentence was found by the THIRD review round, in the draft written specifically to
correct Amendment 1's falsified claims — which had corrected two of them and walked past a
third, twelve lines further down. It is the same failure the amendment exists to fix,
committed inside the fix.

**And the failure-semantics paragraph**, currently line 146:

> **The verdict is never lost to an inline failure.** On an inline-specific rejection the
> summary body posts anyway, the un-anchorable findings are folded back into it, and the
> verdict **reports how many anchors were dropped**.

Two clauses describe an implementation that was deliberately not built (round 6). The
retry is **not** inline-specific — `github.mjs` fires it on any non-zero first exit,
because gating on a 422-shaped stderr would make a transient 5xx lose the verdict, and
REQ-405-4 ranks the verdict above the annotation. And nothing is **folded back**: the
retry re-sends the body byte-identical, because the findings were already in it. Replace
with:

```markdown
**The verdict is never lost to an inline failure.** When an anchored attempt fails — for
any reason, not only an inline-specific rejection, because gating the retry on a
422-shaped error would let a transient failure cost the verdict — the summary body posts
anyway, byte-identical and already carrying every finding, and the verdict **reports how
many anchors were dropped**. The over-count that trade accepts (a network blip read as
dropped anchors) is the deliberate cheaper error.
```

**Sign** with the same `**Signed**: <date> — Cristian Rinaldi` convention.

## The cascade — all three steps, or `decision-gate` fails

1. The ADR edit above.
2. **`brain/HOME.md:69`, in the SAME commit** — `decision-gate` enforces co-occurrence.
   Replace the parenthetical with:

   ```
   (**Amendment 1, 06/08/2026; Amendment 2, <date>** — `prReviewComment` carries optional inline `comments[]`; at most ONE payload the provider accepts carries the verdict, but GitLab needs N+1 calls — verb count and lock 2 unchanged, #405)
   ```

3. **Regenerate `AGENTS.md`** — `HOME.md` is one of the five SOURCE_DOCS, and `AGENTS.md:77`
   currently repeats the falsified "in the same call".

## What is NOT in this amendment

Lock 2 is unchanged and is deliberately restated rather than assumed. The cold review found
that lock 2 was enforced only by a source scan for the literal `APPROVE`, which a widening
walks straight past: adding `event = 'COMMENT'` as a parameter left the entire suite green,
after which `prReviewComment({ ..., event: 'APPROVE' })` posts an approval. That gap is
closed in code on PR #490 by a contract case that passes a hostile `event` and asserts the
payload still carries `COMMENT`. It needs no ADR change — the ADR always said "no parameter
selects a different event"; nothing had ever tested it that way.
