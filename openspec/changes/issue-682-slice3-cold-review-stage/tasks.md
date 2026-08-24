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
- [x] B.6 An engine with no backend REFUSES rather than degrading (REQ-S3-1).
      `harness/stage-seam.mjs` — the `runStage` seam B.5 required and deliberately
      shipped without.

      **Falling back is the failure mode, not crashing.** A seam that quietly ran
      `claude` when the operator wrote `engine: 'plain'` produces a real, well-
      formatted, entirely plausible review from a model they did not choose, and
      nothing on the verdict says so. That is worse than no review, because there
      is no way for them to find out. The file names exactly one engine — the one
      it was given — and that is a property of its shape, not a promise.

      **The refusal rides the existing failure channel** rather than a throw.
      `runColdReviewStage` already has `{routed: true, ok: false, reason}` for "the
      transport ran and broke", which `cli.mjs` refuses to post on; a missing
      backend is a transport failure like a non-zero exit is. One mechanism to keep
      honest, not two. `routed` stays TRUE through it — the operator named an
      engine, so the verdict must not tell them they configured nothing.

      **The oracle is the `backends/` directory, not a fixture list.** The test
      reads it at runtime and asserts conditionally on what each backend actually
      exports: implements `runStage` → its answer must reach the caller; does not →
      the seam must refuse and NAME it. A fixture listing today's backends would
      pass forever while a seventh arrived without `runStage`, and would agree with
      any hardcode a later edit introduced — which is exactly how N6 survived in
      B.5. Measured 22/08/2026: `claude` implements it; `agent-runtime`,
      `antigravity`, `gentle-ai`, `plain` and `settings-hooks` do not, and all five
      refuse. That n=1 is #312's paridad argument, now with a test that watches it.

      **A live instance of #734's shape, found on the way in and reproduced before
      fixing.** `dispatch` discarded the backend's return value —
      `await backend[fn](...args)` with `@returns {Promise<void>}` beside it.
      Harmless while `init` was the only op, because `init` answers nothing; live
      from the moment B.3 added an op whose entire purpose is its `{ok, reason}`.
      Measured: a backend returning `{ok: false, reason: 'status 137'}` came back
      from `dispatch` as `undefined`, so every engine outcome reached
      `runColdReviewStage` as "the engine returned no result".

      Eight mutations, full suite each, tree reverted after every one. Seven died.

      **P2 survived, and the blind claim was in the MODULE's header this time.**
      It said *"every throw is a refusal, not just the two `dispatch` spells out"*
      — and narrowing the catch to `/not found|does not implement/` left the whole
      suite green. The seam would have started RETHROWING the day a third failure
      mode appeared, and a rethrow aborts `brain:review` instead of reporting a
      transport failure the operator can read. Sixth blind claim on this ticket,
      and the first outside a test message: the class does not care which file it
      lives in.

      **Writing its reader found a second, live defect.** The catch is catch-ALL,
      which is precisely why `err.message` was wrong: a rejection with `null` made
      that line throw a TypeError, turning the refusal into the abort it exists to
      prevent. `err?.message ?? String(err)` now. Found by enumerating non-Error
      throws, not by reading the line.

## Slice C — the bound and the close

