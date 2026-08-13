// contributor-scaffold.mjs — ONE neutral source for the contributor-facing
// governance scaffold, with per-provider EMISSION (issue #570).
//
// WHY THIS MODULE EXISTS
//
// `.github/PULL_REQUEST_TEMPLATE.md` is a managed path (brain/core/managed-paths.mjs)
// described there as "the Closes/Fixes scaffold the gate parses (ADR-0014)" — brain
// treats it as part of the gate's own input contract. It was also GitHub-only: a
// consumer who opts into `brain/scripts/ci/gitlab-governance.yml` got `issue-link` as
// a REQUIRED job parsing merge-request descriptions for a closing reference, and no
// scaffold anywhere telling a contributor to write one. That is the #479/#535 class
// one layer up — a provider-specific CONTRIBUTOR CONTRACT on a path that claims to be
// what the gate parses.
//
// THE SHAPE (#340): one source, per-provider emission — never two hand-maintained
// copies. `SCAFFOLD_TEMPLATE` below is the whole neutral text; emission is a pure
// token substitution of the provider's own vocabulary (`{{noun}}`, `{{Noun}}`,
// `{{abbr}}`, `{{path}}`), which each provider module owns as a data constant.
// `contributor-scaffold.test.mjs` folds every emitted file BACK onto the template and
// fails on any residue, so a hand-edit to one provider's copy — the exact way this
// file's predecessor drifted from the doctrine — cannot survive CI.
//
// WHY NOT `brain/core/**`: the neutral source is not doctrine, it is the emitter's
// input. Doctrine (`brain/core/methodology/workflow-governance.md`) is human-signed
// Tier-2 prose; putting the template there would make every wording fix a Tier-2 act
// and would still need an emitter in `brain/scripts/**` to reach two providers. The
// template lives with the code that renders it, is drift-guarded by test against the
// doctrine's own facts (GOVERNANCE_JOBS, the issue-link parser), and travels to every
// consumer under the existing `brain/scripts/**` COPY strategy.
//
// WHAT THE TEXT MAY CLAIM: only what a gate actually does. `decision-gate` dispatches
// to `adrPresence`, whose entire input is the changed-file list plus the added-file
// list — it reads NO labels (ADR-0026 Amendment 4, #516) and is added-only (#510).
// The predecessor of this text promised CI enforcement keyed on a label the gate never
// reads, which was never true. That sentence is not quoted here on purpose: the sweep
// in contributor-scaffold.test.mjs reads every brain-owned file, and a file that
// reproduces the claim in order to disown it is indistinguishable, to a reader
// grepping the tree, from one that means it.

import { CONTRIBUTOR_SCAFFOLD as GITHUB_DELIVERY } from './providers/github.mjs';
import { CONTRIBUTOR_SCAFFOLD as GITLAB_DELIVERY } from './providers/gitlab.mjs';
import { GOVERNANCE_JOBS } from './governance-checks.mjs';

/**
 * Delivery records, keyed by provider. The ONLY provider-specific half of the
 * scaffold: where the platform reads it from, and what the platform calls the
 * thing. Each record is owned by its provider module — the same module that
 * already answers "which provider, which path" for every other verb.
 */
export const SCAFFOLD_DELIVERY = Object.freeze({
  [GITHUB_DELIVERY.provider]: GITHUB_DELIVERY,
  [GITLAB_DELIVERY.provider]: GITLAB_DELIVERY,
});

/** Providers brain emits a scaffold for. */
export const SCAFFOLD_PROVIDERS = Object.freeze(Object.keys(SCAFFOLD_DELIVERY));

/**
 * The `type:*` vocabulary the scaffold offers, and the ONE place it is declared.
 *
 * Measured against the live label set of `csrinaldi/brain` on 2026-08-13 (#570):
 * these six exist; `type:breaking-change` — which the predecessor scaffold offered —
 * returns 404. A contributor who checked that box could not satisfy the "exactly one
 * `type:*` label" item, because there was no such label to add. The drift happened
 * between rare edits, so the guard is a test that reads THIS set and the set the
 * rendered scaffold offers, and fails on any difference in either direction.
 */
export const TYPE_LABELS = Object.freeze([
  Object.freeze({ label: 'type:feature', description: 'New feature' }),
  Object.freeze({ label: 'type:bug', description: 'Bug fix' }),
  Object.freeze({ label: 'type:docs', description: 'Documentation only' }),
  Object.freeze({ label: 'type:refactor', description: 'Code refactoring' }),
  Object.freeze({ label: 'type:chore', description: 'Maintenance / tooling' }),
  Object.freeze({ label: 'type:governance', description: 'Governance / process' }),
]);

