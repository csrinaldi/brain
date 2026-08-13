---
status: draft
issue: 629
---

# Spec — ADR-0030 reachability amendment (issue 629)

## REQ-629-1 — Reachability is a named cost

The amendment states that the registry install requires **registry access**,
a requirement the git-URL install did not have, and that ADR-0030 records this
nowhere (measured: zero mentions of mirror / firewall / air-gap / proxy /
offline / registry access).

## REQ-629-2 — The git-URL path is recorded as surviving, with evidence

Not asserted — measured. 433 files, 5.5 MB, `files` honoured, no `.memory/`,
`openspec/`, `test/`, `docs/`, `.brain-source` or `.git`; works under
`private: true`; lands under the `name` in `package.json`, so post-rename both
transports resolve to the same directory.

## REQ-629-3 — Unreachable is a distinct verdict

Any check that resolves "is there a newer version" must distinguish **up to
date**, **a newer version exists**, and **the registry could not be reached**.
Collapsing the third into "no network" or into silence is
`evidence-reader-empty-on-failure`.

## REQ-629-4 — The decision is not reopened

The amendment opens by stating what it does NOT change. The registry remains the
distribution mechanism; ADR-0006 stays superseded by ADR-0030 and is not touched.

## REQ-629-5 — A reader who never scrolls to the amendment is not misled

§1c. Four in-place edits: the install code block, the `day-start` bullet in
Decision 3, the *Never do* list, and the Consequences Positive. Two are
annotations on passages that are incomplete as written; two ADD rules to a list,
because a rule that exists only inside an amendment section is a rule nobody
applies.

## REQ-629-6 — The draft is a draft

Nothing under `brain/project/decisions/` or `brain/HOME.md` is edited by this
change. `brain:promote` performs §1c's acts and stages them; the human's commit
is the signature (ADR-0028).

## REQ-629-7 — Every anchor resolves exactly once

Verified against the real target before delivery: each of the four
`amend-find` blocks occurs **1** time, each `amend-replace` occurs **0** times
(idempotence), and `planAmendment` renders **7 acts**, all `pending`.
