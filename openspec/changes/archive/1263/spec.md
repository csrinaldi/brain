# Spec — #1263 who defines the project

The decision is the draft ADR-0040 in `brain-drafts/`. These are #1263's acceptance criteria, stated as requirements for the four slices.

## REQ-1263-1 Daily use never writes the team config
On a repository that already has `brain.config.json`, a fresh developer's `npm run brain:env:init` leaves `brain.config.json` byte-identical and writes `~/.brain/config.json`. An undeclared team axis is refused with a named fix.

## REQ-1263-2 A person runs their own orchestrator without touching the repository
A developer declares `platform.default: "antigravity"` in `~/.brain/config.json` and runs it, with no change to the repository. The value is valid only when it is a key of the union of the team's and the user's `platform.providers`.

## REQ-1263-3 Locked axes refuse a user-level or `.env` override
When the team config sets `<axis>.locked: true`, a value for that axis from the user layer, `.env` or the process env is refused, naming the axis, the source and the fix. `vcs` is never overridable from `.env` or the user layer; in CI the runtime-detected provider wins, outside the precedence, and is not a user override.

## REQ-1263-4 A team-config change needs an owner's approval
A PR that changes `brain.config.json` without an approval from a `governance.owners` member who is not the PR author is flagged at `lite` and blocked at `standard` and `regulated`. A sole owner's self-approval counts only at `lite` in autonomy mode A (ADR-0037).

## REQ-1263-5 Adoption names the owner
When `env:init` creates `brain.config.json`, it seeds `governance.owners` with the adopter's bare login (`brain.actor` without its `@`) and declares a team `default` for every axis, except that a non-interactive (no-TTY) foundation leaves `memory` undeclared (`"default": ""`), never guessed; `diagnoseAxes` reports "memory backend undeclared" as an ERROR until someone chooses one. An existing consumer is not auto-seeded; `diagnoseAxes` reports "no owner declared".

## REQ-1263-6 Tests never read a real home
The user layer is `BRAIN_HOME`, else `<os.homedir()>/.brain`. Every test sets `BRAIN_HOME`, and a guard test fails one that does not.
