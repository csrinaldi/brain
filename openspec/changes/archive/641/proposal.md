---
status: draft
issue: 641
---

# Proposal — the working route existed; nothing ever pointed at it

## The ruling

**Option (2) — fall back when the backend is absent, and say so loudly — with option (3) folded
in for the case where a backend was actually named.** Not (1).

(1) "pin the siblings too" is the smallest diff and the wrong one. `memory:share` on a machine
that *has* engram does real work: it runs `engram sync --export`, scrubs the materialized
chunks, and dual-writes the exported observations into `records/`. `plainfiles.share` is a
`rebuildIndex()` self-check and nothing else. Pinning would silently delete the export from
every machine where it currently works, to fix a machine where it currently cannot run. The
ticket says as much — *"costs the engram path its default on machines that do have it"* — and
that cost is not payable.

(3) alone leaves `npm run memory:share` failing, which fails the ticket's own first acceptance
line for anyone who cannot install anything.

So: when nobody stated a backend and the engram binary is measurably absent, the ops that are
about the **brain-owned durable format** (ADR-0017) run on `plainfiles` and say so. When a
backend *was* stated, the run still fails — but the message finally names the working route.

## Measured before writing anything

On `main` at `1c21976`, in this container (no `engram` on PATH):

```
$ command -v engram
(nothing)

$ npm run memory:share
memory/cli: engram.share() failed — engram binary not found. Install via: gentle-ai install
EXIT=1

$ MEMORY_BACKEND=plainfiles npm run memory:share
⚠ 49 duplicate record id(s) in .memory/records/ — 139 excess physical line(s) collapsed
  into the index (2185 physical line(s) → 2046 indexed).
  …
EXIT=0
```

Both halves of the ticket reproduce exactly. Note the second one: the agnostic path was not
merely "not failing", it was **doing the work** — including delivering #574's duplicate report,
which the documented verb could not reach at all.

After the change, same environment, same command:

```
$ npm run memory:share
memory/cli: the `engram` binary is not installed here, so `share` ran on the records-only
  `plainfiles` backend instead — same records, same validation, no backend required (ADR-0017).
  MEMORY_BACKEND was not set, so no stated choice was overridden; set it to pin either backend
  explicitly.
⚠ 49 duplicate record id(s) in .memory/records/ — …
EXIT=0
```

## Why the asymmetry existed, and why it is not a precedent

`memory:save` is pinned because REQ-530-1 requires it: *"`memory:save` MUST exist and MUST pin a
backend that works without engram."* That requirement is about **capture being possible with no
backend**, which is ADR-0017's whole premise. Its siblings inherited the letter of the default
rather than the intent of the rule.

The pin stays where it is. On a machine *with* engram, `memory:save` unpinned would reach
`engram.save`, which refuses by design (Decision 5) — so the pin is load-bearing, not
redundant, even after this change.

## The three conditions, and what each one refuses to get wrong

A fallback is a thing that runs code the caller did not ask for. Each condition rules out a
distinct way that could be a defect rather than a help:

| condition | the failure it prevents |
|---|---|
| the backend was **not stated** | ADR-0004 makes `MEMORY_BACKEND` an operator-stated selector. Overriding a stated selector is a different class of surprise from filling in an unstated default — the same "derive facts, never opinions" asymmetry `plainfiles.save` already applies to `project` vs `type` (#530). |
| the binary is **measurably absent** | A *direct probe*, never a caught error message. Matching on `err.message` would also swallow a genuine engram failure on a machine that has engram — the one thing a fallback must never do. |
| the op is one the fallback **serves natively** | `index`, `import` and `feature-*` project into engram's *own* store. Substituting there would replace `"engram binary not found. Install via: gentle-ai install"` — which names the actual fix — with `"not supported by the 'plainfiles' backend"`, naming a backend the caller never asked for. A fallback that degrades the message is not a fallback. |

## The probe is three-valued, on purpose

`evidence-reader-empty-on-failure` is the defect family this repo keeps finding, and the old
resolution built one: `spawnSync("which", ["engram"])` returning `status !== 0` was read as
*"engram is not installed"*, but on a container with no `which` at all `spawnSync` sets
`.error` and leaves `status` at `null` — so **a broken probe was indistinguishable from a
confident absence**. Harmless while the only consequence was an error message. Not harmless
once that same answer decides whether to switch someone's backend.

So `probeBinary` answers `true` / `false` / `null`, `null` never substitutes, and the CLI
reports "I could not check" as itself, with the cause.

## Blast radius

`requireEngram` now calls that shared probe instead of holding a second copy of the same
`which engram` expression — the #340 shape, where two copies of one rule drift and the
dispatcher concludes "absent, substitute" while the backend concludes "present, run". The
absent-branch message is unchanged byte for byte; only the previously-unreachable third branch
is new. The other two copies of the expression in `engram.mjs` (`_engramEnrich`,
`_defaultCheckEngram`) are routed through it too, with behaviour preserved exactly.

## Not fixed here, found while measuring

`npm run memory:index` with no engram installed **exits 0** and prints
`0 documentos del cerebro indexados`, after one `✗ … spawnSync engram ENOENT` line per
document. A total failure reported as a successful count of zero is
`evidence-reader-empty-on-failure` in its purest form, and it is a different defect in a
different file (`brain-to-engram.mjs`). Flagged, not folded in; the test that touches `index`
asserts only what #641 owns and says so.

## Acceptance

- [x] `npm run memory:share` succeeds with no `engram` binary — **run here**, output above.
- [x] Where a backend *was* stated, the failure names the working alternative.
- [x] The PR template's memory line points at a verb that works in the agent environment —
      `npm run memory:share`, unchanged, now working.
- [x] Nothing changes on a machine that has engram — pinned by a test with a planted binary.

## Links

- #530 / PR #540 (the writer existed; every way to reach it was missing) · #574 (the duplicate
  report this verb could not deliver) · ADR-0004 (the `MEMORY_BACKEND` selector) ·
  ADR-0017 (the record format is brain-owned) · `evidence-reader-empty-on-failure`
