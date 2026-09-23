# ADR-0004 Amendment 1 — draft (issue #863)

> **Tier 3 draft. Not yet promoted.** ADR-0004 is signed, so this is an in-place
> amendment, not a new ADR file.
>
> ```
> npm run brain:promote -- openspec/changes/issue-863-backend-contract/brain-drafts/adr-0004-amendment-1.draft.md
> ```
>
> Promote it together with `memory-backend-contract.md` from this folder: this
> amendment says the interface exists, that document is the interface.

```brain-amendment/1
target: brain/project/decisions/adr-0004-adapter-memoria-memory-backend.md
amendment: 1
issue: 863
home-summary: the interface exists — memory-backend-contract.md names the required verbs, the three rules and the agnosticism test; "manifest required for all backends" is withdrawn (plainfiles is the proof) and the manifest, symlink and driver are the engram adapter's, #863
body: ## Amendment 1 — the interface exists, and the manifest was never the layer's (issue #863)
body-end: ### Notes for the promoter
```

## Act 1 — the Decision names the contract, and the verbs it actually requires

```amend-find
- **Dispatcher**: `scripts/memory/cli.mjs`. Single entry point. Reads `MEMORY_BACKEND` and delegates to the corresponding implementation. Verbs: `index`, `share`, `pull`, `setup`.
```

```amend-replace
- **Dispatcher**: `scripts/memory/cli.mjs`. Single entry point. Reads `MEMORY_BACKEND` and delegates to the corresponding implementation. The verbs, which are required, their normalized returns and the failure discipline are defined by `brain/core/methodology/memory-backend-contract.md` (Amendment 1, #863): required `setup`, `share`, `hydrate` (today `pull` / `cli.mjs import`), `save`; optional `index`, `search`, `featureCheckpoint`, `featureResume`. Backend-agnostic verbs (`reindex`, `resolve-index`, `audit`) are dispatched directly and never reach a backend.
```

## Act 2 — the two admissions in Consequences are closed

```amend-find
- **Negative**: adding a new backend requires implementing all verbs (`index`, `share`, `pull`, `setup`) — there is no formal interface today, only convention.
- **Negative**: the `.memory/manifest.json` manifest remains required for all backends that use the durable git layer.
```

```amend-replace
- **Negative (closed by Amendment 1, #863)**: adding a new backend requires implementing all verbs — there is no formal interface today, only convention. *Closed: `memory-backend-contract.md` is the interface — four required verbs, three rules (idempotent hydration by record id; never the first home of a capture; no artifact the durable layer needs), the agnosticism test, and a conformance row per backend.*
- **Negative (withdrawn by Amendment 1, #863)**: the `.memory/manifest.json` manifest remains required for all backends that use the durable git layer. *Withdrawn: `plainfiles` (#246) uses the durable layer with no manifest, no chunks, no symlink and no driver, and every memory 2.0 scenario has an answer under it. Those four are the engram adapter's private artifacts (ADR-0002 Amendment 1) and leave the tree under #864 task 2.4.*
```

## Amendment 1 — the interface exists, and the manifest was never the layer's (issue #863)

**Signed**: DD/MM/YYYY — <Name>

### What this changes

Consequences admitted two things in 2026-06: that there was no formal interface, only
convention, and that the manifest was required for every backend. Both were true and both
are closed. `brain/core/methodology/memory-backend-contract.md` is the interface: four
required verbs (`setup`, `share`, `hydrate`, `save`), four optional ones, normalized
returns, the failure discipline, three rules — hydration idempotent by record id; the backend
is never the first home of a capture; the backend owns no artifact the durable layer needs —
the agnosticism test (*does it hold under `MEMORY_BACKEND=plainfiles`?*), an open, enumerated
set of producers, and a conformance row per backend. The manifest requirement is withdrawn:
`plainfiles` (#246) is the proof, and ADR-0002 Amendment 1 (same ruling) reassigns manifest,
symlink and driver to the engram adapter.

### What this does NOT change

The selector, the dispatcher and the backend directory are as decided. Adding a backend is
still a file plus a `case`; what is new is that the contract says what the file must export
and how it is proved.

### Notes for the promoter

Both `amend-find` anchors were verified to occur exactly once in the target. The Context and
the "To add a new backend" line stand; the contract's "How to add a backend" section extends
the latter rather than replacing it.
