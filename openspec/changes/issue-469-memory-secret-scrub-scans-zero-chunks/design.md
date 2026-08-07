---
status: draft
issue: 469
---

# Diseño — memory secret scrub scans zero chunks (issue 469)

## D1 — git or the filesystem? The ticket's open question, decided by measurement

#469 asks for *"a decision on whether `--ignored` is the right fix, or whether the detector
should read the filesystem"*. Measured on this branch, with two chunk files present:

| command | output |
| --- | --- |
| `git status --porcelain -- .memory/chunks` | *(empty)* — today's code |
| `git status --porcelain --ignored -- .memory/chunks` | `!! .memory/chunks/` |
| `git status --porcelain --ignored=matching -- .memory/chunks` | `!! .memory/chunks/` |
| `git status --porcelain --ignored=matching -uall -- .memory/chunks` | `!! .memory/chunks/` |
| `git status --porcelain --ignored -uall -- .memory/chunks` | `!! .memory/chunks/probe-0000.jsonl.gz`<br>`!! .memory/chunks/probe-0001.jsonl.gz` |

**`--ignored` alone does not fix it.** Three of the four git variants report the *directory*,
which fails the existing `.jsonl.gz` suffix filter — so the scrub still scans zero. Exactly
one combination works, and it is the counter-intuitive one: plain `--ignored -uall` lists the
files, while `--ignored=matching -uall` — which reads as the more precise request — collapses
to the directory.

**Decision: read the filesystem.** Not on taste; on that table. A gate whose correctness
rests on a flag pair where the more-specific-looking spelling silently disarms it is the
defect we are fixing, re-armed and harder to see. A future tidy-up that "tightens"
`--ignored` to `--ignored=matching` would return the scan to zero and every test would stay
green — the round-19 lesson from #405 (*search for the claim, not for its wording*) applied
before the fact.

Two further reasons, both structural:

- `_defaultReadObservations` **already** reads `.memory/chunks` from the filesystem
  (`collectChunkObservations`). Having the scanner ask git about the same directory the
  reader reads directly is two sources of truth for one set.

  **Corrected in round 1.** This paragraph first closed with *"what gets scanned and what
  gets read are the same enumeration"*, and that was **false as implemented** — see D4. The
  two enumerations are still two; what the round established is the invariant that actually
  matters, which is weaker than equality and is the one worth stating.

## D4 — the invariant is CONTAINMENT, not agreement (round-1 cold review, BLOCKER)

The first draft dropped directories with `Dirent.isFile()` (E5). `isFile()` is also false for
a **symlink** entry, and the reader's `readFileSync` follows symlinks. Measured on a chunks
directory holding one symlink to a chunk carrying `ghp_…`:

```
SCANNER sees : [ 'plain.jsonl.gz' ]
READER  sees : [{"text":"ghp_0123…"},{"text":"fine"}]
```

The secret bypassed the scrub and reached the append-only records log, in a public
repository — the outcome the gate exists to prevent, opened by the guard added to close a
different one. The #405 pattern, in this change's own first draft: *a repair fixes the
dimension it was pointed at and leaves the next one constant.* `isFile()` was aimed at
directories; symlinks are the contiguous shape nobody enumerated.

**The requirement is not that the two sets are equal — it is that the scanned set CONTAINS
the read set.** Nothing may reach `records/` unscanned; scanning something the reader will
ignore costs nothing. Equality would be a stronger claim than the gate needs and, as the
directory case shows, than either function should make.

Implemented with `statSync`, which **follows** symlinks: a symlink to a chunk is scanned, a
directory — reached directly or through a link — is not, and the reader can read nothing the
scanner does not see. An entry that cannot be stat'd fails **closed**, for the same reason
the directory read does: *cannot look* must never be reported as *nothing to scan*, which is
the whole defect of this ticket restated one level down.

Pinned by a test that asserts the containment over a fixture holding every awkward shape at
once — plain file, symlink to a chunk, directory named `*.jsonl.gz`, symlink to a directory,
non-chunk file — and that derives the reader's side from the reader's own rule rather than
from a hand-written list. A hand-written list is how the symlink shape was missed.
- The gate stops depending on `.gitignore`. Today the scan's behaviour is a function of a
  file whose purpose has nothing to do with secret scanning, and which no test asserts.

