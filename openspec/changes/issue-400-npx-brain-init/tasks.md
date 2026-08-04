---
status: tasks
issue: 400
epic: 313
artifact_store: openspec
topic_key: sdd/issue-400-npx-brain-init/tasks
---

# Tasks — `npx brain init` (issue #400)

- [x] T1 — SDD artefacts: proposal / spec (REQ-400-1..10) / design / tasks, with the
      bootstrap-paradox root cause measured against `MANAGED_SCRIPT_KEYS` and
      `test/fresh-install/in-container.sh:118`.
- [x] T2 — `brain/scripts/cli-entry.mjs`: shebang, subcommand dispatch, `--help`
      (REQ-400-1, 7, 8).
- [x] T3 — the `init` module: tag resolution from the installed package, the two
      refusals (no consumer package.json / inside brain itself), the single-alias merge
      through `mergePackageJsonScripts`, delegation to `brain:upgrade`, the
      `brain:env:init` next-step report (REQ-400-2..6).
- [x] T4 — `bin` entry in brain's `package.json` (REQ-400-1).
- [x] T5 — 18 unit tests over the pure/dispatch layer: idempotence, consumer-wins,
      both refusals, tag resolution + its refusal, exit codes. Writing them exposed a
      real gap: `runInit` had no `readFile` seam, so it could not be driven without a
      real filesystem — threaded through. One test also passed for the WRONG reason
      until fixed (a blanket `exists: () => true` made the `.brain-source` marker
      present, turning an exit-code assertion into a refusal assertion).
- [x] T6 — `test/fresh-install/in-container.sh`: replace the hand-written alias step
      with `npx brain init`; keep the consumer-customization assertion (REQ-400-9).
- [x] T7 — README rewritten to the tested flow; the manual path kept, labelled as
      fallback (REQ-400-10).
- [x] T8 — full suite + `repo:check` + `brain:nav`; diff budget.
- [ ] T9 — PR to `main` closing #400.
- [ ] T10 — **HUMAN:** answer D6 (registry / mirror / public repo) and record it on #400
      before it closes, per the ticket's own instruction.
