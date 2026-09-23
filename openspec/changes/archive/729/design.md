# Design — ADR-0006 Amendment 2 (issue #729)

## D1 — Amend in place, do not supersede again

ADR-0006 is already SUPERSEDED by ADR-0030. What is wrong is the amendment's own
prose, not the decision. A third ADR would record no new decision, so this is a §1c
in-place amendment on the existing artefact.

## D2 — Three `amend-find` anchors, each verified unique before drafting

`assessEdit` refuses an anchor found ≠ 1 times. All three were counted against the
target before the draft was written, rather than discovered at promote time.

## D3 — The expired paragraph is terminated, not removed

Deleting it would remove #590's measurement of what shipping-before-recording costs —
the reasoning that made the interval acceptable. A marker naming what expired, and
when, keeps the reasoning and stops the misreading.

## D4 — Dated measurements are out of scope, and said so explicitly

Rows under `measured on main @ 3dfbdd4` stay as measured. One is still true
(`@csrinaldi/brain` → `404`); one was falsified by PR #728 the same day
(`run.sh` still exits 2 without `VCS_TOKEN`). Both stay.

A dated measurement is a record of what the amendment reasoned from. Correcting it
would leave the conclusion standing on evidence that no longer appears anywhere.
ADR-0030 sets this precedent — it annotates `@csrinaldi/brain`'s 404 rather than
replacing it.

## D5 — Verify the draft without running the verb

`brain:promote` refuses without a TTY, deliberately. The draft is validated by calling
`parseAmendmentDraft` and `planAmendment` in process — read-only, no writes — which
yields the exact Status line, HOME marker, signed stamp and amended regions the
promotion will produce.

Faking a pty to run the verb unattended would defeat a control that exists on purpose.

## D6 — The agent stops at the draft

Two independent controls say so: Tier 3 in `agent-authorities.md`, and the verb's TTY
refusal. The split is visible in the commit graph — draft authored by the agent's
branch work, promotion authored and signed by the maintainer.
