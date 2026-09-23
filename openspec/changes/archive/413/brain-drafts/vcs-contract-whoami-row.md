# Draft — vcs-contract.md `whoami` row update (issue #413)

**Tier-2 promotion required** (`brain/core/methodology/vcs-contract.md` is
human-promoted). This draft carries the exact replacement text; the code and
its tests land with the PR, the doc row lands when a human promotes this.

## Why

Issue #413 widens `whoami` with an optional `token`: the reviewer identity
gate must resolve who the reviewer token ACTUALLY belongs to, and the
pre-#413 verb only ever answered for the ambient CLI session — the wrong
identity when the operator's own login and the reviewer token differ, which
is precisely the forgery scenario of the ticket. Optional and backward
compatible: every existing zero-arg call is unchanged.

## Current row (vcs-contract.md line 26)

> | `whoami` | `() -> { username }` | Current user. GL `.username` / GH `.login` → `username`. Transport is `runJson` on both providers, so a transport failure REJECTS (`exec.mjs:31-32`), the same discipline as `mrList`/`issueList`, opposite `authCheck` (issue #385, M10 Phase 2 — final Gap-A batch). Return shape is exactly `{ username }` — no provider field (`login`, `id`, `avatar_url`) survives normalization. |

## Replacement row

> | `whoami` | `({ token? }) -> { username }` | Current user — or, with `token` (issue #413), the identity OF THAT TOKEN: GH runs `gh api /user` with `GH_TOKEN=token` (precedence over keyring auth); GL switches to the shared `gitlabApiFetch` transport (`PRIVATE-TOKEN` header, accepts `apiBase`/`proxyUrl`/`fetchImpl` like `prReviewComment`). Zero-arg behavior unchanged (ambient CLI session). GL `.username` / GH `.login` → `username`. A transport failure REJECTS on **both** paths (`runJson` throws / `gitlabApiFetch` throws), the same discipline as `mrList`/`issueList`, opposite `authCheck` (issue #385, M10 Phase 2 — final Gap-A batch). Return shape is exactly `{ username }` — no provider field (`login`, `id`, `avatar_url`) survives normalization. |

## Consumer

`review/identity.mjs` (`gatherIdentity`, issue #413): verifies
`reviewer.handle` against `whoami({ token })` at boot and refuses on
disagreement or verification failure — fail-closed, the #382 precedent.
