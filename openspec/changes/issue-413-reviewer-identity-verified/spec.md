---
status: spec
issue: 413
epic: 313
artifact_store: openspec
topic_key: sdd/issue-413-reviewer-identity-verified/spec
---

# Spec — reviewer identity verified against the token (issue #413)

Requirements are tagged `REQ-413-N`. Tests live in `identity.test.mjs`,
`cli.test.mjs` and `providers.test.mjs`; each requirement names its pin.

## REQ-413-1 — the handle is verified, not taken on faith

With a token AND a configured `reviewer.handle`, `gatherIdentity` MUST resolve the
token's real login via `whoami({ token })` and compare it to the handle. A
disagreement MUST return `ok: false` with `mismatch: { claimed, actual }` — never
proceed to cold-boot.
Pins: `gatherIdentity: token whose real login disagrees…`, `main: a token whose real
login disagrees… refuses at boot`. **Red against pre-#413 code.**

## REQ-413-2 — verification failure fails closed

A `whoami` rejection MUST return `ok: false` with the underlying error — §10
"uncomputable evidence" discipline: never proceed on an unverified identity.
Pins: `gatherIdentity: whoami rejection…`, `main: whoami rejection refuses at boot`.
**Red against pre-#413 code.**

## REQ-413-3 — logins compare case-insensitively

`CsRinaldiBot` and `csrinaldibot` are the same account on both providers; a case
difference MUST verify, not refuse. Negative control against an over-strict guard —
the same class as #423's REQ-D-3.
Pins: `evaluateVerifiedIdentity: case-different login…`, `main: whoami matching the
handle case-insensitively proceeds`. **Green on both old and new code, by design.**

## REQ-413-4 — verification is scoped to the token, not ambient auth

`whoami({ token })` MUST answer for THAT token: GH passes `GH_TOKEN` (precedence over
keyring auth); GL switches to the `gitlabApiFetch` transport (`PRIVATE-TOKEN`).
Pins: `github.whoami({ token }) scopes the call…`, `gitlab.whoami({ token }) uses
gitlabApiFetch…`. **Red against pre-#413 code.**

## REQ-413-5 — zero-arg `whoami` is byte-identical to pre-#413

No token → no env override (GH), no transport switch (GL): the ambient-session
behavior every existing caller relies on is unchanged.
Pins: the two pre-existing `whoami` normalization tests (untouched) +
`github.whoami() without token passes NO env override`.

## REQ-413-6 — an unset handle skips verification

Nothing to compare against; that case is cli.mjs's #382 refusal, with its own
message. `whoami` MUST NOT be called.
Pin: `gatherIdentity: unset handle skips verification…`.

## REQ-413-7 — transport failures still reject on the token path

The contract row's discipline (`whoami` REJECTS on transport failure) holds on the
new GL token path (`gitlabApiFetch` throws).
Pin: `gitlab.whoami({ token }) rejects on a transport failure`.
