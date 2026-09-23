---
status: draft
issue: 599
---

# Design — adr-0023-citation-gap (issue 599)

Binding input: `proposal.md` (branch **(2) reword**, measured). This file decides
the exact text, the exact deletion, and the order the implementer runs things in.

Note on this file: `openspec/` is in `UNSCANNED_ROOTS`
(`test/adr-citation-resolves.e2e.test.mjs:71`), so the uppercase `ADR-0023`
token used below for discussion is invisible to the check. `docs/**` is not —
that is the whole ticket.

## D1 — Reword the citations; write no ADR; `0023` stays RESERVED for #312

Maintainer ruling, and the proposal's measurement backs it: nothing the draft
proposes has shipped (`roles/` absent, `VALID_OPS = ['init']`, no parity test).
An ADR written now would record a decision nobody made.

So `0023` is **not** a permanent gap and **not** a free number. Each reworded
line must carry three facts — the draft exists, the number is reserved, #312
owns it — per spec REQ-599-2. That is the difference between this change and a
cosmetic token swap: the reader who followed the old pointer landed on nothing;
the reader who follows the new one lands on the draft and on the ticket that
will turn it into doctrine.

## D2 — The safe form is the lowercase draft path, not a rephrased token

`CITATION_RE = /ADR-(\d{4})(?!\d)/g` is case-sensitive by design and says so
(limit 3, lines 34–37): a lowercase prose citation is a miss it will not report.
So the replacement form is the draft's own path, lowercase:

```
brain-drafts/adr-0023-sdd-role-port.md
```

This is not a new trick invented here — it is already live and already green.
`docs/inbox/AGENT-PRIORITY-HANDOFF.md` uses exactly this form at lines 107 and
198 (and the promotion-target path at line 100 inside a fenced block), sits
under `docs/`, which is a `REQUIRED_ROOTS` entry, and contributes **zero**
findings today. The form is measured, not assumed.

Two consequences, stated rather than discovered:

- The path is more useful than the token was. `ADR-0023` pointed at a file that
  does not exist; `brain-drafts/adr-0023-sdd-role-port.md` points at a file that
  does, and the reader can open it.
- The exemption is not moved, it is dissolved. Nothing new is added to any
  registry (D4), and no `ADR-NNNN` token is left behind for the scan to forgive.

Rejected sub-alternatives: `ADR 0023` (no hyphen) and `ADR-23` both dodge the
regex while still naming a record that cannot be opened — they defeat the check
instead of satisfying the reader, which is the defect class this repo's citation
suite exists to kill.

## D3 — The exact replacement text, per site

Three sites, verified by reading the files in this worktree. Line numbers are
current as of this design; the implementer matches on the quoted text, not on
the number.

### Site A — `docs/inbox/MASTER-PLAN-1.0.md:72` (milestone table row)

Current:

```
| M5 | Role-as-port (C) | #312 + ADR-0023 (draft in `brain-drafts/`) |
```

Replacement (single line — markdown table rows cannot wrap):

```
| M5 | Role-as-port (C) | #312 — owns the decision record; `0023` reserved, unpromoted draft at `brain-drafts/adr-0023-sdd-role-port.md` |
```

Style check: neighbouring rows already run long and already mix `#NNN`, `—` and
`·` (line 68 is longer than this). The "Tickets" column keeps leading with the
ticket, which is what the column is for.

### Site B — `docs/inbox/MASTER-PLAN-1.0.md:93` (§4 key decision 1, prose)

Current (line 93, closing the item that starts at line 91):

```
   implementer, not a replacement. #312 · ADR-0023 (draft).
```

Replacement (two lines; keeps the file's 3-space continuation indent and its
~100-column wrap):

```
   implementer, not a replacement. #312 · number `0023` reserved for it; the only artifact today is
   the unpromoted draft `brain-drafts/adr-0023-sdd-role-port.md`.
```

Style check: the section's items are numbered prose ending in a `·`-separated
reference tail (items 2–4 do the same). The tail keeps `#312` first and drops
the bare `(draft)` parenthetical in favour of saying what "draft" means.

### Site C — `docs/inbox/brain-v2-epic-plan.md:114` (Spanish — stays Spanish)

Current, under the heading `### M5 — Role-as-port (C) · #312 — la prueba de neutralidad`:

```
- Ratificar **ADR-0023** (promover el draft a `decisions/` + HOME.md).
```

Replacement (three lines, neutral/professional Spanish, infinitive-led like
every other bullet in that file):

```
- Escribir el ADR del port de roles desde el código ya entregado y promoverlo (`decisions/` +
  HOME.md): hoy solo existe el draft `brain-drafts/adr-0023-sdd-role-port.md` y el número `0023`
  queda reservado para este ticket (#312).
```

