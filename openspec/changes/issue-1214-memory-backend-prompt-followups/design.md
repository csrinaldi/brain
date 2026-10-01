# Design (#1214)
- Fix 1: `if ! read ...; then case valid) keep;; *) clear;; esac; break; fi` inside the existing validate loop.
- Fix 3: new `BEGIN/END memory-backend-declare` markers around the caller `if [ -z "$MEMORY_BACKEND" ]` block; the test lifts it with `fragment()` and stubs `node` (logs argv to a temp file, since the block discards its output) and `warn`. No whole-bootstrap spawn, no real config touched.
- Spawns use `stdio: ['ignore', ...]` (or non-empty `input`) and a 10s timeout; spawn-hygiene allowlist updated for the new line numbers.
