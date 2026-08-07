---
status: spec
issue: 405
epic: 313
artifact_store: openspec
topic_key: sdd/issue-405-inline-review-comments/spec
---

# Spec — inline per-line review comments (issue #405)

Requirements tagged `REQ-405-N`. Provisional until the ADR-0020 amendment is ratified
and D6 is ruled — both are human acts, and the requirements below that depend on them
are marked.

## REQ-405-1 — the port verb widens; the verb count and lock 2 do not move

`prReviewComment({ project, number, body, comments? })`. `comments` is optional and
absent-by-default, so every existing caller is unaffected.

`event: 'COMMENT'` stays hardcoded on GitHub with no parameter, flag or branch reaching
it (ADR-0020 lock 2 / REQ-266-3). Asserted at the level that cannot rot: a test that
inspects the posted payload, plus the existing drift-guard on the verb list.

## REQ-405-2 — a finding carries an OPTIONAL anchor, and no anchor means no comment

`file` (string) and `line` (integer) on a `/2` finding. Both optional. A finding lacking
either produces **no** inline comment and is unaffected in every other respect.

This is what keeps the change additive: every evaluator shipping today keeps working
unchanged and gains inline coverage only when it starts emitting anchors. A test pins
that a legacy finding — no `file`, no `line` — round-trips and posts exactly as it does
today.

## REQ-405-3 — the anchor survives the render/parse round trip

`file`/`line` are scalar entry fields, so they flow through `yamlScalar` /
`unyamlScalar` and `ENTRY_CONT_RE` like `cites`. Pinned by a round-trip test over the
REAL renderer and parser, not hand-built strings — the #381 class exists precisely
because a field was rendered in one encoding and read in another.

Depends on PR #478 (issue #452), which owns that pair today.

## REQ-405-4 — an un-anchorable comment NEVER costs the verdict

The load-bearing requirement. When a provider rejects the inline payload (GitHub 422 for
a line outside the diff; GitLab a stale `position`):

1. the summary block **is still posted**, at the same head;
2. the un-anchorable findings appear **in** that block;
3. the verdict **reports the count** of dropped anchors.

Point 3 is not decoration. Without it, "no inline comments appeared" is indistinguishable
from "the anchors would not attach" — `evidence-reader-empty-on-failure` relocated into
the poster. The count is the reader's only way to tell the two apart.

Proven by making the provider stub reject the inline payload: the failure path IS the
deliverable, not an edge case, so it is exercised at the same level as the success path.

## REQ-405-5 — exactly ONE parseable verdict, so the anti-loop lock is untouched

**Corrected during implementation.** This requirement first read *"inline comments post
in the SAME provider call as the summary body"* — true of GitHub, and **structurally
impossible on GitLab**, where discussions are one-per-position, so N anchors mean N+1
calls whatever the order. A requirement only one provider can satisfy is not a contract;
it is GitHub's implementation promoted to doctrine.

The invariant that is provider-agnostic, and the one the anti-loop lock actually needs:

**Exactly one payload carries the verdict body.** The lock counts PARSEABLE VERDICTS,
not posts — `cold-boot.mjs:123` runs every review body through `parseVerdict` and
`.filter(Boolean)`s the nulls, so an inline annotation, which carries finding text and no
`brain-review/N` block, is invisible to it.

Per provider, then:

- **GitHub** — `comments[]` rides the existing `/reviews` payload. One call, atomic:
  either the whole review posts or none of it does.
- **GitLab** — the summary note goes **first**, then one discussion per anchor. The order
  is the opposite of GitHub's (which attempts anchored and retries bare) and follows from
  the same rule: when the calls cannot be atomic, the verdict must be the one that is
  already safe when anything after it fails.

Asserted on the payloads actually SENT — that the anchor reaches the provider, and that
exactly one payload carries the verdict body. Plus behaviourally: a run that posts inline
comments must still skip with `anti-loop` on a second invocation at the same head.

## REQ-405-6 — parity is forced by the contract suite, not by inspection