/**
 * The closing keywords the scaffold prints as accepted. Provider-independent on
 * purpose: `checks/issue-ref-patterns.mjs#CLOSING_RE` is ONE parser used by both
 * providers' pipelines, so a per-provider wording would be a claim about the parser
 * that is false on one of them. The test proves each of these against that parser
 * rather than against this list's own say-so.
 */
export const CLOSING_KEYWORDS = Object.freeze([
  'Close', 'Closed', 'Closes',
  'Fix', 'Fixed', 'Fixes',
  'Resolve', 'Resolved', 'Resolves',
]);

/** The chain-reference form accepted for slices targeting a non-default branch. */
export const CHAIN_KEYWORD = 'Part of';

/** The fill-in keyword the scaffold leaves on the reference line. */
export const FILL_IN_KEYWORD = 'Closes';

/**
 * One neutral line per governance job. Keyed by `GOVERNANCE_JOBS` — the same
 * registry the workflow job names derive from — so a gate the scaffold describes
 * but that does not exist (or a gate that exists and is never described) is red,
 * not a reader's problem. `{{noun}}` is substituted at emission.
 */
export const GATE_SUMMARY = Object.freeze({
  'issue-link': 'The {{noun}} description references an issue carrying the approved label. Fails closed.',
  'diff-size': 'Changed lines are within the declared tier\'s budget, excluding the configured ignore list.',
  'local-checks': 'The repo-local checks (`npm test`, reference check, navigation check) run in CI too.',
  'memory-gate': 'This repository has EVER recorded a session summary under `.memory/records/`. It is repo-scoped, not per-change.',
  'decision-gate': 'An ADDED ADR is indexed in `brain/HOME.md`, and `brain/HOME.md` is not touched without an ADR. Reads no labels.',
  'phase-order': 'The change\'s SDD artifacts progressed in order. Detection-only at the lightest tier.',
  'actor-check': 'The approval evidence comes from an act distinct from the authoring one.',
  'brain-writes-reviewed': 'Writes to the knowledge half were not authored by an agent identity.',
});

/**
 * THE NEUTRAL SOURCE. Provider vocabulary appears ONLY as `{{noun}}` / `{{Noun}}` /
 * `{{abbr}}` / `{{path}}` — never as a literal, which the drift guard asserts.
 */
export const SCAFFOLD_TEMPLATE = buildTemplate();

