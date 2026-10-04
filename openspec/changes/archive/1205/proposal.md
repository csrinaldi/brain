# Proposal (#1205)

`env:init` asked `Which memory backend do you use? [engram]: ` and Enter declared `engram` in the tracked `brain.config.json`, then indexed doctrine into the operator's real engram store. ADR-0004 Amendment 3 says the selector has NO default. Measured in both phase-1 demos (#1185, #1204).

Fix: the prompt names both choices and offers no default. Enter re-prompts; a closed stdin leaves the backend undeclared through the existing `bootstrap.memory.undeclared` path.
