---
status: draft
issue: 604
---

# Design — the reviewer's coldness is not verifiable (issue 604)

## §1 Why the control runs BEFORE the #413 comparison

Ordering is behavioural, not stylistic. The control's question is whether the
comparison's **answer can mean anything**, so it has to be settled first.

Run second, a credential-injecting environment surfaces as a `mismatch`
(handle `csrinaldibot`, ambient `csrinaldi`) — the right refusal for the wrong
reason, and the exact message that reads as "your token is wrong". That reading
cost three token rotations. Pinned by
`gatherIdentity: the control runs BEFORE the real verification`.

## §2 The three-way classification, and why `unusable` is not `rejected`

`evaluateNegativeControl` returns one of three states, never a boolean:

| outcome | meaning | action |
|---|---|---|
| `resolved` | an invalid token produced an identity | refuse — credentials are injected |
| `rejected` | a **recognised** auth rejection | control clears |
| `lockout` | the provider is throttling auth attempts | refuse — and say the control may have caused it |
| `unusable` | anything else | refuse — nothing was established |

A boolean would have to fold `unusable` into one of the other two. Folding it
into `rejected` is the `evidence-reader-empty-on-failure` defect this repo has
found five times: a probe that could not run would report as a clean bill of
health. Folding it into `resolved` would refuse every offline run for the wrong
stated reason.

`lockout` was split out of `unusable` by this change's own self-review
(REQ-604-6). It is the one failure mode **this control can cause**: one invalid
credential per run, and a burst of those is what providers throttle. Inside
`unusable` it printed *"could not establish whether this environment honours the
reviewer token"* — accurate, and exactly the wrong thing to act on. Tested
**before** `rejected`, so a message carrying both a status code and throttling
text can never be read as a plain 401, where the remedy is the opposite (nothing
is wrong; proceed).

The residual cost is stated rather than engineered away: the control still
sends one failed authentication per run, which is not equivalent to a normal
call for rate-limiting or for audit telemetry. A repo with authentication
logging will see a steady trickle of failed attempts from the reviewer. The
mitigation that would remove it — caching the control's verdict per environment
— is deliberately **not** taken: a cached clearance is exactly the stale false
evidence this ticket exists to delete.

Measured: `gh` absent yields precisely the `unusable` shape, and it is a state
the operator must be able to tell apart from a proxy.

Recognition is by message match against `AUTH_REJECTION`. Message-matching is
brittle, and it is deliberately biased: an unrecognised rejection is `unusable`
and **refuses**, so the failure mode of the brittleness is a false refusal that
names its reason, never a false clearance. If the port later exposes a status
code, that becomes the discriminator and the regex retires.

## §3 The sentinel

`NEGATIVE_CONTROL_SENTINEL` is a literal constant, never read from config or the
environment — pinned by test. It is shaped like a PAT so a provider that
validates format rejects it on **credentials** rather than on shape, which is
what makes the 401 meaningful.

It must never be satisfiable by the real credential, or the probe proves
nothing. REQ-604-3's e2e case asserts the identity endpoint is hit **twice**:
once with the sentinel, once with the real token.

## §4 Why the test doubles had to change, and what that revealed

Every `whoami` double in the repo returned a fixed login for any token, so the
control refused all of them on its first run: **34 tests went red on a working
change.** That is a finding, not fallout.

`gh-stub` is the sharpest case. It served `user.json` for any `GH_TOKEN` at all
— which, without anyone intending it, is a faithful reproduction of the
credential-injecting proxy. The `/2` e2e suite has been running against a
simulated broken environment since #409, and could not have observed this defect.

It now accepts exactly `GH_STUB_VALID_TOKEN` and refuses to guess when unset —
the same fail-closed rule the stub already applies to `GH_STUB_DIR`.
`GH_STUB_INJECT_CREDENTIALS=1` stands the broken environment up **on purpose**,
which is what lets REQ-604-1 be proven through a real process boundary rather
than an in-process seam.

## §5 `run()` and the empty reason

`spawnSync` reports a failure to launch in `r.error`, with `status: null` and
`stdout`/`stderr` both null. `run()` returned `stderr: ''`, so
`runJson`'s `failed (status ${status}): ${stderr}` rendered:

```
gh api /user failed (status null):
```

The fix prefers a real `stderr` and falls back to the launch error, so a
command that genuinely ran and said nothing still reports nothing — both
directions pinned by `exec.test.mjs`. The `error` object is passed through for
callers that want to branch on `code`, rather than re-parsing a string.

This is scoped deliberately: it is the reader on the path #604 measured, and it
is what made the first refusal in this session unreadable. It is not a sweep of
every reader in the repo.

## §6 Doctrine — nothing here amends `reviewer-protocol.md`

The protocol is Tier 2 and **signed** (`status: current`, #580). Amending it is
ADR → HOME.md → regenerate AGENTS.md, not an edit.

Nothing in this change needs it. §11 says the handle is verified against the
token; the control makes that verification mean what §11 already claims, and
adds no rule. §10's abstention is untouched — half 2 stays open, and Ruling 3
says why building it now would be self-attestation.

Should provenance land (Ruling 3), **that** is an amendment: it changes what a
verdict carries, which §6's schema section defines. Sequenced as such.

## §7 The self-certification hazard

This change modifies the mechanism every other change is reviewed with. The
failure mode to avoid is a fix that certifies itself.

Concretely: `brain:review` cannot run in the environment that produced this
change — `gh` is absent, and the control refuses there regardless. So there is
no cold verdict from the modified tooling on the modification. That is stated in
`proposal.md` and in the PR rather than papered over, and the mutation evidence
in `tasks.md` is offered in its place: three mutations, each shown to land, to
turn the suite red, and to revert byte-identical.
