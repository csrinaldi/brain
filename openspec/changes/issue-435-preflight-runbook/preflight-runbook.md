# #435 Pre-flight — runbook

> **The agent prepared this; the maintainer executes it.** Every command runs on
> a **full clone**, on the maintainer's machine. Nothing here can be run from a
> Claude Code cloud container (see §0), and nothing here should be run by an
> agent: the output is credential material.
>
> **Fill in:** `<FULL_CLONE_PATH>`.

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

**STOP if it prints `true`.** Re-clone: `git clone https://github.com/csrinaldi/brain.git`.

> This is not hypothetical. The agent-side pass reported in §4.0 ran in a
> container where this printed `true` and only 218 commits were reachable —
> which is exactly why that pass does not count as this step.

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

### 1.1 gitleaks over all history

```bash
gitleaks detect --source . --log-opts="--all" --redact --report-path /tmp/gitleaks.json
echo "findings: $(jq 'length' /tmp/gitleaks.json)"
```

`--redact` keeps the secret itself out of the report file. Read findings by
`RuleID`, `File`, `Commit`, `Date`.

### 1.2 trufflehog, verified-only then everything

```bash
trufflehog git file://. --only-verified --json > /tmp/th-verified.json
trufflehog git file://. --json > /tmp/th-all.json
```

`--only-verified` calls the provider to ask whether the credential is **live**.
Those are the ones that matter: a live key is an incident, an expired one is
hygiene.

### 1.3 Targeted passes the scanners are weakest at

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

### 1.4 Expected benign hits — anything else is a finding

The working tree has four files that legitimately contain credential-shaped
strings, because they are the fixtures that test the scrubber:

| file | shapes |
|---|---|
| `brain/scripts/memory/lib/secret-scrub.test.mjs` | GitLab PAT ×9, AWS key ×1, private-key block ×1 |
| `brain/scripts/memory/backends/engram.share.test.mjs` | GitHub PAT ×2, AWS key ×2 |

Confirm each hit resolves to one of those. **Every other hit stops the run** and
goes to §3.

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

### 2a — The records the scrub never ran on

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

Measured on `main` @ `b2a6b37`: **10 records**, all `@legacy` / `session_summary`.
Read all ten in full — they are architecture prose and very unlikely to carry a
secret, but "unlikely" is what the scrub existed to stop being the argument.

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

### 4.0 What was already run, and why it does not count

An agent ran a pattern pass on 2026-08-13 over the **1011 tracked files of the
working tree**: the only credential-shaped hits were the §1.4 fixtures, and
`.memory/` was clean.

**It does not satisfy §1.** That clone was shallow — 218 commits of ~534
reachable — so it audited the tree, not the history. Treat it as a smoke test
that found nothing, not as evidence.

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

### 4.2 What unblocks on the back of it

With §4.1 posted, the rest of #435 is ordinary work: the scoped package name,
`private: false` in `package.json`, the install-spec move off the git URL, the
README and `test/fresh-install` corrections, and the ADR superseding ADR-0006.

`files` and the licence are **already done** (#607) and deliberately land first:
the allowlist has to exist before `private` comes off, and that ordering is the
one thing in #435 that is still protecting something.
