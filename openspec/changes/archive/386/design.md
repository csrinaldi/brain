---
status: draft
issue: 388
---

# Design

Two helpers per provider, deliberately duplicated rather than shared: the port's providers are
adapters and do not import from each other (ADR-0008). Four lines of encoding are not worth a
coupling between two files that exist to be independently replaceable.

```js
const enc     = (v) => encodeURIComponent(String(v));
const encPath = (p) => String(p).split('/').map(encodeURIComponent).join('/');
```

## Why `%3A` is accepted

Both standard options encode `:` — `encodeURIComponent` and `URLSearchParams` alike. Sparing it
would mean hand-rolling a character list. One rule, no exceptions, no forgotten character.

## Scope note — what was NOT changed

`scopes.join(...)` still throws when `scopes` is undefined. Making it default to `[]` would turn
a missing required argument into a silently empty scope list, which is a worse failure than a
throw. Out of scope for all three tickets, and left deliberately.
