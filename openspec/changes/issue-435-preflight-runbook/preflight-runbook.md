# #435 Pre-flight — runbook

> **§1 and §2a have been EXECUTED — results inline below.** The first draft of
> this runbook handed the whole thing to the maintainer on the grounds that an
> agent could not run it. Two of the three stated blockers were false, and the
> corrections are recorded in §4.0 rather than quietly fixed.
>
> **What remains is genuinely the maintainer's**, and §4.2 says why for each:
> live-credential verification, rotation, the §2b judgment call, and the
> signature.
>
> Every command below is reproducible on a full clone. **Fill in:** `<FULL_CLONE_PATH>`.

---

## Read this before step 0 — the pre-flight's purpose has changed

#435 wrote this audit as a **gate**: *"The irreversible part — a pre-flight,
before anything else."* The gate describes a decision that has already been
taken. Measured 2026-08-13:

```
$ curl https://api.github.com/repos/csrinaldi/brain
  private: false · visibility: public · forks: 0 · stars: 0
```

The repository is public and has been for some time. #94 records the switch in
passing (*"The repo is public. The decision resolved itself along #435's path"*)
and closed on the branch-protection it enabled.

So this runbook is no longer *"should we publish?"* It is **"what is already
exposed, and what has to be rotated?"** Three consequences, and they change
what a finding means:

1. **There is no no-go.** Publication is not undoable in practice: forks,
   clones, caches and archives outlive any revert. Today's `forks: 0 · stars: 0`
   bounds the likely exposure; it does not undo it.
2. **A history rewrite is the wrong remedy.** `git filter-repo` on a public repo
   rewrites *your* copy and nothing anyone else already has. **If a live
   credential is found, the fix is to ROTATE it** — treat rewriting as optional
   hygiene afterwards, never as containment.
3. **The judgment call in step 2b was made by omission.** 2177 session records
   narrating internal decisions are public right now. This runbook's job there
   is to convert that into a decision that was actually made, either way.

Everything below is still worth doing. Only the verb changed: from *authorise*
to *find out and repair*.

---

## §0 — Preconditions

### 0.1 A FULL clone, verified

The audit surface is every commit, not the working tree. A shallow clone reads
as a clean history because the commits that would fail are simply absent.

```bash
cd <FULL_CLONE_PATH>
git rev-parse --is-shallow-repository     # MUST print: false
git rev-list --count --all                # record this number
```

If it prints `true`, **deepen rather than re-clone** — `git fetch --unshallow`
works and is far cheaper. Measured 2026-08-13: the container's clone printed
`true` at 218 commits; after `--unshallow`, **1170 reachable, 1114 on `main`**.

> **#435's own figure is stale.** It says *"all 534 commits on `main`"*; `main`
> carries 1114 today. Anyone scoping the audit from that number is scoping half
> of it.

### 0.2 Tools

```bash
gitleaks version        # https://github.com/gitleaks/gitleaks
trufflehog --version    # https://github.com/trufflesecurity/trufflehog
```

Two scanners, deliberately. They use different rule sets and different entropy
heuristics; agreement is weak evidence and disagreement is the interesting
case. #435's own wording: automated scanning is **necessary and not
sufficient**.

### 0.3 Not from a cloud container

