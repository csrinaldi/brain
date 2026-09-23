---
status: draft
issue: 641
---

# Tasks — #641

- [x] **T1** Measure the defect on `main` at `1c21976`, in the container that has no engram:
      `npm run memory:share` → exit 1; `MEMORY_BACKEND=plainfiles npm run memory:share` → exit 0
      **and** delivering #574's duplicate report the documented verb could not reach.
- [x] **T2** Rule option (2) + (3), with the cost of the rejected (1) stated: pinning would
      delete the engram export from every machine that has engram.
- [x] **T3** `lib/backend-selection.mjs` — a three-valued `probeBinary` and a pure
      `selectBackend` over three preconditions.
- [x] **T4** Wire it into `cli.mjs` below the backend-agnostic ops, so nothing pays for a probe
      it does not need. Notices to stderr, from catalog keys.
- [x] **T5** Point `cli.mjs`'s failure messages at the backend that actually ran, not the one
      that was requested.
- [x] **T6** Route `requireEngram` (and `_engramEnrich`, `_defaultCheckEngram`) through the
      shared probe — no second copy of `which engram` left in `engram.mjs`. Absent-branch
      message preserved byte for byte.
- [x] **T7** `en.mjs` + `es.mjs`, three keys each, translated rather than copied.
- [x] **T8** `BRAIN_MEMORY_ENV_FILE` test seam, so the stated-vs-defaulted branch is not decided
      by whatever `.env` the runner's machine happens to have.
- [x] **T9** 24 tests across two suites: the pure decision, and the real CLI in a child process
      with `PATH` and `.env` both replaced.
- [x] **T10** Eight mutations RED, each verified to have LANDED before the result was read, each
      restore `diff -q` byte-identical:

      | # | mutation | went red |
      |---|---|---|
      | M1 | `stated` guard removed | 3 tests |
      | M2 | probe `null` treated as absent | 3 tests |
      | M3 | `FALLBACK_OPS` guard removed | 3 tests |
      | M4 | `probeBinary`'s `.error` branch removed | 1 test |
      | M5 | substitution notice moved to stdout | 4 tests |
      | M6 | stated-but-absent signpost removed | 2 tests |
      | M7 | selection bypassed entirely (pre-#641 behaviour) | 2 tests |
      | M8 | `es.mjs` value replaced with the `en.mjs` one | 1 test |

      M8's first attempt was a **bad mutation, not a passing test**: the substitution replaced
      only a prefix, so the Spanish value never actually equalled the English one and the suite
      stayed green for a correct reason. Rebuilt to assign the two values identically; then red.
- [x] **T11** Full suite: **3649 tests, 0 failures**, 1 pre-existing skip (`copyManaged`, skipped
      because the runner is root and cannot make a chmod-based cleanup fail).
- [x] **T12** Acceptance proved by running the shipped verb here, not by reading the code:
      `npm run memory:share` → exit 0, substitution announced, `.memory/` unchanged.
- [x] **T13** **Cold review of this PR caught a regression I had introduced.** The first
      `FALLBACK_OPS` was `["share","pull","setup","save","search"]`, derived by reasoning ("the ops
      plainfiles serves natively") and never measured against what actually fails without the
      binary. Measured afterwards, three of the five were wrong:

      | op | with no engram, BEFORE #641 | verdict |
      |---|---|---|
      | `share` | `engram binary not found` | genuinely blocked — covered |
      | `pull` | `engram binary not found` | genuinely blocked — covered |
      | `setup` | `✓ merge driver registered`, **exit 0** | **REGRESSION** — removed |
      | `save` | `'save' is not a cli verb for engram` | designed refusal — removed |
      | `search` | `'search' is not a cli verb for engram` | designed refusal — removed |
      | `index` | `0 documentos indexados`, exit 0 | never blocked — stays out |

      `setup` was the real defect: `engram.setup()` needs no binary and is what creates the
      `.engram → .memory` symlink and registers the `merge=union` driver for
      `.memory/manifest.json` (ADR-0002). `plainfiles.setup()` does neither, so the substitution
      silently dropped the merge driver on every machine without engram — the mechanism ADR-0017's
      union safety depends on. `FALLBACK_OPS` is now `["share","pull"]`, and the rule is stated as
      "a fallback may only replace a FAILURE".
- [x] **T14** Same review caught a fragile assertion: `doesNotMatch(/not installed here/)` collided
      with #530's `memory.save.engramUnsupported`, which contains the words "If engram is not
      installed here (the agent environment)". Every guard on a non-substituted op could trip on an
      unrelated message, and every positive match could in principle have been satisfied by one.
      Anchored on a phrase unique to the notice instead.
- [x] **T15** Re-proved: the old list restored as a mutation fails 5 tests; suite 3650, 0 failures.
- [ ] **T16** *(filed, not done)* `memory:index` with no engram exits **0** and reports
      `0 documentos indexados` after failing on every document — a total failure that reads as a
      healthy zero. `brain-to-engram.mjs`, out of this ticket's file claim.
- [ ] **T17** *(filed, not done)* `requireEngram`'s two remaining messages are hardcoded English.
      That is #638's territory (catalogs, not call sites); the new strings added here all went to
      the catalogs.
