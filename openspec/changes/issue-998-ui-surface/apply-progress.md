# Apply progress — issue-998: the Brain UI surface

## PR 1 — state vocabulary, provenance, tokens (2026-09-16, applied inline by the orchestrator: the sub-agent models were rate-limited)

Commits on `feat/issue-998-featui-the-brain-ui-surface-per-the-desi` off `origin/feature/issue-998-ui-surface` (4d47e2f9 = main):

| sha | unit | RED → GREEN | mutation |
|---|---|---|---|
| b43ab2e0 | the change dir: proposal (the issue), design (the map's sections 2–5), spec (R998-1 detailed, R998-2..6 by acceptance), tasks | — | — |
| 59dbf65f | `lib/state-vocab.mjs`: nine states as code + word + mark + class in colour.mjs's priority; `colour.mjs` becomes the class-only view of the same table | ERR_MODULE_NOT_FOUND → 18/18 across state-vocab, colour, canvas-model | swapping the blocked and not-computed priorities → the priority test red |
| 1d5080e1 | `lib/provenance.mjs`: `sourceLabel` moved (plain form kept, drawer-model re-exports), `sourceStamp` renders `[repo: path:line]`, `[forge: #n]` with the href, `[git: sha7]`, `[link: url]`; only https becomes an href | ERR_MODULE_NOT_FOUND → 22/22 across provenance, drawer-model, source-guard | the raw URL instead of the forge stamp → the stamp test red |
| 74ce22dd | `static/app.css`: the token block on bare `:root` with the page's previous colours (light is the base), the design's dark palette under `prefers-color-scheme: dark` redefining only those names, `--font-sans`/`--font-mono` system stacks, node rules re-pointed | 0/3 → 13/13 across tokens, app-source-guard, state-vocab | deleting one state token → two token tests red |
| 771b9eee | `static/app-source-guard.test.mjs`: no `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` in `app.js` | green on today's page (an absence guard) | injecting an innerHTML assignment → red |

Full suite under `GIT_CONFIG_GLOBAL=/dev/null`: see the PR body for the count (tracker baseline: main at 4d47e2f9). `npm run brain:repo:check` green before every commit. Counted diff: see the PR body.

### Deviations from the plan, said
- The spec's R998-1 text says `sourceLabel` renders the stamp forms. It does not: `sourceLabel` keeps the plain form the current page shows beside every value (six drawer-model assertions pin it), and the stamp forms live in `sourceStamp`, which PRs 2–6 use for the redesigned screens. Amended in this batch's spec wording? No — recorded here; the spec is amended in PR 2's first commit when the stamps are first rendered.
- `[link: url]` is a fifth form for an https URL that is not a forge issue or PR (the design named only three); a `javascript:` URL stays text with no href.
- The `unknown` state's class is the renderer's existing `node-unknown`; its mark `✕` is not from the design's table (which has no unknown row).

### Carried
- PR 2 renders `sourceStamp` on the new screens and amends R998-1's wording.
- The design's `APPROVED` / `REVISE` rows are round verdicts, not node states (ruling 2): the timeline in PR 5 owns them; state-vocab has no such codes on purpose.
