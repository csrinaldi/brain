# ADR-0020 — External-reviewer VCS port verbs + the reviewActors/approvalActors two-key split

**Status**: Accepted · **amended 07/08/2026** (Amendment 2 — see below)
**Date**: 2026-07-16 — Cristian Rinaldi

## Context

The external reviewer is real and load-bearing today but human-mediated: a human relays a
checkpoint report to the reviewer and relays the verdict back. The role — verify against the
server, rule design forks against doctrine, sequence parallel work — is mechanizable. The single
piece of judgment that must stay human is the _keystroke_ (`status:approved`, `override:*`,
`size:exception`), not the whole role.

Automating the reviewer creates one hazard that shapes everything else. `brain:protect` sets
`required_approving_review_count: 1` on `main`, and L6 (`brain/scripts/vcs/brain-writes-reviewed.mjs`)
counts any review with `state === 'APPROVED'` from a non-author, non-allow-listed login as _the_
human review of a `brain/**` write. A reviewer agent running `gh pr review --approve` would satisfy
branch protection **and** the brain-writes gate in one call — it would become a merge authorizer.
The asymmetry cannot be a rule the agent remembers; it must be structurally impossible.

A second, subtler coupling was found during cold review (finding **H0-LOCK3-DUAL**, issue #266
comment 4974795208). Today `governance.approvalActors` feeds `botAllowlist` in **two** gates with
**opposite** semantics:

- **L6** (`brain-writes-reviewed.mjs`): restrictive — an allow-listed APPROVE does **not** count as
  the human review.
- **L5** (`brain/scripts/vcs/actor-check.mjs`, `evaluateActor`): permissive — an allow-listed actor
  applying `status:approved` returns `{ level: 'pass', reason: 'allow-listed automation identity' }`.

Registering the reviewer handle in that one key would de-authorize it at L6 **and** authorize it to
self-apply `status:approved` at L5 — the exact self-authorization the design forbids, hidden behind
one config line.

## Decision

**1. Add four write verbs to the VCS port, all incapable of approving.**

| Verb                                         | Contract                                                       |
| -------------------------------------------- | -------------------------------------------------------------- |
| `prReviewComment({ project, number, body })` | `event: 'COMMENT'` **hardcoded** — no APPROVE code path exists |
| `issueComment({ project, number, body })`    | rulings on issues                                              |
| `labelAdd({ project, number, labels })`      | caller enforces the deny-set (monotonic tightening only)       |
| `labelRemove({ project, number, labels })`   | caller enforces the deny-set                                   |

Both providers (`brain/scripts/vcs/providers/github.mjs`, `.../gitlab.mjs`) implement them or the
verb-contract drift-guard turns red. Adding verbs to the port is itself a decision (this ADR +
`decision` label), by the protocol's own rule (`brain/core/methodology/vcs-contract.md`,
`brain/scripts/vcs/cli.mjs` `VERBS`).

**2. Split `governance.approvalActors` into two single-semantic keys, each read by exactly one gate.**

- `governance.reviewActors` (**NEW**) — "these identities do **not** count as the human reviewer."
  Read **only** by L6. The human-approver search excludes `author + reviewActors`. The reviewer
  handle registers **here and only here**.
- `governance.approvalActors` (**EXISTING**, semantics unchanged) — "these identities **may**
  legitimately apply `status:approved`." Read **only** by L5. The reviewer handle **never** appears
  here.