A Claude Code cloud container routes `api.github.com` through a proxy that
injects its own credentials (#604), and has no `gh`. Its `HTTPS_PROXY` also
means "clean" network results there say nothing about your machine.

---

## §1 — History credential scan

### 1.1 gitleaks over all history — **EXECUTED 2026-08-13, 19 findings, all benign**

```bash
gitleaks detect --source . --log-opts="--all" --redact --report-path /tmp/gitleaks.json
echo "findings: $(jq 'length' /tmp/gitleaks.json)"
```

`--redact` keeps the secret itself out of the report file. Read findings by
`RuleID`, `File`, `Commit`, `Date`.

**Result — 853 commits scanned, 19 findings, every one accounted for:**

| count | rule @ file | verdict |
|---|---|---|
| 12 | `gitlab-pat` ×9, `generic-api-key` ×2, `aws-access-token` ×1 @ `secret-scrub.test.mjs` | fixture (§1.4) |
| 5 | `github-pat` ×2, `aws-access-token` ×2, `generic-api-key` ×1 @ `engram.share.test.mjs` | fixture (§1.4) |
| 2 | `generic-api-key` @ `vcs/ci-context.mjs` | **false positive** — the matched line is `apiBase: env.CI_API_V4_URL ?? 'https://gitlab.com/api/v4'`. A public URL; the rule fires on the variable name |

### 1.2 trufflehog, verified-only then everything

```bash
trufflehog git file://. --only-verified --json > /tmp/th-verified.json
trufflehog git file://. --json > /tmp/th-all.json
```

`--only-verified` calls the provider to ask whether the credential is **live**.
Those are the ones that matter: a live key is an incident, an expired one is
hygiene.

### 1.3 Targeted passes the scanners are weakest at — **EXECUTED, clean**

Commit **messages** and deleted files — both are places a pasted token survives
a later cleanup.

```bash
# tokens in commit messages
git log --all --format='%H %s%n%b' | grep -nE 'ghp_|github_pat_|glpat-|sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}' || echo "clean"

# any blob that ever contained a token shape, including deleted ones
git log --all -p -S'ghp_' --oneline || echo "clean"
git log --all -p -S'glpat-' --oneline || echo "clean"
git log --all -p -S'BEGIN RSA PRIVATE KEY' --oneline || echo "clean"

# .env was never versioned — confirm that across ALL history, not just HEAD
git log --all --diff-filter=A --name-only --format='%H' -- '.env' | head || echo "never added"
```

**Results:** commit messages **clean**. `.env` **never versioned**, across all
history. The `-S` passes found token shapes in 16 / 9 / 2 / 2 commits
respectively — and every file they touch is the scrubber (`secret-scrub.mjs`),
its tests, its pattern definitions (`config-migrations.mjs`), openspec documents
*about* the scrubber, or this runbook. One exception was worth chasing:
`.memory/records/2026-07.jsonl`, resolved in §2a.

### 1.4 Expected benign hits — anything else is a finding

The working tree has four files that legitimately contain credential-shaped
strings, because they are the fixtures that test the scrubber:

| file | shapes |
|---|---|
| `brain/scripts/memory/lib/secret-scrub.test.mjs` | GitLab PAT ×9, AWS key ×1, private-key block ×1 |
| `brain/scripts/memory/backends/engram.share.test.mjs` | GitHub PAT ×2, AWS key ×2 |

Plus **two `generic-api-key` false positives** in `brain/scripts/vcs/ci-context.mjs`,
both on `apiBase … 'https://gitlab.com/api/v4'`.

Confirm each hit resolves to one of those. **Every other hit stops the run** and
goes to §1.5.

### 1.5 If something is found

In this order:

1. **Rotate the credential at its provider.** Immediately, before anything else.
   This is the containment step; nothing in git is.
2. Record it in the §4 block: what, which commit, when it was introduced,
   when rotated.
3. Only then consider `git filter-repo`, and only as hygiene. It does not
   retract what is already cloned or cached.

Author emails in commit metadata are **not** a finding — they are public in
every git history by construction.

---

## §2 — `.memory/` (8.6 MB, 2177 records)

### 2a — The records the scrub never ran on — **EXECUTED, clean**

`secret-scrub` is wired into the memory **backends** (`engram.mjs`,
`plainfiles.mjs`); `format.mjs` explicitly disclaims it. The records written in
#410/#427 went through `buildRecord` plus a direct file append, so the backend
path — and therefore the scrub — **never executed** on them.

```bash
node -e '
const fs=require("fs");
for (const f of fs.readdirSync(".memory/records")) {
  for (const line of fs.readFileSync(".memory/records/"+f,"utf8").split("\n")) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (/#410|#427/.test(JSON.stringify(r))) console.log(f, r.id, r.actor, r.type);
  }
}'
```

**Result: 4 records**, all `@legacy` / `session_summary`, 2229–3185 chars each,
**all clean** against full-form PAT / GitLab-PAT / AWS-key / private-key /
long-Bearer / `password=` patterns.

> An earlier count in this runbook said 10. That was a looser regex (`#41\b`)
> catching unrelated ticket numbers. The corrected figure is 4.

The one thing worth reading anyway, because it is the shape §1.3 chased into
this file: `.memory/records/2026-07.jsonl` contains **5 occurrences of `ghp_`**,
and every one is *narrative with the token elided* — e.g. *"the reviewer token
got written as a KEY NAME (`ghp_...=`) instead of `BRAIN_REVIEWER_TOKEN=`"*, and
*"a 40-char `ghp_` PAT, in BOTH the main checkout and the …"*.

Verified: **zero full-form tokens across the entire history of `.memory/`.**

```bash
git log --all -p -- .memory/ | grep -coE 'ghp_[A-Za-z0-9]{36}|glpat-[A-Za-z0-9_-]{20}|github_pat_[A-Za-z0-9_]{22,}'
# → 0
```

Those records are clean, and they are also a fair illustration of §2b: a session
summary narrating a credential-handling incident does not leak the credential,
but it does tell a reader that a 40-char PAT once sat in `.env` in two
checkouts.

```bash
node -e '
const fs=require("fs");
for (const f of fs.readdirSync(".memory/records"))
  for (const l of fs.readFileSync(".memory/records/"+f,"utf8").split("\n")) {
    if (!l.trim()) continue; let r; try { r = JSON.parse(l); } catch { continue; }
    if (/#410|#427/.test(JSON.stringify(r))) console.log("\n=== "+r.id+" ===\n"+r.content);
  }' | less
```

### 2b — The judgment call, which is not automatable

```bash
node -e '
const fs=require("fs"); const a={};
for (const f of fs.readdirSync(".memory/records"))
  for (const l of fs.readFileSync(".memory/records/"+f,"utf8").split("\n")) {
    if (!l.trim()) continue; try { const r=JSON.parse(l); a[r.actor+"/"+r.actorKind]=(a[r.actor+"/"+r.actorKind]||0)+1; } catch {}
  }
Object.entries(a).sort((x,y)=>y[1]-x[1]).forEach(([k,v])=>console.log(v,k));'
```

Measured: **2070 of 2177** are `@legacy` / human session summaries. They narrate
internal decisions, mistakes and process — including this repo's own governance
failures, which is most of what makes them interesting.

#435 puts it well: that is *"arguably brain's best advertisement — the
methodology working in the open — but it is a choice to make deliberately, not
by omission."* It is currently public **by omission**. Pick one and write it in
§4:

- **Keep and own it.** The records stay, and the README says why they are there.
- **Stop shipping forward.** They stay in history (unavoidable) but `.memory/`
  leaves the published tarball — **already done**, #607.
- **Prune.** Only meaningful together with rotation of anything found in §1;
  deletion does not retract.

---

## §3 — Internal references

Measured file counts on `main` @ `b2a6b37`:

| term | files | reading |
|---|---|---|
| `engram` | 219 | product surface — the memory backend. Expected. |
| `gentle-ai` | 71 | product surface — the SDD harness. Expected. |
| `gitlab.com` | 33 | mostly the GitLab provider and ADR-0018's fragment. Check for a **specific mirror URL**. |
| `SCIT` | 25 | **the one to read closely.** A named self-hosted environment. |
| `samples-of-html5` | 6 | the sample consumer repo used by `test/fresh-install`. |

```bash
grep -rn "SCIT" --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.memory . | less
grep -rn "gitlab\.com/[A-Za-z0-9._/-]*" -o --exclude-dir=.git --exclude-dir=node_modules . | sort -u
```

The question is not "is this internal?" but **"does this read as personal
infrastructure to a stranger, and does naming it cost anything?"** Hostnames of
a self-hosted instance are the ones worth a second look; a product name is not.

---

## §4 — The record

### 4.0 What the agent got wrong, and then ran

The first draft of this runbook handed everything to the maintainer, on three
stated blockers. **Two were false**, and finding that out is why §1 and §2a are
now executed rather than pending:

| claimed blocker | reality |
|---|---|
| "the clone is shallow and cannot be deepened" | `git fetch --unshallow` worked. 218 → **1170 reachable, 1114 on `main`** |
| "gitleaks/trufflehog are not installed" | the gitleaks release tarball downloads and runs |
| "verification uses live credentials" | **true** — see §4.2 |

So §1.1, §1.3 and §2a were executed from the container, and their results are
inline above. What that does *not* cover is §1.2's `--only-verified` pass, which
is the one genuine blocker.

**Read the executed sections as a scan, not as an audit.** gitleaks' rule set is
broad but finite; a credential in an unusual shape passes it, which is the whole
reason #435 says automated scanning is *necessary and not sufficient*. The
maintainer's re-run is still worth its time — it costs about a minute now that
the commands and their expected output are written down.

### 4.1 The block to sign

Paste into #435 as a comment, filled in:

```
## Pre-flight — executed <DATE>

Clone:            <FULL_CLONE_PATH>, shallow=false, <N> commits
Scanners:         gitleaks <ver>, trufflehog <ver>

§1 history:       <N> gitleaks findings / <N> trufflehog verified
                  → all resolve to §1.4 fixtures        [ ] yes  [ ] no
                  → credentials rotated:                <list, or "none found">
§2a #410/#427:    10 records read in full               [ ] clean  [ ] finding
§2b session logs: decision = [ ] keep and own  [ ] prune  [ ] other: ______
§3 references:    SCIT / mirror URLs reviewed           [ ] no change  [ ] changes: ______

Outcome:          [ ] nothing exposed — record and move on
                  [ ] exposure found, rotated, recorded below
                  <detail>

Signed: <name>, <date>
```

### 4.2 What is the maintainer's, and why

Four things, and none of them for ceremony:

1. **`trufflehog --only-verified` (§1.2).** Verification means *sending each
   candidate credential to its provider* to ask whether it is live. That is the
   one step where auditing and exercising someone's credential are the same
   action — and from this container it would go through a proxy that rewrites
   identity (#604), so a "clean" result would mean nothing.
2. **Rotation (§1.5).** Provider consoles, the maintainer's accounts. Nothing
   found so far needs it.
3. **The §2b decision.** Whether 2070 human session summaries stay public is a
   values call about the maintainer's own working record, not a technical
   finding. An agent picking it would be the omission all over again, with a
   different author.
4. **The signature (§4.1).** Same class as `brain:promote`: the mechanics are
   automatable, the attestation is not.

### 4.3 What unblocks on the back of it

With §4.1 posted, the rest of #435 is ordinary work: the scoped package name,
`private: false` in `package.json`, the install-spec move off the git URL, the
README and `test/fresh-install` corrections, and the ADR superseding ADR-0006.

`files` and the licence are **already done** (#607) and deliberately land first:
the allowlist has to exist before `private` comes off, and that ordering is the
one thing in #435 that is still protecting something.