Two deliberate changes beyond the token:

- **"Ratificar" → "Escribir … desde el código ya entregado y promoverlo."**
  "Ratificar" implies the decision is made and only needs a signature. The
  measurement says the opposite. The bullet now describes the work #312 actually
  owes.
- **`(#312)` is restated inline** even though the heading two lines up names it,
  so the bullet survives being quoted or moved on its own.

Register: no voseo, no regionalism — it matches the surrounding bullets.

## D4 — `KNOWN_GAPS` surgery: delete exactly two entries, keep the docblock

Current, `test/adr-citation-resolves.e2e.test.mjs:145–150`:

```js
const KNOWN_GAPS = Object.freeze([
  { file: 'docs/inbox/MASTER-PLAN-1.0.md', number: '0023',
    why: 'ADR-0023 (SDD role port) drafted at brain-drafts/adr-0023-sdd-role-port.md, never promoted — owned by #599' },
  { file: 'docs/inbox/brain-v2-epic-plan.md', number: '0023',
    why: 'the second citation of the same unpromoted draft — owned by #599' },
]);
```

End state:

```js
const KNOWN_GAPS = Object.freeze([]);
```

Decided:

- **Both object literals go, and only they.** They are the entire contents; #599
  is the ticket that owned both, and it is being closed by repair rather than by
  re-baselining.
- **The docblock at lines 126–144 is NOT edited.** It states the registry's
  *contract* (every entry names an issue; `ADR-0018` is never baselined), not
  its inventory. Deleting it would delete the rule that makes the next entry
  cost a ticket. Its `ADR-0018` mentions are safe: this file excludes itself
  from its own scan (`SELF`, line 110), which is exactly why the registries are
  allowed to name the numbers they exempt.
- **The array stays declared and frozen, not removed.** Three call sites depend
  on it existing: `registry` spread (line 222), the `0018` baseline guard
  (line 346), and the per-entry ticket assertion (lines 353–358). All three are
  vacuously green over an empty array and must stay in place for the next gap.

An empty honesty budget is the intended end state, not an oversight worth
commenting on: the file already explains what the registry is for.

## D5 — The reword and the deletion are atomic; the test enforces it in both directions

Read off the code, not asserted:

- **Delete the entries early (docs untouched)** → the two `0023` citations are
  in `unresolved` and no longer covered by `registry`, so
  `rot = unresolved.filter(c => !registry.some(e => covers(e, c)))` (line 281)
  is non-empty and *every cited `ADR-NNNN` resolves* (line 280) goes red.
- **Reword the docs and keep the entries** → the entries stop matching any
  unresolved citation, so
  `stale = registry.filter(e => !unresolved.some(c => covers(e, c)))` (line 335)
  is non-empty and *no registry entry outlives the citation it exempts*
  (line 334) goes red.

There is no ordering that keeps the tree green through a split. Hence: one
commit, three files.

A sharper corollary the coupling section only gestures at. One `KNOWN_GAPS`
entry covers a `(file, number)` **pair**, not a line (`covers`, line 214). So if
the implementer rewords only line 72 and *keeps* the entry, the staleness guard
still passes — line 93 keeps the pair unresolved and the entry alive. The
half-done reword is silently accepted. It is the **deletion** that forces both
MASTER-PLAN lines to be done, which is the second reason the deletion cannot be
deferred.

## D6 — Verification order, red-first

The suite already exists, so the strict-TDD red comes from removing the
exemption before writing the fix. Sequence, in the working tree of
`/home/gandalf/IA/brain-issue-599`:

1. **Red / negative control.** Apply D4 *only* — delete the two entries, touch
   no doc. Run the file directly:
   `node --test test/adr-citation-resolves.e2e.test.mjs`.
   Expect *every cited `ADR-NNNN` resolves* to FAIL and name exactly three
   sites: `docs/inbox/MASTER-PLAN-1.0.md:72`, `:93`,
   `docs/inbox/brain-v2-epic-plan.md:114`. Fewer than three means a citation
   moved and the design's site list is stale — stop and re-measure. Paste the
   failure into `apply-progress`; this is the evidence the test has teeth on
   these exact lines, and it is the only proof the reword did the work rather
   than the deletion hiding it.
2. **Green.** Apply D3's three replacements. Re-run the same file. Expect all 10
   tests green, including the staleness guard and the vacuity guards (`scanned >
   100`, `citations.length > 100`, `signed.size >= 25` — none of these move,
   since the citations are rephrased, not deleted from the surface).
3. **Full gate.** `npm test`.
4. **Commit once**, with steps 1–3 already green. The red from step 1 is
   captured as pasted output, never as a committed state: D5 forbids landing a
   split.

