# Spec — Secret Scrub + Id-Integrity Hardening (slice C1b)

> Closes the C1 gaps against [issue-201-memory-format/spec.md](../issue-201-memory-format/spec.md)
> (REQ-MF-3, REQ-MF-4, REQ-MF-5) that C1a ([issue-205](../issue-205-memory-format-lib/spec.md))
> deferred, plus id-integrity hardening and the `index.jsonl` rename discovered while closing them.

| Req | Name | C1b status |
|-----|------|------------|
| REQ-SCRUB-1 | Fail-closed secret scan on `memory:share` | ✅ `secret-scrub.mjs` + `engram.mjs#scrubMaterializedChunks` |
| REQ-SCRUB-2 | The allowlist is the only bypass — no CLI flag | ✅ `resolveSecretConfig` + `scanTextForSecrets` (no `--no-scrub` option exists) |
| REQ-ID-1 | `rebuildIndex` id-integrity — fail closed on mismatch | ✅ `store.mjs#rebuildIndex` (reuses `format.mjs#computeRecordId`) |
| REQ-CFG-1 | `0.5.0` additive config migration | ✅ `config-migrations.mjs` + drift guard vs. `secret-scrub.mjs` defaults |
| REQ-GA-1 | Repo-wide `.gitattributes` union-merge line | ✅ appended + single-sourced in `managed-paths.mjs` |
| REQ-RENAME-1 | `index.json` → `index.jsonl` | ✅ renamed in code, tests, and docs |

---

## REQ-SCRUB-1: Fail-Closed Secret Scan On `memory:share`

`memory:share` MUST scan the content it materializes in the CURRENT run — today, the
`.memory/chunks/*.jsonl.gz` files changed by that run's `engram sync --export` (the pre-C2 scrub
target; see [design.md](design.md) Decision 1) — against a pattern set covering, at minimum: a
GitHub personal access token (`ghp_`/`github_pat_`), a GitLab personal access token (`glpat-`),
an AWS access key (`AKIA...`), and a PEM private-key header (`-----BEGIN * PRIVATE KEY-----`). A
match MUST fail the run closed: a non-zero exit, naming the matched pattern and its `file:line`
location. The scan MUST NOT re-scan the whole store on every run.

#### Scenario: A leaked GitHub PAT blocks `memory:share`

- GIVEN a chunk materialized in the current `memory:share` run contains `ghp_<20+ chars>`
- WHEN the scrub runs
- THEN the run fails with a non-zero exit
- AND the error names the matched pattern and the chunk's `file:line`

#### Scenario: A clean run passes

- GIVEN no materialized chunk matches any configured pattern
- WHEN the scrub runs
- THEN `memory:share` completes normally

#### Scenario: The scanner never inspects an unchanged chunk

- GIVEN a chunk that existed before this run and was not touched by it
- WHEN the scrub runs
- THEN that chunk is not passed to the scanner (only `git status`-reported changed chunks are)

---

## REQ-SCRUB-2: The Allowlist Is The Only Bypass

There MUST be no CLI flag (e.g. `--no-scrub`) capable of disabling the scan. The sole permitted
bypass is `governance.memorySecretAllowPatterns`, an array of regex sources in
`brain.config.json` — committed, reviewable, and diffable. A line matched by BOTH a secret
pattern AND an allow pattern MUST be treated as allowed and MUST NOT fail the run; a line matched
by a secret pattern with no corresponding allow-pattern match on that same line MUST still fail
the run.

#### Scenario: A documented false positive is allowlisted

- GIVEN a chunk contains a tutorial example matching `glpat-` shaped like a real token
- AND `governance.memorySecretAllowPatterns` contains a pattern matching that exact line
- WHEN the scrub runs
- THEN the run does not fail on that line

#### Scenario: The allowlist does not suppress an unrelated real leak

- GIVEN one line is allowlisted and a DIFFERENT line contains an un-allowlisted real secret
- WHEN the scrub runs
- THEN the run fails closed on the un-allowlisted line

---

## REQ-ID-1: `rebuildIndex` Id-Integrity — Fail Closed On Mismatch

For every record read while rebuilding `index.jsonl`, `rebuildIndex` MUST recompute the record's
`id` via the ONE shared `computeRecordId` (never a second/duplicated hasher) from the record's
own read fields, and MUST fail closed — throwing with `<filename>:<1-based line number>` in the
message — when the recomputed `id` does not match the stored `id`. A legitimate record (title
already folded into `content`, absent optionals already omitted per R2/R3) MUST NOT produce a
false mismatch.

#### Scenario: A tampered id fails closed

- GIVEN a physical line whose `id` field does not match `computeRecordId` of its own other fields
- WHEN `rebuildIndex` runs
- THEN it throws, and the message contains `<filename>:<line number>`

#### Scenario: A legitimate record never false-positives

- GIVEN a record built via `buildRecord` (title folded, optional `issue` present) and appended
  via `appendRecord`
- WHEN `rebuildIndex` runs
- THEN no error is thrown and the record is indexed

---

## REQ-CFG-1: `0.5.0` Additive Config Migration

`config-migrations.mjs` MUST register a `0.5.0` migration adding
`governance.memorySecretPatterns` (defaulting to the built-in pattern list) and
`governance.memorySecretAllowPatterns` (defaulting to an empty array), following the existing
additive-merge convention (`mergeDefaults`: never overwrite a value the consumer already set).
The migration's default pattern list MUST NOT silently diverge from the scanner's own runtime
default (`secret-scrub.mjs#DEFAULT_SECRET_PATTERNS`) — a test MUST guard the two against drift.

#### Scenario: A fresh consumer config gets both keys

- GIVEN a config at schema `0.4.0` with no `governance.memorySecretPatterns`/`AllowPatterns`
- WHEN migrated to `0.5.0`
- THEN both keys are present with their defaults

#### Scenario: A consumer-set allowlist survives migration

- GIVEN a config already carrying `governance.memorySecretAllowPatterns: ["custom-pattern"]`
- WHEN migrated to `0.5.0`
- THEN that value is preserved unchanged

#### Scenario: The migration default and the runtime default never silently diverge

- GIVEN the `0.5.0` migration's `defaults.governance.memorySecretPatterns` array
- AND `secret-scrub.mjs#DEFAULT_SECRET_PATTERNS`
- WHEN compared
- THEN they are deep-equal

---

## REQ-GA-1: Repo-Wide `.gitattributes` Union-Merge Line

The repo's `.gitattributes` MUST declare `/.memory/records/*.jsonl merge=union` using git's
BUILT-IN `union` driver (no per-clone `git config` registration, unlike the pre-existing
`merge=engram-manifest` custom-driver line). The exact literal MUST be single-sourced as a named
constant in `managed-paths.mjs` so it can be drift-guarded against the real file.

#### Scenario: The literal is present and matches the single source of truth

- GIVEN `managed-paths.mjs#RECORDS_UNION_MERGE_GITATTRIBUTES_LINE`
- WHEN the repo's `.gitattributes` is read
- THEN it contains that exact line

---

## REQ-RENAME-1: `index.json` → `index.jsonl`

Every place that produces or documents the derived index file MUST use the `.jsonl` extension,
reflecting the R1-fixed on-disk shape (one entry per physical line) rather than the misleading
`.json` (whole-document) extension.

#### Scenario: `memory:reindex` writes `index.jsonl`

- GIVEN `memory:reindex` runs
- WHEN it completes
- THEN `.memory/index.jsonl` exists and `.memory/index.json` is never created
