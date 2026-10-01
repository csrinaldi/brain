# Proposal: cut 1.11.0 (#1225)

## Problem
The 1.10.1 exit run (#1204) answered phase 1's fresh-install clause No: the first PR needed two manual steps (a `type:*` label, a push) and the backend prompt declared `engram` on Enter. The fixes (#1209, #1210, #1211, #1217) are merged on `main` but unpublished, and phase 1 of #1121 closes only on a published package (ADR-0036). `main` also carries a new capability, #1212 (#1198).

## Intent
- Release the eight merged commits as 1.11.0: the release reporter measured 1 feat, 5 fix, 2 internal, and no config migration above 1.10.1. A new capability is a minor by the rule 1.6.0 to 1.10.0 applied; the maintainer ruled A (cut from `main`) over cherry-picking into 1.10.2.
- State in the CHANGELOG, the adoption guide and the known limitations only what the code on `main` does. The two manual steps are not removed by this release; they fail first and name the fix.

## Scope
- `package.json` and the README/adoption pins to 1.11.0; a new CHANGELOG entry; `docs/adoption.md` (first-PR prerequisites, stale "or empty" backend sentence); `docs/KNOWN-LIMITATIONS.md` (#1189, #1190).
- `claim-sweep.md`: every behavioural sentence of the new entry and every changed doc line, traced to code.
- Not in scope: tagging, pushing, publishing, the post-publish registry verification and phase-1 re-run.
