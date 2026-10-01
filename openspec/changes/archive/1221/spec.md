# Spec: deterministic stdin for test children

- REQ-1: No spawn in `bootstrap.memory-backend-validate.test.mjs` uses the `input` option; a drift guard
  reads the file's own source (comments and strings masked) and fails if one reappears.
- REQ-2: The `{ eof, raw }` / `stdinLines` API of `runFragment` is unchanged; `eof` is an empty file.
- REQ-3: Any test child that reads stdin to EOF is fed from a file or file descriptor, or given a path argument.
- REQ-4: Reverting #1214's `bootstrap.sh` fix still fails the newline-less tests promptly (not by timeout).
