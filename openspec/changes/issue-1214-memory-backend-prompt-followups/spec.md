# Spec delta (#1214)
- REQ-1: At EOF, a non-empty answer that is `engram` or `plainfiles` is kept; an empty or invalid answer at EOF leaves the backend undeclared and the loop terminates.
- REQ-2: Both `en` and `es` `bootstrap.memory.prompt` name `engram` and `plainfiles` and carry no bracketed default.
- REQ-3: With an empty backend the caller warns, appends to `MISSING_OPTIONAL` and never calls `config/cli.mjs set`; with a backend it calls `config/cli.mjs set memory.backend <value>`.
