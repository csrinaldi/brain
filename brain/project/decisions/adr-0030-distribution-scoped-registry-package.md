# ADR-0030 — Distribution moves to a scoped registry package; ADR-0006's premise no longer exists

**Status**: Accepted
**Date**: 2026-08-13 — Cristian Rinaldi

## Context

ADR-0006 chose `git tags + npm install` and rejected the registry. Read its own
comparison table today and the reason it chose is gone:

> **npm registry**: requires publishing to npmjs.com or a private registry;
> bureaucratic overhead.
> **git tags + npm install**: installs directly from GitHub by version tag;
> **compatible with private repos**; zero registry.

Measured on `main` @ `3dfbdd4`: `private: false`. **The repository is public.**
"Compatible with private repos" was the deciding property, and there is no
longer a private repo for it to be compatible with. Its stated Negative —
*"requires the consumer to have access to the brain repo (authenticated, if
private)"* — is the friction #435 exists to remove.

This is not a decision that aged. It is a decision whose **premise was deleted**,
which is why it is superseded rather than amended.

Two constraints were measured before choosing a name:

- **`brain` is unavailable.** `https://registry.npmjs.org/brain` returns `200`.
  Measured against the registry, not quoted from a ticket: the name was created
  **2011-04-29**, its last of 20 versions (`1.0.0`) published **2018-02-17**, and
  it carries a `deprecated` field reading *"Package no longer supported. Contact
  support@npmjs.com for more info."* Its `description` is explicit about why it
  still exists: *"This package is no longer supported and has been deprecated.
  **To avoid malicious use, npm is hanging on to the package name.**"*

  A name npm holds deliberately to keep it out of circulation is not obtainable
  by asking. **A scope is mandatory**, not a preference.
- **`@csrinaldi/brain` is free** — `404` on the registry, a user scope requiring
  no organisation.

## Decision

### 1. Distribution is a published, scoped npm package.

The consumer installs by name:

```bash
npm install --save-dev @csrinaldi/brain
```

No token, no repository access, no git ref. That is the whole point: ADR-0006's
install line required the consumer to authenticate against this repository, and
`test/fresh-install/run.sh` still refuses to run without a `VCS_TOKEN` for
exactly that reason. When the fixture stops needing one, the friction is gone —
and that is the acceptance criterion, not a side effect.

**The scope is `@csrinaldi`** — a user scope, free, no organisation to create.
An organisation scope was considered and rejected for now: it buys a transferable
identity brain does not yet need, at the cost of a decision that is easy to make
later and awkward to unmake early.

### 2. Repository visibility and package publication are two decisions, not one.

ADR-0006 tied them together — the repo was private, so the registry was
"bureaucratic overhead" and git tags were the only path. #435 inherited that
framing and treats going public and publishing as one irreversible act.

**They are separate exposures with separate guards:**

| | what it exposes | what guards it |
|---|---|---|
| public repository | every commit, `.memory/`, `openspec/`, the full history | the #610 pre-flight |
| published tarball | only what `files` names | the #607 allowlist, and the test that measures a real `npm pack` |

Recorded because conflating them is what put the repository public with no
pre-flight artifact behind it. The tarball contains `brain/core`, `brain/scripts`
and the managed config files — no `.memory/`, no `openspec/`, no git history —
so nothing the pre-flight audits reaches a consumer.

### 3. The install spec becomes a package name; version reasoning must be re-derived.

`installSpec`/`BRAIN_REPO_HTTPS` (`brain/scripts/lib/installer.mjs`) resolve to
`git+https://github.com/csrinaldi/brain.git#<tag>`. That becomes the package
name plus a semver range.

**The non-mechanical part is everything downstream that reasons about git refs**,
and it must be re-derived against registry semantics rather than translated:

