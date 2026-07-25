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
 * plain backend init: emit the manual-flow manifest. Zero AI provider, zero
 * network, zero tool beyond the repo's own npm verbs.
 * @param {{ _emit?: (line: string) => void }} [opts] Injectable sink (default console.log).
 */
export async function init({ _emit = console.log } = {}) {
  _emit('SDD_HARNESS=plain — manual flow (no AI). Run these npm verbs in sequence:');
  MANUAL_FLOW_STEPS.forEach((step, i) => _emit(`  ${i + 1}. ${step}`));
}
