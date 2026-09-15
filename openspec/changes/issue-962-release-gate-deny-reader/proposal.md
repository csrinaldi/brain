# Issue #962 — the release gate reads the approval deny set through a loader that swallows an unreadable config

## Status
Applied (see `apply-progress.md`).

## Intent

`brain-audit.mjs` is the release gate: `.github/workflows/release.yml` tags a
release only after it exits 0. Its `loadConfig()` read `brain.config.json` and
returned `{}` on ANY error — missing, unreadable, or unparseable — documented
as "returns `{}` on any error (never throws)". `governance.reviewActors`
(read at `brain-audit.mjs:370`, pre-fix `:354`) is a DENY/exclusion list — the
identities EXCLUDED from the human-approver count when a PR's only approval
came from a registered bot. An unparseable `brain.config.json` silently made
that list empty, so nobody was excluded: a merge whose only "approval" was a
bot review counted as human-reviewed, the audit reported clean, and the
release tagged. Nothing said the policy could not be read.

This is the same class issue #942 (R1) already ruled on and fixed in five
other readers — `evidence-reader-empty-on-failure.md`'s "Direction decides
whether empty is safe": a DENY/exclusion reader must propagate a config-read
failure; an ALLOW/exemption reader may still degrade to `[]`. #942's
exploration classified `brain-audit.mjs` as reporting-only and missed it. It
is the release gate.

## Scope

- Fix `brain-audit.mjs`'s `loadConfig` to fail closed on an unreadable or
  unparseable `brain.config.json`, using the existing
  `loadBrainConfigOrThrow(root)` (`brain/scripts/lib/brain-config.mjs`,
  shipped by #942) instead of a local `try { … } catch { return {}; }`.
- Classify every OTHER config consumer in `brain-audit.mjs` as deny or allow,
  so this is not the next one missed (see "Consumer classification" below).
- A Tier 2 doctrine follow-up, drafted only (never promoted): the roster
  paragraph in `evidence-reader-empty-on-failure.md` still names
  `brain-audit.mjs` as a still-broken sixth reader and misclassifies
  `approved-label.mjs` as an ALLOW-list reader. See `brain-drafts/`.

Out of scope: `brain/core/**` and `brain/project/**` are never edited directly
by this change (hard constraint); the doctrine fix is a draft only.

## Acceptance criteria (copied from issue #962)

- With an unparseable `brain.config.json`, `brain-audit.mjs` exits non-zero
  and names the config as the cause.
- With no `brain.config.json`, behaviour is unchanged.
- A test drives both through a temp fixture, never the real clone, and
  neutralizes any sibling reader on the path, so reverting only this reader
  turns exactly its test red.
- The rest of `brain-audit.mjs`'s config consumers are classified deny or
  allow in the change, so this is not the next one to be missed.

## Consumer classification — every config consumer in `brain-audit.mjs`

| Consumer | Location | Key read | Direction | Disposition |
|---|---|---|---|---|
| `loadConfig` | `:159-179` (was `:159-165`) | loads the whole `brain.config.json` | N/A — the loader itself | **FIXED (#962)**: now delegates to `loadBrainConfigOrThrow(cwd)`; propagates any read/parse failure instead of swallowing to `{}`. The throw reaches the top-level `.catch` (REQ-D2-12) and exits 2 before any consumer below runs. |
| `ignoreList` | `:201-203` | `governance.ignoreList` | ALLOW/exemption — paths excluded from certain checks | Unchanged. Empty is already the strict (safe) answer — named explicitly in `evidence-reader-empty-on-failure.md`'s doctrine. |
| `tier` | `:208` (`resolveTier(config)`) | `governance.tier` | Not a deny/allow list — a ratified fixed fallback (`'standard'`) | Unchanged. Covered by the doc's own "Exemption" paragraph for `governance-tiers.mjs`'s `resolveTier` — doctrine choosing one fallback value on purpose, not a deny/allow reader at all. |
| `rawBaseline` | `:218` | `governance.auditBaseline` | Not an identity list — an audit-scope ref, not deny/allow at all | Unchanged. Absent/unreadable → `null` → NO merges are pre-baseline-skipped → **more** merges get audited, which is strictly the safer direction — already fail-strict on absence. |
| `vcs` | `:227`, `:321` (`resolveVcs(config)`, `fetchPrMeta(subject, vcs, config)`) | `vcs.provider`, `project.slug` (adapter wiring) | Not an identity list — VCS adapter configuration | Unchanged. REQ-TS-3 already documents an explicit, visible `[WARN]` degrade by design ("a configuration state, not a fetch failure") — never silent, so it was never the fail-open this issue is about. |
| `botAllowlist` | `:370` | `governance.reviewActors` | **DENY/exclusion** — identities excluded from the human-approver count | **FIXED (#962)** — protected transitively: `loadConfig`'s throw (above) means this line is never reached on a broken config; the whole release gate fails closed instead. |

Net effect: because `loadConfig(cwd)` now throws unconditionally on an
unreadable/unparseable config and that throw is never caught locally, EVERY
consumer below it in the file — deny or allow — is protected the same way on
a config-read failure: the entire audit run fails closed rather than any one
consumer silently degrading. The classification above is about what each
consumer would need to do if `config` were reachable but partially wrong
(e.g. `governance.reviewActors` present but not an array) — that per-key
shape validation is unchanged by this fix and out of scope for #962.

## Tier 2 doctrine follow-up (draft only, never promoted)

`brain-drafts/deny-readers-roster-sixth.draft.md` — a `brain-amendment/1`
draft targeting `brain/core/anti-patterns/evidence-reader-empty-on-failure.md`.
Rewrites the "Applied at" paragraph so it:

1. Lists `brain-audit.mjs`'s `loadConfig` among the FIXED readers (six, not
   five) instead of "still swallows the failure, tracked in issue #962".
2. Reclassifies `approved-label.mjs`'s `resolveApprovedLabel` OUT of the
   ALLOW-reader bullet list. Verified directly against
   `brain/scripts/governance/approved-label.mjs`: `governance.approvedLabel`
   is a single string, not a list, and a config-read failure degrades to the
   ratified constant `DEFAULT_APPROVED_LABEL = 'status:approved'`
   (`approved-label.mjs:19`, caught at `:56-60`) — the same fixed-fallback
   shape the doc already carves out for `governance-tiers.mjs`'s
   `resolveTier` (its own "Exemption" paragraph), not an empty-list ALLOW
   exemption. The prior classification was imprecise; this draft corrects it.

Proven to parse and assess as pending against the real target file with a
throwaway script that imports the real `brain/scripts/lib/amendment-draft.mjs`
(see `apply-progress.md` for the run). `brain:promote` was never invoked.
