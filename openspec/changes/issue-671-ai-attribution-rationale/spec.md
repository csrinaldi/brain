---
status: draft
issue: 671
---

# Spec — issue 671

## REQ-671-1 — The prohibition is enforced at commit time and at push time

`hooks/commit-msg` rejects a message carrying AI attribution. `hooks/pre-receive`
rejects the same message server-side, where `--no-verify` cannot reach it and
where a clone that never ran `env:init` is still covered — `core.hooksPath` is
per-clone and not committed, so the client half alone is best-effort.

## REQ-671-2 — The check precedes every exemption

Both hooks test attribution **before** the `chore(release)` / `chore(memory)`
exemptions from the ticket-reference rule. An exemption from one rule may never
become an exemption from another; that is how a Tier-3 list grows holes.

## REQ-671-3 — One rule, three implementations, pinned by a shared corpus

`commit-msg`, `pre-receive` and `review/evaluators/tranche.mjs` are driven
through **one corpus** of messages, and must agree on every entry.

The two shell hooks additionally carry a byte-identical pattern literal.
`pre-receive`'s header already claimed *"Checks mirrored from commit-msg"* and
nothing pinned it — the shape #130, #340 and #555 each closed.

The corpus asserts both directions: attributed forms are rejected, and a
**human** `Co-Authored-By:` is accepted. The trailer is a legitimate convention;
what is refused is pointing it at an entity that cannot answer for the work.

## REQ-671-4 — A shipped `cites:` may not name a document that does not exist

`cites-resolve.test.mjs` verifies that every `*.md` filename appearing in a
shipped `cites:` resolves to a real file, alongside its existing
`file.mjs symbol` check.

Scope is unchanged in kind: an ADR, a REQ id or a protocol section (`§10`) is
still not verified, because those have no single mechanical resolution and a
guard pretending to check them is the apparent protection #499 refuses. A
filename resolves trivially, and this is the fourth instance of the class.

## REQ-671-5 — The PR-body finding says what it measures

`tranche.mjs`'s `ai-attribution` finding cites doctrine that exists, names the
surface it actually reads (the PR body), and points at the hooks for the commit
surface it does not read.
