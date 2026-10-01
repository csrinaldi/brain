---
status: approved
approved: 2026-09-30 (maintainer)
issue: 1198
---

# Proposal — sdd-artifact-reader (issue 1198)

## Intent

The drawer shows most SDD artifacts as presence only. `spec` renders as cards, `tasks` as a checklist and `resume` as frontmatter, and no artifact can be read as a document. The maintainer reads these artifacts to see what agents are doing, and calls this gap FUNDAMENTAL (#1198).

## Scope

### In
- A deterministic markdown-to-DOM renderer for the subset the artifacts use: headings, paragraphs, lists, task items, code blocks, inline code, emphasis, tables, block quotes and links.
- A readable document for each of the 7 artifacts: `proposal.md`, `spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md` and `resume.md`. `archive` is a lifecycle stage (`sdd-model.mjs` `STAGE_IDS`), not a document.
- A source stamp `{path, commit}` on every document.
- Document text served by `change-route.mjs`.

### Out
- #883's uncommitted overlay. No working-tree or index content.
- Editing, LLM summaries, a file-serving route, live links to repo files, and a "load full" action.

## Maintainer rulings (2026-09-30, binding)

| # | Ruling |
|---|---|
| R1 | A relative link renders as inert text showing its path. It is never a live link. |
| R2 | All 7 documents come from committed content (`git show HEAD:<path>`), including `spec.md` and `tasks.md`, which today read the working tree. There is one read path. The exception is `resume.md`: it is branch-local working memory and is already read as `git show <branch>:resume.md` (`change-route.mjs:131`). That read is committed content too, at the change branch's tip rather than HEAD, and it stays as is. |
| R3 | Documents are capped at 256 KB. A capped document carries the note "truncated at N bytes". |
| R4 | Documents are read in the existing SDD tab. Each stage row expands to show its document. No new tabs are added. |
| R5 | An HTML comment renders as visible literal text. |
| R6 | Image syntax renders as inert text `[image: alt]`. Nothing is loaded. |
| R7 | Tokenizing uses `marked`, vendored and pinned (not an npm dependency). Only `marked.lexer()` is called, and `marked.parse()` is forbidden. |

## Constraints

- Escape first, then build structure. Code sets `textContent` only and never uses `innerHTML`.
- Links pass a scheme allowlist. Every other link is inert text.
- No new runtime dependency in `package.json`. The markdown tokenizer is a vendored file (see Approach), not an npm dependency.
- Rendering is deterministic, with no LLM (epic #878, ruling 3).

## Capabilities

- **New:** `sdd-artifact-reader`. It covers the renderer subset, the document route, the source stamp, the cap, and the missing/unreadable wording.
- **Modified:** none. `openspec/specs/` has no UI capability today.

## Approach

**Option A′ (chosen; maintainer ruling R7, 2026-09-30).** The tokenizer is `marked`, vendored. The DOM is ours.

- **Vendored tokenizer.**
  - `marked@18.0.14` (MIT, zero dependencies) is vendored as `brain/scripts/ui/vendor/marked.esm.js`, with its LICENSE beside it. The file is 80 lines and 46 KB, and it is ESM, so the browser and node:test import the same file.
  - The version is pinned exactly. A drift test asserts that the vendored file's sha256 matches the version recorded next to it, so an unrecorded swap fails.
- **Only the lexer is used.** Code calls only `marked.lexer(text)`, which returns tokens. `marked.parse()` and every other HTML-string output are forbidden, and a source guard enforces this. `parse()` produces an HTML string that could only reach the page through `innerHTML`.
- **`ui/lib/markdown.mjs`** is a pure adapter. It maps marked's tokens to our block/inline tree and applies the rulings:
  - an `html` token becomes literal text (R5);
  - an `image` token becomes `[image: alt]` (R6);
  - a relative link becomes inert path text (R1);
  - every other link passes through a scheme allowlist.
  The tree shape stays ours, so the DOM builder does not depend on marked's token format.
- **The DOM builder in `static/app.js`** turns the tree into elements using `textContent` only.
- **`change-route.mjs`** adds a `documents` payload. A single `git show HEAD:<path>` read feeds both the raw text and the existing spec cards, so the two cannot disagree.

**Rejected:**
- **A hand-written tokenizer** (about 380 lines). It re-implements CommonMark and GFM tables and carries the edge cases ourselves.
- **marked or markdown-it as an npm dependency.** It would be the first runtime dependency every `@logikas/brain` consumer installs. The browser cannot import from `node_modules` without a build step or a new route. markdown-it also carries 6 dependencies.
- **unified/mdast.** It has 12 dependencies and needs a separate GFM extension.
- **`marked.parse()`, or any server-rendered HTML string.** Either brings back `innerHTML` and fails `app-source-guard`.
- **`<pre>` raw text only.** It is not readable as a document.

## Affected areas

| Path | Impact |
|---|---|
| `brain/scripts/ui/vendor/marked.esm.js`, `vendor/LICENSE.marked`, `vendor/VERSIONS` | New. The vendored tokenizer, pinned at 18.0.14, with its sha256 recorded. |
| `brain/scripts/ui/lib/markdown.mjs` | New. Pure adapter from tokens to the tree, applying the rulings. |
| `brain/scripts/ui/server.mjs` | Possibly modified. Serves `/vendor/*` if the existing static route does not already serve it. |
| `brain/scripts/ui/change-route.mjs` | Modified. Adds `documents`, moves spec/tasks to HEAD, adds the cap and stamp. |
| `brain/scripts/ui/lib/drawer-model.mjs`, `lib/sdd-model.mjs` | Modified. Expandable stage rows. |
| `brain/scripts/ui/static/app.js` | Modified. DOM builder and row expansion. |
| `brain/scripts/ui/lib/resume-view.mjs` | Modified. Adds the body as well as the frontmatter. |
| `*.test.mjs` beside each file, plus an XSS fixture | New or modified. |

## Risks

| Risk | L | Mitigation |
|---|---|---|
| The renderer becomes an XSS vector | Med | `textContent` only, a scheme allowlist, an XSS fixture, and `app-source-guard`. |
| Moving spec/tasks to HEAD hides uncommitted edits | Med | This is R2's intent. The UI names the commit, and #883 owns the overlay. |
| The subset grows into a full CommonMark | Med | Scope is limited to constructs the artifacts contain. Any other construct renders as literal text. |
| The slice exceeds the lite budget | Med | The split point is below. |

## Size forecast

Measured 921 changed lines, excluding tests (forecast was 450–550), against the `lite` budget of 1000. The vendored file adds 80 lines. Before R7 the forecast was 750–850 with a hand-written tokenizer. If the slice still exceeds the budget, split it into:
1. Renderer, route and the new artifacts.
2. Spec raw text, the resume body, and the move of spec/tasks to HEAD.

## Rollback

Revert the PR. The change adds a payload field and a pure module, with no data migration, config change or dependency. After the revert, spec and tasks read the working tree again.

## Success criteria (mapped to the acceptance criteria)

- [ ] AC1. An XSS fixture (script, `on*` attributes, `javascript:` links, raw HTML) renders inert.
- [ ] AC2. `app-source-guard.test.mjs` passes, with no `innerHTML`.
- [ ] AC3. All 7 documents are reachable from the SDD tab and non-empty, each with a `{path, commit}` stamp.
- [ ] AC4. Each construct yields its expected element. Removing the table rule fails the table test.
- [ ] AC5. "missing" (no file at HEAD) and "unreadable" (the read failed) use distinct wording.
- [ ] AC6. `package.json` gains no `dependencies` entry. The vendored `marked` is pinned, its sha256 is checked by a test, and a source guard proves that no `marked.parse` call and no HTML-string output exist.
- [ ] AC7. Spec raw text and spec cards come from one read and agree on the requirement count.
