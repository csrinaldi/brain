# Spec (#1340)

- REQ-1: `package.json` reads 1.12.0 and every install/upgrade pin in `README.md` and `docs/adoption.md` names `v1.12.0`. A mention of 1.11.0 that is history stays.
- REQ-2: `CHANGELOG.md` opens with a `## v1.12.0` entry whose first block is "Manual step: read before upgrading" and covers, in that block, the undeclared-axis refusal, the `1.11.1` migration, the `team-config-reviewed` gate (including the GitLab fail-closed case, #1281), the REFUSE-managed files, and `env:init` in an existing repository. It then has one section per observable change, a "What ships" table, the follow-ups and why this is a minor.
- REQ-3: The entry quotes real messages from `brain/scripts/i18n/en.mjs` and the migration's own output. It does not paraphrase a message it presents as quoted.
- REQ-4: `docs/adoption.md` states that an axis must be declared, documents the user layer, `brain:config user-set`, `locked` and `governance.owners`, and no longer says `.env` holds the agent platform. `docs/KNOWN-LIMITATIONS.md` says it describes 1.12.0 and lists #1281, #1339, #1334 and the #1325 scope note.
- REQ-5: Every behavioural sentence of the CHANGELOG entry and of each changed doc line has a row in `claim-sweep.md` with the file:line that proves it, verified YES. A sentence that cannot be traced is fixed or removed before the commit and listed there as corrected.
- REQ-6: Before publish, the 1.11.0 to 1.12.0 upgrade is run on a scratch consumer from `npm pack` of this tree. Every axis resolves with no refusal and `brain:repo:check` passes; any refusal is a release blocker.