- [x] C.1 REQ-682-5: `reviewer.convergence.maxRounds` as its own key, distinct from §7's
      `rev >= 3`. Assert the two bounds are not the same number read twice.
      `review/lib/convergence.mjs`, read by the produce loop in
      `evaluators/inferential.mjs` and resolved in `cli.mjs`.

      **Two bounds, two quantities.** §7's `rev >= 3` counts POSTED REVISIONS and
      asks how many times a PR may be re-reviewed before a human is summoned;
      `maxRounds` counts PRODUCE ROUNDS inside one run and asks how long a single
      review may argue with itself. Conflating them is how a PR on its third
      revision gets a one-round review, or a run is told it used up its rounds on
      previous days.

      **The oracle is INDEPENDENCE, not equality, and that distinction is the
      whole task.** Both bounds are small integers and §7's is 3, so a test
      asserting both are 3 would pass under an implementation that read ONE
      constant twice — precisely the conflation the requirement forbids. Two
      knobs, moved one at a time: `maxRounds` moves the loop and leaves §7's
      escalation where it was; `priorRevCount` moves the escalation and leaves the
      loop alone. Neither assertion mentions a shared number.

      **The key was not allowed to be a bound with nothing to bound** — that is
      the defect class this ticket has hit all the way down, and shipping a lonely
      resolver would have been a fresh instance of it. So the produce loop is
      real: `gatherInferentialInputs` iterates, stopping early on a round that
      produces nothing new, and `cli.mjs` resolves the bound at the one place that
      knows a run is starting.

      **The default is a measurement.** `ROUNDS_IN_FORCE_TODAY = 1` is what called
      `generate` before this key existed, not a round number that seemed
      reasonable — REQ-682-5's second clause is "the bound in force today applies,
      UNCHANGED". Imported rather than restated, because a second literal `1`
      would be this very requirement's defect in miniature.

      **Written down because an operator would otherwise learn it from a bill:**
      with today's file transport a higher bound converges on round 2 by
      construction. `makeArtifactGenerate` reads the same static
      `cold-review.md` every round, so every round after the first is entirely
      duplicates. The loop and the bound are real and become load-bearing the
      moment a transport re-runs the stage between rounds; today `maxRounds: 5`
      buys one round of work.

      **A failed round discards the earlier rounds.** Keeping them hands the
      verdict a PARTIAL list it renders as complete — "the model became
      unreachable after round 1" presented as "this is what the reviewer found",
      the same fold as the array coercion this evaluator's header rails against,
      one loop iteration further in.

      Nine mutations, full suite each, tree reverted after every one. Seven died.
      **Two survived, both blind in the way this ticket keeps producing:**

      - **Q6** deleted `maxRounds` from `cli.mjs`'s call — the resolved bound
        computed and never passed. Green, because every unit test hands the loop
        its bound directly. The config key would have been INERT IN THE REAL VERB
        while `convergence.test.mjs` proved the loop honours a bound nobody gave
        it. Same shape as A.3's `deps.inferentialDeps ?? artifactDeps(…)`; seventh
        occurrence overall and the second at the production-glue layer. Three
        tests through `main()` now — and the "unset key runs one round" one is not
        redundant: without it, hardcoding `4` at the call site would satisfy the
        other.
      - **Q8** replaced the id-less dedup key `JSON.stringify(f)` with a random
        value. Green, because every fixture carried an `id`. The hazard is
        asymmetric and silent: with `undefined` as the key for every id-less
        finding, the FIRST is kept and every later one is dropped as a duplicate,
        so a generator that omits ids loses distinct findings and the verdict
        reports fewer than were found. Both directions pinned now.
- [x] C.2a Prove the whole path **through the real verb**: stage runs → artifact written →
      finding reaches the rendered verdict. The wiring, in `cli.mjs`.

      **Measured by grep before this task: `runColdReviewStage` and
      `makeRunStageSeam` had ZERO production callers.** The slice had a producer,
      a transport and a reader that never touched — everything tested, nothing
      reachable from `brain:review`. That is the defect class the mutation passes
      kept finding, at SLICE scale rather than line scale: a capability that reads
      as "built" in every place except the one that runs. Until this commit the
      artifact only existed if a human wrote it by hand.

      **The ordering IS the wiring.** `makeArtifactGenerate` answers `null` for a
      file absent *at the moment it is asked*, so the stage has to run before
      `artifactDeps` resolves. The other order makes the FIRST review on every PR
      report "no transport is configured" about a stage that had just written its
      artifact. Pinned by a test that reads the filesystem from inside the
      engine's turn.

      **A routed stage that FAILED is refused, not fallen through.** Falling
      through reaches `artifactDeps`, finds no file, and renders *"enabled but no
      transport is configured"* — telling an operator who configured an engine
      that they did not. Same words, opposite fact. `routed` surviving the failure
      is what lets this branch tell them apart.

      **An injected `inferentialDeps` replaces the stage entirely** — a caller
      supplying its own generator has supplied what the stage exists to produce,
      and spawning anyway burns a model call nothing reads. **It runs under
      `--dry-run`**, because `--dry-run` governs POSTING, not producing: a preview
      that skipped the stage would render a different verdict from the real one,
      which is the only reason to ask for a preview. Cost is opt-in — `sdd.map`
      ships empty.

      Six tests through `main()`, one with no `stageDeps` at all so B.6's refusal
      is driven by the real seam and the real dispatcher from the verb.

      Seven mutations, full suite each, tree reverted after every one. Six died.
      **R5 survived: `baseRef`/`headRef` replaced with nulls left the suite
      green.** `buildColdReviewPrompt` then falls back to the vague *"the diff of
      this pull request against its base branch"*, so the engine reviews whatever
      it infers rather than the range the verdict binds itself to — **and a review
      of the wrong range is still a well-formatted review.** The composition test
      asserted stage, engine, model and the artifact path, and stopped one field
      short of the one that says WHAT to review. Ninth occurrence on this ticket.
