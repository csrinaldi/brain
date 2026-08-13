# ADR-0006 Amendment 1 — draft (issue #617)

> **Tier 2 draft. Not yet promoted.** ADR-0006 is signed, so this is an in-place
> amendment, not a new ADR file.
>
> ```
> npm run brain:promote -- openspec/changes/issue-617-supersede-adr-0006/brain-drafts/adr-0006-amendment-1.draft.md
> ```
>
> **Promote ADR-0030 in this same change first** — this amendment points at it,
> and an amendment naming a record that does not exist is the #590 defect from
> the other side.
>
> The verb renders the plan, waits for the typed word, performs §1c's three acts,
> writes the `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them,
> and stops. **Your commit is the signature** (ADR-0028).
>
> **Known limitation, deliberate:** `amendStatusLine` writes
> `**amended <date>** (Amendment 1 — see below)`. There is no supersession shape
> in `brain:promote`, so the Status line will read *amended* while the amendment
> heading below carries the supersession. See ADR-0030's closing section and #617.

```brain-amendment/1
target: brain/project/decisions/adr-0006-distribucion-installer-versionado.md
amendment: 1
issue: 617
home-summary: **SUPERSEDED by ADR-0030** — the private-repo premise that chose git tags no longer exists; distribution moves to a scoped registry package, #617
body: ## Amendment 1 — SUPERSEDED by ADR-0030: the premise that chose git tags no longer exists (issue #617)
body-end: ### Notes for the promoter
```

```amend-find
- **npm registry**: requires publishing to npmjs.com or a private registry; bureaucratic overhead.
```

```amend-replace
- **npm registry**: requires publishing to npmjs.com or a private registry; bureaucratic overhead.
  **[Amended by Amendment 1 (#617) — this rejection is reversed. ADR-0030 chooses the registry. The "overhead" was weighed against a private repo that no longer exists.]**
```

```amend-find
Distribution uses **git tags + npm install**:
```

```amend-replace
Distribution uses **git tags + npm install**:

**[Amended by Amendment 1 (#617) — SUPERSEDED. Distribution is a published scoped package, `@csrinaldi/brain`. See ADR-0030. The install line below is historical.]**
```

```amend-find
npm install --save-dev github:csrinaldi/brain#v1.0.0
```

```amend-replace
# HISTORICAL — superseded by ADR-0030. The current line is:
#   npm install --save-dev @csrinaldi/brain
npm install --save-dev github:csrinaldi/brain#v1.0.0
```

```amend-find
- **Positive**: one-liner installation, no registry, compatible with private repos (GitHub).
```

```amend-replace
- **Positive**: one-liner installation, no registry, compatible with private repos (GitHub).
  **[Amended by Amendment 1 (#617) — no longer a Positive. The repository is public (`private: false`), so "compatible with private repos" describes nothing, and "no registry" is now the cost rather than the benefit.]**
```

```amend-find
- **Negative**: distributing via npm install from GitHub requires the consumer to have access to the brain repo (authenticated, if private).
```

```amend-replace
- **Negative**: distributing via npm install from GitHub requires the consumer to have access to the brain repo (authenticated, if private).
  **[Amended by Amendment 1 (#617) — this is the friction ADR-0030 removes. `test/fresh-install/run.sh` still refuses to run without a `VCS_TOKEN` for exactly this reason; when that fixture stops needing one, this Negative is gone.]**
```

## Amendment 1 — SUPERSEDED by ADR-0030: the premise that chose git tags no longer exists (issue #617)

**Signed**: DD/MM/YYYY — <Name>

### What changed

**This ADR is superseded by ADR-0030 for its distribution mechanism.** Not amended
— superseded. The distinction is the point: its Decision did not become
inconvenient, its **premise was deleted**.

ADR-0006's own comparison chose `git tags + npm install` on one property:

> **git tags + npm install**: installs directly from GitHub by version tag;
> **compatible with private repos**; zero registry.

Measured on `main` @ `3dfbdd4`: **`private: false`**. There is no private repo for
that compatibility to serve. The option it rejected — *"npm registry: requires
publishing […] bureaucratic overhead"* — is what ADR-0030 chooses, and the
overhead was weighed against a constraint that no longer applies.

Its stated Negative, that the consumer needs authenticated access to this
repository, is precisely the friction #435 exists to remove.

### What is NOT superseded

Narrower than a reader might assume, and stated so the supersession is not read
as wider than it is. Everything below stands unchanged and is still current
doctrine:

- **`brain/core/**` is read-only in the consumer**, and improvements go upstream.
- **The three-pillar model** — core / project / scripts — and the `brain/scripts/`
  namespace decided in the S3 update, which removed the root `scripts/` collision.
- **Additive `brain.config.json` migrations**, `schemaVersion`, and the rule that
  a consumer-set value is never overwritten, falsy values included.
- **Check-and-notify in `day:start`, never auto-update.** A registry makes
  auto-update easier to reach for, so `instaladores-autoactualizantes-no-inocuos`
  is *more* load-bearing after this, not less.
- **`specialMerge` and the collision guard** in `copyManaged()`.

What is superseded is one thing: **how the bytes reach the consumer**, and the
private-repo premise that chose it.

### The measurement

| ADR-0006 asserts | measured on `main` @ `3dfbdd4` |
|---|---|
| "compatible with private repos" | `private: false` — public |
| "no registry" as a Positive | `brain` is a deprecated placeholder (`200`); `@csrinaldi/brain` is free (`404`) |
| consumer needs repo access | `test/fresh-install/run.sh` still exits 2 without `VCS_TOKEN` |

### The accepted loss

**ADR-0030 is signed while the mechanism is still ADR-0006's.** `main` carries
`private: true`, `"name": "brain"` and an install spec pointing at the git URL.
For as long as #435's mechanical half is open, ADR-0030 records an intent and
ADR-0006's install line is what actually runs.

That ordering is deliberate. #590 measured what the reverse costs: a mechanism
shipped, its decision record never written, and five live files citing an ADR
that did not exist — for months. Writing the decision first means a reader can
see the gap. Writing it last means nobody can.

### Notes for the promoter

Promote **ADR-0030 first**, then this draft. The `brain/HOME.md` marker this
amendment writes points at a record that must already exist.
