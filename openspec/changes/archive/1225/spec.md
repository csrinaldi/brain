# Spec (#1225)

- REQ-1: `package.json` reads 1.11.0 and every install/upgrade pin in `README.md` and `docs/adoption.md` names `v1.11.0`. Mentions of 1.10.1 that are history stay.
- REQ-2: `CHANGELOG.md` opens with a `## v1.11.0` entry that starts with what a consumer observes now, then one section per change, a "What ships" row per merged PR (#1208, #1209, #1210, #1211, #1212, #1213, #1217, #1222), the follow-ups and why this is a minor.
- REQ-3: The entry states that the 1.10.0 line "Enter accepts `engram`" is superseded, quotes the real `ticket.error.noTypeLabel` message and the real `brain:ship` refusals, and names the vendored `marked` 18.0.14 (path, sha256 pin, licence file, not in `dependencies`).
- REQ-4: `docs/adoption.md` states that the issue needs a `type:*` label (checked at `ticket:start`) and that the branch must be pushed before `brain:ship`; `docs/KNOWN-LIMITATIONS.md` lists #1189 and #1190 and says it describes 1.11.0.
- REQ-5: Every behavioural sentence in the CHANGELOG entry and every changed doc line has a row in `claim-sweep.md` with the file:line that proves it, verified YES; a NO is fixed or removed before the commit.
