# Archive Report: issue-978-codex-cold-review

**Status:** success
**Change:** `issue-978-codex-cold-review`
**Archived:** 2026-09-16
**Artifact store:** OpenSpec (repo-local)
**Source:** `openspec/changes/issue-978-codex-cold-review/`
**Destination:** `openspec/changes/archive/2026-09-16-issue-978-codex-cold-review/`

## Final State

The change is complete and archived. The persisted `tasks.md` contains 15/15 checked implementation tasks. The final verification report is PASS with 8/8 requirements and 14/14 scenarios compliant, zero blockers, zero critical findings, and no warnings or suggestions. The final `verify-report.md` SHA-256 is `68d1cb06f5ed7ca543a82a541a3341f1ecccb17bbe9203ec56be917e51c02503`.

Final evidence supplied by the orchestrator:

- `GIT_CONFIG_GLOBAL=/dev/null npm test`: 5,380 passed, 0 failed, cancelled, skipped, or todo.
- `bash -n brain/scripts/install-tools.sh && bash -n brain/scripts/bootstrap.sh && npm run brain:repo:check`: passed; no prohibited references and valid artifact structure.
- `npm run test:fresh-install`: passed.
- PR1, PR2, and PR3 attempt work was settled; no verification warnings remain.

The restricted-sandbox stream-file-descriptor failure recorded in intermediate verification was an environment-only interruption. The same suite was rerun outside that sandbox and passed; it is not a candidate defect.

## Specs Synced

Both delta specs were new domains, so each was copied mechanically into the canonical source-of-truth location:

| Domain | Action | Result |
|---|---|---|
| `codex-cold-review-transport` | Created | `openspec/specs/codex-cold-review-transport/spec.md` |
| `route-conditional-codex-setup` | Created | `openspec/specs/route-conditional-codex-setup/spec.md` |

The archived delta specs and canonical specs were compared with `diff -r`; both comparisons produced no output (byte-identical).

## Archive Readback

The source change directory was snapshotted before moving. `git mv` refused because the source directory was untracked (`fatal: source directory is empty`), so the unchanged snapshot was verified and the permitted plain `mv` fallback completed. The required recursive readback was:

```text
diff -r /tmp/sdd-archive.6DEtb7/source openspec/changes/archive/2026-09-16-issue-978-codex-cold-review (verbatim output):
```

The command produced no differences. The active source directory is absent, and the archived tree contains proposal, both specs, design, tasks, apply progress, verify report, and supporting exploration/research artifacts. Archived tasks have no unchecked implementation items.

## Durable Requirements and Decisions

The canonical specs preserve the approved requirements for bounded Codex `gpt-5.5` execution, host-owned output outside an immutable candidate, complete candidate snapshots, fail-closed findings/security handling, explicit route resolution, route-conditional setup, actionable readiness diagnostics, and positive/negative route coverage. The design records the producer-only transport boundary, per-run isolated Codex home, generic opaque output descriptor, and host-side atomic publication while retaining the existing findings reader and parent-owned poster.

## Risks

None. No files under `brain/core/**` or `brain/project/**` were modified by archive operations.
