# Spec — #1263 who defines the project

The decision is the draft ADR-0040 in `brain-drafts/`. These are #1263's acceptance criteria, stated as requirements for the four slices.

## REQ-1263-1 Daily use never writes the team config
On a repository that already has `brain.config.json`, a fresh developer's `npm run brain:env:init` leaves `brain.config.json` byte-identical and writes `~/.brain/config.json`. An undeclared team axis is refused with a named fix.

## REQ-1263-2 A person runs their own orchestrator without touching the repository
A developer declares `platform.default: "antigravity"` in `~/.brain/config.json` and runs it, with no change to the repository. The value is valid only when it is a key of the union of the team's and the user's `platform.providers`.

## REQ-1263-3 Locked axes refuse a user-level or `.env` override
When the team config sets `<axis>.locked: true`, a value for that axis from `~/.brain/config.json` or `.env` is refused, naming the axis, the source and the fix. `vcs` is never overridable.

## REQ-1263-4 A team-config change needs an owner's approval
A PR that changes `brain.config.json` without an approval from an identity in `governance.approvalActors` is flagged at `lite` and blocked at `standard` and `regulated`.

## REQ-1263-5 Adoption names the owner
When `env:init` creates `brain.config.json`, it seeds `governance.approvalActors` with the adopter's `brain.actor`, and the shipped `CODEOWNERS` covers `brain.config.json`.
