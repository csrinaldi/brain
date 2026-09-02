# Design: #814 — the engine adapter, the config verb, the first first-party role

Tier `lite`. Implements `specs/sdd-engine-adapter/spec.md` under the proposal's
D1–D6. Worktree `/home/gandalf/IA/brain-issue-814` off `origin/main @ 55700da`.

## T1 — `brain/scripts/config/` layout: one writer module, two callers

```
brain/scripts/config/
  config-verb.mjs        # pure: resolve path, validate, plan migrations, produce next config
  cli.mjs                # brain:config get/set — thin I/O over config-verb.mjs
```

`config-verb.mjs` exports `planConfigWrite({ config, path, value })` → `{ next,
migrationsApplied, refusal }` — PURE, in `role-port.mjs`'s discipline: config
received, never read. `cli.mjs` does the read/write I/O. The discovery verb
imports `config-verb.mjs`, NEVER writes `brain.config.json` itself — one
validator, two callers, the `CLI_OPS`-from-`OPS` house pattern.

**Path grammar**: dot-separated keys, validated against a `KNOWN_PATHS`
declaration derived from the migration defaults (the schema the migrations
already state) — not a second hand-written schema. A path outside it is refused
naming the nearest known family (spec scenario). `set` values parse as JSON
first, bare string on failure — `set sdd.map.tasks '{"engine":"gentle-ai"}'`
and `set docs.language es` both work.

**Migration version**: #806 — the number IS the package version. The draft
ships as `brain-drafts/config-migrations-1.4.0.md` (following #312's 1.3.0
draft precedent; renumbered at land time if the package moved — the #456
precedent, renumbered 0.11.0 → 1.2.0). It declares `sdd.engines: {}`.

## T2 — the gentle-ai declaration: data module beside the backend

`declareRoles(stages)` in `gentle-ai.mjs` reads a sibling data module
`gentle-ai.roles.mjs` — the RECORDED declaration (D2), one exported frozen
object with `_provenance { recorded: true, endpoint:
'~/.claude/agents/sdd-*.md + agent-teams-lite Model Assignments table',
date: '2026-09-02' }`. Tiers per D4. Every stage in the argument is answered:
lifecycle stages from the recorded table; a custom stage the recording never
saw is answered with the framework's default producer role, marked
`derived: true` in a per-role provenance note — never silently invented as
`recorded`.

Rationale for the sibling module: `gentle-ai.mjs` is 302 lines of init
emitter; the declaration is ~90 lines of data. Separating keeps the backend's
init surface and the adapter surface independently reviewable, and the
declaration importable by tests without touching init.

## T3 — `instructions` in the contract

`role-port.mjs` validation grows one clause, placed with the `chooses_model`
check: `typeof role.instructions === 'string' && role.instructions.length > 0`
OR `role.instructions === null` — anything else refused naming stage and
field. `resolveRoles` carries it through to the result verbatim. `plain.mjs`
declares `instructions: null` on every stage (the human path — mirrors its
`model_tier: null`).

## T4 — the Adversary instance, and the assembler split (D5)

```
brain/scripts/roles/first-party/
  adversary-cold-review.mjs   # the role TEXT + _provenance; exports role()
  index.mjs                   # firstPartyRole(stage) → role | null
```

The role module owns what `cold-review-prompt.mjs`'s template said about the
ROLE: identity ("You are a COLD REVIEWER…"), what it may use, what it must not
do, the empty-case doctrine. It carries ZERO protocol literals — no tag, no
field list, no severities, no paths.

`review/lib/cold-review-prompt.mjs` is DELETED. Its replacement,
`review/lib/assemble-review-prompt.mjs`, keeps the derived-from-the-reader
machinery exactly as it stands today — imports from `findings-artifact.mjs` /
`evaluators/inferential.mjs`, the `artifactRoot` absolute-path split, the
worked example — and takes the role text as an ARGUMENT.
`run-cold-review-stage.mjs` fetches `firstPartyRole(COLD_REVIEW_STAGE)` and
hands it in. Direction of imports: review → roles/first-party. `roles/` never
imports review — the diamond holds.

**Neutrality (ADR-0019 Am.1 c.2)**: `firstPartyRole` returns content keyed by
stage. It exposes no engine choice, no routing input, and
`run-cold-review-stage.mjs`'s engine resolution is untouched. The test asserts
the served object has no `engine`/`map`/routing-shaped key.

**`ROLE_DEBT_TICKET` discharge**: the constant, the module, and its test are
deleted. The debt was recorded in three places; the other two (the #682
change's tasks.md, #312's issue) are historical records and stay.

## T5 — the discovery verb

`brain:engines` (`brain/scripts/harness/engines-cli.mjs`): for each
`SDD_ENGINES` member, `loadInhabitant` → `resolveRoles` against the CURRENT
resolved stage set; print per stage: role agent, tier, chooses_model,
instructions state (text/none). A refusing engine is one reported row, not a
crash (spec scenario). `--record` writes `sdd.engines.<name> = { recordedAt,
stages: [...] }` via `config-verb.mjs`. Reader of the recorded key: the verb's
own next run (drift line), and #323's router later — named so the key is not
the unread-field defect.

## T6 — parity, and what dies

- `INHABITANTS` gains `gentle-ai` (the one line).
- The TRIPWIRE test is deleted BECAUSE IT FAILED, with the parity-debt header.
- The `resolve-challenger.mjs` "WHEN #312 LANDS" header and any
  `cold-review-prompt` references update to the port surface.
- The registry stays the explicit map — the `SDD_ENGINES`-scoped directory scan
  #312 authorized is NOT taken here: with `first-party/` under `roles/`, a scan
  needs an exclusion rule, and an explicit two-entry map is smaller than the
  rule explaining it.

## Vocabulary note (D6)

Engines are FRAMEWORKS (skill + doctrine + hooks): `gentle-ai`, `plain`,
a future `brain-sdd-engine`. Platforms are AGENTS (executing runtimes):
Claude, Antigravity, openCode. `sdd.map['cold-review'].engine = 'claude'` in
the operator's working config names ADR-0033's TRANSPORT. This design adds no
code that conflates the axes; the port serves framework declarations and
first-party content, and who RUNS a stage stays where it is.

## Slice risk, restated for tasks

Three surfaces: config verb, adapter+parity, review rewiring. The natural
seams are exactly those three. Review Workload Forecast decides; the review
rewiring (T4) is the one that must not be split from T3 (the field without
its consumer would be the unread-field defect for one PR's lifetime).