- the downgrade guard (#398), which compares versions to refuse a backwards move;
- `npx brain init`'s tag resolution (#400);
- `day-start.mjs`'s check-and-notify, which reads `highestTag`.

A git tag and a registry version are not the same object: tags can be moved and
deleted, published versions cannot; `dist-tags` exist and refs do not; and a
range resolves differently from a pinned ref. Each of the three needs its own
red-first proof. **This ADR does not pre-judge those**; it records that
translating them one-for-one is the error to avoid.

### 4. What ADR-0006 decided that SURVIVES.

Superseding the distribution mechanism does not repeal the model built on it,
and this section exists so nobody reads the supersession as wider than it is:

- **`brain/core/**` is read-only in the consumer.** Unchanged.
- **The three-pillar model** — core / project / scripts, and the `brain/scripts/`
  namespace that removed the root `scripts/` collision. Unchanged.
- **Additive `brain.config.json` migrations**, `schemaVersion`, and the rule that
  a consumer-set value is never overwritten. Unchanged.
- **Check-and-notify, never auto-update** (`instaladores-autoactualizantes-no-inocuos`).
  Unchanged, and *more* load-bearing: a registry makes auto-update easier to
  reach for, so the anti-pattern's reason survives its mechanism.
- **`specialMerge` and the collision guard.** Unchanged.

What is superseded is narrow: **how bytes reach the consumer**, and the
private-repo premise that chose it.

## Never do

- **Never publish without the `files` allowlist in place** (#607). An over-broad
  first publish cannot be cleanly unpublished, and `private: true` is what holds
  the line until the scope and the workflow exist.
- **Never translate a git-ref version check into a registry one without
  re-deriving it.** See Decision 3.
- **Never auto-update.** A registry does not change the anti-pattern.
- **Never treat repository visibility and package publication as one act.**

## Consequences

**Positive:** a consumer installs with no credential and no repository access —
the friction ADR-0006 accepted as its cost. `npx` resolves the bin under a scope
that cannot be squatted, which is the shape of the `#400` edge folded into #435.

**Positive:** publishing is a deliberate, versioned act with an immutable
artifact. A git tag can be moved; a published version cannot.

**Negative, and new:** publishing is irreversible in a way tagging was not. An
over-broad tarball cannot be unpublished cleanly. #607's allowlist and its test
exist for that, and they land before `private: false` comes off — the ordering is
part of the decision, not an implementation detail.

**Negative:** a registry account and an `NPM_TOKEN` become part of the release
path. Who owns that credential is a decision #435 still owes.

**Residual, stated rather than hidden:** this ADR is written while `main` still
carries `private: true`, an unscoped `"name": "brain"`, and an install spec
pointing at the git URL. **The decision precedes the mechanism on purpose** —
that ordering is the entire reason this is a separate ticket (#617), after #590
showed what the reverse costs. Until #435's mechanical half lands, ADR-0030
describes an intent, and every reader can see it does.

## Supersession has no shape in this system

Recorded because acting on it revealed it. Measured on `main` @ `3dfbdd4`:

- **No ADR in `brain/project/decisions/` is marked `Superseded`.** ADR-0013
  mentions *"superseded entries"* as normal ADR-log behaviour; none exists.
- **`brain:promote` has no supersession path.** It knows a new ADR and a
  `brain-amendment/1` in-place amendment. `amendStatusLine` writes
  `**amended <date>** (Amendment N — see below)`; no branch can write
  `Superseded by ADR-NNNN`.

So ADR-0006 is marked through the amendment path, and its Status line will say
*amended* while Amendment 1's heading carries the supersession. That is the
available shape, not the right one. Whether the verb should grow a supersession
shape — and whether `brain:nav` and `decision-gate` should treat a superseded
ADR differently from a live one — is a separate decision this ADR deliberately
does not take.

## Alternatives considered

**Amend ADR-0006 instead of superseding it.** Rejected. Its Decision section
chose git tags *because* the repo was private; amending would leave a decision
whose stated reason no longer exists standing as current.

**Publish unscoped.** Impossible — `brain` is a deprecated placeholder, `200` on
the registry.

**An organisation scope.** Deferred, not rejected. Easy later, awkward to unmake
now.

**Keep git tags and simply make the repo public.** Rejected: a public repo with
git-tag installs still requires the consumer to resolve a git ref and gives no
immutable artifact, no `dist-tags` and no `npx` resolution under an unsquattable
name. It removes the token and keeps every other cost.

## References

- [ADR-0006](adr-0006-distribucion-installer-versionado.md) — superseded by this record; see its Amendment 1
- [ADR-0003](adr-0003-split-core-project-self-hosting.md) — the core/project split this does not touch
- `brain/scripts/lib/installer.mjs` (`BRAIN_REPO_HTTPS`, `installSpec`, `highestTag`) · `brain/scripts/brain-upgrade.mjs` · `brain/scripts/day-start.mjs`
- `brain/core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md`
- #435 (the mechanism) · #617 (this record) · #607 (`files` + licence) · #610 (pre-flight) · #398 · #400
- #590 — why the decision is written before the mechanism this time
