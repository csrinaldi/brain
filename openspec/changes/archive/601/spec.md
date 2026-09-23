---
status: draft
issue: 601
---

# Spec — REFUSE protects a first-ship path (issue 601)

## REQ-601-1 — A first-ship REFUSE path the consumer owns is refused

REFUSE-classified, absent from `outgoing`, and a file exists at it in the
consumer's tree ⇒ the path is named in `refused` and nothing is written over it.

## REQ-601-2 — The escape hatch is unchanged

`--force-managed <path>` still overrides, per path, never as a wildcard (signed
decision 3). Fail-closed must not mean fail-stuck.

## REQ-601-3 — REFUSE is still not "always ask"

A first-ship REFUSE path the consumer does NOT have copies silently. Asking on
every release is how a real warning becomes the thing everyone clicks through.

## REQ-601-4 — A degraded run manufactures no refusals

With `outgoing: null` (`--no-install`) there is no outgoing tree, and treating
that as "brain never shipped this" would refuse every REFUSE path on every
degraded run. Unknown-because-degraded and unknown-because-new are different
facts; only the second is evidence about the consumer's file.

## REQ-601-5 — The doctrine comment states the behaviour

`managed-paths.mjs`'s REFUSE comment describes both cases it now covers. No
strategy ROW changes value, so no new human signature is required by ADR-0013 —
the ratified table is untouched; only the prose describing what REFUSE does was
corrected to match.
