---
status: draft
issue: 487
---

# Design — anchor the terminator

```js
export const FENCE_RE = /```(?:yaml)?[ \t]*\r?\n([\s\S]*?\r?\n)```[ \t]*(?:\r?\n|$)/;
```

Three properties, each load-bearing:

| | why |
|---|---|
| `\r?\n` **inside** the capture | the closing fence must be preceded by a real line break — that is the anchor, and it is what a value can never contain, since `yamlScalar` escapes `\n` |
| non-greedy `*?` retained | greedy would swallow a later legitimate block (M2) |
| the capture keeps its trailing newline | `scalar()` matches `^key:…$` under `/m`, and `parseEntryList`'s terminator predicate reads column-0 keys — both need the block to end with a line break, exactly as before |

The opener gains `[ \t]*` in place of `\s*`, which is what skips a **tagged** prose fence:
`\s*` could match nothing and then require `\n`, but so could the old form — the real
difference is that the terminator no longer matches mid-line, so the engine no longer
settles on the prose block's closing fence as an opener/closer pair.

## Why not the payload

Escaping ``` in `yamlScalar` is symmetric with the existing escapes and `decodeYamlEscapes`
already has the shape to reverse it. Rejected because `evidence:` exists to be read by a
human in the PR thread; making the most common shape of evidence the least readable one
trades a parsing bug for a reading one.

## Shared consumers

`extractFencedBlock` is also the locator for `brain-decision/1` (`decision-block.mjs`,
#473). Both protocols are emitted by the same fence-emitting family, so the anchor applies
uniformly; `yaml-block.drift.test.mjs` and the decision-block suite pass unchanged.