## D2 — the "materialized THIS run" boundary was already gone

`_defaultChangedChunkFiles`'s docstring says the git query is *"the 'materialized THIS run'
boundary the scrubber respects (never the whole store)"*. That boundary depends on chunks
being tracked, so that "changed" means "differs from HEAD". They are gitignored and have
**never** been tracked, so no chunk has ever been reported — the boundary did not narrow the
scan, it emptied it.

Note that the working git variant does not restore it either: `--ignored -uall` reports
**every** chunk in the directory, not this run's. Both viable fixes scan the whole store.

**Decision: scan every chunk present, and say so.** The premise that an untouched chunk was
already cleared by an earlier run is false — no earlier run scanned anything. Re-establishing
a real boundary (a pre-export snapshot differenced against a post-export one) is possible and
deliberately not done here: it trades the gate's completeness for speed, in a gate whose
entire job is completeness, on a store measured at 6.8 MB. If the store grows enough for the
scan to hurt, that is a ticket with a measurement in it, not a guess now.

The docstring is rewritten to state what the function does. Leaving the old sentence would
be a normative claim the code falsifies — the #405 class of defect this repo keeps finding.

## D3 — fail loudly when the export wrote somewhere else

`ensureMemorySymlink` already models the three states (`engram.mjs:54-56`) and, in case 3
(`.engram` is a real directory), only warns. `share()` then exports into `.engram/chunks/`
and scans and reads `.memory/chunks/` — a different directory — so the run succeeds with zero
records and zero scanned chunks.

**Decision: `share()` verifies, after `_export` and before the scrub, that the directory it
is about to scan is the one the export writes to.** The check is a resolved-path comparison,
not a symlink-type check: what matters is that the two paths land on the same directory, and
`realpathSync` answers that for a symlink, a bind mount, or anything else that makes them
agree. Absent `.engram` is fine — engram then writes to `.memory` directly, which is the
post-migration state on a fresh clone.

It throws rather than warns. A warning is what `ensureMemorySymlink` already does, and this
defect reached the maintainer's checkout with that warning in place; the ticket's acceptance
asks for loud, and a publication path that reports success having done nothing is the failure
mode `evidence-reader-empty-on-failure` names.

The check is a new seam (`_resolveDir`) so it is testable without a real symlink, and so the
test can drive the trap state directly rather than reproducing it with filesystem setup.

## Contract / API impact

None public. `_defaultChangedChunkFiles`'s signature is unchanged: `(root, opts) => string[]`,
absolute paths. Its `opts._spawn` seam is replaced by `opts._listDir`, which is an internal
test seam — the exported name, arity and return type are the same, and `scrubMaterializedChunks`
calls it identically.

`share()` gains one injectable seam (`_resolveDir`), following the file's existing convention
that every external dependency is an underscore-prefixed default parameter.

No config key, no CLI flag. There is still no `--no-scrub`; the allowlist
(`governance.memorySecretAllowPatterns`) remains the sole bypass.

## Alternativas descartadas

- **`git status --porcelain --ignored -uall`.** Works, measured. Rejected per D1: it is the
  only one of four spellings that works, the failure is silent, and it keeps two readers on
  one directory.
- **Un-ignore `.memory/chunks/`.** Would make the original query correct, and would commit
  regenerable gzip transport to the repo — the exact thing `.gitignore:82` says not to do
  (*"regenerables con `memory:share`"*). It also makes a security gate depend on a
  repository-layout decision.
- **Keep the git call and fail closed on an empty result.** Rejected: an empty chunk
  directory is a legitimate state (a fresh clone), so "empty" cannot be treated as failure at
  that layer. The honest fix is a query that can distinguish the two, which is what reading
  the directory gives — `ENOENT` versus `[]`.
- **Make `ensureMemorySymlink` clobber a real `.engram` directory.** Rejected: it deliberately
  does not clobber, and that is right. D3 detects the state at the point where it does harm
  instead of changing the setup verb's contract.
