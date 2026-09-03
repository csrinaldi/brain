# Exploration: #323 S5 — the artifact-contract guards (#713 + #752)

Off `main @ 5fb0343` (S4 merged). The roadmap's S5: "el guard 'que el
contrato de artefactos no se forkee'" — the tasks.md halves of two leaks.

## #752 — the maintainer's reframing IS the design

The unit was never the problem; the CONTRACT was. `tasks.md` carries SCOPE
(which REQs this slice claims — contract, the reviewer cannot judge without
it) and PLAN (the task list — the implementer's approach, rightly withheld:
showing it biases toward "did they do what they planned"). One file, so
withholding one withheld both — which explains every out-of-scope finding
on #682's stack without appealing to chaining at all.

The slice review's three questions, per the ruling: (1) does it deliver what
it CLAIMS — against the slice's scope, not the ticket's; (2) does it break
anything — regressions always in scope; (3) does it claim MORE than it
delivers — the class that fired twice on #682.

**The fix shape**: scope becomes a NORMALIZED, machine-parseable declaration
— the house pattern is a fenced contract block (`brain-graph/1`,
`brain-amendment/1`, `brain-migration/1` precedents): `brain-slice-scope/1`
per slice inside tasks.md, carrying the claims. The parser lives in
`sdd-layout.mjs` (the single accessor); the guard: every engine's tasks.md
must carry it or the artifact-structure check refuses — "que todos los
engines deben cumplir" is the roadmap's own wording.

## #713 — the termination rule + the stranded surface

The harness half exists already (sdd-tasks emits a matchable `Terminal PR:`
line; sdd-verify treats its absence as CRITICAL) — but "the harness is
advisory and lives outside this repo. Brain currently has no way to notice
on its own." An unterminated chain is the ABSENCE of a PR: no PR-triggered
check can fire on it; health and silence are the same reading
(evidence-reader-empty-on-failure, at the delivery layer).

**The fix shape per the ticket**: (a) the `Terminal PR:` line normalizes
INTO the scope contract (one block declares claims AND termination);
(b) a stranded-branch SURFACE — commits ahead of default + no open PR
carrying them — through the VCS adapter (ADR-0008; prStatusRollup/issueList
precedents, never a bare gh call), reported where people already look
(`brain:status`). The ticket's own lean: REPORT, not refuse — refusing
would fail closed on ordinary WIP.

## The two decisions #713 left explicitly open (the maintainer's)

1. What counts as stranded: ANY branch ahead with no PR, or only `feature/*`
   trackers (the chain shape)?
2. Report or refuse? (The ticket argues report; confirming it is a ruling,
   not a default.)

## Scope boundary candidate

The reviewer WIRING (handing the parsed scope to the cold review so
findings can be judged in/out of slice-scope — #752's questions 1 and 3
made mechanical) is a consumer of this contract, arguably its own slice:
S5 lands the contract + parser + guard + surface; the reviewer's
consumption could ride S5 or follow it.
