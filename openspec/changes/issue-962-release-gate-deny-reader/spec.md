---
status: applying
issue: 962
---

# Release-gate config-read failure closes, not opens (#962)

## Requirements

### Requirement: an unparseable brain.config.json fails the release gate closed

#### Scenario: unparseable config
- **WHEN** `brain-audit.mjs` runs against a working tree whose `brain.config.json` is present but not valid JSON
- **THEN** the audit exits non-zero and the printed failure names `brain.config.json` as the cause, before any merge is evaluated

### Requirement: an absent brain.config.json behaves exactly as before

#### Scenario: no config at all
- **WHEN** `brain-audit.mjs` runs against a working tree with no `brain.config.json`
- **THEN** the audit proceeds exactly as it did before this change (an empty range still exits 0 with "No commits found"; a populated range is audited with no reviewer-deny-set applied)

### Requirement: the DENY-direction reader propagates, the ALLOW-direction readers are unaffected

#### Scenario: reviewActors is protected transitively
- **WHEN** `brain.config.json` cannot be read or parsed
- **THEN** `governance.reviewActors` (the DENY/exclusion list feeding the human-approver count) is never silently treated as `[]` — the whole audit fails closed before that line is reached

#### Scenario: no sibling reader changes behaviour
- **WHEN** `brain.config.json` is present and valid
- **THEN** `governance.ignoreList`, `governance.tier`, `governance.auditBaseline`, and the VCS adapter config continue to resolve exactly as before this change
