# ADR-0019 Amendment 5 — draft (issue #810)

> **Tier 3 target. Not promoted, and not promotable by an agent.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-810-artefact-live/brain-drafts/adr-0019-amendment-5.draft.md
> ```
>
> Run it on THIS branch so the amendment lands in the same pull request as the
> code it authorises. The verb renders the plan, waits for the typed word,
> performs §1c's acts, writes the `brain/HOME.md` marker and a regenerated
> `AGENTS.md`, stages them, and stops. **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0019-harness-port.md
amendment: 5
issue: 810
home-summary: a DECLARED custom stage's artefact joins the evidence contract under Amendment 1's four conditions — scaffolded, walked by phase-order in declared position, archived whole; the tier still scopes only the four, #810
body: ## Amendment 5 — the declared artefact joins the contract (issue #810)
body-end: ### What this amendment still does NOT authorise
```

```amend-find
A stage that writes INTO `openspec/changes/**` and expects the shared readers to find it is a
different act: it changes what the gates demand. That is **#456**'s question (stage-set
configurability), not this one, and it is not authorised here.
```

```amend-replace
A stage that writes INTO `openspec/changes/**` and expects the shared readers to find it is a
different act: it changes what the gates demand. That is **#456**'s question (stage-set
configurability), not this one, and it is not authorised here.
**[Amended by Amendment 5 (#810) — AUTHORISED, for DECLARED stages only, under the four
conditions. See Amendment 5 for what each condition maps to and what remains withheld.]**
```

## Amendment 5 — the declared artefact joins the contract (issue #810)

Amendment 1 withheld one act: a stage whose artefact the shared readers must
find. #456 slice A built the declaration (`sdd.stages`, resolved by
`resolveStageSet` with three refusals and a collision guard) and shipped the
`artefact` field validated but inert. This amendment authorises the act, for
**declared** stages only, because each of Amendment 1's four conditions now has
an enforcing surface:

1. **One layout.** The custom artefact lives in the same change dir as the
   four, under the file name `resolveStageSet(config)` resolves — no forked
   root, no second reader. The collision guard refuses a custom artefact that
   impersonates a lifecycle file.
2. **Neutral verification.** The gates read the RESOLVED SET, never an engine:
   `phase-order`'s Rule A walks `tier-scoped four ∪ declared customs` in the
   declared interleaved order. No gate learns engine shapes.
3. **Indistinguishable at the boundary.** A custom stage routes through the
   same `assertRoutedStage` evidence and the same engine seam as the four
   (#834/#836) — the transport cannot tell them apart, by construction.
4. **The refusal is replaced, not removed.** `resolveStageSet`'s three
   refusals (omission, relative reorder, collision) stand, and the gate DEMANDS
   a declared custom artefact exactly as it demands the tier-scoped four:
   declaring the stage is the demand. What the tier scopes is unchanged — the
   four only (REQ-L4-2′: the tier scopes what the GATE demands of doctrine's
   set, never what the SCAFFOLD produces, and never a consumer's own
   declaration).

The three sets stay separate, asserted in both directions: SCAFFOLD writes the
full declared set; GATE walks tier-scoped four ∪ customs; the presence DEMAND
of `check-refs` and the reviewer checkpoint stays the tier-scoped four.
Zero-config identity is the regression bar: without `sdd.stages`, every
surface above is byte-identical to its pre-#810 behaviour.

### What this amendment still does NOT authorise

An UNDECLARED artefact joining anything — a file appearing in a change dir
does not create a stage; only `sdd.stages` does. Removing or reordering the
four (Amendment 1's additive-only ruling stands). RENAMING one of the four's
artefacts — their files are canon; every fixed reader (gate flags, scaffold
paths, tier tables, the reviewer checkpoint) reads them by name, and a rename
would change what the gates demand, which stays withheld. And a forked
verifier, which condition 2 rejected and continues to reject.