function buildTemplate() {
  const typeBoxes = TYPE_LABELS
    .map(t => `- [ ] ${t.description} (\`${t.label}\`)`)
    .join('\n');

  const gateRows = GOVERNANCE_JOBS
    .map(job => `| \`${job}\` | ${GATE_SUMMARY[job]} |`)
    .join('\n');

  const keywords = CLOSING_KEYWORDS.map(k => `\`${k}\``).join(', ');

  return `## Linked issue (required)

<!--
Every {{noun}} must reference an approved issue — \`issue-link\` is a required gate
and fails closed without one.

  · Targeting the default branch: use a CLOSING reference, followed by the issue
    number — the line below is already in that form.
    Accepted closing keywords (case-insensitive): ${keywords}.
  · Targeting any other branch (a chained slice): "${CHAIN_KEYWORD} #N" is accepted too.
    It is NOT accepted on the default branch — the integration {{abbr}} must close.

The referenced issue MUST carry the approved label (\`status:approved\`; scoped
providers use their own separator). An unapproved issue fails the gate exactly as a
missing reference does.
-->

${FILL_IN_KEYWORD} #

## {{Noun}} type

<!--
Check exactly ONE box and add the matching \`type:*\` label.

This list IS the vocabulary — a \`type:*\` value outside it is not a label on this
repository, so checking a box for one leaves the "exactly one \`type:*\` label" item
unsatisfiable. Verify with your provider's label list before adding a new value here.
-->

${typeBoxes}

## Summary

<!-- 1–3 bullet points describing what this {{noun}} does. -->

-

## Changes

| File | Change |
|------|--------|
| \`path/to/file\` | what changed |

## Diff size budget

<!--
The budget is resolved from the repo's declared governance tier, NOT a flat number
(#496): 1000 changed lines at \`lite\`, 400 at \`standard\`, 200 at \`regulated\`.
Additions + deletions, excluding whatever \`governance.ignoreList\` in this repo's
brain.config.json lists (test files, fixtures and lock files are the usual
entries — the list varies per repo, so read it rather than assuming).

If this {{noun}} exceeds the budget, add the \`size:exception\` label and explain why
splitting was not feasible. CI will block merges over budget without it.

\`regulated\` does NOT honor \`size:exception\` — at that tier the label is refused
and the only way through is a smaller diff. Run \`npm run brain:governance-status\`
if you are unsure which tier this repo declares.
-->

- [ ] Diff is under the tier's budget (or \`size:exception\` label added with justification — not available at \`regulated\`)

## Decision / ADR

<!--
What \`decision-gate\` actually does (ADR-0026 Amendment 4, #516; added-only since #510):
it takes the changed-file list and the added-file list. It reads no labels. It fails
in exactly two cases —

  · an ADR is ADDED under \`brain/project/decisions/\` and \`brain/HOME.md\` is not in
    the diff;
  · \`brain/HOME.md\` is in the diff and no ADR path is touched at all.

Everything else passes, including MODIFYING an existing ADR on its own: correcting a
line in an ADR from months ago does not force a re-index.

So if this {{noun}} introduces an architectural or process decision:
  1. Add an \`adr-NNNN-<slug>.md\` under \`brain/project/decisions/\`
  2. Index it in \`brain/HOME.md\` — this is the half the gate checks
  3. Add the \`decision\` label

Step 3 is a HUMAN signal that a decision was made. No gate reads it, and no gate
verifies that an ADR was OWED — "is this a decision?" is judgment, deliberately left
outside the machine.
-->

- [ ] No architectural decision involved
- [ ] ADR added (\`brain/project/decisions/adr-NNNN-*.md\`) and indexed in \`brain/HOME.md\`

## What the gates check

<!--
The governance jobs that run on this {{noun}}. Which of them BLOCK the merge depends
on the tier this repo declares and on what the platform can enforce — run
\`npm run brain:governance-status\` to see the resolved set.
-->

| Gate | What it verifies |
|------|------------------|
${gateRows}

## Test plan

- [ ] \`npm test\` passes (all unit tests green)
- [ ] \`npm run brain:repo:check\` passes
- [ ] \`npm run brain:nav\` passes (no orphans, no broken links)
- [ ] Manually verified the changed functionality

## Contributor checklist

- [ ] Linked an approved issue on the reference line above
- [ ] Exactly one \`type:*\` label added, from the list above
- [ ] Diff size within the tier's budget (or \`size:exception\` labelled and justified)
- [ ] Conventional commit format (\`type(scope): description\`, no AI-attribution trailers)
- [ ] Anything worth keeping was captured with \`npm run memory:share\`. Note that
      \`memory-gate\` does not check this {{noun}}: it asks only whether the repository
      has ever recorded a session summary, and \`skip:memory-gate\` is named in the
      docs but no code reads it — applying it changes nothing.

<!-- Emitted from brain/scripts/vcs/contributor-scaffold.mjs — edit the source, not
     {{path}}. A hand-edit here is refused by contributor-scaffold.test.mjs. -->
`;
}

/**
 * The delivery record for `provider`. Throws on an unknown provider rather than
 * defaulting: silently emitting a GitHub-shaped scaffold for a third provider is
 * how this defect started.
 *
 * @param {string} provider
 * @returns {{ provider: string, path: string, noun: string, nounTitle: string, abbr: string }}
 */
export function scaffoldDelivery(provider) {
  const delivery = Object.hasOwn(SCAFFOLD_DELIVERY, String(provider))
    ? SCAFFOLD_DELIVERY[provider]
    : null;
  if (!delivery) {
    throw new Error(
      `contributor-scaffold: no delivery record for provider "${provider}" — ` +
      `known providers: ${SCAFFOLD_PROVIDERS.join(', ')}`,
    );
  }
  return delivery;
}

/**
 * Emits the scaffold for `provider`: the neutral template with that provider's
 * vocabulary substituted. Pure — no I/O, no clock, no filesystem.
 *
 * @param {string} provider
 * @returns {string}
 */
export function renderScaffold(provider) {
  const d = scaffoldDelivery(provider);
  return SCAFFOLD_TEMPLATE
    .split('{{path}}').join(d.path)
    .split('{{Noun}}').join(d.nounTitle)
    .split('{{noun}}').join(d.noun)
    .split('{{abbr}}').join(d.abbr);
}
