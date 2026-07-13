# Runbook — The #247 Baptism (Track B / B2 Half 2)

> **Status:** prepared, NOT executed. Half 2 (the `#247` baptism itself, REQ-B2-5) is downstream,
> human-operated, Antigravity-alone, and out of scope for Half 1's checklist. This document is
> Half 1's only Half-2 deliverable — it prepares the baptism, it does not run it.
> **Signature (LOAD-BEARING, host-scoped):** Antigravity CLI 1.1.1 · Gemini 3.5 Flash (Medium) ·
> Google AI Pro · host `gandalf` · 2026-07-12. See `sdd/issue-256-b2/measurements` (#604) and
> `sdd/issue-256-b2/constraints` (#601).

## 1. Permission pre-declaration (Fork A) — TO-VERIFY against real Antigravity

Exp 2 (#604) measured a 4-option permission dialog per mutating command (point-approve /
always-allow-conversation / always-allow-persist-to-`settings.json` / deny). To avoid re-approving
the same circuit repeatedly during the baptism, the runbook proposes pre-declaring the circuit set
via Antigravity `settings.json`:

```jsonc
// ~/.gemini/settings.json (or project .antigravity/ — CONFIRM location live)
{
  "tools": {
    "allowed": [
      "run_shell_command(npm test)",
      "run_shell_command(git commit)",
      "run_shell_command(git push)",
      "run_shell_command(gh pr create)"
    ]
  }
}
```

**FLAGGED TO-VERIFY against real Antigravity at runbook/baptism time — Gemini-CLI inheritance is
PARTIAL (#601/#604). This is the PROPOSED shape, not a confirmed-live shape.** Before the baptism
operator relies on it, confirm live: (a) the exact settings file location, (b) the exact key/value
shape `tools.allowed` expects, (c) that it actually suppresses the per-command dialog for these 4
commands and no others.

### Rollback

1. Before adding anything, record the pre-existing `settings.json` content (or its absence) —
   save a copy, or note explicitly that the file did not exist.
2. After `#247` merges, remove exactly the 4 added allow-entries above.
3. If the file did not exist before step 1, delete it entirely. If it existed, restore the saved
   copy. Nothing else in the file is touched, either direction.

## 2. Hygiene rules (measured hazards, #604 Exp 2/3)

1. **Verify every slash-command with `/help` before use.** The command namespace is shared with
   installed plugins and matching is LAX — measured: `/memory show` mis-resolved to a
   chrome-devtools plugin skill instead of a built-in. Run `/help` first to confirm the command
   resolves to the intended built-in, every time, before invoking it during the baptism.
2. **There is no native `/memory show|reload` in Antigravity CLI 1.1.1.** The ONLY
   context-inspection instrument available is a **sentinel-prompt in a fresh session** — plant a
   unique sentinel string, open a new session, ask the agent to report exactly what it can see. Do
   not assume a memory-inspection slash-command exists; verify absence via `/help` if in doubt,
   then fall back to the sentinel-prompt method.

## 3. Composition statement — the repo layer composes, it never governs alone

This is the CANONICAL location for the REQ-B2-3 composition statement (the compiled `AGENTS.md`
banner does not restate it — one canonical source, this document).

Measured fact (#604 Exp 4, host `gandalf`, Antigravity CLI 1.1.1): Antigravity reads `AGENTS.md`
(and any repo-local `GEMINI.md`, if present) and composes them with host-level globals — on this
pre-configured host: `~/.gemini/GEMINI.md` (rules + persona), the engram MCP server, and the
chrome-devtools plugin. Verbatim example from Exp 4: the agent refused an AI-attribution request
citing `AGENTS.md`'s Tier-3 prohibition, and separately referenced "our global rules" (host
`~/.gemini/GEMINI.md`) for conventional-commit style — both layers active, composed, in the same
session.

**This composition is a property of THIS pre-configured host, not a factory-default Antigravity
guarantee.** Do not assume a fresh, unconfigured Antigravity install exhibits the same engram
auto-discovery or global-rules composition. Before the baptism, perform this composition check
ONCE: confirm the operator's actual Antigravity install loads `AGENTS.md` plus whatever host
globals are configured there, and note explicitly which layers were present.

## 4. Acceptance bar for the baptism (REQ-B2-5) — not yet executed

`#247` MUST complete through Antigravity ALONE, human as operator. Claude Code MAY observe or
support but MUST NEVER co-implement.

- **Acceptance:** `#247` MERGED with a clean `git diff` over every governance-gate file
  (`.github/workflows/governance.yml`, `governance-checks.mjs`, and the other files the gate list
  in `workflow-governance.md` names) — zero changes attributable to the baptism.
- **A gate that blocks Antigravity during the baptism is a STOP-finding, reported and left
  unmodified — never resolved by weakening the gate.** No governance gate change is ever an
  acceptable fix for a baptism failure; it goes back to the human owner as a finding.
- No `cli.mjs` change, no `VALID_OPS` expansion — the baptism exercises the existing `init`
  dispatch surface plus the ordinary SDD/git/PR flow, all through Antigravity.

This is guidance for Half 2. No gate file is touched by the Half 1 PR that ships this document.
