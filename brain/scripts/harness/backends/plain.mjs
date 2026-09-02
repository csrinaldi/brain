// plain.mjs — the `plain` SDD_HARNESS backend: a real, dispatchable second
// inhabitant of `init` (issue #250, B0, REQ-B0-5). No `cli.mjs` change is
// required — the dispatcher is already backend-agnostic (design §4). Emits
// the manual-flow manifest (the nine docs/workflow-guide.md §B npm-verb
// steps). Zero AI provider, zero network call, zero tool beyond the repo's
// own npm verbs.

/** The nine docs/workflow-guide.md §B manual-flow steps (design §4, cross-checked #584 §5). */
const MANUAL_FLOW_STEPS = [
  'npm run brain:env:init — one-time bootstrap.',
  'npm run brain:session:start — open the session (read-only, local).',
  'npm run brain:ticket:start -- <id> — take the issue, create the branch.',
  'npm run brain:project:feature -- --issue <id> — scaffold the change dir.',
  'Edit the four artifacts by hand, in order: proposal.md → spec.md → design.md → tasks.md.',
  "Implement the code, checking off tasks.md items as you go.",
  'npm run brain:repo:check + npm test + npm run brain:change:verify — the gates.',
  'npm run memory:share — persist team memory before pushing.',
  'Commit + open the PR with Closes #<id>.',
];

/**
 * No agent runtime to version-check (issue #123): `plain` is the zero-AI
 * backend by definition, so day-start reports "nothing declared" rather than
 * probing for a binary that is not part of this flow.
 */
export const AGENT_RUNTIME = null;

/**
 * plain backend init: emit the manual-flow manifest. Zero AI provider, zero
 * network, zero tool beyond the repo's own npm verbs.
 * @param {{ _emit?: (line: string) => void }} [opts] Injectable sink (default console.log).
 */
export async function init({ _emit = console.log } = {}) {
  _emit('SDD_HARNESS=plain — manual flow (no AI). Run these npm verbs in sequence:');
  MANUAL_FLOW_STEPS.forEach((step, i) => _emit(`  ${i + 1}. ${step}`));
}

/**
 * `plain`'s role declaration (issue #312 slice A, design D2) — the inhabitant
 * surface `roles/role-port.mjs`'s `resolveRoles` calls. Answers EVERY stage it
 * is asked about, including a custom one `plain.mjs` never heard of: a human
 * executes any stage, which is a real property of this backend (`AGENT_RUNTIME
 * = null` above, one manual flow), not a gap a static map would leave.
 *
 * The three values are CHECKED, not a stub — a stub is a shape with EMPTY
 * values, and each of these would change the day `plain` gained a runtime:
 * `agent: 'human'` (the human executing `MANUAL_FLOW_STEPS`, not a null this
 * object already uses for "no model runs"), `model_tier: null` (a checked
 * value meaning "a human executes this", never a fourth tier), `chooses_model:
 * false` (strictly boolean, never absent — `plain` does not choose a model
 * because no agent runs here to choose one).
 *
 * @param {string[]} stages The resolved stage set to declare a role for.
 * @returns {Record<string, {stage: string, agent: string, model_tier: null, chooses_model: false, instructions: null}>}
 */
export function declareRoles(stages) {
  return Object.fromEntries(stages.map((stage) => [stage, {
    // `instructions: null` — checked (#814 T3): a human executes; there is no
    // prompt to declare. The same reasoning as `model_tier: null` above.
    stage, agent: 'human', model_tier: null, chooses_model: false, instructions: null,
  }]));
}