- [x] C.2b The same path **on a real PR**, with the verdict posted and its inline
      comments visible. #682 acceptance criterion 3.
      **Satisfied on PR #765 at `59ecb69`, 24/08/2026**, in ONE invocation of
      `npm run brain:review -- --pr 765` from a maintainer machine where #604's
      negative control passes (an invalid token is rejected, so credentials are
      not proxy-injected). Requires `sdd.map["cold-review"]`, which this repo's
      `brain.config.json` does not carry: migrations run only at file creation,
      and `schemaVersion 0.3.0` predates 0.10.0's key. **The operator adds it
      locally and does not commit it** — see below.

      **The key was committed once, and CI went red on 25 tests. That is the
      measurement that says it must not be.** `brain-config.mjs:20` derives
      `CONFIG_PATH` from the MODULE's own location, not from the caller's `root`:

      ```js
      const REPO_ROOT  = join(dirname(__filename), '..', '..', '..');
      const CONFIG_PATH = join(REPO_ROOT, 'brain.config.json');
      ```

      So `loadBrainConfig()` reads the REAL repo's config no matter which
      fixture repo a test built, and `fixture.mjs:110`'s own `brain.config.json`
      is never the one consulted. The moment the repo routed the stage, every
      test reaching `main()` without an injected `deps.config` saw a routed
      stage, the real seam tried to spawn a `claude` binary CI does not have,
      B.6 refused — correctly — and `cli.mjs` refused to post. 25 e2e tests that
      expect a posted verdict failed. Measured at `dbe6094`: 4245 tests, 25 fail.

      **The 25 failures are the smaller half.** With the key in the tree, every
      `npm test` anyone runs tries to spawn a model: costly, non-deterministic,
      network-dependent. `config-migrations.mjs`'s 0.10.0 entry already ruled
      this — *"Empty by default — an unrouted stage is the honest default, and a
      shipped entry would spawn an engine nobody asked for."* Committing the key
      into the repo that ships that migration is that same defect, one layer up.

      The routing belongs beside the credential, not beside the code: an
      operator sets `sdd.map["cold-review"]` locally for the run, exactly as
      they set `BRAIN_REVIEWER_TOKEN`. **C.2b's evidence does not depend on it
      living in the tree** — the posted verdict below is the durable record.

      **Evidence, all from the same run:**
      - Artifact: `openspec/reviews/pr-765/cold-review.md`, 12606 bytes, a
        `brain-findings/1` block. Deleted before the run, so the presence check
        could not pass on a stale file.
      - Verdict: <https://github.com/csrinaldi/brain/pull/765#pullrequestreview-5007283896>
        — `csrinaldibot`, `COMMENTED`, `head_sha: 59ecb69…`, `rev: 1`,
        `verdict: REVISE`, `escalate: human`.
      - Both halves declared: `controls: ["deterministic", "inferential"]`,
        `controls_not_applied: []`, `challenger_axis: human`.
      - 8 inline comments anchored to file+line, e.g.
        <https://github.com/csrinaldi/brain/pull/765#discussion_r3843006851>
        (`run-cold-review-stage.mjs:105`). Reconciles exactly: 11 findings, 8
        carry `file:`, 8 posted, 0 dropped.
      - REQ-S3-3 — `git status --porcelain -uall` after the run shows the
        artifact as `?? openspec/reviews/pr-765/cold-review.md`, HEAD still at
        the sha the verdict binds to, nothing staged. **The artifact is never
        committed**: committing it would move the head the verdict is bound to,
        and §10 would leave the verdict stale against its own commit.

      **Two prior runs failed, and both failures are evidence too.** One posted
      nothing while exiting 0 — the credential was a fine-grained PAT (403) and
      `poster.mjs` never reads the write verb's `error`, filed as #766. One hit
      `spawnSync claude ETIMEDOUT` at `STAGE_TIMEOUT_MS`, and the CLI refused:
      *"the cold-review stage failed — the engine failed to run: spawnSync claude
      ETIMEDOUT. Refusing to post a verdict that would declare the inferential
      control applied."* — exit 1, PR untouched. That is C.3's refusal proven on
      a real PR rather than against a spy.
