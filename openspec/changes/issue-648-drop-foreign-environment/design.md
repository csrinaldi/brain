---
status: draft
issue: 648
---

# Design — brain stops shipping somebody else's environment (issue 648)

## D1 — Specs are corrected; records are not

`openspec/specs/**` states what is true now, so a stale name there is a defect.
`openspec/changes/**` states what was decided then, and the phase genuinely
carried that name. Rewriting it would make the record disagree with the tickets,
the commits and the archive it belongs to — for the sake of tidiness.

This is the same instinct ADR-0028 encodes about signatures: a record's value is
that it was not edited afterwards.

## D2 — One half is guarded, the other deliberately is not

A hostname has a **shape**: `[a-z0-9.-]`, reserved-or-not, checkable without
naming anything. An organisation's name has no shape — a guard for it must
contain the string, and this guard ships. It would put the word into the tarball
it exists to keep out.

So the enforceable half is enforced and the other half is a one-time edit, said
out loud rather than left looking like an oversight.

## D3 — The allowlist is derived, and carries reasons

Built from what the tree actually contains, not from imagination: eight real
hosts, each with the line saying why brain names it. The protection is that
adding one is deliberate — a hostname is otherwise indistinguishable from any
other string, so the only real control is that someone had to type it here.

## D4 — Positive recognition, not exclusion of known junk

`isNotAHostname` matches `[a-z0-9.-]` with a dot. The first version asked
`!h.includes('.')` and reported `…#v1.0.0` as a foreign host. Every blocklist is
a list of the mistakes you have already seen.

## D5 — Userinfo stripped before classification

`https://oauth2:tok@gl.example.com` must read as `gl.example.com`. Skipping it
produced `oauth2`, `x`, `h`, `proxy` and `x-access-token` as "hosts" — a list
long enough that the one real offender does not stand out. Measured while
deriving the allowlist.

## Hot micro-decisions

- **Four path segments kept** in the replacement fixture. `org/group/sub/repo`
  rather than `group/repo`: the assertion exists to prove nested groups parse,
  and a two-segment path would leave it passing while testing nothing.
- **`.gitlab-ci.yml` is in, `CHANGELOG.md` is out.** One is live configuration
  describing the pipeline's future; the other is a record of a release.
- **The guard lives in `brain/scripts/lib/`**, beside the other drift guards,
  rather than under `vcs/` where the offender was. It guards all of `brain/**`,
  not one subtree.
