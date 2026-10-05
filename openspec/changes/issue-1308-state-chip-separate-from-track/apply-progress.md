# Apply progress — issue-1308-state-chip-separate-from-track

Mode: Strict TDD. Single PR. All tasks 1.1 – 5.4 done (see `tasks.md`).

## TDD cycle evidence

| Task | RED (test, why it failed) | GREEN | REFACTOR |
|---|---|---|---|
| 1.1/1.2 | `inflight-model.test.mjs` R1308-6 x2: `workIndex` is not exported | `workIndex` over `collect` + `missingSources` minus hierarchy | none |
| 2.1/2.2 | `state-vocab.test.mjs` R1308-2..9: no `TRACK_MARKS`/`trackMarkOf`; `unclassified` short-circuited | `stateOf(node, work)` ruled precedence, `TRACK_MARKS`, `trackMarkOf` | 2.3: removed the `unclassified` matrix rows/tests, `colour.mjs` comment |
| 3.1/3.2 | `lane-model.test.mjs` + `roadmap-model.test.mjs` (6 failures): no `work` option, no `trackMark`, no `declare` | `work` plumbed through every row shape; `declareFor`; `stateView` | none |
| 4.1/4.2 | `static/state-chip-render.test.mjs` (5 failures): one chip, no track chip, no legend groups, no paste block | `app.js` chips/legend/declare block, `app.css` track chip and warning | removed `status-unclassified`/`state-unclassified` CSS and vars |

Note: the first RED of Phase 4 also exposed a fixture gap (the fake `issueList` carried no `state`, so every node read Done); the fixture was fixed, the production code untouched.

## Results

- `npm test`: 7643 tests, 7640 pass, 0 fail, 3 skipped.
- `npm run brain:repo:check`: clean. `npm run brain:nav`: clean.
- Gated diff vs `origin/main` (ignoreList applied): 246 added / 95 deleted (341 changed), budget 1000 at `lite`.

## Mutations (each failed tests, then reverted)

1. `unclassified` returned before the roadmap/work reading: 5 failures.
2. Work evidence dropped (worktree-only reads Planned): 5+ failures.
3. In flight above Blocked: 2 failures.
4. Warning chip dropped for an undeclared node (`trackMarkOf` returns null): 4 failures.
5. Stale-only evidence removed from the index: 2 failures.

## Real browser

Server `node brain/scripts/ui/server.mjs --port 4327 --root /home/gandalf/IA/brain` (own PID killed afterwards). Shots in the session scratchpad: `v1308-home*.png`, `v1308-home-holding.png`, `v1308-drawer-undeclared.png`.

## Deviations

- `tasks.md` heading `Micro-decisions` renamed to English.
- The holding-lane tile (the card of an undeclared issue) now carries both chips, so the warning is on the card as ruled; the tile gained `data-issue`.
- Legend track group lists `Track <id>`, `? No track`, `⚠ Configuration missing`.