Optional confirmation, cheap and worth 30 seconds: re-add either deleted entry
after step 2 and re-run — the staleness guard must go red, proving the guard
covers the deletion as well as the reword. Revert immediately.

Expected end state: `KNOWN_GAPS` empty, no `0023` finding anywhere, no new
exemption of any kind.

## D7 — Rejected alternatives

- **Write ADR-0023 now (#590's "write it from the code" pattern).** Rejected on
  measurement, not taste: there is no code to write it from — `roles/` does not
  exist, `brain/scripts/harness/cli.mjs:99` still declares
  `VALID_OPS = ['init']`, `backends/gentle-ai.mjs` has no
  `model_tier`/`reads`/`writes` surface. An ADR authored ahead of its mechanism
  documents a decision nobody made, and it would go stale the moment #312
  actually decides. #590 could use this pattern because ADR-0018's mechanism was
  already shipped and running in CI.
- **Record `0023` as a permanent gap (keep or restate `KNOWN_GAPS`).**
  Rejected by maintainer ruling: the number is RESERVED for #312, not
  abandoned. And the registry's own docblock says what a permanent entry means —
  "real rot this ticket does not repair" — which is false here, since #599 is
  the ticket that repairs it.
- **Add a new exemption mechanism (a `DRAFT_CITATIONS` registry, or widening
  `UNSCANNED_ROOTS` to cover `docs/inbox/`).** Rejected as the worst of the
  three: it leaves the reader following a pointer to nothing and merely teaches
  the checker to stop mentioning it. Widening `UNSCANNED_ROOTS` additionally
  requires deleting a `REQUIRED_ROOTS` entry (`docs/` — "adoption and planning
  documents readers actually follow"), which is precisely the visible act
  finding G1 built that guard to force.
- **Renumber the draft to a free number.** Not requested, and it would break
  three archived artifacts that already reserve `0023` for M5/#312 (e.g.
  `openspec/changes/archive/2026-08-01-issue-358-q5-doctrine-tiers/.../HOME-entry-adr-0026.md:24`).
  The reservation is the cheaper invariant to keep.

## Testing

| Decision | How it is verified |
|----------|--------------------|
| D1 (no ADR written, `0023` reserved) | Spec REQ-599-4 diff-scope check: `git diff --name-only` lists exactly the three files; `brain/project/decisions/` is unchanged and still has no `adr-0023-*.md` |
| D2 (lowercase draft-path form) | *every cited `ADR-NNNN` resolves* (line 280) green after the reword — the form is what makes it green without an exemption |
| D3 site A + site B | Step 1's red names `:72` and `:93` separately; step 2 clears both. Partial reword is caught by the same check (spec REQ-599-3 scenario 1) |
| D3 site C (Spanish preserved) | Human read of the diff — no automated check covers register. The bullet must stay infinitive-led and voseo-free |
| D4 (exactly two entries deleted, docblock kept) | *KNOWN_GAPS only shrinks — ADR-0018 is never baselined* (line 343) still runs; diff shows 6 lines removed from the array and nothing removed from lines 126–144 |
| D5 (atomicity) | Step 1 red proves the delete-first direction; the optional re-add probe proves the reword-first direction (*no registry entry outlives the citation it exempts*, line 334) |
| D6 (order + gate) | `node --test test/adr-citation-resolves.e2e.test.mjs` green (10/10), then `npm test` green over the tree |
| Scan did not silently narrow | Vacuity guards (line 226) and `REQUIRED_ROOTS` (line 257) — both must stay green; `docs/` must still contribute scanned files |

## Hot micro-decisions

- Line budget: `docs/**` is not in `brain.config.json` `governance.ignoreList`
  (which does list `**/*.test.mjs`), so only the doc edits count — roughly 6
  changed lines across two files. `size:exception` is not in play; single PR, no
  chain.
- The design quotes the uppercase token freely because `openspec/` is unscanned.
  The implementer must not copy that habit into `docs/**` — including into any
  commit message body that later gets pasted into a doc.
- `brain-drafts/adr-0023-sdd-role-port.md` is untouched, per proposal scope. It
  is also known-malformed (two `**Status**:` lines; `promote-guards.mjs` rejects
  it — see `docs/inbox/AGENT-PRIORITY-HANDOFF.md:99–109`). That repair belongs to
  whoever promotes it, i.e. #312.
- The draft-link guard (line 308) reads `brain-drafts/` drafts for sibling links.
  This change adds no link inside the draft, so that check is unaffected — worth
  knowing only because it is the one place `brain-drafts/` *is* read despite
  being an unscanned root.
