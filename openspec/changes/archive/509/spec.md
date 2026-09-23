---
status: draft
issue: 509
---

# Spec

## REQ-509-0 — the acceptance suite cannot be green having asserted nothing
The oracle's reachability MUST be asserted by a test that never skips. `node --test` exits 0 on
skips, so a suite that skips its whole acceptance set is the same colour as one that passes it.
Both the oracle AND the draft it is driven with MUST be read from history, not from the working
tree.

## REQ-509-1 — the golden fixture binds
Given the tree at `be2d143^` and the #473 amendment draft expressed in the `brain-amendment/1`
contract, `brain:promote` MUST leave `brain/project/decisions/adr-0026-governance-doctrine-tiers.md`,
`brain/HOME.md` and `AGENTS.md` **byte-identical** to the files commit `be2d143` produced, MUST
create zero commits, MUST stage exactly those three paths, and the commit command it prints MUST
pass the `commit-msg` hook. Proven RED by mutation on at least one act.

## REQ-509-2 — anchored, or refused
Every declared in-place anchor MUST leave **exactly one free occurrence** in the target at the
moment its edit is applied — free meaning not already inside an applied replacement. Any other
count refuses the whole run with nothing written, never an edit to something adjacent.
Occurrences MUST be counted including self-overlapping matches. A declared amendment number that
neither follows nor equals the number the target carries refuses. An ambiguous or missing
`brain/HOME.md` index line refuses.

## REQ-509-3 — one cascade, both target shapes
The verb MUST own §1d in one place. An ADR target gets §1c acts 1-3 plus the `brain/HOME.md`
marker plus the `AGENTS.md` regeneration; a doctrine-document target gets the same minus the
Status line and minus the `brain/HOME.md` act. `AGENTS.md` MUST be regenerated on both, and the
regenerated file MUST contain the amended text — the step `promote-529.sh` lost.

## REQ-509-4 — ADR-0028's four locks carry over verbatim
Non-TTY refusal before any read or write; no auto-accept option and zero `process.env` reads;
the git seam allowlist unchanged (`add`, `config` — never `commit`, never `push`); one exact
typed word. Each MUST be proven on the amendment branch, not inherited by assertion: a lock
proven on one branch of a dispatch is blind along the branch axis.

## REQ-509-5 — idempotence is decided over the WHOLE cascade
"Already promoted" MUST mean every act is applied — the Status line, every in-place edit, the
appended section, the `brain/HOME.md` marker AND a current `AGENTS.md`. No single act may stand
in for the others. A cascade with some acts applied and some not MUST refuse, naming each act's
state; it MUST NOT report success, and it MUST NOT silently finish someone else's partial edit.
The key MUST hold in both directions: an anchor that is a prefix of its own replacement does not
re-apply, and a replacement that already appears elsewhere in the document does not suppress a
genuine first application.

## REQ-509-9 — the verb never writes into a state it cannot stage honestly
It MUST refuse when the repository has unmerged paths (`git add` marks a conflict resolved), when
a path it would write has staged-but-uncommitted content (destroying it is unrecoverable), and
when a write path is a symlink or resolves outside the repository. Worktree-only modifications to
a write path MUST be disclosed in the plan, above the confirmation, because staging takes the
whole file.

## REQ-509-10 — a failed write leaves nothing half-applied
If any write in the cascade fails, every file already written MUST be restored to its prior bytes,
nothing MUST be staged, and the run MUST report what was rolled back. The rollback MUST be proven
against a real filesystem failure, not only through an injected seam.

## REQ-509-6 — the `AGENTS.md` compiler does not fail open
`compileAgentsMd(docs)` MUST throw on a docs map missing any `SOURCE_DOCS` key — including the
array shape a new caller reaches for first — rather than compiling empty sections. The new
caller MUST build its map by iterating `SOURCE_DOCS`, so it cannot produce one.

## REQ-509-7 — the stopgaps are gone
`promote-529.sh` and `promote-516.sh` are deleted, and a test keeps them deleted. One
implementation of the cascade, not three.

## REQ-509-8 — Tier 2
No `brain/core/**` or `brain/project/decisions/**` file is written by this change. The doctrine
this change makes stale (ADR-0028's slice-1 scope paragraph, `consolidation-protocol.md` §1c's
*"until #509 ships"* sentences) ships as amendment drafts under `brain-drafts/`, in the contract
format this change defines. The human's `brain:promote` run and commit are the signature.
