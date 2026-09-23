---
status: draft
issue: 388
epic: 335
---

# Proposal — three URL defects that #385 froze rather than fixed

#385 was a **test-only slice**: it added contract-parity coverage over the VCS port and, where
it found defects, pinned them as `LATENT DEFECT, PINNED NOT FIXED (follow-up filed)`. That was
the right call — a test documenting wrong behaviour is worth more than no test **provided the
follow-up lands**. These are those follow-ups. The three arrived together because they share
four lines of code.

## #386 — `gitlab.repoCloneUrl` had no host fallback

```js
return `https://oauth2:${token}@${host}/${project}.git`;
```

An omitted `host` produced `https://oauth2:***@undefined/x/y.git` — a URL that **parses**,
reads plausibly in a log, and resolves to nothing. GitHub's equivalent had always defaulted.

## #387 — `github.patSetupUrl` ignored its own `host`

```js
export async function patSetupUrl({ host, name, scopes }) {
  return `https://github.com/settings/tokens/new?...`;   // `host` is never read
}
```

A GitHub Enterprise Server operator passing their GHES hostname was sent to the **public**
github.com token page, where any token they created would be useless against their own server —
with nothing saying why. GitLab was already host-driven; that divergence is why self-hosted
GitLab worked and GHES did not.

## #388 — neither provider encoded what it interpolated

`name: 'brain & co'` does not merely look wrong, it **splits**: `description=brain ` plus a
second, spurious ` co` parameter. The operator lands on a page with a truncated token name and
saves it.

## The encoding decisions, since both are judgement calls

**One rule, `encodeURIComponent` per value.** It encodes `:`, so `read:user` reaches the URL as
`read%3Auser`. Not over-caution — the consequence of refusing to hand-roll. A narrower encoder
sparing `:` is a list of characters someone must keep correct, and the one it eventually misses
is the next defect. Both standard encoders agree here (`URLSearchParams` also emits `%3A`), and
every conforming server percent-decodes a query value before reading it.

**The comma between scopes stays literal.** Scopes are encoded per entry and joined with a raw
`,`, because the comma is the separator the provider parses — structure, not data. Encoding
`scopes.join(',')` as one string would send `repo%2Cworkflow`: a single scope by that name.

**A project slug is encoded per segment.** `encodeURIComponent('group/repo')` yields
`group%2Frepo` and the clone URL stops resolving. GitLab subgroups make it concrete: the
slashes are structure, what sits between them is data.

## The locks are inverted, not deleted

Each `PINNED NOT FIXED` test keeps its call sites and now asserts the corrected behaviour, with
the defect it used to hold named in the assertion message. A deleted lock loses the record of
why the code looks the way it does.
