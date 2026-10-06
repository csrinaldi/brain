# Design: a same-day lane re-ship after a squash merge (#1190)

Paths are under `brain/scripts/memory/` unless stated otherwise. Line numbers are at `b1226c27`.

## Technical approach

The ship keeps refusing a known divergence, with one exception. It replaces its own remote lane branch, with a lease, when two keys both hold:

- **The content key** is a git read with no port call. It runs first.
- **The PR key** is the port read. It runs second, and only if the content key held.

The change is confined to `lane/ship.mjs`, plus two new catalog keys and the CLI's error mapping. There are no port, plan, branch-name or collect changes.

## D1. Where the two-key check sits

**Choice.** Branch inside the existing `behind > 0` block at `lane/ship.mjs:399`. Do not reorder the whole function. The ordering is:

```
behind>0 ──► ahead>0 && remoteTip!==null ? ──no──► throw diverged          (0 port calls)
               │yes
               ▼
           contentDelivery(remoteTip) === 'delivered' ? ──no──► throw diverged   (0 port calls)
               │yes
               ▼
           decision = decidePr(...)        (1 mrList; a throw stays prLookupFailed, pushed:false)
               ├─ closedUnmerged         ──► return the existing closedUnmerged outcome (REQ-4)
               ├─ create, basis:'merged' ──► replace = true; fall through to the push
               └─ anything else (open, no PR, other) ──► throw diverged
```

`decidePr` is then not called a second time. The `decision` reaches `lane/ship.mjs:415` already decided: `decision ??= await decidePr(...)`.

**`decidePr` change** (`lane/ship.mjs:210,226`). A `create` decision now carries a `basis` field:

| Case | Return |
|---|---|
| empty list | `{action:'create', basis:'none'}` |
| newest PR has `merged === true` | `{action:'create', basis:'merged', number}` |
| any other computable combination | `{action:'create', basis:'other'}` |

Only `'merged'` unlocks the replace. This keeps the rule exact: `merged === true`, never "anything else".

**Ordering guarantees in `lane/ship.test.mjs`:**

- `:425` "behind > 0 … zero port calls" is **preserved unchanged**. Its catch-all `diff` rule makes the remote tip `pending`, so the content key fails before any port call.
- `:450` (non-fast-forward backstop, `mrList: 1`) is unchanged, because `behind` is 0 there.
- `:403` is **deliberately tightened**, not loosened. On every non-replace path, no argv element may start with `--force`. Its source check `/(['"])--force\1/` still holds, because the lease is built in a template literal.
- The only newly permitted state is "a known divergence makes one `mrList` call". It applies only after the remote tip is proven content-delivered.

**Alternatives rejected:**

- Moving `decidePr` above `:399` for every `behind > 0`. That costs a port call on every divergence and breaks `:425`.
- Reading the PR first. That puts a port call before the cheap git proof.

## D2. `contentDelivery` on the remote tip

**Choice.** Call `contentDelivery({git, root, rev: remoteTip, baseFetched})` from `lane/delivery.mjs:34`, with the **sha** that the survey resolved, not the ref name. The same object is proved and leased, so a re-fetch in between cannot split the two.

| Result | Outcome |
|---|---|
| `delivered` | the only state that passes |
| `pending` | `diverged`, with the message suffix `remote tip <sha> carries content not on origin/main` |
| `unknown` (`baseStale` or `diffFailed`) | `diverged`, with the suffix `remote tip <sha> delivery unknown (<reason>)` |

A remote tip with no merge base, which is the racing writer at `ship.integration.test.mjs:138-140` and `cli.ship.test.mjs:90-92`, fails the three-dot diff. That result is `unknown`, so the refusal holds.

Every diverged message keeps `${ref}`, which `cli.ship.test.mjs:216` asserts.

## D3. The lease push

**`surveyRef`.** After a successful fetch (`lane/ship.mjs:71-73`), it runs `git rev-parse --verify --quiet refs/remotes/origin/<branch>` and returns `remoteTip`. It returns `remoteTip: null` on all three other returns, at `:57`, `:66` and `:68`.

**`behind: null`** means the fetch failed. The `behind > 0` block is never entered and `remoteTip` is null. The ordinary push at `:427` runs with no lease, so a stale remote is still refused by git and reported as `diverged` by the backstop. **A replace is unreachable without a successful survey.**

**argv**, on the replace path only:

```js
['push', '--no-verify', `--force-with-lease=${ref}:${remoteTip}`, 'origin', `${ref}:${ref}`]
```

`ref` is already `refs/heads/memory/<host>-<date>`, and the refspec has no leading `+`.

**Stderr classification on the replace path** uses a new pure, exported function, `classifyReplaceFailure(stderr)`. It is checked in this order:

