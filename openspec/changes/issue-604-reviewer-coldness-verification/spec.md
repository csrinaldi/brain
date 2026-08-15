---
status: draft
issue: 604
---

# Spec — the reviewer's coldness is not verifiable (issue 604)

## REQ-604-1 — An environment that resolves an invalid token refuses the run

Before the #413 comparison, `gatherIdentity` resolves identity with
`NEGATIVE_CONTROL_SENTINEL`, a sentinel that is not and can never be a credential.
If that probe **resolves to any login**, the run refuses, naming the ambient
identity and stating that rotating the token cannot fix it.

The refusal is **not** the #413 `mismatch` shape. That distinction is the
requirement, not decoration: the mismatch message sent the maintainer through
three token rotations chasing an environment problem.

## REQ-604-2 — The control fails closed on an unusable probe

Only a **recognised authentication rejection** clears the control. Any other
failure — a missing binary, an unreachable API, an unparsed error — is
`unusable` and refuses with its own message.

Scoring an unusable probe as `rejected` would rebuild the very defect the
control exists to catch: a reader that on failure returns something
indistinguishable from "nothing to report". "Could not establish" is not
"established clean".

## REQ-604-6 — A provider lockout is named as such, and never blamed on the token

The control sends one deliberately-invalid credential per run. Repeated invalid
attempts are exactly what providers throttle — GitHub answers a burst with
`403 Maximum number of login attempts exceeded`, which then rejects **valid**
credentials too until the window expires. **The control can cause the condition
that stops it working.**

That outcome is its own state, `lockout`, with its own message: it names the
throttling, says the control may have caused it, and tells the operator to
**wait** — explicitly not to rotate the token, and not to read it as a
credential-injecting environment.

It remains a **refusal**. A lockout is suggestive that credentials are honoured
— a proxy would never produce one, because the sentinel never reaches the
provider *as* an invalid credential — but inferring a clearance from a failure
is the exact inversion this control exists to remove.

Left inside `unusable`, this surfaced as *"could not establish whether this
environment honours the reviewer token"*, sending the operator after a proxy
that is not there: the same mis-diagnosis shape that cost three token
rotations, re-introduced by the fix that exists to prevent it.

## REQ-604-3 — The control does not fire in an environment that honours credentials

Where the provider rejects the sentinel, the run proceeds unchanged and the
verdict still posts. A control that refused everywhere would be worthless, and
this is the requirement that says so.

`GH_TOKEN` takes precedence over `gh`'s keyring session, so a maintainer machine
authenticated with `gh auth login` rejects the sentinel and clears the control.
The control therefore fires only where something **overrides the client's own
credential** — a proxy — and not merely because credentials are ambient.

## REQ-604-4 — A failure to launch is reported as such

`run()` surfaces `spawnSync`'s `r.error` when a command cannot be launched, and
a command that ran and printed nothing keeps an empty `stderr`. The two states
stay distinguishable at the reader.

## REQ-604-5 — Test doubles honour the credential they are handed

No `whoami` double — unit or e2e — resolves a fixed login for any token. The
`gh` stub's `/user` accepts exactly `GH_STUB_VALID_TOKEN` and rejects everything
else, and refuses to guess when that variable is unset.

A double that ignores its token models the credential-injecting environment,
which is the thing under test. `GH_STUB_INJECT_CREDENTIALS=1` stands that
environment up **on purpose**, so REQ-604-1 is proven end to end through the
real verb rather than in-process.

---

# The rulings #604 asks for

## Ruling 1 — `whoami` verification may not be trusted unaccompanied. **Implemented here.**

The negative control ships as REQ-604-1/2/3. Cost, in the same sentence as the
choice: **one extra API call per review run**, and a refusal in environments
that were previously producing verdicts on false evidence — which is the point,
not a side effect.

What it does **not** buy: it does not prove the reviewer is cold, only that the
identity evidence is the token's own. Half 2 is untouched by it.

## Ruling 2 — the credential-injecting environment is declared UNSUPPORTED for `brain:review`

It already was, twice over, and the verb now says so instead of producing false
evidence in silence:

- `gh` is not installed there, and the GitHub provider shells out to it — the
  verb could not have completed a run regardless.
- After REQ-604-1 the control refuses there explicitly, naming the environment
  rather than the token.

The supported environments are stated in the refusal text itself: the
maintainer's machine with the PAT, or a GitHub Actions job with the PAT as a
repository secret.

## Ruling 3 — provenance belongs in the verdict, and is NOT built here

Ruled **yes in principle, deferred in implementation**, with the reason stated
rather than the deferral alone.

A verdict that recorded what produced it — which process, holding which
credential, with or without authoring context — is the only proposal in #604
that makes coldness *verifiable* rather than *procedural*. A warm review would
read as warm instead of being indistinguishable from a cold one.

It is not built here because a provenance field that the producing agent fills
in about itself is **self-attestation**, not evidence: the warm case is exactly
the case that would fill it in wrong. Provenance becomes evidence when the
runner attests to it — a GitHub Actions run id, a workflow identity — which is
the shape #604 already names as the closest thing to a genuinely cold reviewer.

Sequenced in `tasks.md` behind that: provenance should land **with** the CI
runner that can vouch for it, not before. Building the field first would put a
trustworthy-looking slot in the verdict schema with nothing standing behind it —
the same shape as #552's `inferential`: a declared slot, a consumer wired to
fork on it, and no honest producer.

## Ruling 4 — `brain:approve` inherits the ambient resolution. MEASURED, not assumed.

**It does, and the blast radius is larger than the reviewer's — but the remedy
is not this control.**

Measured, driving the real verb through a pty behind a credential-injecting
proxy shim:

```
─── SIGNING PR #640 ─────────────────────────────────────────────
  actor       csrinaldi
  head_sha    deadbeef…

protocol: brain-decision/1
decision: APPROVE
actor: csrinaldi
```

`brain:approve` resolved `actor: csrinaldi` from **ambient credentials with no
token held at all**, and composed a signed `brain-decision/1 APPROVE` block
attributed to the maintainer.

Why this is worse than the reviewer's half 1, stated plainly: **no gate consumes
a `brain-review/N` verdict**, but a signed `brain-decision/1` **is** sufficient
evidence for `actor-check` at `lite` (ADR-0026 Am. 2, #473). The reviewer's
defect produces false evidence nothing reads; this one produces evidence a gate
does read.

Why it is nonetheless a different defect, and not fixed by the negative control:

- Approve resolves identity from ambient credentials **by design**, and posts
  with the **same** ambient credentials. Verified identity and writing identity
  do not diverge — there is no second, inert token, so there is no false claim
  of a token-scoped verification to remove.
- Approve takes no token. Running the control there would mean changing its port
  usage, which `approve/cli.mjs` deliberately avoids (design §F3: no new token
  env var, no port-shape change).

What actually held, measured in the real container: **the TTY lock**.
`brain:approve` refuses before reading or writing anything when stdin is not a
TTY, and it refused here. The typed `SIGN` is the second. Both are the human
keystroke the doctrine says must never be mechanized, and both did their job.

**Ruled:** report it, do not patch it in this change. The honest fix is that
approve should establish the ambient identity is the *operator's*, which is a
change to approve's identity contract and touches ADR-0026's evidence rules —
too large to carry in behind a reviewer fix, and it must not be decided by the
same agent that just wrote the reviewer's control. Filed as follow-up work in
`tasks.md`.

`tracker-board.mjs` and `day-start.mjs` also call `whoami()` — ambient,
cosmetic, no gate reads them. Unchanged, and stated so the next reader does not
re-derive it.
