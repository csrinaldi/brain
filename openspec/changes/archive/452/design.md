---
status: design
issue: 452
epic: 313
artifact_store: openspec
topic_key: sdd/issue-452-parseentrylist-empty-vs-absent/design
---

# Design — `parseEntryList` distinguishes empty from absent (issue #452)

## D0 — CORRECTED after the cold review of PR #478 (read this before D1)

D1 below argued that reaching the end of the entry loop with `entries` empty means "the
list is empty", because the `start === -1` early return already established the key was
found. **That argument is wrong, and the first version of this change shipped on it.**

The loop also `break`s on the first line it does not recognise as list content — and it
recognises exactly two shapes, both anchored to one emitter's indentation. So an empty
`entries` has two causes, not one:

```
$ node scratchpad/foreign.mjs   # against the first version of the fix
GENUINELY empty (key, then next top-level key)     | in: true  | value: []
FOREIGN 0-indent seq (valid YAML, real findings)   | in: true  | value: []   ← WRONG
FOREIGN 4-indent seq (real findings)               | in: true  | value: []   ← WRONG
FOREIGN quoted key (real findings)                 | in: true  | value: []   ← WRONG
```

On `main` those three rows were `undefined` — *unknown*. The first fix turned them into
a positive, trusted `[]`: **"the reviewer found nothing"**, about verdicts carrying real
blockers, on exactly the foreign-verdict population this change's own justification cites
(`cold-boot.mjs:123`, `board.mjs:104`). It closed one instance of
`evidence-reader-empty-on-failure` by opening another in the worse direction.

The corrected rule follows the anti-pattern doc verbatim — `null` = uncomputable, `[]` =
genuinely empty. After the loop — **at any entry count**, not only when nothing parsed —
skip blank lines and ask whether the scan stopped at the next top-level key or the end of
the block. If yes, everything under the key was read → `[]` or the entries. If it stopped
on anything else, there was a body here this parser could not read → `null`.

Two corrections landed on that sentence, each from a review round, each inside the
previous round's fix:

- **"at any entry count"** (round 2). The first correction ran the test only when
  `entries.length === 0`, so a list that read one entry and then hit unreadable content
  returned the truncated prefix as a confident, complete list.
- **which lines may END a list** (round 3). `TOP_LEVEL_KEY_RE` was a generic
  `/^[A-Za-z_][A-Za-z0-9_]*:/`, so any `word:` at column 0 counted as a clean end — and
  the likeliest unreadable content in production is `brain-governance-status` stdout,
  which contains lines like `Tier: 2`. The predicate that decides "unreadable" had never
  been interrogated, only the rule built on top of it. It now names **this protocol's own
  top-level keys**, with a drift test that renders a fully-populated verdict and asserts
  every column-0 key it emits is accepted.

Blank lines are skipped rather than treated as a clean end, because `findings:` + blank +
0-indent entries would otherwise report empty again — the same bug one line further out.

D1's control-flow observation is still true; it simply does not support the conclusion
that was drawn from it. Kept below, with that correction, because the reasoning error is
more instructive than a clean narrative.

## D1 — the fix is `return entries`, and the reason is a control-flow fact
### (superseded by D0 — this was the flawed step)

The block-form branch is only reached after:

```js
const start = lines.findIndex(l => l.trimEnd() === `${key}:`);
if (start === -1) return null;
```

So by the time the entry loop finishes, **the key was found** — that is already
established by the early return above. An empty `entries` at that point is not "I could
not read a list", it is "the list I read has nothing in it". Those are different
sentences and they need different values.

This is why the fix is one line and still worth a change folder: the defect is not a
missing branch, it is a *conflation of two answers into one value*, and the argument for
the fix is a control-flow invariant that a reader can check in place.

## D2 — do NOT touch the inline branch (`parseJsonScalar`)

`parseEntryList` has two encodings. The inline one returns `parseJsonScalar(inline)`,
which yields `null` on unparseable input — a THIRD meaning for `null` in the same
function, and the more dangerous one (a corrupt findings list reads as no findings).

Deliberately out of scope, and not from timidity:

- It is a **documented** contract (`@returns … null when the key is absent or
  unparseable`), so changing it changes a promise, not a bug.
- `parseVerdict` guarantees it never throws (`parseJsonScalar`'s own comment: *"Never
  throws — an unparseable scalar … yields null, tolerated by the caller"*, and
  `board.mjs` relies on that for hand-edited comments). Distinguishing corrupt from
  absent therefore needs a **policy** — a distinct sentinel? a `malformed` flag on the
  result? — and every consumer needs a decision about it.

That is design work with its own red-first evidence, filed as its own ticket with the
measurement attached. Smuggling it into a one-line fix would give it none of that.

## D3 — the renderer half is #408's, and the pins prove it

