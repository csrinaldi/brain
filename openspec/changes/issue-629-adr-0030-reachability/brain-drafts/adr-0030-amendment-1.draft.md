# ADR-0030 Amendment 1 — draft (issue #629)

> **Tier 2 draft. Not yet promoted.** ADR-0030 is signed, so this is an in-place
> amendment, not a new ADR file.
>
> ```
> npm run brain:promote -- openspec/changes/issue-629-adr-0030-reachability/brain-drafts/adr-0030-amendment-1.draft.md
> ```
>
> The verb renders the plan, waits for the typed word, performs §1c's three acts,
> writes the `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them,
> and stops. **Your commit is the signature** (ADR-0028).
>
> This amendment does NOT change the decision. The registry stays the
> distribution mechanism. It records a cost the record left unnamed, and a path
> the record left readable as retired when it is not.

```brain-amendment/1
target: brain/project/decisions/adr-0030-distribution-scoped-registry-package.md
amendment: 1
issue: 629
home-summary: reachability is a named cost — a registry name needs a registry, where a git URL reached any host; the git-URL install survives as a measured, equivalent escape hatch, #629
body: ## Amendment 1 — reachability: a registry name is not a git URL (issue #629)
body-end: ### Notes for the promoter
```

```amend-find
npm install --save-dev @csrinaldi/brain
```

```amend-replace
npm install --save-dev @csrinaldi/brain

# Amended by Amendment 1 (#629): this reaches whatever `npm config get registry`
# points at, and only if that registry carries the scope. Where it does not, the
# git URL installs the SAME allowlisted bytes — a supported fallback, measured
# in Amendment 1, not a retired one.
```

```amend-find
- `day-start.mjs`'s check-and-notify, which reads `highestTag`.
```

```amend-replace
- `day-start.mjs`'s check-and-notify, which reads `highestTag`.
  **[Amendment 1 (#629): and which must report "could not reach the registry" as
  a verdict distinct from "no network" and from "up to date" — see #627.]**
```

```amend-find
- **Never translate a git-ref version check into a registry one without
  re-deriving it.** See Decision 3.
```

```amend-replace
- **Never translate a git-ref version check into a registry one without
  re-deriving it.** See Decision 3.
- **Never report an unreachable registry as "no network" or as silence.**
  Amendment 1 (#629). A consumer behind a mirror or an allow-list has a working
  network and an unreachable host; collapsing the two is the
  `evidence-reader-empty-on-failure` shape, and it points them at the wrong
  problem.
- **Never document the registry as the only way in.** Amendment 1 (#629). The
  git URL still installs the same bytes and is the fallback for anyone who
  cannot reach the registry.
```

```amend-find
**Positive:** a consumer installs with no credential and no repository access —
the friction ADR-0006 accepted as its cost. `npx` resolves the bin under a scope
that cannot be squatted, which is the shape of the `#400` edge folded into #435.
```

```amend-replace
**Positive:** a consumer installs with no credential and no repository access —
the friction ADR-0006 accepted as its cost. `npx` resolves the bin under a scope
that cannot be squatted, which is the shape of the `#400` edge folded into #435.
**[Amended by Amendment 1 (#629) — incomplete as written. They install with
REGISTRY access, which the git-URL path did not require. Amendment 1 names that
cost rather than leaving it as an absence.]**
```

## Amendment 1 — reachability: a registry name is not a git URL (issue #629)

**Signed**: DD/MM/YYYY — <Name>

### What this does NOT change

Stated first, because an amendment to a distribution decision invites the wrong
reading. **The registry remains the distribution mechanism.** Decision 1, the
scope, the separation of visibility from publication, the `files` allowlist
ordering, and every item under *"What ADR-0006 decided that SURVIVES"* stand
unchanged. Nothing here reopens ADR-0006.

What this adds is a **cost this record did not name**, and a **path it left
readable as retired**.

### The unnamed cost

ADR-0030's Consequences read:

> a consumer installs with no credential and no repository access

True, and incomplete. They install with **registry access**. ADR-0006's
mechanism had a property nobody chose and nobody wrote down: a git URL reaches
**any host that serves git** — github.com, an internal mirror, a self-hosted
GitLab, a `file://` path. A package name reaches whatever `npm config get
registry` resolves to, and only if that registry carries `@csrinaldi/brain`.

Measured on the signed record: **zero mentions** of `mirror`, `firewall`,
`air-gap`, `proxy`, `offline` or `registry access`. The cost is not weighed and
rejected there; it is absent.

### The path that survives, measured

The git-URL install is **not** retired by the rename. Measured by installing this
repository's HEAD into a clean fixture over `git+file://` with `--ignore-scripts`:

| | measured |
|---|---|
| result | `added 1 package in 5s` |
| contents | **433 files, 5.5 MB** |
| `.memory/` · `openspec/` · `test/` · `docs/` · `.brain-source` · `.git` | **all absent** |
| top level | `brain/` `.github/` `.gitlab/` `.claude/` `.gemini/` `.gitattributes` `LICENSE` `package.json` `README.md` |

Three consequences, none of which the record states:

1. **A git install honours `files`.** It delivers the same allowlisted tree the
   tarball carries, so #607's guarantee is not bypassed by this path. (`README.md`
   is npm's always-included set, not a leak.)
2. **It works under `private: true`.** `private` blocks *publishing*, not
   installing from git — so this path is available today, before the publish, and
   remains available after it.
3. **It lands under the `name` in `package.json`.** After the rename, a git-URL
   install and a registry install resolve to the *same* directory. That is the
   same mechanic #625 traced when it found the mid-upgrade break, and it is why
   one resolver serves both paths.

So the fallback is not a degraded mode. It is the same bytes at the same path,
reached over a different transport.

### What follows for any version check

A check that resolves "is there a newer version" must distinguish three verdicts,
not two:

- up to date;
- a newer version exists;
- **the registry could not be reached.**

Collapsing the third into "no network" — which is what `day-start.mjs` does today
for GitHub, and would do for the registry if translated one-for-one (#627) — is
the `evidence-reader-empty-on-failure` shape: it makes *"there is nothing new"*
indistinguishable from *"I could not look"*, and points a mirrored consumer at a
network that is working fine.

### Why an amendment and not a note in the ticket

Two independent findings landed on the same absence — #627's air-gap failure mode
and #625's tracing of where a git install actually lands. A property that two
unrelated pieces of work rediscover is doctrine, not a preference belonging to
whichever ticket noticed it second. Leaving it in #435 means the next reader of
ADR-0030 finds a record that answers "how do bytes reach the consumer" without
mentioning that some consumers cannot reach the answer.

### Notes for the promoter

**Four in-place edits.** Two annotate passages that are incomplete as written (the
install line, the Positive); two ADD to lists rather than annotate — a
`day-start` bullet in Decision 3 and two new *Never do* entries. The additive
ones are deliberate: a rule that only exists inside an amendment section is a
rule nobody applies, and §1c's requirement is that *"a reader who never scrolls
to the amendment must not be left with the superseded rule."*

Nothing here needs ADR-0006 touched. Its Amendment 1 already carries the
supersession, and this amendment does not change what superseded it.
