// resume-view.mjs — parsed frontmatter -> the three ruling-3 fields
// (R881-8 Working memory tab, D12). Pure, imported by the browser AND by
// node:test (D9).
//
// `resume.md`'s frontmatter grammar is already parsed by
// `resume-frontmatter.mjs`'s `parseFrontmatter` (server-side, D11 —
// duplicating that grammar in `ui/lib` would be a second reader of one
// format); this module only SHAPES the already-parsed object into the
// three fields `resume-schema.mjs`'s `REQUIRED_FIELDS` names.
//
// `validateResume` is deliberately NOT used as a gate (D12): `resume.md` is
// an operational artefact where staleness is expected, never a gate
// condition (`AGENTS.md:388-395`). A missing field renders `{ok:false,
// reason}` beside the fields that ARE present — never an all-or-nothing
// failure over the whole tab.

const FIELDS = ['next_action', 'current_slice', 'blockers'];

/**
 * shapeResumeView({frontmatter, branch, path}) -> {next_action, current_slice, blockers}
 * — each a drawer field `{ok:true, value, source} | {ok:false, reason, source?}`.
 *
 * @param {{frontmatter: Record<string, unknown>|null, branch: string, path?: string}} input
 */
export function shapeResumeView({ frontmatter, branch, path = 'resume.md' } = {}) {
  const source = { path: `${branch}:${path}` };
  const out = {};
  for (const key of FIELDS) {
    const value = frontmatter?.[key];
    out[key] = value == null
      ? { ok: false, reason: `resume.md on ${branch} has no ${key}`, source }
      : { ok: true, value, source };
  }
  return out;
}

/**
 * The words a reader sees for a resume that is not shown (#1201 R1201-8). Four
 * states, four sentences: collapsing any two would make "no resume exists" read
 * the same as "one exists and could not be read". `null` for a resume that is
 * present. One source for the lane card and the drawer block.
 *
 * @param {{state: string, reason?: string|null}|null} resume
 */
export function resumeWording(resume) {
  if (!resume) return null;
  const why = resume.reason ? `: ${resume.reason}` : '';
  if (resume.state === 'missing') return 'no resume was found for this branch';
  if (resume.state === 'unreadable') return `resume.md could not be read${why}`;
  if (resume.state === 'invalid') return `resume.md is not valid${why}`;
  if (resume.state === 'deferred') return 'resume.md not read yet: this build\'s read budget was spent';
  return null;
}
