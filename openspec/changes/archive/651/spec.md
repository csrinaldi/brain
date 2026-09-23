---
status: draft
issue: 651
---

# Spec — own the public session record (issue 651)

## REQ-651-1 — The README carries five claims

Checked as claims, not as wording:

1. it names `.memory/` — a reader must know which directory this is about;
2. it says the exposure is **deliberate** — §2b's whole finding was omission;
3. it admits the unflattering half — the first record anyone opens contradicts a
   README that claims only the wins;
4. it cites the **audit** — "no credentials in here" is a measurement and has a
   record (the pre-flight comment on #435);
5. it says the records **do not ship** — a consumer installs the harness, not
   this project's history (#607).

## REQ-651-2 — The decision cannot revert silently

Deleting the section fails. **Keeping the section and removing "on purpose" also
fails** — that is the reversion that would otherwise look like an edit.

## REQ-651-3 — The guard reads a real README

It throws rather than returning `''` on an unreadable or gutted file, asserts the
README is a real length, asserts the claim list is non-empty, and asserts the
file is brain's own. "Nothing missing" and "nothing read" must not share a
verdict.

## REQ-651-4 — The guard does not ship

It lives in `test/`. Vendored into a consumer it would assert facts about the
wrong repository.

## REQ-651-5 — Numbers are dated, not floating

The record count is stated **as of the audit date**. A bare count ages into a
false statement with every session; a dated measurement stays true.

## REQ-651-6 — Nothing else changes

No change to `.memory/`, to the memory backends, or to `files`.
