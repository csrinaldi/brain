# ADR-0026 Amendment 3 — paste-ready draft (issue #454)

> **Tier 2.** An agent drafted this; a human signs it. The three acts below follow
> `consolidation-protocol.md` §1c and go in **one commit** together with the
> `brain/HOME.md` edit (§1d act 2) and the regenerated `AGENTS.md` (§1d act 3).
>
> `brain:promote` cannot do this — it promotes NEW `adr-NNNN-*.md` files only and
> refuses in-place edits by design (`brain-promote.mjs:335`). Automating it is #509,
> unbuilt. Precedent for the manual shape: `git show be2d143` (Amendment 2, #473).
>
> `promote-amendment-3.sh`, next to this file, performs acts 1-3 plus the `HOME.md`
> edit deterministically and stops before committing. Review its diff; the commit is
> the signature.

---

## ACT 1 — the Status line

Replace line 3 of `brain/project/decisions/adr-0026-governance-doctrine-tiers.md`:

```diff
-**Status**: Accepted · **amended 08/08/2026** (Amendments 1-2 — see below)  
+**Status**: Accepted · **amended DD/MM/2026** (Amendments 1-3 — see below)  
```

(Trailing two spaces are significant — they are the markdown line break.)

---

## ACT 2 — annotate the superseded rule in place

In the `GATE_MATRIX` table, the `actor-check` row already carries the Amendment 2
annotation. Append the third **inside the same cell**, immediately after it, so a
reader who never scrolls to the amendments is not left with the superseded rule:

```
 **[Amended by Amendment 3 (#454) — the exempt set also includes identities registered in `governance.agentActors`: an agent acting inside the approved loop under the approver's instruction does not re-arm the approval; see Amendment 3.]**
```

---

## ACT 3 — append the signed section

At the end of the file:

```markdown
## Amendment 3 — an agent identity inside the approved loop does not re-arm (issue #454)

**Signed**: DD/MM/2026 — Cristian Rinaldi

### What changed

At `lite`, `actor-check`'s distinct-act evidence compares the approved-label event
against the latest **foreign** commit. Amendment 1 defined foreign as *authored by
neither the approver nor a registered `governance.reviewActors` identity*. This
amendment adds a third exempt set: **`governance.agentActors`**.

The key is read with `?? []`, is **absent by default**, and is deliberately NOT added
to `config-migrations.mjs`. `governance.reviewActors` set that precedent — its 0.8.0
migration says outright that it "stays absent". A key that WEAKENS a gate may never
arrive by upgrade, and a consumer who never declares it keeps today's behaviour byte
for byte.

### Why

The gate asks *"does the approval postdate work the approver has seen?"*. That
question is not served by re-arming on commits the approver's own agent made under
their instruction; it is served against commits from **outside** the approved loop,
which remain foreign.

The cost was measured before it was fixed. #454 recorded the maintainer re-applying
`status:approved` five times in one day. On the day this amendment was drafted, three
consecutive PRs — #514, #515 and #507 — were green on every other gate and red on
`actor-check` for this reason alone; #507's refusal listed four stale
`brain-decision/1` signatures, one per push. A gate whose normal failure mode is noise
on correct work trains people to ignore it.

### What was measured, and what it corrected in the ticket

The ticket's stated premise was that agent commits are authored as an address the
provider resolves to no account, and are foreign because unattributable. That is
**false**, and driving the API is what showed it: `GET /repos/…/commits/54aa5ff`
returns `author.login` populated. The commit is foreign only because the identity is
not in the exempt set. Two identities appear in this repo's history and only one is
attributable at all; the unattributable one keeps re-arming, which is correct.

### What this exemption does NOT prove — the accepted loss

**An identity string in a config file is not an authenticated identity.** The provider
attributes a commit by matching the author email against an account, and git authorship
is unauthenticated by construction, so anyone with push access can spell it. The
exemption is therefore only as strong as the push-access set.

This is accepted as a **`lite`-tier** trade, and it is accepted on a precedent already
load-bearing in the same function: `reviewActors` is exempt on exactly this basis.
#413 verified the reviewer identity against its token at the review-**posting** seam,
never at the authorship seam. Demanding cryptographic proof of the agent while the
reviewer bot rides on email attribution would be an inconsistency, not a standard.

The `standard`-tier upgrade is **signature verification**: the port normalizes a
`verified` flag across providers the same way it already normalizes `login`, and the
exemption requires it. `prCommits` discards `commit.verification` today, so that is a
port-contract change (ADR-0020 territory) and is tracked, not assumed.

### Platform-agnosticism, as a property rather than an intention

No vendor name appears in the governance decision path. The identity lives in the
consumer's `brain.config.json`, which `brain:upgrade` never touches (ADR-0003 /
ADR-0006). `agent-identity-agnostic.test.mjs` holds this as a structural lock and
derives what it forbids **from the config**, so it does not name a platform either and
starts guarding the moment any consumer declares one.

Its first version scanned all of `brain/core/**` and `brain/scripts/**` and reported 18
files; reading them refuted it. Nearly all are adapters or their manifests, and naming
a platform is what an adapter is *for* — a guard forbidding it would condemn the very
pattern that produces the agnosticism. The lock is scoped to `brain/scripts/vcs/**` and
`brain/scripts/governance/**`: the path that decides outcomes, where a literal would
leave no adapter boundary to swap.

### A separate key, not a reuse

`reviewActors` means *"acts as the cold reviewer"*. Reusing it would produce the right
behaviour on all three of its current readings and the wrong **meaning**, and the
wrongness surfaces as a refusal whose stated reason is false: a consumer running an
agent but no cold reviewer would have to register their coding agent there, and
`brain:approve` would refuse it with *"a review identity may never sign an approval"* —
said about something that reviews nothing. Ruling R2 ("no key feeds two gates") was
knowingly excepted once, in #375; twice is how an exception becomes the rule.

### What is unchanged

§9 stands: an agent identity may never **apply** `status:approved`. Exemption from
re-arming and permission to approve are different powers, and this grants only the
first — deny-before-allow still refuses a listed identity the label, tier-agnostically
(#375). An **unresolvable** author remains foreign; the relief never extends to an
identity the platform cannot vouch for. A third party still re-arms: the exemption
narrows the foreign set, never empties it.
```
