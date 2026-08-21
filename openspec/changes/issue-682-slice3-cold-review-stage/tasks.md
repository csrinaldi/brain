# Tasks — slice 3, the cold review as an SDD stage (#682)

## Slice A — the contract, before the transport

- [x] A.1 Define ` ```brain-findings/1 ` and its reader: the fields are `CARRIED_FIELDS`,
      the tag is the selector, and a file carrying `protocol:` shape is REFUSED with the
      reason (#495 D1). `review/lib/findings-artifact.mjs`.
      **The payload is JSON, and the reason is measured, not preferred.** Against the
      verdict's own list reader: the same findings list parses to 1 entry at 2-space
      indent (what `renderVerdict` emits), and to **0 entries** at 0-indent and at
      4-space — silently, as an empty list rather than as uncomputable. Its regexes are
      anchored to one emitter's indentation. Survivable for a block this repo rendered;
      not for a file a model writes, where indentation is the detail nobody controls.
- [x] A.2 The reader fails closed on missing / unparseable / malformed, and reports
      "ran and found nothing" as a distinct state (REQ-S3-4), proven by mutation.
      **The first cut of that pin was blind along the PATH axis** — it asserted
      `findings === undefined` on ONE failure branch while its message claimed to cover
      "a failure", and a mutation adding `findings: []` to the missing-file branch
      survived the file green. The oracle now enumerates all nine `ok: false` branches.
      Re-run against three separate branches: three deaths. Six mutations total, full
      file each, tree reverted clean after every one.
- [x] A.3 Wire the reader to `gatherInferentialInputs` as a `deps.generate` that reads a
      file instead of calling a model. **The judgment half runs end to end**, with a
      hand-written artifact and no agent spawned. `artifactDeps` in `cli.mjs`.
      Three states at the file layer, and the first is deliberately not a failure:
      absent → no `generate` at all, so the half does not run and the verdict still says
      "no transport is configured"; present-and-unreadable → a throw, mapped by
      `gatherInferentialInputs` to `{failed: true}` and refused by `cli.mjs`;
      present-and-readable → the findings, `[]` included.
      **`root` is injectable on `main` for one reason**: without it, every test hands
      `main` a `generate` directly, so `deps.inferentialDeps ?? artifactDeps(...)` could
      be deleted and the suite would stay green. Mutation-checked — deleting the glue
      now kills a test.
- [x] A.4 Prove REQ-S3-5 against a real posted review: a finding with `file`+`line`
      appears as an inline comment. **M3's exit criterion, reached** — and reached
      without spawning anything, because the stage's engine is a file the test wrote.
      Driven through the real verb in the e2e fixture: the anchored finding rides as a
      comment on `big.txt:3` carrying its evidence, the un-anchorable one stays in the
      summary block, `event` is still `COMMENT`, and the verdict declares `inferential`.
      **The tripwire moved rather than being deleted**, as its own instruction required
      — it had survived three owners. Its basis changed and had to be restated: the
      transport now EXISTS and that fixture does not configure it, which is a different
      fact from "the transport does not exist" and is the state every repo sees until it
      runs the stage. The two pins are complements — without the pair, "no comments
      appeared" and "comments cannot appear" are the same observation.

## Slice B — the transport

- [x] B.1 Draft the ADR (`brain-drafts/`) — network, credential and determinism. Promote
      it before B.2. It decides, and this tracker does not proceed without it.
      **ADR-0033, promoted and signed 21/08/2026.** Its own preamble carried a
      `**Status**:` line as ordinary text and `single-status-line` refused the first
      attempt: the verb writes the signature header itself, so the house shape is the
      blockquote it strips. Recorded because the pre-check that missed it validated the
      PARSER (`transformDraft`) and not the GUARDS — two different layers, and only the
      second is what refuses.
- [x] B.2 `sdd.map` with `cold-review` as its first entry; `{engine, model}`, `model`
      opaque (D7). `lib/stage-engine.mjs` + migration `0.10.0`.
      Three states, and the middle one is the only one that produces an engine:
      **unrouted** → `null`, because a repo that routed nothing misconfigured nothing;
      **routed** → `{engine, model}` with the model passed through untouched;
      **routed-but-unreadable** → REFUSES, because an operator who wrote the key asked
      for something and silence would ignore it. `{}` is not "no opinion" once the key
      exists.
      The migration ships `map: {}`. A shipped `cold-review` entry would turn a spawn on
      for every consumer at upgrade — nobody asked for that, and the default has to be
      the state that asks for nothing.
- [x] B.3 The harness op: spawn an engine with a prompt and a model (REQ-S3-2).
      `VALID_OPS = ['init', 'run-stage']`, and `runStage` in the `claude` backend.
      **The additive guarantee is asserted in CODE, not promised.** ADR-0019 rejected two
      different things, and only the first is ever cited: routing the artifact lifecycle
      per-backend (forbidden), and treating one op as the ceiling (also rejected — *"the
      op count is just today's state"*). So the growth is permitted and the fork is what
      must stay unbuildable: `assertRoutableStage` refuses all four lifecycle stages, and
      a test drives every one of them through the op. That is what let ADR-0033 land
      without resolving Compuerta 1 — an argument about which stages are routed is only
      as good as the thing keeping it true.
      **Brain does not parse the engine's stdout.** The contract is the file; the engine
      writes the artifact and slice A's reader reads it. Nothing interprets what the
      agent said, which is what keeps the boundary auditable.
      A non-zero exit is a FAILURE, and so is `status: null` — `spawnSync` reports a
      timeout through `error`, so a guard reading only `status !== 0` lets a hung engine
      through as clean.
- [x] B.4 The provisional role prompt, with its debt recorded against #312 **in
      `tasks.md` and on the ticket**, not only in a header comment (D8).
      `review/lib/cold-review-prompt.mjs`.

      **THE DEBT, recorded here as D8 requires.** The cold-reviewer role is a
      string in `cold-review-prompt.mjs`. It belongs to #312's role port, is an
      instance of #576's Adversary archetype, and is the role #754 says exists
      nowhere. It lives in the reviewer's `lib/` because `brain/roles/` does not
      exist and this stage could not run without a role. **WHEN #312 LANDS:
      delete the module and read the role from the port** — there is no half of
      that file that is reviewer policy rather than role content, so it is a
      clean deletion, not a split. That distinguishes it from
      `resolve-challenger.mjs`, where the AXIS resolution stays.

      **The prompt is DERIVED from the reader, not restated beside it.** Fence
      tag, carried fields, evidence classes, causal dispositions and artifact
      path are all interpolated from the constants `readFindingsArtifact` uses. A
      restated contract goes stale the first time a field moves, and the failure
      is invisible: the engine writes a file, exits 0, the reader silently drops
      the field, and the review is merely quieter than it should be.
      `severity` is the one literal — no `ALLOWED_SEVERITIES` exists, and
      inventing one no validator reads would BE the defect — so the test reads
      `reviewer-protocol.md`'s own `severity:` line and requires the two to agree.

      **The oracle is the reader, run over the whole prompt.** The role embeds a
      worked example in the artifact's shape; the test feeds the entire prompt to
      `readFindingsArtifact` unmocked. Twelve mutations, full suite each, tree
      reverted after every one — eleven died on the first pass.

      **The twelfth survived, and it was my own test that was blind.** Inverting
      the instruction to *"if you find nothing, omit the file"* left the suite
      green: the test replaced the example block with `[]` itself, so it never
      read the sentence its message said it executed. The engine would have been
      told to signal "found nothing" by producing the one state that reads as
      "never ran" — REQ-S3-4's fold, re-created one layer up at the instruction.
      Split into two claims that do not substitute for each other, and M12 dies now.
      Third occurrence of this defect class in my own test code on this ticket.
      Two others were found and closed the same way before commit: the vocabulary
      assertion was blind to an EXTRA value (`includes(join(' | '))` passes when
      the prompt lists a fourth class the validator rejects), and the round-trip
      test claimed in a comment to cover the posted-family refusal "without a
      second assertion" — a coverage claim in a comment, now executed.

      Also corrected here: `resolve-challenger.mjs`'s PROVISIONAL header measured
      that `VALID_OPS` "still routes one op". B.3 made that false. `brain/roles/`
      still does not exist, which is the half carrying the argument — and a stale
      measurement reads exactly like a current one.
- [x] B.5 The stage writes `openspec/reviews/pr-NNN/` and does not commit (REQ-S3-3).
      ~~Pin the not-committing: a test that fails if the run leaves the tree dirty.~~
      `review/lib/run-cold-review-stage.mjs`.

      **This task's own second sentence was wrong, and implementing it literally
      would have inverted the requirement.** The run necessarily leaves the tree
      dirty — the artifact is an untracked file, and that is the point. A test
      failing on a dirty tree would fail on correct behaviour, or would be made to
      pass by having the stage not write at all. REQ-S3-3's property is that the
      run creates **no commit and no other mutation**, which is a different
      sentence: HEAD unmoved, index untouched, no tracked file modified, and the
      artifact the ONLY worktree change.

      **"It performs no git operations" is a claim about an absence**, which no
      assertion about the module's source can check and which a later edit could
      quietly undo. Measured from outside instead: the run happens inside a real
      repository and `git status` is read afterwards. Stronger than "did not
      commit" — a stage that committed nothing but rewrote three tracked files
      would pass that and still have corrupted the diff the verdict is about.

      **The post-run existence check is a fold, not a crash.** An engine exiting 0
      having written nothing leaves no artifact; `makeArtifactGenerate` reads that
      as `null`, and the verdict says *"enabled but no transport is configured"* —
      word for word what a repo that never routed the stage is told. Without the
      check, a silent no-op engine tells the operator who configured it that they
      did not. #552's fold, one layer up, at the producer instead of the runner.

      **No default `runStage`.** Defaulting to one backend would hand it every
      engine a repo routes to — B.6's silent degradation, shipped one commit early
      — so the seam is required and the resolution lands with its refusal in B.6.

      Ten mutations, full suite each, tree reverted after every one. Seven died
      first pass. **Two survived, and both were blind oracles of a kind this
      ticket keeps producing:**

      - **N2** moved the `mkdir` ahead of the routing guard, so an unrouted repo
        got a directory for a run that never happened — and the suite stayed
        green. Both "nothing was created" assertions read `git status`, and **git
        does not track empty directories** at any `-u` level. Git is the right tool
        for "did it commit" and the wrong one for "did it create a directory".
        Asked of the filesystem now.
      - **N6** replaced `routing.engine`/`routing.model` with the literals
        `'claude'` / `'claude-opus-5'` — invisible, because the only fixture
        driving that assertion routed to exactly those two values. **An oracle
        whose fixture equals the hardcode it is meant to catch is not an oracle.**
        Two distinct routings now, one with a `null` model, which also pins that
        an absent model stays absent rather than acquiring a default (#323).

      Fourth and fifth occurrences on this ticket. Both were found by mutation,
      neither by reading.

      **One comment was upgraded from claim to measurement.** `-uall` is load-
      bearing rather than tidiness: plain `--porcelain` collapses a wholly
      untracked directory to `?? openspec/`, under which a stray file dropped
      beside the artifact is invisible. N9 (stray log) dies with `-uall`; N10 (the
      same stray log, listing reverted to plain `--porcelain`) SURVIVES. The
      comment says so because it was run, not because it sounded right.
- [ ] B.6 An engine with no backend REFUSES rather than degrading (REQ-S3-1).

## Slice C — the bound and the close

- [ ] C.1 REQ-682-5: `reviewer.convergence.maxRounds` as its own key, distinct from §7's
      `rev >= 3`. Assert the two bounds are not the same number read twice.
- [ ] C.2 Prove the whole path through the real verb, on a real PR: stage runs → artifact
      written → verdict posted with inline comments. #682 acceptance criterion 3.
- [ ] C.3 The negative case stays honest end to end (#682 criterion 6): an engine that
      fails posts nothing and says why.
- [x] C.4 **The terminal PR is OPEN, as a draft**, from the first slice rather than the
      last — **#765**, `feature/issue-682-slice3-cold-review-stage → main`.
      This task used to say "open it" and was scheduled here, at the end. It moved on
      purpose: #713's defect is a tracker whose work is invisible because no PR carries
      it, and #758 paid for that with 43 commits, 12 merged PRs and no terminal PR until
      the very end. A task that opens the PR last reproduces the shape it exists to
      prevent. Open early, the gates run on every push and say so early too.
- [ ] C.4b Mark it **ready for review** — the slices are complete and `Closes #682` is
      about to be true rather than merely true-at-merge.
- [ ] C.5 Cold review of the chain, from an environment where credentials are not
      proxy-injected — the only place a verdict can be produced (#604, measured four
      times on this line of work).
- [ ] C.6 Close **#682** and **#754**. #754 closes because the role stops being rewritten
      per launch: it is the stage's prompt.

## Not in this change

- `same-model` / `cross-family` axes.
- #761 (the three #743 criteria), #759, #760 — though A.1-A.3 give #760's channel gap its
  answer in practice.
