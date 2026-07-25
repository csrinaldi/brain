# Evidence reader returns empty on failure (fail-open in REQUIRED gates)

- **Discovered in:** issue #193 / `providers/github.mjs` `prView()` + `decision-gate`
- **Applies to:** any reader that supplies evidence to a governance gate — VCS
  providers (GitHub, GitLab), CI-context readers, memory readers, and any future
  evidence source consumed by `REQUIRED_JOBS`

## Symptom

A REQUIRED gate passes green without ever having evaluated. In the real case:
`prView()` returned `labels: [], body: ''` on ANY failure (network, auth, proxy,
API error). A failed label fetch made `decision-gate` see "no `decision` label"
and exit 0 — skipping the hard check entirely. The same conflation silently
weakened `diff-size` (`size:exception`), `memory-gate` (`skip:memory-gate`) and
`issue-link` (`Closes #N` parsed from `body`). Nothing in the pipeline looked
red; the gate simply never ran its check.

## Cause

The reader conflates two states that gates must distinguish: **"the value is
genuinely empty"** (`[]` / `''`) and **"the value could not be obtained"**
(uncomputable). Returning an empty default on failure feels safe — no throw, no
crash, callers need no null guards — but for a gate whose trigger condition is
the _presence_ of something (a label, a marker in the body), a fabricated empty
is indistinguishable from a legitimate absence. The failure direction inverts:
the reader's error becomes the gate's approval. This violates ADR-0015's
Never-do ("a REQUIRED gate must never exit 0 without evaluating") one layer
below the gate, where no one is looking.

## Solution / correct pattern

Evidence readers return **value-or-null**: `null` = uncomputable (the fetch
failed), `[]` / `''` = genuinely empty. Consumers apply their class policy on
`null` — REQUIRED gates fail closed ("cannot fetch labels — failing closed"),
DETECTION gates degrade to warn with a documented reason. Never a stale
fallback (a frozen env var) in place of the live value, for the same reason: it
conflates "current state" with "state at pipeline creation".

```js
// WRONG — reader's failure becomes the gate's approval
catch { return { labels: [], body: '' }; }

// RIGHT — uncomputable is a first-class state the gate must handle
catch { return { labels: null, body: null }; }
```

Being fixed at source in slice A1 (Track A, adapter plan): `prView()` will
return `null` on failure; the seam (`ci-context.mjs`, ADR-0016) specifies the
distinction contractually (REQ-CIC-2/3/5); wrappers of REQUIRED gates fail
closed on `null`. The audit path (`brain-audit.mjs`, `audit-helpers.mjs`) is
migrated off the empty-default in the same slice so the fail-open does not
survive on a parallel path.