The natural follow-on thought is "then `renderVerdict` should emit `follow_ups: []` like
it emits `findings: []`". That is a **protocol change**: it alters what brain posts, and
`follow_ups` is structurally unreachable until #408 gives an evaluator something to put
there. PR #444 already installed the tripwire, in both layers, with an instruction:

> *"If present: either #408 landed, or the render/parse contract changed — check WHICH
> before moving this."*

This change must leave both halves of that pin green. That is the operational test for
"did I stay in scope": REQ-409-6 going red here would mean the renderer moved.

## D4 — the one real behaviour change, and how it is checked

After the fix, a parsed verdict can carry `findings: []` / `follow_ups: []` where the
property was previously `undefined`. `undefined` is falsy; `[]` is **truthy**. Any
consumer doing `if (verdict.follow_ups)` would flip from the else-branch to the
then-branch.

Inspection says no such consumer exists: `parseVerdict`'s callers are `cold-boot.mjs:123`
and `board.mjs:104`, and `verdict.mjs:113`'s `if (v.follow_ups && v.follow_ups.length > 0)`
operates on the evaluator's object, which never goes through this parser.

Inspection is not evidence, so this is stated in the spec (REQ-452-5) and the full suite
is the check. Note also that reaching the new value from brain's own output is currently
impossible — `renderVerdict` emits neither a bare `follow_ups:` nor a bare `findings:` —
so the exposure is limited to foreign verdicts, which is exactly the population
`cold-boot` and `board` read.

## D5 — red-proof plan

1. Three-state test against the SHIPPED code: absent → `null` (green), present-empty →
   `[]` (**red**, returns `null` today), present-with-entries → entries (green).
2. `parseVerdict`-level: `'follow_ups' in result` for a bare `follow_ups:` block —
   **red** today.
3. After the fix, mutate `return entries` back to `entries.length > 0 ? entries : null`
   and watch 1 and 2 go red. **Verify the mutation landed on executable code before
   trusting the red** — the recurring lesson from #409 and #443, where a substitution
   silently failed to match and produced a meaningless green.
4. REQ-409-6's two pins stay green throughout — the in-scope check (D3).


## D6 — the encoder/decoder pair (issue #481, ruled in scope by the maintainer)

The largest and most delicate decision on this branch, added to the design record after
the third review noted it had none.

`yamlScalar` quoted values but did not ESCAPE line breaks. A quoted scalar carrying a raw
newline puts its continuation lines at column 0 — which terminates the findings list, so
every finding after it is dropped. `checkpoint.mjs` interpolates multi-line command stdout
into `evidence:`, so this fired on brain's own verdicts, not only foreign ones.

**Encode**: `\` → `\\` first (so later escapes are not re-escaped), then `"`, then
`\n`, `\r`, `\u2028`, `\u2029`. All four are line terminators to some reader; the JSDoc
says "line breaks are escaped", so it has to mean all of them rather than the two that
were convenient.

**Decode**: `decodeYamlEscapes` — the SINGLE inverse, added in round 4 after that
round found the emitter had acquired two decoders and only one had learned the new
escape. Both readers delegate to it. It maps `\n`/`\r`/`\u2028`/`\u2029` back to the CHARACTERS and
keeps the generic `\X → X` rule for everything else. **The halves move together** — the
generic rule alone would have turned the new escape into a bare `n` and lost the newline a
different way. That is why they are one design decision and one commit, not two.

Rejected: a YAML block scalar (`|-` + indented continuation). It preserves readability in
the posted comment, but it needs a third entry-line shape in a parser whose two existing
shapes are already the brittleness this change exists to reduce. Measured instead of
assumed: the escaped form is not less legible to a machine — `yaml.safe_load` reads the
escaped block and keeps the newlines, where the old raw-newline form silently folded them
into spaces.

**Every per-finding field goes through the encoder**, not just the three originally
touched. `severity`, `evidence_class` and `causal_disposition` were interpolated raw, and
`validateSchemaV2` is exported but called nowhere in production — so nothing constrained
them, and a newline in any one reproduced the same truncation one field over.

## D7 — red-proof plan, as executed

The D5 plan below was written for the first draft and is kept as the record. What the
three rounds actually required:

| mutation | expected red |
|---|---|
| `entries.length > 0 ? entries : null` (the round-1 draft) | the present-but-empty cases |
| `endedCleanly = true` | the unreadable cases |
| `endedCleanly = false` | the genuinely-empty AND with-entries cases — proves the branch DISCRIMINATES rather than merely fires |
| `if (!endedCleanly && entries.length === 0)` (the round-2 draft) | the partial-read case |
| `TOP_LEVEL_KEY_RE` loosened back to `/^\w+:/` | the `Tier: 2` case |
| drop the encoder's `\n` escape | the render round-trip cases |
| revert the decoder to generic `\X → X` | the same cases, separately |

**Print the diff before every mutation run.** Three mutations on this branch silently
failed to match and produced meaningless greens; recovering from one of them cost the
working copy, because `git checkout --` on an uncommitted fix reverts it entirely. Commit
before mutating.
