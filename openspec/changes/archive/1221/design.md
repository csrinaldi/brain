# Design

`runFragment` prepends `exec 0<'<tmpfile>'` to the bash script and spawns with
`stdio: ['ignore', 'pipe', 'pipe']`. A regular file always yields EOF after its bytes, regardless of
how the harness wires pipes.

## Sweep of `rg -n "input:" brain/scripts test --glob '*.test.mjs'`

| Site | Child | Class | Outcome |
|---|---|---|---|
| `bootstrap.memory-backend-validate.test.mjs` runFragment | bash `read` (needs EOF for newline-less answers) | (b) | `exec 0<file` |
| `bootstrap.default-platform.test.mjs` | `bash -s` reads script to EOF | (b) | script written to a file, `bash <file>` |
| `i18n/coverage.test.mjs` | `eval "$(cat)"` | (b) | `cat "$1"` of a temp file |
| `governance/postmerge/parse-failures.test.mjs` | node CLI reads all stdin | (b) | bash redirects a temp file onto the CLI (`exec node "$0" <"$1"`). An fd handed to `spawnSync` read empty in the reviewer sandbox (PR #1222 rev 1) |
| `hooks/hooks.attribution-parity.test.mjs` | `grep -qiE` on stdin | (b) | message written to a file, passed as grep operand |
| `memory/lane/collect.integration.test.mjs` | `git hash-object --stdin` | (b) | hash the already-existing record file by path (`--no-filters`) |
| `bootstrap.vcs-provider-validate.test.mjs` | bash `read` loop, every answer ends in `\n` and breaks before EOF | (a) | unchanged |
| `review/mode.test.mjs` (6) | `input:` is a plain object argument, no spawn | (a) | unchanged |
| `axes/vcs/contract.test.mjs` 2941, 2989 | mocked spawn captures `opts.input`, no child | (a) | unchanged |
| `axes/vcs/contract.test.mjs` 701 | comment | (a) | unchanged |
| `axes/platform/lib/settings-hooks.test.mjs` 91 | `tool_input` JSON key, no spawn stdin | (a) | unchanged |

Counts: 6 sites class (b), all fixed; 5 groups class (a), unchanged.

## Gotcha
`maskNonCode` (shared by the spawn-hygiene scan) loses sync on a template literal containing an
escaped quote, which silently hides later spawns from the scan. The shell-quote helper avoids template literals.
