# Proposal: cut 1.10.1 (#1196)

## Problem
The 1.10.0 exit run (#1185) found that a fresh consumer's first PR and first real merge still needed a human. The fixes are merged on `main` (#1192, #1193; #1191 is docs only) but unpublished, and phase 1 of #1121 closes on a published package (ADR-0036).

## Intent
- Release the three merged commits as 1.10.1: the release reporter measured 3 commits since v1.10.0, 0 feat, 2 fix, 1 internal, and no config migration above 1.10.0.
- Promote the `issueClose` row of `vcs-contract.md`, drafted free-form in #1188, through `brain:promote`.
- State in the CHANGELOG, the adoption guide and the known limitations only what the code on `main` does.

## Scope
- `package.json` and the README/adoption pins to 1.10.1; a new CHANGELOG entry; `docs/adoption.md`; `docs/KNOWN-LIMITATIONS.md`.
- A `brain-amendment/1` draft for `vcs-contract.md`. The maintainer promotes it; the drift guard's `PENDING_PROMOTION` is emptied in the same promote commit.
- Not in scope: tagging, pushing, publishing, the #1194 fixes, the next exit run.
