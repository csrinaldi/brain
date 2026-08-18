# Delta spec — ADR-0006 Amendment 2 (issue #729)

Scope: one in-place amendment to one signed ADR, via `brain:promote` Route B.
No code changes. No new ADR. The deliverable an agent can produce is the draft;
the promotion and its commit are the maintainer's, because
`brain/project/decisions/**` is Tier 3 and the verb refuses without a TTY.

## REQ-729-1 — the present-tense scope names the package that exists

`brain/project/decisions/adr-0006-…md` MUST NOT assert, in the present tense, that
distribution is a package under a scope that was never published.

**Scenario — a reader reaches the superseded Decision section**
- GIVEN Amendment 1's marker at the Decision heading
- WHEN the reader looks for what replaced git tags
- THEN the scope they are given resolves on the registry
- AND the scope Amendment 1 originally wrote is still visible as the thing that changed,
  not silently swapped

Measured: `@csrinaldi/brain` → `404`, never published. `@logikas/brain` → `200`, `1.1.0`.

## REQ-729-2 — the install line a reader is told to type resolves

The `# HISTORICAL …  The current line is:` comment MUST name an installable spec.

**Scenario — a consumer copies the "current line"**
- GIVEN the historical code block, whose comment exists to redirect the reader
- WHEN they copy the line it points at
- THEN `npm install --save-dev <that line>` resolves a real package

A comment written expressly to say "type this instead" is the one place a stale name
costs a reader something.

## REQ-729-3 — an expired "accepted loss" is terminated, not deleted

The `### The accepted loss` paragraph MUST NOT read as a description of the present,
and MUST remain readable as the reasoning that justified signing ADR-0030 first.

**Scenario — the interval it describes has closed**
- GIVEN a paragraph stating `private: true`, `"name": "brain"`, a git-URL install spec,
  and "#435's mechanical half is open"
- WHEN every one of those has changed
- THEN the paragraph carries an amendment marker naming what expired and when
- AND the paragraph itself survives, because deleting it would erase #590's measurement
  of what the reverse ordering costs

## REQ-729-4 — dated measurements are preserved, not corrected

Rows under the heading `measured on main @ 3dfbdd4` MUST NOT be rewritten.

**Scenario — a preserved row is now false**
- GIVEN the row `test/fresh-install/run.sh still exits 2 without VCS_TOKEN`, which #728 falsified
- AND the row ``@csrinaldi/brain`` is free (`404`)``, which remains true
- WHEN the amendment is applied
- THEN both are left exactly as measured
- BECAUSE a dated measurement is a record of what Amendment 1 saw, and rewriting it would
  destroy the evidence the amendment reasoned from

This is the same treatment ADR-0030 gives the identical fact: annotate, never replace.

## REQ-729-5 — the promotion is a human act

**Scenario — an agent prepares the amendment**
- GIVEN a draft under `openspec/changes/issue-729-adr-0006-stale-scope/brain-drafts/`
- WHEN the agent has verified it parses and plans cleanly
- THEN the agent stops
- AND `brain/project/decisions/**` and `brain/HOME.md` are untouched in the agent's commits
- AND the maintainer runs `brain:promote` and commits, that commit being the signature (ADR-0028)

Enforced twice over: Tier 3 in `agent-authorities.md`, and the verb's own TTY refusal.

## Out of scope

- Any change to ADR-0030, which #653 already corrected.
- Any change to `test/fresh-install/**` — that is #435, delivered in PR #728.
- Numbering, wording or status of any other ADR.
