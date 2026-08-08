---
status: draft
issue: 501
epic: 313
artifact_store: openspec
topic_key: sdd/issue-501-reviewer-writes-with-ambient-identity/brain-drafts/vcs-contract-identity-binding
---

# DRAFT for human promotion — `vcs-contract.md`, the port-level identity binding

`brain/**` is Tier 2 (human-only). This is the agent's draft; a human promotes it.

**Destination:** `brain/core/methodology/vcs-contract.md`
**Shape:** a new section after the verb table — not a verb row, because the rule is about the
**port**, not about any one verb. `brain:promote` (ADR-0028) promotes new-file ADRs only, so
this is an in-place edit under `consolidation-protocol.md` §1c/§1d — the file, the
`brain/HOME.md` entry in the same commit, and `AGENTS.md` regenerated.

**Cascade note:** `vcs-contract.md` is not an ADR, so `decision-gate`'s ADR ⇔ `HOME.md`
co-occurrence rule does not fire — but `brain:nav` reachability and the `AGENTS.md`
regeneration (`antigravity.drift.test.mjs`) both still apply.

---

## The port carries the identity, not the verb (issue #501)

Every verb in this contract makes its server calls under **the credential bound to the port
it came from**, never under one resolved inside the verb.

```js
const vcs = await getVcs({ provider, identity });   // identity OPTIONAL
```

- **Bound** — every call, read and write, carries `identity`. GitHub sets `GH_TOKEN` on the
  child process of each `gh` invocation; GitLab passes it as the `PRIVATE-TOKEN`.
- **Unbound** — resolution is the ambient one: `gh`'s keyring session on GitHub,
  `VCS_TOKEN` on GitLab. This is what every non-reviewer caller uses, and it is unchanged.

An explicit `token` argument on a verb that accepts one still wins over the binding, so
`whoami({ token })` can keep resolving the identity of a *candidate* credential — that is
the #413 verification, and it must be able to ask about a token the port is not bound to.

### Why the rule is at the port

**Because the per-verb form was tried and failed.** GitLab's verbs have accepted a `token`
parameter since the port was written — thirteen sites, all correct — and the reviewer still
wrote under the wrong credential, because `poster.mjs` never passed one. GitHub had no such
parameter and fell back to whatever `gh` was logged in as.

Measured on PR #500: the reviewer **verified** as `csrinaldibot` and **posted** as
`csrinaldi`. Both providers wrote as someone other than the reviewer, by two different
mechanisms, and a per-verb parameter prevented neither.

`reviewer-protocol.md` §2 states the standard this satisfies: *"That asymmetry cannot be a
rule the agent remembers… It must be impossible by construction."* A parameter a caller may
omit is a rule the caller must remember. A bound port has no unbound verb to call, and a verb
added tomorrow inherits the binding without knowing it exists.

### What a provider must do to satisfy it

1. **One chokepoint.** Every transport call in the provider goes through a single internal
   helper that applies the bound identity. Not most calls — every call, including reads: a
   port that reads under one credential and writes under another can report on a repository
   it is not writing to.
2. **No inline fallback.** No verb resolves the generic credential itself when a binding
   exists.
3. **A source-level drift guard** asserting both of the above
   (`providers/identity.drift.test.mjs`). This is the load-bearing part. `whoami` was the one
   call site that applied the reviewer token, it was correct, and it stayed alone for the
   entire life of #413 while nineteen other verbs did not follow — and **nothing failed**,
   because a verb that ignores the credential still works. It just works as somebody else.
   A behavioural test cannot see that; only a test on the shape of the source can.

### The fixture rule this contract imposes on its own tests

**Any test of the binding must drive two DIFFERENT identities** — the bound one and the
ambient one. With both set to the same identity, every assertion passes against a port that
ignores the binding entirely, which is exactly how the defect shipped and survived. It is the
cardinality lesson from `red-proof-blind-along-an-unvaried-axis.md` in another dimension:
with N=1 identities, *"wrote as the reviewer"* is trivially true.

### What depends on this holding

- **Lock 3** (`reviewer-protocol.md` §1). The reviewer's identity is allow-listed so L6
  discounts its approvals. That guarantee is about the identity that **writes**; before this
  binding existed it was never load-bearing.
- **The anti-loop lock** (`poster.mjs`). It compares a prior verdict's author against the
  configured reviewer handle. Those coincide only because the handle is verified against the
  token (#413) *and* the port carries that token to the wire (#501). With only the first
  half, the lock saw its own verdict and disowned it — measured: two identical verdicts at
  one `head_sha` on PR #500, and `rev` climbing on every further run.
- **The self-review abstention** (`cold-boot.mjs`), for the same reason.
