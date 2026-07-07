# Design — Durable Memory Format Library (slice C1, C1a delivered)

> Realizes [proposal.md](proposal.md) against the C0 contract
> ([spec.md](../issue-201-memory-format/spec.md),
> [memory-format.md](../issue-201-memory-format/brain-drafts/memory-format.md)).

## Decision 1 — pure-evaluator + thin-I/O split

`format.mjs` (pure: hashing, canonicalization, schema validation, serialization) is fully
separated from `store.mjs` (I/O: append to `records/<yyyy-mm>.jsonl`, rebuild `index.json`).
Matches the convention already used across `brain/scripts/memory/lib/` (e.g.
`resume-schema.mjs` vs. its caller in `backends/engram.mjs`). This makes the hashing/validation
logic — the highest-risk, spec-critical code — testable with zero filesystem mocking, and keeps
`store.mjs` small enough to audit by inspection (73 lines).

## Decision 2 — `canonicalJson` is a minimal, schema-scoped RFC 8785 (JCS) implementation

The record's `hashInput` (REQ-MF-2) only ever contains strings, finite integers, and a flat
object shape — never floats, `NaN`/`Infinity`, or deep nesting. Rather than vendor a full JCS
library (the repo has **zero** npm dependencies today — a deliberate zero-dependency posture),
`canonicalJson` implements exactly the JCS rules this schema exercises:

- **Key order** — `Object.keys(...).sort()`, which is JS's native UTF-16 code-unit string
  comparison — the exact JCS key-order rule.
- **Number encoding** — delegates to `String(n)`, which is the ECMAScript Number-to-String
  algorithm JCS mandates. Non-finite numbers throw rather than silently miscanonicalizing.
- **String escaping** — delegates to `JSON.stringify`, which already implements RFC 8259
  control-character/quote/backslash escaping and leaves non-ASCII as raw UTF-8 (consistent with
  JCS, which does not require `\u`-escaping non-ASCII).

This is honest about its scope: it is not a general-purpose JCS library and would need extending
(float `Number` formatting per the JCS algorithm's edge cases) before use outside this record
schema. Documented in `format.mjs`'s doc comment and here so a future caller does not assume more
generality than exists.

## Decision 3 — `memory:reindex` dispatches directly in `cli.mjs`, not through a backend

`cli.mjs` normally dispatches every op to `backends/<MEMORY_BACKEND>.mjs`. `reindex` breaks that
pattern deliberately: the durable record format (`.memory/records/`, `.memory/index.json`) is
**brain-owned** (ADR-0017 draft) and independent of the live memory backend engram vs. any future
alternative. Routing it through `backends/engram.mjs` would wrongly couple a backend-agnostic
format operation to one specific backend's module, and every future backend would have to
re-implement (or re-export) the identical reindex logic. `cli.mjs` intercepts `op === "reindex"`
before backend resolution and calls `store.mjs#rebuildIndex` directly.

## Decision 4 — the REQ-MF-3 integration test declares its own scoped `.gitattributes`

The repo-wide `.memory/records/*.jsonl merge=union` line ships in C1b. The integration test does
not wait for that: it creates a throwaway temp git repository, writes `.gitattributes` itself
(`'.memory/records/*.jsonl merge=union'`), and proves the mechanism — real `git merge`, two
branches, distinct records, one merge, no conflict markers, a clean `rebuildIndex`. This is
legitimate CP-C1 evidence for REQ-MF-3 without a false dependency on C1b's file landing first.

## Decision 5 (recorded now, implemented in C1b) — secret-scrub false-positive valve

C1b's fail-closed secret scanner in `memory:share` needs a documented escape valve for a
legitimate false positive (e.g., a record's `content` discusses "a `glpat-`-shaped example token
used in a tutorial") — decided here, ahead of implementation, so C1b does not improvise it:

- **No `--no-scrub` flag, ever.** A silent CLI bypass is unauditable and defeats the fail-closed
  guarantee (REQ-MF-5's stance: "keeping secrets out is the writer's burden," enforced by a gate,
  not a convention). The **only** valve is a config-level allowlist.
- **`governance.memorySecretAllowPatterns`** (array of regex source strings, additive migration
  `0.5.0`) is the sole bypass. It is **committed, reviewable, and diffable** — a false-positive
  suppression is itself a change someone can see in `git log brain.config.json`, unlike an
  ephemeral flag on someone's local invocation.
- **Scope discipline.** The scanner inspects **only the records materialized in the current
  `memory:share` run**, never the whole store — re-scanning already-committed history on every
  run would be both wasteful and would re-litigate records that already passed review at commit
  time.
- **Failure message contract.** On a hit, the error names the **matched pattern** and its
  **location** (file + line, reusing `store.mjs`'s existing file:line convention from the
  corrupt-line fail-closed path) — enough for a human to either redact the content or add a
  precise allowlist entry, never a bare "secret found" with no lead.
- **Default patterns are a starting floor, not a ceiling.** `governance.memorySecretPatterns`
  ships with PATs, `glpat-`, AWS access keys, and private-key PEM headers as defaults (additive —
  a consumer repo can extend, never shrink, the default set without an explicit override, per the
  existing `config-migrations.mjs` additive-merge convention: `mergeDefaults` preserves what the
  consumer already set and only fills gaps).
