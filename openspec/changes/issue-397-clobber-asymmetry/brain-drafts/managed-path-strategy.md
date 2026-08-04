# Tier-2 draft — per-path upgrade strategy for the managed manifest

**Status**: Draft — agent-prepared, awaiting human signature (Tier-2 / ADR-0013)
**For**: issue #397 · milestone M4
**Touches**: `brain/core/managed-paths.mjs` — **Tier 2, human-promoted.** No code ships until this is signed.

---

## What was measured, not assumed

A consumer who had edited four managed files ran `brain:upgrade`. The whole run:

```
⚠ 4 collision(s) detected (destination differs from brain source). Proceeding — review the diff:
✓ Copied 4 managed file(s).
Done. Review the diff and commit.
```

| file | before | after |
|---|---|---|
| `.github/CODEOWNERS` | `* @my-team` | `* @brain-team` |
| `.gemini/settings.json` | `{"context":{"mine":true}}` | `{"context":{"brainOnly":1}}` |
| `AGENTS.md` | `MY AGENTS (from my HOME)` | `BRAIN AGENTS` |
| `.github/PULL_REQUEST_TEMPLATE.md` | `my PR template` | `brain PR template` |

Four edits gone, one warning line, exit 0. This is #397 as filed.

## The finding #397 does not contain

`AGENTS.md` is not a file a consumer merely *edits*. It is **generated**, and its inputs are split across the ownership boundary:

```
AGENTS.md  ←  brain/HOME.md                                  managed: false, local: false  → CONSUMER-OWNED
              brain/core/methodology/agent-authorities.md    managed: true                 → brain
              brain/core/methodology/harness-contract.md     managed: true                 → brain
              brain/core/methodology/sdd-layout.md           managed: true                 → brain
              brain/core/methodology/workflow-governance.md  managed: true                 → brain
```

So plain-copying `AGENTS.md` does not lose a consumer's edit — **it hands every consumer brain's own `AGENTS.md`, compiled from brain's `HOME.md`.** A file describing the wrong repository, from the first upgrade onward, for everyone. Regenerating it locally immediately produces something different, which is why brain's own drift-guard would fail in any consumer that ran the generator.

`AGENTS.md` should never be copied at all.

## Why the existing collision check cannot answer this

`copyManaged`'s collision detection (#396) compares **destination bytes vs the INCOMING package's bytes**. That single comparison conflates two different facts:

- the consumer edited the file, and
- brain changed the file between releases.

Both produce "differs". It cannot tell them apart, which is why it can only warn.

**The fix needs no new state.** Before the install runs, `node_modules/brain/<path>` still holds *what brain shipped last time*. That is the missing third point:

| comparison | means |
|---|---|
| dest vs **outgoing** package | the consumer modified it |
| outgoing vs **incoming** package | brain changed it |
| dest vs incoming | today's check — the two, conflated |

This is the same "read the outgoing package before the install" move #398 already uses for its migration list, so the machinery exists.

---

## Proposed classification — THE DECISION THIS DRAFT ASKS FOR

| path | strategy | why |
|---|---|---|
| `.gemini/settings.json` | **MERGE** | Same shape as `.claude/settings.json`, which already has a deterministic merge (#103). Consumer keys win; brain's block is spread underneath. No reason to treat two sibling agent-config files differently. |
| `.github/CODEOWNERS` | **REFUSE if modified** | No meaningful merge — ownership lines are a policy, not a set to union. Abort naming the file with a diff; `--force-managed <path>` to overwrite deliberately. |
| `.github/PULL_REQUEST_TEMPLATE.md` | **REFUSE if modified** | Same: prose a team rewrites wholesale. |
| `.github/workflows/governance.yml` | **REFUSE if modified** | A consumer who pinned a runner version or added a job loses it silently today. Merging YAML semantically is not cheap and not safe. |
| `.github/workflows/release.yml` | **REFUSE if modified** | idem |
| `.github/workflows/governance-postmerge.yml` | **REFUSE if modified** | idem |
| `brain/scripts/ci/gitlab-governance.yml` | **REFUSE if modified** | idem — the GitLab sibling |
| `AGENTS.md` | **NEVER COPY — regenerate** | See above. Copying is not a lossy merge; it is wrong. Remove it from `managed` and regenerate post-upgrade from the consumer's own `HOME.md`, reporting that it did. |
| `.gitattributes` | **plain copy (unchanged)** | Not named in #397. It is brain's own line-ending/diff policy for managed paths, not something a consumer curates. Flagged so the decision is explicit rather than an omission. |
| `brain/core/**`, `brain/scripts/**` | **plain copy (unchanged)** | ADR-0003: core is read-only in the consumer. Editing them is out of contract; the collision warning is already the right response. |
| `.claude/settings.json`, `package.json` | **MERGE (unchanged)** | Already correct. |

## Consequences of adopting this

**Positive**

- No file a consumer edited is ever silently replaced — every overwrite becomes a real merge or an explicit, per-path, confirmed act. That is #397's exit criterion, met literally.
- `AGENTS.md` stops being wrong in every consumer repo.
- `--force-managed <path>` mirrors `--skip-merge <path>` (#399), so the escape-hatch vocabulary stays consistent — and it must route the same way: a forced path is *overwritten*, a refused one is *left alone*, never silently swapped.

**Costs, accepted**

- A consumer who edited a workflow now has to act on each upgrade until they revert or force it. That is the point; today they lose the edit and never learn.
- Removing `AGENTS.md` from `managed` means an existing consumer keeps whatever copy they already have until they regenerate. The upgrade should say so rather than leave it implicit.
- Three-way comparison needs the outgoing package read before the install. Under `--no-install` the outgoing and incoming are the same tree, so modification detection degrades to today's behaviour — which must be **stated**, not discovered.

## Open questions for the signer

1. **`.gitattributes`** — brain-owned as classified here, or consumer-editable like CODEOWNERS?
2. **Existing consumers already clobbered.** Some repos already have brain's `AGENTS.md` and brain's `CODEOWNERS` from earlier upgrades. Should the first run after this lands detect and report that, or stay silent and only protect from here on?
3. **`--force-managed` granularity** — per path (as drafted), or a single `--force-managed` that accepts all pending? Per path is more typing and much harder to do by accident.

## References

- Issue #397 · epic #313 (M4 hard gate) · #401 needs this for its second danger path
- ADR-0003 (core is read-only in the consumer) · ADR-0006 (the upgrade contract)
- #103 (the `.claude/settings.json` merge this reuses) · #105 (`--abort-on-collision`)
- #399 (`--skip-merge`, whose shape `--force-managed` mirrors)
- `brain/core/anti-patterns/pre-v0-8-0-upgrade-clobber-lockout.md` (#180 — the identity-clobber sibling of this defect)
