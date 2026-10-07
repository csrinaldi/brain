# Spec delta: #1386

- R1 `day:start` spawns neither `gentle-ai update` nor `gentle-ai upgrade`; step 3 keeps the version probe and `skill-registry refresh`, prints the `day.ecosystem.runToUpdate` reminder (en + es). Step count stays 6.
- R2 `brain:tools:update` runs `gentle-ai --version`, `update`, `upgrade` in that order, stopping on the first failure and returning its status.
- R3 It refuses (exit 1, nothing spawned) when `CI` is set (not `0`/`false`/empty) or stdin/stdout is not a TTY, with a message saying it must be run interactively.
- R4 The verb is an npm script and a `MANAGED_SCRIPT_KEYS` entry, so consumers receive it.
- R5 No printf specifier inside a `console.log` template in day-start.mjs.
- R6 The axis-port allowlist: day-start `spawn-concrete:gentle-ai` max 2; `tools-update.mjs` max 3, owner #1130.