No key feeds two gates. The dual-semantics coupling is dissolved by construction, not by convention.
(Human decision, csrinaldi 2026-07-14: "la separación de la lista en dos es la correcta" — issue
#266 comment 4975121847. Durable record: `.memory/records/` `rec-1efa1893e1427623`.)

## Consequences

**The three structural locks against reviewer-as-authorizer** (any one failing leaves the other two
standing):

1. verdicts post as **COMMENT-state** reviews (`prReviewComment`, `event: 'COMMENT'`) — L6 ignores
   `COMMENTED` by construction, so a verdict cannot be miscounted as an approval;
2. the VCS adapter **never gains an approve capability** — there is no code path to emit APPROVE;
3. the reviewer handle lives in `reviewActors` (L6-only) and never in `approvalActors` (L5-only).

**Two mandatory tests gate the landing of the two-key split** (the decision does not land without
both — they belong to the implementation slice, H0-b):

- **t1** — the reviewer identity does **not** pass `actor-check` when applying `status:approved`;
- **t2** — the reviewer identity **is** excluded from the L6 human-approver count.

Because `actor-check` independently rejects a misapplied `status:approved` from any identity not in
`approvalActors` — and the reviewer is never in `approvalActors` — a deny-set bug in the caller is
still caught downstream. The claim "actor-check independently catches a misapplied `status:approved`"
becomes true again for the reviewer identity precisely because of the split.

**Labels: monotonic tightening only.** The reviewer may apply labels that make a gate stricter
(`decision`, `seq:*`, `reviewed:*`, `needs-ruling`) via `labelAdd`, and never ones that loosen
(`size:exception`, `skip:memory-gate`) or unlock (`status:approved`). The deny-set is hardcoded in
the caller, not left to the model; L5 `actor-check` is the independent backstop.

**Files touched at implementation (H0-b):** `brain/scripts/vcs/cli.mjs` (`VERBS`),
`brain/scripts/vcs/providers/{github,gitlab}.mjs`, `brain/scripts/vcs/actor-check.mjs`,
`brain/scripts/vcs/brain-writes-reviewed.mjs`, `brain.config.json` (the two governance keys),
`brain/core/methodology/vcs-contract.md`.

## Amendment 1 — `prReviewComment` carries inline comments; the verb count and lock 2 do not move (issue #405)

**Signed**: 06/08/2026 — Cristian Rinaldi

M3's exit criterion is *"a developer sees inline code review in the PR, on GitHub and
GitLab."* The four verbs above post a single fenced block and nothing else, so a reviewer
that reports `src/a.mjs:42` inside a YAML block leaves the developer to go find the line
themselves. The milestone does not hold.

**Amended verb contract:**

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

### Why widening rather than a fifth verb

Measured, not preferred. GitHub's `POST repos/{project}/pulls/{number}/reviews` — the
endpoint `prReviewComment` already calls — accepts `body`, `event` and `comments[]` in
**one** payload. Widening costs zero additional calls on GitHub and keeps its review
atomic; on GitLab it costs one `diff_refs` read plus one call per anchor, which is the
floor that provider's API allows.

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
`position`. **The verdict is never lost to an inline failure.** When an anchored attempt
fails — for any reason, not only an inline-specific rejection, because gating the retry on
a 422-shaped error would let a transient failure cost the verdict — the summary body posts
anyway, byte-identical and already carrying every finding, and the verdict **reports how
many anchors were dropped**. The over-count that trade accepts (a network blip read as
dropped anchors) is the deliberate cheaper error.

The count is not decoration. Without it, "no inline comments appeared" is
indistinguishable from "the anchors would not attach" — `evidence-reader-empty-on-failure`
relocated from a reader into a poster. Reporting it is what lets the reader tell the two
apart.

Anchors themselves are optional per finding (`file`/`line`, both optional; absent ⇒ no
inline comment) and are **not gated on protocol** — a `/1` verdict simply omits them, the
same way it omits `evidence_class`. What keeps `/1` output unchanged is that nothing emits
the field, not a protocol branch; adding one would be a second place for the two protocols
to drift. Every evaluator shipping today keeps working unchanged and gains inline coverage
only when it starts emitting anchors.

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

## Amendment 2 — Amendment 1 asserted a property GitLab cannot have (issue #405)

**Signed**: 07/08/2026 — Cristian Rinaldi

Amendment 1 was signed 06/08/2026 and merged in `697bbf3`, **before** the GitLab half of
#405 was implemented. It asserted that `comments` post as line-anchored review comments
*"in the same provider call"* as `body`, and that there is *"no second postable
artifact"*. Implementing GitLab falsified both sentences. Measured against the shipped
verb with two anchors:

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
that is the finding (cold review of PR #490, finding B1): the change corrected every
artefact it owned and none of the one with authority over them.

**What this amendment rewrites in place, per `consolidation-protocol.md` §1c:**

1. The Amendment 1 verb-contract row and the sentence under it. The invariant is now **"at
   most ONE payload the provider ACCEPTS carries the verdict body"** — not "one call" —
   which is what the anti-loop lock actually needs, with the duplicate-send bound stated
   rather than denied.
2. The *"Widening therefore costs zero additional calls"* sentence, scoped to GitHub — it
   is true there and false on GitLab, where the floor is one `diff_refs` read plus one
   call per anchor.
3. The failure-semantics paragraph. The retry is **not** inline-specific — gating it on a
   422-shaped error would let a transient failure cost the verdict — and nothing is
   "folded back": the retry re-sends the body byte-identical, because the findings were
   already in it.
4. The anchor-optionality sentence. Anchors are **not gated on protocol** — a `/1` verdict
   carrying an anchored finding posts inline comments today, measured through the real CLI
   at `lite`. This third falsified claim was found by the third review round, inside the
   draft written specifically to correct the first two — the same failure the amendment
   exists to fix, committed inside the fix.

**Accepted losses, stated so they are chosen rather than discovered:** a first provider
call that lands server-side but exits non-zero posts the verdict body twice (bounded: the
anti-loop lock reads the LAST parsed verdict, so a duplicate at the same head still
skips); and an anchored attempt that fails for a transient, non-inline reason reads as
dropped anchors in the verdict — the over-count is the deliberate cheaper error.

Lock 2 is unchanged and needs no ADR change — the ADR always said no parameter selects a
different event. What was missing was the test: PR #490 adds a contract case that passes a
hostile `event` and asserts every payload the verb sends — all **three** sites — still
carries `COMMENT`.

## References

- Issue #266 body (Track H design, rev-2 APPROVE).
- rev-1 verdict / finding H0-LOCK3-DUAL: issue #266 comment 4974795208.
- Human decision: issue #266 comment 4975121847.
- rev-2 APPROVE + binding conditions: issue #266 comment 4986616224.
- Durable records: `rec-1efa1893e1427623` (decision), `rec-ed1c325e24addf22` (design-off meta-finding),
  `rec-04902454cc5ffa88`.
