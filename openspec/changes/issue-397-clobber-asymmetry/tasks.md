---
status: tasks
issue: 397
epic: 313
artifact_store: openspec
topic_key: sdd/issue-397-clobber-asymmetry/tasks
---

# Tasks — Per-path upgrade strategy (#397)

## Phase 0 — Measure (done)

- [x] 0.1 Read the real managed manifest: 13 globs, 2 merged, 11 plain-copied
- [x] 0.2 Drive the real CLI with four consumer-edited files — all four destroyed, exit 0
- [x] 0.3 Establish that `AGENTS.md` is GENERATED and that `brain/HOME.md` is consumer-owned
- [x] 0.4 Establish that the existing collision check conflates "consumer edited" with
      "brain changed", and that the outgoing package supplies the missing third point

## Phase 1 — Decision (BLOCKED — human)

- [x] 1.1 Draft the per-path classification into `brain-drafts/managed-path-strategy.md`
- [ ] 1.2 **Maintainer signs or amends the classification.** Tier-2: it lands in
      `brain/core/managed-paths.mjs`. **No implementation task below may start first.**
- [ ] 1.3 Answer the three open questions: `.gitattributes` ownership · whether already-clobbered
      consumers are detected · `--force-managed` granularity

## Phase 2 — Implementation (blocked on 1.2)

- [ ] 2.1 Three-way modification detection reading the outgoing package pre-install (REQ-397-1)
- [ ] 2.2 State the degraded mode under `--no-install` rather than implying a check happened
- [ ] 2.3 Strategy as DATA in `brain/core/managed-paths.mjs` (REQ-397-5) — **Tier 2**
- [ ] 2.4 `.gemini/settings.json` routed through the `.claude/settings.json` merge (REQ-397-3)
- [ ] 2.5 REFUSE + per-path `--force-managed`, validated against the classification (REQ-397-2)
- [ ] 2.6 `AGENTS.md` off the copy set; regenerate post-upgrade and report it (REQ-397-4)
- [ ] 2.7 Add `.gemini/settings.json` to #399's merge pre-flight

## Phase 3 — Tests (blocked on 1.2)

- [ ] 3.1 Consumer-modified REFUSE path aborts, names it, writes nothing
- [ ] 3.2 **Negative control:** brain-changed-but-consumer-untouched writes without prompting
- [ ] 3.3 `--force-managed` overwrites only the named path
- [ ] 3.4 **Negative control:** a refused path is LEFT ALONE, never quietly written (#399's lesson, inverted)
- [ ] 3.5 `.gemini/settings.json` merge preserves consumer keys
- [ ] 3.6 `AGENTS.md` after an upgrade reflects the CONSUMER's `brain/HOME.md`
- [ ] 3.7 Every test drives the real CLI — the #396 lesson: a suite that never runs the
      command a consumer runs carries no information about it
- [ ] 3.8 Prove each test RED before its fix

## Phase 4 — Docs (blocked on 1.2)

- [ ] 4.1 `docs/KNOWN-LIMITATIONS.md`: close or narrow the clobber-asymmetry entry honestly
- [ ] 4.2 Record the degraded `--no-install` mode as a named residual