- [x] C.3 The negative case stays honest end to end (#682 criterion 6): an engine that
      fails posts nothing and says why. `cli.judgment.test.mjs`, C.3 section.

      **C.2a's tests could not have caught a broken refusal, and that is the whole
      reason this task is separate.** They all run at `--dry-run`, which posts
      nothing regardless — "posts nothing" is only a claim when the run is one
      that WOULD post. These drop `--dry-run` and spy the write verbs, so a
      regression that let a failed judgment half through shows up as
      `prReviewComment: 1`.

      **Four failure modes, each refusing, naming its cause, and leaving every
      write counter at zero:** the engine failed; the engine exited clean and
      wrote nothing; the artifact exists and cannot be read; the engine has no
      backend — that last one through the REAL seam and dispatcher, no injection.

      **Their reasons are asserted PAIRWISE DISTINCT.** Three failures rendering
      one message is the fold this ticket keeps finding, and "something went
      wrong" is not something an operator can act on. Measured by printing them:
      three different messages from three different paths.

      **The control is what makes the rest mean anything.** "Refuses on failure"
      is trivially satisfiable by refusing always, so an engine that ran and found
      nothing must still POST — REQ-S3-4's distinction arriving intact at the
      layer that writes to the PR. Mutation S2 made "found nothing" a failure and
      the control died, along with four older tests.

      **And the refusal comes before the verdict is RENDERED, not after.** A block
      printed to stdout and then withheld is still one a human can paste onto the
      PR by hand, carrying an inferential control it never applied.

      Four mutations, full suite each, tree reverted after every one. All died —
      including S4, the unreadable artifact folding into "found nothing", which is
      #552's shape at the file layer.

      **One blind spot in my own test, found before commit rather than by
      mutation.** The mode table built one row via `mode.name.includes(...)` — a
      branch keyed off the row's DISPLAY NAME. Renaming a row would have silently
      changed what it ran, and that row would then have fallen through to the real
      seam and tried to spawn an actual `claude` binary. Each row carries its own
      behaviour now: a table whose rows mean different things has to say so in the
      table, not in a string comparison beside it.
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

## Slice D — what the cold review found in the slice that built it

C.5's verdict is REVISE: 11 findings, `escalate: human`. **Nine of them are about
this slice's own code, and four were confirmed by reading it before any was
touched.** They are tracked here rather than in the tasks that shipped the
defects, because a task that already says `[x]` is not where a reader looks for
what it got wrong.

The pattern is the one this whole ticket is about, and it landed on the ticket
itself: a declared value with no reader. Tenth, eleventh and twelfth occurrence.

- [x] D.1 **`judgment:cold-4` — `defaultRun` dropped the `cwd` it was handed.**
      `claude.mjs:114` has always called `_run(cmd, args, { cwd, timeoutMs })`;
      `agent-runtime.mjs:79` destructured only `{ timeoutMs }`, so `spawnSync`
      inherited the parent's directory. Production masked it — `cli.mjs:560`
      makes `root === process.cwd()` when `deps.root` is unset — but `root` was
      made an explicit parameter precisely so it could differ, and the day it
      does, the engine reviews an unrelated tree, the artifact check finds
      nothing, and the run reports *"the engine exited cleanly but wrote no
      artifact"*: a true refusal with a false diagnosis. Fixed at `ac4c75b`.

      **The oracle had to be the REAL runner, and that is the whole lesson.**
      `run-stage.test.mjs:101` asserts `opts.timeoutMs` reaches the runner and
      asserts nothing about the directory the child got — and it could not have:
      it hands in a spy, and **a spy records the `cwd` it was GIVEN however the
      real runner treats it.** Every caller-side test in the chain has that
      shape, which is why four layers of correct threading and one drop at the
      end stayed green. The new test spawns a child and asks it for
      `process.cwd()`.

      Two mutations, full suite each, tree reverted after both. Both died, and
      they die on different halves: re-dropping `cwd` kills the directed
      assertion; defaulting `cwd` to `'/'` kills *"an absent cwd still means
      inherit"* — the property every `probeAgentRuntime` caller depends on and
      the one a careless fix would have broken silently.

- [x] D.2 **`judgment:cold-9` — the prompt asked for a field the reader drops.**
      `cold-review-prompt.mjs` documented `causal_disposition` as a field the
      engine may state. It is not in `CARRIED_FIELDS`, so `findings-artifact.mjs:117`
      dropped every stated one through `sanitiseFinding`. **That is the defect
      the module's own header claims derivation prevents, committed by the
      module.** Fixed at `9d77c54`.

      **THE FIX IS TO STOP ASKING, NOT TO START CARRYING, and the finding
      implied the opposite.** It read the drop as the loss — *"the engine's
      stated disposition would have been honoured and rendered had it survived
      the boundary"*. Checked before acting, because the two fixes differ by a
      security property rather than by taste:

      - `verdict.mjs:192` routes `pre-existing`/`base-only` into `follow_ups` —
        OUT of the blocking set.
      - `causal-admission.mjs` spreads `...f` LAST in
        `annotateDeterministicFindings`, so a producer's own value wins over the
        default.

      Carry the field and a cold reviewer de-blocks its own findings by
      declaring them `pre-existing`: the producer grading its own
      admissibility. **This entry first justified that with a measurement that
      does not exist**, and the second cold review caught it: it said
      `classifyAgainstBase` decides the disposition by measuring against the
      base, so a producer's claim would be corrected downstream. False for
      exactly these findings — `gateNameOf` is `/^gate:(.+)$/`, a `judgment:*`
      id does not match, and `base-comparison.mjs:259` returns the finding
      untouched. **A producer finding is never measured; it keeps a DEFAULT, and
      a default is not a measurement.** The wrong reason is corrected here
      rather than deleted, because it pointed the next reader at a safety net
      that was not there — the same defect one layer up, and the third time this
      ticket has produced a claim with no reader inside the fix for a claim with
      no reader.

      **The only lock is the absence from `CARRIED_FIELDS`**, and the reviewer's
      table is worth keeping: unchallenged, a carried `pre-existing` yields
      `escalate: human`, 0 blocking, REVISE; **corroborated by a challenger it
      yields a clean APPROVE over a real blocker.** The escalation that saves it
      today exists only because no challenger is built yet. The reader dropping
      it was already the fail-closed behaviour; the prompt was the wrong half.
      A reversal of this ruling belongs in an ADR, not in a field list.

      **Refused out loud, not by silence.** Deleting the bullet leaves a prompt
      that says nothing, and an engine carrying the habit from another protocol
      still emits the field — dropped with neither side knowing. The prompt now
      states the refusal and its reason.

      **Why every existing oracle was blind, which is the reusable part:**
      `RENDERED_ALWAYS` checks that every CARRIED field renders, and the
      field-list test reads back the enumerated `  - name` block. Both look the
      same way. **Neither asks the converse — is every field this prompt NAMES
      one the reader carries?** A field named in the prose bullets and absent
      from `CARRIED_FIELDS` is invisible to both. The new test asks it.

      Two mutations, full suite each, tree reverted after both. Both died, on
      different halves: re-adding the field to the bullets kills the converse
      test AND the refusal test; deleting the refusal bullet while leaving the
      field uncarried kills ONLY the refusal test — which is what proves
      "says so out loud" is a property the suite can tell apart from "says
      nothing".

- [x] D.3 **`judgment:cold-2` — a blocker disappeared because a model reused a
      label.** The round loop deduplicated by `f?.id`, so two DISTINCT findings
      sharing an id collapsed to one — inside a SINGLE round, on the default
      bound of 1, with the loop not even involved. Fixed at `8e1f70a`.

      **Measured on both sides, before touching anything:** a generator emitting
      `[{id:'J1',…'first claim'},{id:'J1',…'second claim'}]` returns **2**
      findings at base `71a7abd` and returned **1** at head. The second
      **blocker** left the verdict with no condition, no count, no log line.

      Fail-OPEN, and over the one input nobody controls: **the ids are a model's
      choice.** `uniqueId`'s own docstring names *"a generator emitting two
      findings under `J1`"* as real producer behaviour and exists to
      disambiguate it with `#2` — and that disambiguation was unreachable,
      because the finding was dropped before `evaluateInferential` saw it. A
      convergence check had quietly become a filter that trusts a
      non-deterministic producer to label its claims uniquely.

      **The fix keys on CONTENT.** Two findings are the same when they SAY the
      same thing, not when they carry the same name. `findingKey` is total by
      construction because its input is model output — `canonicalJson` in
      `memory/lib/format.mjs` does the same job and THROWS on an unsupported
      value, which here would turn a duplicate check into a crash.

      Three mutations, full suite each, tree reverted after every one, each
      dying on a different property:

      | mutation | what dies |
      |---|---|
      | key by `id` again | the two cold-2 tests |
      | delete the dedup outright | convergence — the new test AND the two already in `convergence.test.mjs` |
      | stop sorting keys in `findingKey` | ONLY the new test |

      **The middle row corrected me.** This entry first claimed the early-break
      had no oracle at all; a grep had missed `convergence.test.mjs:113` and
      `:129`, and the mutation found them where the search did not. The third
      row is what earns the new test its place beside them: order-normalisation
      is a property `findingKey` introduced, and nothing else exercises it.

- [x] D.4 **`judgment:cold-3` — the engine read the operator's tree, not the cold
      checkout.** ADR-0033 names the producer's load-bearing property as *"the
      subagent reads a cold worktree and writes a file"*, and design.md D6 says
      the generator reads the diff from that worktree. It got `root`. cold-boot
      computed `worktreePath`, handed it to `gatherInferentialInputs` — whose
      closure declares no parameters and ignores every coordinate it is given —
      and handed it to nothing else. Fixed at `550c746`.

      **The divergence was silent, and that is what made it dangerous.**
      `git diff BASE...HEAD` still resolves in the operator's tree, because
      cold-boot fetched both shas into the shared object db. So the RANGE was
      right and the file contents were whatever was on disk — an arbitrary
      branch with arbitrary uncommitted changes, reviewed under a verdict that
      binds itself to `boot.headSha`.

      **The read surface and the write target are different places, and the
      finding does not say so.** Pointing the engine's cwd at the worktree
      without moving the artifact lands the findings inside a throwaway
      checkout, where `artifactDeps` does not look — and the presence check then
      reports *"the engine exited cleanly but wrote no artifact"* about a file
      the engine wrote perfectly. Acting on the finding as written would have
      traded one silent wrong answer for a loud one. The prompt now renders the
      path ABSOLUTE into `root`: reads cold, writes where the reader looks.
      `artifactPathFor` stays the one source for the location; `artifactRoot`
      changes only its spelling.

      **No worktree is a REFUSAL.** Falling back to `root` is the defect, and it
      produces a well-formed verdict over the wrong tree. Same move as
      `assertRoutableStage`: a property an ADR names is only as good as the
      thing that keeps it true.

      **A test had PINNED the defect.** `run-cold-review-stage.test.mjs`'s
      composition test asserted `a.cwd === root` and had done so for the whole
      slice — a test holds the wrong behaviour exactly as firmly as the right
      one, and reads exactly as convincing. It asserts the worktree now.

      Four mutations, full suite each, tree reverted after every one:

      | mutation | what dies |
      |---|---|
      | `cwd: root` again | the composition test + the split test |
      | delete the refusal, fall back silently | the refusal test alone |
      | artifact path relative again | the split test — the artifact lands in the worktree and the reader calls it missing |
      | `cli.mjs` stops passing `boot.worktreePath` | all six C.2a/C.3 composition tests |

      The last row is the production-glue axis this ticket has now needed three
      times (A.3, C.1's Q6, here): wiring that no test drives is wiring that can
      be deleted green.

- [x] D.5 **`judgment:cold-1` — a stale artifact passed for one the run wrote.**
      The post-spawn check was a bare `exists`, so it could not tell *"the
      engine wrote this"* from *"a previous round left it here"*. Fixed at
      `54c41aa`: the artifact is removed BEFORE the spawn.

      **It only ever held on the FIRST review of a PR.** Re-review is the normal
      case — §7 counts revisions precisely because it happens, and the `mkdir`
      one line above is recursive for exactly that reason, so re-runs were
      anticipated and the staleness was not. On every later review an engine
      that exited 0 and wrote nothing PASSED, and the verdict for the NEW head
      declared the judgment control applied over findings produced against an
      older one. **Its own test used a fresh repo, which is why the suite stayed
      green** — the fixture agreed with the bug.

      **Deleting is the cheap half of the fix and the honest one.** Afterwards, a
      file at that path was written by THIS run: no clock, no mtime, no
      filesystem resolution to trust. The alternative — recording an mtime
      across the spawn — depends on both, and on the engine rewriting rather
      than touching. The cost is that a failed run leaves no artifact to
      inspect, and it is accepted rather than overlooked: the artifact is
      already ruled ephemeral (`.gitignore`d, with the posted verdict as the
      durable record), so preserving it between runs was never a property
      anyone chose.

      **A removal that fails is a REFUSAL with its own reason.** Continuing
      would run the engine with the stale file in place and land back in the
      state this exists to prevent — and the operator would be told the engine
      wrote nothing, which is a lie about a file it never got the chance to
      replace. The two reasons are asserted pairwise distinct, the way C.3
      requires.

      Three mutations, full suite each, tree reverted after every one:

      | mutation | what dies |
      |---|---|
      | delete the removal | all three cold-1 tests |
      | move it AFTER the spawn | the C.2a/C.3 composition tests and the git test — it eats what the engine wrote |
      | swallow the removal failure | the refusal test alone |

      The middle row is why the ordering has its own oracle, read from inside
      the engine's turn: clearing is correct and clearing late is a new defect,
      and the two are one line apart.

- [x] D.6 **`judgment:cold-6` — two resolvers failed closed without saying so, and
      one was never read.** Fixed at `6afe314`. Both halves, and the second is
      the worse one.

      **OUT LOUD.** `resolveConvergence` and `resolveStageEngine` threw from
      inside `main()`, whose entry point is `process.exit(await main())` with no
      outer catch. An operator's typo in `sdd.map` or `convergence.maxRounds`
      surfaced as a raw `ERR_UNHANDLED_REJECTION`: a Node stack, no
      `brain:review:` line, no verdict. **Measured: the injected error channel
      received nothing.** The run failed closed either way — what was lost is
      the message naming the key to fix, which is the whole point of failing
      closed out loud rather than merely failing. Both are wrapped now, the way
      `resolveJudgment` already was two hundred lines above.

      **READ ON EVERY RUN.** `resolveConvergence` sat inside the branch that
      runs when a transport IS configured, so a repo with none never validated
      the key: `maxRounds: "three"` **RESOLVED WITH EXIT 0**, measured. The
      refusal arrived the day someone routed the stage, not the day they wrote
      the key — and config is wrong when it is WRITTEN.

      **The existing C.1 test could not tell the two apart.** It asserted the
      message by CATCHING a throw, which passes for a real refusal AND for the
      unhandled rejection production actually got. It drives `main()` with an
      error spy now and asserts exit 1 plus a `brain:review:` line.

      Three mutations, full suite each, tree reverted after every one, and the
      third is the one that made the pair honest:

      | mutation | what dies |
      |---|---|
      | unwrap `resolveConvergence` | both C.1 refusal tests |
      | make the stage wrapper rethrow | the `sdd.map` test alone |
      | keep it wrapped but move it back INSIDE the `else` | the no-transport test ALONE |

      The first cut of that middle row moved AND unwrapped in one mutation, so
      it killed the same pair as the first and proved nothing about hoisting.
      Splitting them is what gives each property its own oracle.

- [x] D.7 **`judgment:cold-5` — the requirement and the loop it named were
      different loops.** REQ-682-5 said `maxRounds` bounds *"the
      produce→challenge rounds"*; the implementation bounds produce only, and
      `convergence.mjs` stated the measurement correctly in its own header and
      then bounded half of it. Measured through the real verb: **`maxRounds: 4`
      yields 4 produce calls and 1 challenge.** Fixed at `bd8df2d`.

      **THE REQUIREMENT IS CORRECTED, NOT THE CODE**, and that direction is the
      ruling. The bound exists so a single run cannot loop. The only thing in a
      run that CAN loop is `gatherInferentialInputs`; `applyCausalAdmission` is
      a straight-line call that challenges the blocking set once. Bounding it at
      N buys no safety — it pays N challenger costs to challenge the same
      findings and invites N different answers about one claim.

      **A prose ruling with nothing reading it is this ticket's own defect**, so
      it is pinned: a test drives `main()` at `maxRounds: 4` and asserts 4
      produces and exactly 1 challenge. One mutation — making the challenger run
      once per round, which is what "fixing" the mismatch in the other direction
      would look like — kills it. Whoever tries has to face the reason.

      A challenger that genuinely iterates would change this, and would have to
      change REQ-682-5 with it, deliberately and with its own measurement.

- [x] D.8 **`judgment:cold-7` — the prompt did not warn about the refusal its own
      example can trigger.** The role embeds its worked example in a fence
      carrying `ARTIFACT_TAG`, and `readFindingsArtifact` hard-refuses an
      artifact containing two such blocks. An engine that echoes the example
      above its own findings produces two, and the run refuses. Fail-closed, so
      not a correctness defect — but **the model call is unrecoverable**, and the
      prompt said only *"It contains one fenced block"*. Fixed at `324f4b2`.

      **This is the one instruction the file cannot interpolate**, which is why
      it was missing and why it needs care: every other machine-checkable
      element here is derived from a constant the reader uses, but this
      constraint lives in the reader's CONTROL FLOW (`found.length > 1`). There
      is nothing to derive from, so it is hand-written — exactly the kind of
      sentence that goes stale without anyone noticing.

      **So its oracle does not string-match.** It MEASURES the reader — feeds it
      a two-block artifact, confirms the refusal — and only then requires the
      prompt to describe it. The day the reader tolerates two blocks, the first
      half fails and the warning is deleted deliberately rather than left
      quietly false. One mutation: weakening the wording back to "one fenced
      block" kills it.

- [x] D.9 **`judgment:cold-8` — the highest-level test of the wire spelled the
      contract a second time.** `withArtifact` hardcoded
      `join(repoDir, 'openspec', 'reviews', 'pr-N')` and a hand-written
      ` ```brain-findings/1 ` fence, while `artifactPathFor()` and `ARTIFACT_TAG`
      are exported for exactly that and are what `cold-review-prompt.mjs`
      derives from. Fixed at `324f4b2`.

      **Measured, and the result is more interesting than the finding claims.**
      Moving the single source — `artifactPathFor` returning a different
      filename — and running the e2e file:

      | state | result |
      |---|---|
      | source moved, helper DERIVED (the fix) | 25/25 pass — the helper follows |
      | source moved, helper HARDCODED (before) | **A.4 fails** |

      So the drift was not silent: it would have broken the wire's own e2e test
      the day the path moved. That is what makes `cold-8` correctly rated
      EDITORIAL rather than a correction — and it is still worth fixing, because
      the difference between the two rows is a test that follows a rename and a
      test that has to be repaired by hand while reading a failure that names
      neither cause.

## Answered, not pending — the rest of C.5's verdict

**The count reconciles, and the first version of this section did not.** It
claimed to be "listed so the count is honest rather than implied" and then left
three of the verdict's eleven findings appearing nowhere — `tier2-frontier`,
`cold-7` and `cold-8`. `cold-7` still carries a live inline comment on the PR,
so it existed on GitHub and not in the tracker. A claim about honesty with
nothing checking it is the defect this ticket keeps finding, and the reader here
is arithmetic:

| | |
|---|---|
| the posted verdict | **11** findings |
| closed (D.1–D.9) | `cold-4`, `cold-9`, `cold-2`, `cold-3`, `cold-1`, `cold-6`, `cold-5`, `cold-7`, `cold-8` — 9 |
| ANSWERED, below — not defects | `tier2-frontier`, `budget` — 2 |
| | 9 + 2 = **11** ✓ |

**Nothing here is a defect, and neither has work to do.** Both are correctly
reported and already answered — listed so the count closes at 11 and nobody has
to re-derive why they are not pending:

- `tier2-frontier` (correction) — the diff touches Tier-2 (`config-migrations.mjs`,
  `adr-0033-*.md`). Deterministic and true, and **already satisfied**: what Tier-2
  asks for is a promoted, signed ADR, and ADR-0033 has been one since 21/08/2026
  (B.1). It is a frontier NOTICE — a fact about where the diff reaches — not a
  defect, and there is no edit that would answer it that has not been made.
- `budget` (blocker) — 1204 > 1000 at `lite`. Not a false positive: the reviewer
  keeps `size:exception` in its DENY-SET on purpose, so it reports the overflow
  raw and leaves the waiver to a human. The gate passes on the label; the
  reviewer refuses to read it. Both are correct at once.

## Not in this change

- `same-model` / `cross-family` axes.
- #761 (the three #743 criteria), #759, #760 — though A.1-A.3 give #760's channel gap its
  answer in practice.