| Order | Pattern | Error tag | Key | Message |
|---|---|---|---|---|
| 1 | `/\(stale info\)/` | `leaseStale` and `diverged` | `memory.ship.leaseStale` | `memory.ship.leaseStale: lease on <ref> at <sha> refused — <stderr>` |
| 2 | `/\[remote rejected\]\|protected branch\|GH006\|GH013\|not allowed to force push\|repository rule/i` | `replaceRefused` | `memory.ship.replaceRefused` | `memory.ship.replaceRefused: origin refused the forced update of <ref> — <stderr>` |
| 3 | anything else | `pushFailed` | the existing key | the existing message |

Notes on the classifier:

- The ordinary path keeps `:429` verbatim. Its `/rejected/` also matches `[remote rejected]`, which is why the replace path needs its own classifier.
- `diverged` stays on `leaseStale`, so `lane/sweep.mjs:156` reports it as a `diverged` row. `replaceRefused` maps to sweep's `failed` row, with the message as the reason.
- The push runs once. There is no retry and no delete.

**CLI** (`cli.mjs:678-684`). Insert `err?.leaseStale ? "leaseStale" : err?.replaceRefused ? "replaceRefused"` before `diverged`.

**Catalog texts** (`i18n/en.mjs` after `:463`, `i18n/es.mjs` after `:424`):

- `memory.ship.leaseStale`
  - en: `'✗ ship failed — origin\'s lane branch moved after it was surveyed, so the lease refused the replace; nothing was overwritten, retried or deleted. Run the ship again to re-survey it. {message}'`
  - es: `'✗ el envío falló — la rama del lane en origin se movió después de relevarla, así que el lease rechazó el reemplazo; no se sobrescribió, reintentó ni borró nada. Volvé a correr el envío para relevarla de nuevo. {message}'`
- `memory.ship.replaceRefused`
  - en: `'✗ ship failed — origin refused to replace its merged lane branch, most likely a protection or rule forbidding forced updates on memory/*; nothing was retried or deleted. Allow forced updates on memory/* or delete the merged branch by hand, then ship again. {message}'`
  - es: `'✗ el envío falló — origin rechazó reemplazar la rama del lane ya fusionada, probablemente por una protección o regla que prohíbe updates forzados en memory/*; no se reintentó ni se borró nada. Permití updates forzados en memory/* o borrá a mano la rama fusionada, y volvé a enviar. {message}'`
- `memory.ship.replaced` is a stderr evidence line, next to `cli.mjs:639`.
  - en: `'✓ replaced {branch} on origin under a lease — pull request #{number} was merged and every record it carried is on main.'`
  - es: `'✓ se reemplazó {branch} en origin con lease — el pull request #{number} se fusionó y cada registro que llevaba está en main.'`

**Outcome shape.** `base` gains `replaced: null`. A replace run returns `replaced: {from: remoteTip, mergedPr: n}`.

## D4. PR handling after a replace

`decision.action === 'create'`, so `createPr` runs (`lane/ship.mjs:446-448`) and opens a **new** PR. Auto-merge is armed at `:474`.

The title and body are unchanged. `buildTitleAndBody` (`:127`) diffs the **local** ref, which `collect.mjs:298-302` reparented onto `origin/main`, so it lists only the new records. There is no "replaces #N" line, so the ADR-0034 grammar stays as it is.

## D5. Sweep inheritance (named, not hidden)

`lane/sweep.mjs:151` calls `shipLane` for prior-day `pending` refs, so the replace path is reachable there too. It needs the same two keys on the same ref. **The decision is to inherit it, with no flag.** A flag would add a second code path, and the proof does not depend on the day. Accepted (ruling 2): both keys are still required, so nothing unmerged is ever replaced.

## Test plan

Every spawn gets a `timeout`. Two changes cover that:

- the local `git()` helpers in `ship.integration.test.mjs:26` and `cli.ship.test.mjs:36` get `timeout: 30_000`;
- `runCli` (`cli.ship.test.mjs:125`) gets `timeout: 60_000` and `stdio: ['ignore','pipe','pipe']`.

