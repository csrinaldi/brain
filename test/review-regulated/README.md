# review-regulated — the `/2` reviewer e2e (issue #409)

Runs the REAL `brain:review` CLI, end to end, at the `regulated` tier — the only tier
whose default protocol is `brain-review/2`. Until this harness existed, the entire `/2`
path (causal admission, the refuter fork, `/2` findings, `follow_ups`) was exercised by
unit tests and by nothing else; #381 and #413 were found by reading, and this harness
found the tranche budget hardcode (#443) **on its first run**.

## Shape (design D1/D2/D3-amended in `openspec/changes/issue-409-regulated-review-e2e/`)

- **`fixture.mjs`** builds a real consumer: bare origin + working clone with brain
  **vendored** into it (`brain/core` + `brain/scripts` — the `copyManaged` shape), its
  own `brain.config.json` declaring the tier, and a PR-shaped branch whose head sha
  genuinely exists in origin. Nothing git-shaped is faked: cold-boot's
  `git fetch origin <sha>` and detached-worktree checkout run for real. The vendored
  shape is load-bearing — `loadBrainConfig` resolves from the SCRIPT's location, which
  is exactly how a real consumer's copy finds the consumer's config.
- **`gh-stub/gh`** is the ONLY fake: a PATH-prepended binary that serves canned JSON
  from `$GH_STUB_DIR`, captures `POST …/reviews` bodies to `posted/reviews.jsonl`
  (the artifact the assertions parse with the REAL `parseVerdict`), logs every call to
  `calls.log` (how the tests prove the #413 identity verification actually executed),
  and **fails closed** on any argv shape it does not recognize — a new port verb
  surfaces as a loud failure, never a silently-served guess.

## Reuse contract (REQ-409-7 — the landing pad for #405/#408)

`buildFixture({ tier, diffLines, handle, author, prNumber, redJob })`:

- `tier` — any of the three; `lite` is the /1 control (REQ-409-4).
- `redJob` — which required gate the canned rollup reports FAILURE for; the
  deterministic finding of design D4. Set to `null`-ish only if you provide another
  finding source. (The original plan — a diff-budget breach — is blocked on **#443**:
  tranche's budget is hardcoded at 400, untiered. When #443 lands, restore
  `diffLines`-driven breaches and retire this parameter's default.)
- Canned responses are plain files in `stubDir` — a test may overwrite any of them
  after building (see the REQ-409-5b identity-mismatch case).

**Cleanup is mandatory.** Each fixture is ~8 MB (vendored `brain/`, plus a clone and a
bare origin) and this suite runs on every `npm test`. Build through `withFixture(t, …)`,
never `buildFixture` directly — it registers `t.after` removal. Before that helper
existed the development tree had accumulated 47 orphaned trees / 383 MB.

Expected flips when the residuals land, by design:

- **#408** (producers for `pre-existing`/`base-only` + `inferential`): the REQ-409-6
  assertions go red — MOVE them into #408's cases; do not delete them. Note the
  `follow_ups` pin asserts **absence**, in both the parsed verdict and the posted body:
  `renderVerdict` omits the key when the list is empty, so "present and empty" is not a
  state this protocol can currently be in. If #408 makes it emittable, the pin moves to
  presence — but that is a protocol change and belongs to #408.
- **#405** (inline `comments[]`): assert on the captured POST payload's `comments`
  array in `posted/reviews.jsonl` — the stub already captures the full body verbatim.

## Red-proofs performed (tasks.md T8)

- Forcing the vendored `TIER_PARAMS.regulated.reviewProtocol` to `/1` makes the posted
  body `/1` → REQ-409-1 goes red. (First attempt at this mutation hit the JSDoc
  comment, not the value — a reminder that mutations must be verified to have taken
  effect before trusting the red.)
- A nonexistent `headRefOid` in the canned prView makes the run exit non-zero —
  the fixture's git integrity is asserted by production code itself (design D2).
