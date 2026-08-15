---
status: draft
issue: 677
---

# Tasks — #677

- [x] **T1** Isolate the mechanism driver-free before proposing anything. Two branches, two
      different records, one base, no `.gitattributes`: month file → **CONFLICT** (3 stages);
      one file per record → **clean**, both records present. Same inputs both times.
- [x] **T2** Correct a bad measurement of my own before drawing anything from it. The first
      `git merge-tree` probe reported "clean" for the month layout *without* the attribute,
      which would have contradicted the ticket. Cause was the probe: scratch files were written
      inside the repo, `git add -A` swallowed them, and two of the four branches never got their
      commit (`branch-B` had 30 lines, not 31). Rebuilt with the scratch outside the repo — month
      + union → clean, month + no attribute → **conflict, 3 stages**. Only then was `merge-tree`
      trusted as a driver-sensitive probe.
- [x] **T3** Price the objection ADR-0017 used to reject sharding, on the real 2052-record store
      exploded to one file per record:

      | | 3 month files | 2052 record files |
      |---|---|---|
      | read whole store | ≈133 ms | **≈70 ms** |
      | packed repo | 2.34 MiB | 2.68 MiB (+15%, one-off) |
      | +20 further records | +11 KiB | +13 KiB |
      | `git status` | 6 ms | 6 ms |

      The read result reversed my expectation. So did the incremental one: I predicted the month
      layout would pay more per append (a new blob of the whole file); delta compression absorbs
      it and they are equivalent. Both reported as measured, not as they helped.
- [x] **T4** `recordFilename` as the single statement of the layout, refusing an `id` that is not
      `rec-<16 hex>` — the id is a path now, so its shape is checked rather than trusted.
- [x] **T5** `appendRecord` writes one record per file, never overwrites, and returns `written`.
      Silence about "already present" would be `evidence-reader-empty-on-failure` in miniature.
- [x] **T6** Confirm the readers need NO change — measured, not assumed: every reader globs
      `*.jsonl` and parses per line, so month, per-record and mixed stores read identically. This
      is what makes the migration opt-in on a consumer-owned store.
- [x] **T7** `memory:split-records`: report-only by default, refuses corrupt/tampered lines
      before writing, reports first-wins collapses on both paths, verifies every record reads
      back before deleting a month file, idempotent, never overwrites an existing record file.
- [x] **T8** Prove the migration lossless on a COPY of the real store before running it on the
      real one: 2052 → 2052 physical lines, 2052 → 2052 unique byte-strings, **0** bytes lost,
      **0** bytes invented, 0 filenames off-pattern, 0 files with more than one line, index
      unchanged in every field except `file`.
      Then on the real store: `brain:metrics` byte-identical, record id-set hash unchanged. The
      one observable difference is iteration ORDER (filename order, not append order) — no
      consumer reads order, checked in the six readers and then confirmed by the identical
      metrics output.
- [x] **T9** Eight mutations, each verified to have LANDED before the result was read, each
      restore `diff -q` byte-identical:

      | # | mutation | went red |
      |---|---|---|
      | M1 | `appendRecord` back to the month file | 15 tests |
      | M2 | `appendRecord` overwrites an existing record file | 2 tests |
      | M3 | `recordFilename` stops checking the id shape | 1 test |
      | M4b | the month delete is REORDERED before the verify | 2 tests |
      | M5 | the verification is skipped entirely | 2 tests |
      | M6 | a corrupt line is skipped instead of refused | 1 test |
      | M7 | a repeat is resolved LAST-wins | 1 test |
      | M8 | **negative control** — the repo's `merge=union` removed | **0 tests** |

      M4's first form was a bad mutation: it inserted a second delete rather than moving the
      existing one, so the run went red on an ENOENT from deleting twice — red for the wrong
      reason, and indistinguishable from the ordering guarantee holding. Rebuilt as M4b (a
      genuine reorder), which reddens exactly the two verification tests.

      M8 is the one that earns the `.gitattributes` comment: the claim "this attribute is no
      longer load-bearing" is only worth writing if removing it changes nothing, and it does not.
- [x] **T10** Rewrite the two integration tests that pinned the old doctrine, rather than
      deleting them. `records-merge.integration.test.mjs` asked "does union work?" — true, and
      the wrong question, since it declared the attribute the forge does not apply (#632's
      green-for-the-wrong-reason). It now asks "does it merge with NO driver?", keeps the union
      case demoted below it, and adds the residual divergent case.
      `records-merge-duplicate.integration.test.mjs` lost its scenario — the same record on two
      branches no longer duplicates — so #574's rule is re-pinned against the two shapes that CAN
      still produce a repeat: a half-migrated store, and union resolving a divergent pair.
- [x] **T11** Full suite: **3766 tests, 0 failures**, 1 pre-existing skip (`copyManaged`; root).
      `brain:repo:check` and `brain:nav` green. Re-run after the real store was migrated, since
      several tests read it.
- [x] **T12** Both `brain:promote` drafts validated by driving the promoter's own parser — 6 acts
      on ADR-0017 and 8 on `memory-format.md`, every one `{state:'pending', free:1}`, status line
      rendering `Amendments 1-2`, HOME.md marker applicable.
- [x] **T13** Apply both drafts to temp copies and READ THE RESULT — #635's lesson. It found two
      gaps the drafts had left: the ADR's Decision section states the layout a second time
      (Act 4), and both artefacts close the anti-custom-driver passage by pointing at the
      built-in union driver as the friction-free alternative (Act 5 / Act 7). Added rather than
      left for the next reader.
- [ ] **T14** **The forge-side half of the acceptance.** What is proven so far is that git merges
      the new layout cleanly with no driver in effect. What is NOT yet observed is GitHub
      reporting `mergeable` for a second memory-capturing branch in the new layout. Recorded here
      with what was actually run, in the PR description, once measured — and stated as unproven
      until then.
- [ ] **T15** *(requires the maintainer)* `npm run brain:promote` on both drafts, in the same
      sitting. The verb needs a TTY and a typed confirmation; an agent cannot and must not run it.