`ship` never reads stdin, so no test passes `input`. If a future child reads stdin, it is fed by a bash redirect from a file (#1221). `cli.ship.test.mjs` is already allowlisted file-wide in `test-spawn-hygiene.test.mjs:303`, so no new entry is needed. The integration tests spawn only `git`, which is not a scanned entrypoint.

| Spec | File | Test name |
|---|---|---|
| 1.1, 1.2 | `ship.test.mjs` | `#1190 replace: both keys hold ⇒ one push with --force-with-lease=<ref>:<observed remoteTip>, new PR, armed, replaced set` |
| 2.1 | `ship.test.mjs` | `#1190 remote delivered, no PR ⇒ diverged, one mrList, no push`; `… newest PR open ⇒ diverged` |
| 2.2 | `ship.test.mjs` | `#1190 newest PR merged but remote tip pending ⇒ diverged, zero port calls` |
| 2.2 (unknown) | `ship.test.mjs` | `#1190 baseFetched:false ⇒ remote unknown ⇒ diverged, zero port calls` |
| 4.1 | `ship.test.mjs` | `#1190 behind>0, remote delivered, closed-unmerged ⇒ closedUnmerged outcome, no push` |
| 5.1 | `ship.test.mjs` | `#1190 lease push "[remote rejected] … (protected branch hook declined)" ⇒ replaceRefused, exactly one push, no delete argv` (fake stderr) |
| 5.2 | `ship.test.mjs` | `#1190 lease push "(stale info)" ⇒ leaseStale + diverged, exactly one push` |
| D3 | `ship.test.mjs` | `#1190 behind:null with a stale remote ⇒ no lease argv, non-ff backstop ⇒ diverged`; `ahead:0 or remoteTip null ⇒ diverged` |
| 6.2 | `ship.test.mjs:403` | tightened as described in D1 |
| 1.1, 7.2 | `ship.integration.test.mjs` | `#1190: squash with the branch surviving, PR merged ⇒ lease replace, new PR, remote = second.commit` (`#1050` at `:263` stays; its comment at `:276-278` is corrected) |
| 2.1 | `ship.integration.test.mjs` | `#1190: surviving branch, PR still open ⇒ diverged, remote sha unchanged` |
| 3.1 | `ship.integration.test.mjs` | `#1190: extra unmerged commit on the remote, PR merged ⇒ diverged, remote sha unchanged, mrList count unchanged` (`:126` unchanged) |
| 5.2 | `ship.integration.test.mjs` | `#1190: lease race — a git wrapper moves origin just before the lease push ⇒ leaseStale, racer's sha survives` |
| 5.1 | `ship.integration.test.mjs` | `#1190: origin with receive.denyNonFastForwards=true ⇒ replaceRefused, remote sha unchanged` |
| 5.1 (CLI) | `cli.ship.test.mjs` | `#1190: a refused forced update exits 1 with memory.ship.replaceRefused's en text, origin unchanged` (`hostname()` and today, as at `:84`) |
| 7.1 (CLI) | `cli.ship.test.mjs` | `#1190: a same-day re-ship after a squash exits 0 and prints memory.ship.replaced` |

How the integration tests mark the PR merged: `recordingVcs()` exposes `prs` (`:89`), and the test sets `prs[0].state = 'closed'` and `prs[0].merged = true`.

**Hermetic e2e: not needed.** The integration fixture uses real git and a real bare remote. REQ-7 on a fresh consumer is shown by the next phase-exit demo run, as evidence.

## ADR-0034 amendment outline (`brain-amendment/1`, written later)

- `target: brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md`, `amendment: 5`, `issue: 1190`. The ADR's Status line is at Amendments 1-4.
- **amend-find** is `:84` "never a force-push". **amend-replace** annotates it: the one forced update a lane takes is replacing its own provably merged branch by lease (Amendment 5).
- **What changed.** `brain:memory:ship` replaces `memory/<host>-<date>` with `--force-with-lease=<ref>:<observed sha>` only when two keys hold: the remote tip is content-delivered on `origin/main`, and the newest PR is `merged:true`.
- **Why.** Squash auto-merge does not delete the branch, so the same-day re-ship refused. The manual delete it needed is Tier 2.
- **What it does NOT close.** A remote rule forbidding force-push still refuses, loudly. The branch is never deleted. A sweep exposure exists (D5). The merged key trusts `mrList`, which carries no head sha.
- **Tier 3 reasoning.** This is not a history rewrite of shared work:
  - the product acts, not an agent;
  - only on its own lane branch;
  - only after proving that every byte is on `main` and the PR merged;
  - the lease refuses any concurrent push.

## Diff-size estimate (excluding tests and `openspec/`)

| File | Estimated change |
|---|---|
| `ship.mjs` | about +75 lines |
| `cli.mjs` | about +6 |
| `en.mjs` and `es.mjs` | about +6 |
| `docs/KNOWN-LIMITATIONS.md` | about −10 |
| **Total** | **about 100 lines, against the lite budget of 1000** |

## Open questions

- [x] D5: may the cross-day sweep inherit the replace path? The design says yes.
- [x] The spec's "newest PR is the first result" is read as `decidePr`'s rule: an open PR wins, then the highest number. The spec wording should align.
- [x] Scenario 4.1 says "the closedUnmerged error", but the existing behaviour is a non-throwing outcome that exits 0. The design keeps the outcome.
- [x] The exact stderr from `receive.denyNonFastForwards` must be captured in the test. The test asserts the key, not the text.
