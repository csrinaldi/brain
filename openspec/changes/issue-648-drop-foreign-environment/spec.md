---
status: draft
issue: 648
---

# Spec — brain stops shipping somebody else's environment (issue 648)

## REQ-648-1 — No foreign hostname under `brain/**`

Every `scheme://host` under `brain/**` must be RFC 2606/6761 reserved
(`example.com|net|org`, `*.example`, `*.test`, `*.invalid`, `*.localhost`,
`localhost`, loopback) or on `ALLOWED_REAL`, a short list of services brain
genuinely integrates with, each with its reason recorded.

## REQ-648-2 — The nested-group test keeps testing nested groups

`parseRemote`'s subgroup assertion is what distinguishes GitLab from GitHub. The
replacement host is reserved; the path keeps **four segments**, because the
segment count is the point of the test.

## REQ-648-3 — Userinfo is not a host

`https://oauth2:tok@gl.example.com` resolves to `gl.example.com`. A parser that
skips this reports a pile of fake hosts and buries a real one among them —
measured on the first version.

## REQ-648-4 — A hostname is recognised positively

`[a-z0-9.-]`, at least one dot, nothing else. Written as a blocklist of the
shapes already seen, the rule reported `…#v1.0.0` — an ellipsis-truncated URL in
a doc comment — as a foreign host, because the version number supplied the dot.

## REQ-648-5 — The guard cannot pass vacuously

It asserts it walked a real tree (>100 files) and that `ALLOWED_REAL` is
non-empty, and it throws rather than returning `[]` when nothing was scanned.
An emptied allowlist must fail loudly, not silently reclassify every host.

## REQ-648-6 — The guard does not ship what it forbids

It describes the offending host instead of quoting it, and is **not** excluded
from its own scan. Its negative-case probe assembles the URL at runtime for the
same reason.

## REQ-648-7 — Records are not rewritten

Nothing under `openspec/changes/**` or `CHANGELOG.md` changes. Those record what
was planned and what it was called. `openspec/specs/**` is the current contract
and is corrected.

## REQ-648-8 — The fixtures still parse and still assert the same payloads

Only `note` provenance fields change. `npm test` green.