`vcs.contract.test.mjs` requires BOTH providers to satisfy REQ-405-1, -2 and -4. The
implementations differ by design (GitHub widens one payload; GitLab switches from
`notes` to `discussions` and fetches `diff_refs` first) — the contract is what makes
that asymmetry safe rather than accidental. A provider that silently no-ops on
`comments` fails the suite.

## REQ-405-7 — the contract document is DRAFTED, not written

`brain/core/methodology/vcs-contract.md`'s `prReviewComment` row must record the widened
signature, the two-endpoint GitLab mapping, and the extra `diff_refs` read.

`brain/**` is Tier 2 — **human-only**. The agent writes
`openspec/changes/issue-405-inline-review-comments/brain-drafts/vcs-contract-row.md` and
the human promotes it. The agent must never write the destination file.

## REQ-405-8 — the e2e proves the anchor reaches the wire, and that today NOTHING sends one

On #409's harness (`test/review-regulated/`), whose README already names this change as
its landing pad: assert the captured `POST …/reviews` payload's `comments` array.

**Corrected during implementation — the second requirement on this change to be falsified
by building it** (the first was REQ-405-5). This one read *"the e2e proves a developer
actually sees them"* and predicted the harness would need no change. Both halves were
wrong, for one reason this spec had never stated plainly:

> **No evaluator emits `file`/`line`.** REQ-405-2 made the anchor optional precisely so
> evaluators could adopt it one at a time, and none has. A CLI-level run therefore cannot
> produce an anchored finding, and no assertion over a real `brain:review` invocation can
> observe a developer seeing an inline comment.

What is provable today, and what this requirement now demands:

1. **The wire path carries an anchor.** The anchored cases drive the REAL `postVerdict`
   against the harness's `gh` stub: poster → `getVcs` → `github.mjs` → `spawnSync('gh')`
   → the payload captured on disk. Only the findings array comes from the test, which is
   exactly the interface #405 widened.
2. **A refused anchor never costs the verdict.** `GH_STUB_REJECT_INLINE=1` makes the stub
   422 any payload carrying `comments`, so the fallback runs against the real binary
   boundary and not only against an in-process fake. Refusals land in a separate
   `posted/rejected.jsonl` — sharing the file would let a test counting posts read a
   refusal as a success.
3. **The absence is honest and load-bearing.** A CLI-level tripwire asserts the real run
   posts no `comments` key, against a non-empty findings list so it cannot pass
   vacuously. It is the detector for the first evaluator that anchors.

Row 3 is not a consolation prize — it is what caught the defect. Patching `tranche.mjs`
to anchor its budget finding left the posted payload's keys at `["body","event"]`, because
`cli.mjs` never passed `findings` to `postVerdict`. The poster was wired and its only
production caller was not, and every unit and contract test on this branch was green
throughout. With the wiring fixed the same mutation yields `["body","event","comments"]`.

The CLI→poster link itself is pinned by a **source-level** drift guard, labelled as such:
with no evaluator anchoring there is no seam through which a test can put an anchored
finding into a real `main()` run. It is scheduled for deletion the day one does.

### The residual, stated rather than implied

This change ships an inline path with **no producer**: it is reachable from production
only once an evaluator starts anchoring. That is the same shape as `validateSchemaV2`'s
inertness (#483), and it must not be left for a reviewer to discover by reading the code.
Whether to ship it as plumbing for #408, to widen the anchor so `tier2-frontier` — which
already knows the file — becomes the first producer, or to file a follow-up, is a **scope
ruling for the maintainer**, not an agent decision (#473).

## Pending human acts — NOT agent decisions

- **The ADR-0020 amendment** recording D1–D5. Amending an ADR is a three-step cascade
  (ADR → `brain/HOME.md` → regenerate `AGENTS.md`).
- ~~**D6**~~ — **RULED (b), 2026-08-06.** The validator stays untouched here; its
  inertness is **#483**. What replaces "validator coverage" as this change's schema
  evidence: REQ-405-3's round trip over the REAL renderer/parser, and REQ-405-4's
  poster-side anchor validation — both of which run in production, which the validator
  does not.
