# ADR-0033 Amendment 2 — draft (issue #775)

> **status:** Tier 2 draft. Not yet promoted. ADR-0033 is already signed, so this is an
> in-place amendment, not a new ADR file.
>
> ```
> npm run brain:promote -- brain-drafts/adr-0033-amendment-2.draft.md
> ```
>
> The verb renders the plan, waits for the typed word, performs §1c's three acts, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops.
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0033-cold-review-transport.md
amendment: 2
issue: 775
home-summary: the forge-CLI row gains a per-run config-dir shadow — the CLI can no longer find the keyring, which is not the same as the secret being gone, #775
body: ## Amendment 2 — the forge-CLI channel gains a shadow, and the probe stays its reader (issue #775)
body-end: ### Notes for the promoter
```

```amend-find
| a forge CLI's own store outside the repository (`~/.config/gh`, the OS keyring) | `producer-forge-reach.mjs`, which probes the producer's environment and REFUSES when a forge CLI still authenticates | **by measurement, failing closed** — a probe that cannot reach a verdict refuses |
```

```amend-replace
| a forge CLI's own store outside the repository (`~/.config/gh`, the OS keyring) | a per-run config-dir shadow (`withForgeConfigDir`) so the CLI cannot FIND its session, then `producer-forge-reach.mjs`, which probes the producer's environment and REFUSES when a forge CLI still authenticates | **by measurement, failing closed** — a probe that cannot reach a verdict refuses. **[Amended by Amendment 2 (#775) — the shadow changes what is measured, never whether it is; the secret itself is untouched]** |
```

## Amendment 2 — the forge-CLI channel gains a shadow, and the probe stays its reader (issue #775)

**Signed**: DD/MM/YYYY — <Name>

### What changed

The forge-CLI row's mechanism gains a first half. Before the probe runs, the cold-review stage
creates a **per-run, disposable directory** and points every forge CLI brain names at it —
`GH_CONFIG_DIR` and `GLAB_CONFIG_DIR`, declared beside the CLIs themselves in `FORGE_CLIS`. The
probe then runs **against that same environment**, and the producer is spawned with it.

The row's warrant is unchanged: **by measurement, failing closed.** The shadow changes what is
measured. It does not change whether it is measured, and it may not.

### Why

This row was the product's first blocker, and the refusal was correct the whole time. A
developer's machine is normally logged into `gh`; ADR-0033's own stage then declines to spawn,
and `docs/reviewer-setup.md`'s only remedy was `gh auth logout` — removing the CLI the developer
uses for everything else, for as long as brain runs. The product model recorded in
`docs/inbox/cold-review-as-product-stage.md` is a workflow engine **started by the developer**,
so that remedy is a precondition the product cannot ask for.

### The measurement, and why it works

Taken 27/08/2026 on the maintainer's machine with `gh` authenticated, running the real probe
against the real post-scrub environment:

```
WITHOUT the shadow : {"state":"reachable","ok":false,"gh":"authenticated"}
WITH    the shadow : {"state":"closed","ok":true,"gh":"unauthenticated"}
```

The reason is exact rather than lucky. `gh auth status` reports `csrinaldi (keyring)`, and
`~/.config/gh/hosts.yml` holds **no token** — only the host→user mapping. The secret is in the
OS keyring; the *mapping* is in the config dir. With an empty config dir `gh` no longer knows
github.com exists, so it never asks the keyring. **The operator's keyring is never touched**,
before, during or after — verified in the same run.

### What this does NOT close, and it belongs in the row rather than in a reader's assumption

- **The secret is still there.** This makes the CLI unable to FIND it. A tool reading libsecret
  directly, a `~/.netrc`, or a git credential helper remains the open namespace
  `credential-env.mjs` declines to pretend it can bound — the table's last row is unchanged.
- **It is complementary to the scrub, never a replacement.** `GH_TOKEN` in the environment
  authenticates `gh` whatever the config dir says; what removes that is `withoutCredentials`.
  Two mechanisms, one property — worth knowing which is which before changing either.
- **It is measured on ONE deployment.** `gh` keeping the host mapping in the config dir is what
  makes this work, and that is a probe result on Linux with `gh` 2.x, not a contract. Which is
  precisely why the probe remains the reader and stays fail-closed: `authenticated` refuses,
  `unreadable` refuses, an empty probe list refuses. A deployment where the shadow does not close
  the channel refuses exactly as before, and the refusal now names the remaining remedy.

### Why this is not the `$HOME` design this ADR already rejected

Rejected shape 3 in `producer-forge-reach.mjs` builds a synthetic `$HOME` carrying an allowlist
of the ENGINE's credential paths, and fails because a backend author cannot know the deployment.
This names **two variables belonging to the two forge CLIs brain itself declares** — the same
axis argument that lets `FORGE_CLIS` name `gh` and `glab` at all. No engine vendor appears, so
ADR-0005 is untouched.

### The ordering that is the guarantee

The shadow is created **before** the probe and handed to **both** the probe and the spawn. A
probe run against an unshadowed environment would answer about an environment the child never
receives — and a probe that lies is worse than no probe, which is the defect class this module
exists to remove. For the same reason the parameter threaded through `runStage` is a **path**
rather than an env bag: there is no spelling of it that re-admits a credential the scrub removed,
and it is applied **after** the scrub, never merged over it.

The directory is per-run and disposable because `gh` **writes** a `config.yml` into whatever
directory it is given. A reused path would be a place a session could accumulate, which would
turn this fix into the channel it closes. It is removed in a `finally`, so a refused run cleans
up on the very path an operator is already debugging.

### Notes for the promoter

Amendment number 2 — Amendment 1 (#773) landed on 28/08/2026.

The `amend-find` anchor is the warrant table's forge-CLI row and occurs exactly once in the
target. The replacement keeps the row at three cells, so the GFM truncation that made Amendment
7 of ADR-0026 render as its own pre-amendment version cannot repeat here.

Nothing else is superseded. The poster-credential row, Amendment 1's ruling, the worktree row's
`by cost` correction and the `not claimed` row all stand as signed.
