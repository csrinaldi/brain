# Draft — ship the GitLab contributor scaffold as a managed path (issue #570)

> **status:** Tier 2 draft. NOT promoted. An agent may not write `brain/core/**`
> (`brain/core/methodology/agent-authorities.md` §Tier 3) and may not sign doctrine.
> This file states the change; a **human** applies it.
>
> `brain:promote` cannot take this one: it amends `brain/**` **Markdown** targets only
> (`amendment-draft.mjs` rejects a non-`.md` target), and this target is code. So the
> route is the one agent-authorities prescribes for `brain/`: the agent drafts, the
> human moves it.

## Why

PR #596 emits the contributor scaffold from one neutral source for both providers, and
writes `.gitlab/merge_request_templates/Default.md`. Until the manifest lists that path,
**`brain:upgrade` does not ship it** — a GitLab consumer still receives `issue-link` as a
REQUIRED job parsing MR descriptions for a closing reference, and no scaffold telling a
contributor to write one. That is the whole second half of #570.

Everything else in #596 is agent-writable and already landed. This is the one hunk that
is not.

## The change — two hunks in `brain/core/managed-paths.mjs`

### 1. `managed` — add the literal, after `.github/PULL_REQUEST_TEMPLATE.md`

```js
  '.gitlab/merge_request_templates/Default.md', // the SAME scaffold, emitted for GitLab (issue #570).
                                             // Both files are rendered from ONE neutral source
                                             // (brain/scripts/vcs/contributor-scaffold.mjs) — only the
                                             // DELIVERY is provider-specific. Shipping the GitHub one
                                             // alone left a GitLab consumer with `issue-link` as a
                                             // REQUIRED job parsing MR descriptions for a closing
                                             // reference and no scaffold telling anyone to write one.
                                             // LITERAL, never `.gitlab/**`: the consumer's other merge
                                             // request templates are theirs.
```

`Default.md` is load-bearing, not a name: GitLab auto-applies only the description
template called `Default`, exactly as GitHub auto-applies `PULL_REQUEST_TEMPLATE.md`.
Any other filename ships a template a contributor must know to select — a scaffold that
does not scaffold. Pinned by test in `contributor-scaffold.test.mjs`.

### 2. `managedStrategy` — add the row, after `.github/PULL_REQUEST_TEMPLATE.md`

```js
  // The GitLab sibling of the row above (issue #570). Same artifact, same class,
  // therefore the same strategy. Classified by extension of an already ratified row
  // rather than as a new class; it is a NEW path, so no signed row changes value.
  //
  // WHAT THIS ROW DOES NOT DO, ON THE RELEASE THAT INTRODUCES IT: refuse. The gate
  // fires only for a path the PREVIOUSLY INSTALLED package shipped (`outgoing` in
  // installer.mjs), and a first-ship path is in no prior release — so a consumer who
  // already owns `.gitlab/merge_request_templates/Default.md` gets it OVERWRITTEN,
  // reported as a collision, unless they ran with `--abort-on-collision`. Measured,
  // not assumed: `contributor-scaffold.test.mjs` pins it, and #601 tracks the hole.
  // The protection is real from the next release onward; saying otherwise here would
  // be the same class of comfortable falsehood #570 is about.
  '.gitlab/merge_request_templates/Default.md': STRATEGY.REFUSE,
```

### 3. `brain/scripts/lib/managed-paths.test.mjs` — the independent transcription

This file is `brain/scripts/**` and an agent may write it, but it must move **with**
the manifest or its drift guard fails. Add to `RATIFIED_STRATEGY`, after the
`.github/PULL_REQUEST_TEMPLATE.md` row:

```js
  // Issue #570 — the GitLab emission of the SAME scaffold. A new path, not a
  // changed row: the signed 04/08/2026 classification is untouched and this one
  // extends it to the sibling artifact.
  '.gitlab/merge_request_templates/Default.md': 'refuse',
```

## What you are signing

The `managedStrategy` table is the classification **ratified 04/08/2026**, recorded in
`openspec/changes/issue-397-clobber-asymmetry/brain-drafts/managed-path-strategy.md`,
whose header reads *"An implementer may not change a row without a new signature."*

This adds a row; it changes none. Whether a NEW row needs its own signature is the
question this draft puts in front of you rather than answering. If it does, the signed
draft above should gain the GitLab row too — otherwise the transcription in
`managed-paths.test.mjs` stops transcribing a signature and starts transcribing the code.

## After applying

```bash
npm test                     # the two pending-aware tests in contributor-scaffold.test.mjs
                             # switch from their "declared in the draft" branch to their
                             # "delivered by the manifest" branch — both are real assertions
npm run brain:repo:check
npm run brain:nav
```

The delivery test runs the REAL `copyManaged` over the REAL manifest into a temp consumer
and asserts both scaffolds arrive byte-correct. It is the proof that the GitLab half of
#570 actually reaches a consumer, and it cannot pass until this hunk lands.

## References

#570 · PR #596 · #397 / REQ-397-2 (the REFUSE classification and its signed table) ·
#601 (the first-ship hole) · ADR-0013 (Tier 2) · ADR-0028 (`brain:promote` is
read-confirm-stage; the commit is the signature)
