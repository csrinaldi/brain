# Design brief — brain landing page + methodology page

*Hand this file to a design agent as its prompt. It is written to be pasted whole: everything
the agent needs is here, including the facts it is allowed to claim and the ones it is not.*

---

## 0. Your role and the task

You are the design lead for a small studio. You are designing **two web pages** for a
software project called **brain**:

1. **A landing page** — new, does not exist yet. Its job is to make an engineer who has
   never heard of brain understand, in about sixty seconds, what it is, whether it is for
   them, and what to do next.
2. **A methodology page** — a redesign of an existing working page (`index.html`, in this
   same directory). Its job is reference: the whole method, in detail, navigable.

Both are static, self-contained HTML files that live in the project's own repository. There
is no CMS, no framework, no build step.

Read §11 before you write any code. This project is unusually strict about not claiming
things that are not true, and a design that overstates it is a failed design regardless of
how it looks.

---

## 1. What brain actually is

brain is **a working method for building software with AI agents, plus the tooling that
keeps the method honest.** It is not a chatbot, not an IDE, not an agent. It is the
scaffolding a team puts around agents so the work is traceable, reviewable, and safe to
merge.

It installs into a team's own repository from a pinned git tag and adds four things:

- **A knowledge base** (`brain/`) — architecture decision records, domain notes,
  anti-patterns. Documentation that outlives any single session or conversation.
- **A spec-driven change flow** (`openspec/`) — every change produces four artifacts on
  disk before it produces code: a proposal, a spec with numbered requirements, a design,
  and a task checklist.
- **Git-native team memory** (`.memory/`) — content-addressed records committed to the
  repository, so what one session learned is available to the next one, on any machine,
  to a human or an agent.
- **Governance gates** — CI checks that read the *evidence* a change left behind (files,
  git history, issue and pull-request metadata) and never read which tool produced it.

### The three ideas underneath it

These are the spine of both pages. Everything else is detail.

1. **Knowledge outlives the session.** An agent forgets. The repository does not. Decisions
   become ADRs; sessions become committed memory records.
2. **One shape for every change.** Issue → proposal → spec → design → tasks → code →
   review → merge, with artifacts at each step. The same shape whether a person or an agent
   drives it, which is what makes the two interchangeable.
3. **Machines prepare decisions; humans take them.** The gates enforce that the *process*
   happened — never that the work is *good*, which is a judgment no machine can make.
   Approving and merging stays a human keystroke, and the automated reviewer has no code
   path that reaches it.

### The one detail that explains the product's character

brain has an automated code reviewer. It can verify a change against the server, rule on
design questions, and sequence parallel work. It **cannot approve a pull request** — and
not because it is told not to. Its verdicts post in a comment state that the approval
counter structurally cannot count; the function that posts them hardcodes the comment
event with no approve sibling anywhere in the code; and its identity is registered under a
config key that only the exclusion check reads, never the authorization check. Three
independent locks, any one of which holds if the other two fail.

That is the product in miniature: **safety by construction, not by instruction.** If your
design communicates one thing beyond "what is this", make it that.

---

## 2. Who you are designing for

**Primary — the landing page.** A senior engineer or engineering lead, 30–50, who is
already using AI agents to write code and is uneasy about it. They have seen an agent
produce four hundred lines that nobody reviewed properly. They are technical, skeptical of
tooling that promises velocity, and allergic to marketing language. They will decide
whether to keep reading based on whether the first paragraph sounds like it was written by
someone who has actually shipped software.

**Secondary — the methodology page.** Someone who has decided brain is interesting and now
wants to understand the mechanics: which command does what, which gate reads which
evidence, who is allowed to do what. Also the project's own maintainer, using the page as a
map of the system while working on it.

Neither audience wants to be sold to. Both will notice an invented statistic instantly.

---

## 3. Page 1 — the landing page

### Its job

Orientation, not conversion. There is nothing to buy and no signup. The success condition
is: *a reader who is not the right audience leaves quickly and knows why, and a reader who
is the right audience clicks through to the methodology page.*

### Required sections, in this order

**1 · Opening.** The name, one sentence that says what it is, and one that says why it
exists. Do not lead with a benefit ("ship faster"). Lead with the problem, stated flatly:
*an agent writes code faster than a team can agree on what it should do, or verify what it
did.*

**2 · The three ideas** (§1 above). Three short blocks. They are not a sequence — do not
number them 01/02/03 or connect them with arrows.

**3 · What it actually adds to a repository.** The four concrete things: knowledge base,
change flow, memory, gates. This is where a skeptical reader decides whether it is real.
Consider showing the directory structure — engineers read a file tree faster than a
paragraph:

```
brain/core/      the product — read-only in your repo, upgraded from a tag
brain/project/   your ADRs, your domain, your rules — yours to own
brain/scripts/   the verbs: brain:day:start, brain:check, brain:ship, brain:review…
openspec/        the spec-driven artifacts for each change in flight
.memory/         durable team memory, content-addressed, committed to git
```

**4 · What using it looks like.** A short worked sequence — the commands a developer runs
in a day. Real commands only; they are listed in the appendix (§13). This section should
feel like a terminal, not like a feature grid.

**5 · The reviewer.** The strongest single idea in the product (§1, "the one detail"). It
deserves its own moment and is the place to spend some of your design budget.

**6 · Honest status.** brain is at **v1.0.0, a controlled pilot** — intended for
repositories its maintainer controls, not yet open adoption. Say so plainly, in the reader's
eyeline, not in a footnote. This is not a disclaimer to minimize; it is a credibility asset,
and burying it would contradict the product. Note also that the project is **self-hosting**:
brain's own repository is built using brain, so the method is tested before it ships.

**7 · Where to go next.** A link to the methodology page. Optionally the repository.
No email capture, no "book a demo", no newsletter.

### Explicitly not on this page

No pricing. No testimonials. No logos of companies. No performance claims. No "trusted by".
No metrics that were not measured. No roadmap promises. No comparison table against other
tools.

---

## 4. Page 2 — the methodology page

An working version exists at `docs/methodology-map/index.html`. **Read it before designing.**
Your job is to raise its design, not to replace its information architecture, which was
built from the source tree and is accurate.

### What it contains

An opening description, then three views behind a tab control:

- **Flow map** — nine lanes (adoption · rhythm · the feature cycle · the review cycle ·
  issue rulings · golden path · memory · governance · authority), 67 nodes. Every node is a
  real command, artifact, or gate. Clicking one opens a side panel with what it does, who
  may run it, what it produces, which gates read it, what is still unfinished about it, and
  links to the defining source files.
- **A day in it** — one feature walked end to end, fifteen steps, each with the real command
  and the real shape of its output. Each step links back into the map.
- **Evolution** — a release-by-release timeline of how the method got to where it is.

### What must survive your redesign

- **The data model.** Content lives in three JavaScript arrays — `NODES`, `JOURNEY`,
  `MILESTONES` — and the page renders from them. Adding a step to the method must stay a
  matter of adding one object. Do not hardcode content into markup.
- **The four actor roles must stay visually distinct**, because who is allowed to act is
  the point of half the diagram: *human keystroke*, *agent*, *cold reviewer* (an agent with
  strictly narrower authority), *CI/automation*, and *either*. Colour is the current
  encoding; another encoding is fine if it survives colour-blindness and greyscale.
- **Status must remain legible per node**: shipped, proposed, in flight.
- **The "Not closed yet" sections.** Nodes carry known gaps and the page shows them. Do not
  design these away or tuck them behind a disclosure — an honest map is the entire value
  proposition of the page.
- **Every interaction**: node selection with deep-linkable URLs, filtering by actor, a
  toggle between local file links and GitHub links, light/dark, keyboard access.

### What to improve

The current page is competent and plain — it was built for accuracy first. The flow map in
particular is a grid of rectangles; the *sequence* and the one **backward edge** (the review
loop, where a REVISE verdict sends the work back for another round) deserve better than
inline arrows. Typography, rhythm, and the relationship between the map and the detail panel
are all open.

---

## 5. Voice and tone

The project's own documentation has a distinctive voice, and the pages should match it or
they will read as bolted on. It is:

- **Flat and declarative.** "The gates enforce that the process happened, never that the
  work is good." Not "brain empowers teams to ensure quality."
- **Willing to name the cost.** The real docs contain a section titled *The honest cost*
  that says what the automated reviewer permanently loses versus a human one. That is the
  register.
- **Specific over clever.** Numbers, file paths, and real command names beat adjectives.
- **No exclamation marks, no emoji, no second-person hype.** "You" is fine when giving
  instructions.

Write in **English** — the project declares English for its documentation.

---

## 6. Visual direction

You have freedom here. What the design must *feel* like:

**Documentary, not promotional.** This is a page about rigor and evidence. It should look
like something built by people who measure things — closer to a well-set technical manual,
an instrument panel, or a printed specification than to a startup homepage.

**Precise.** Alignment, spacing, and type scale carry the message. If the design is sloppy,
the claim "safety by construction" reads as a bluff.

**Quiet, with one moment of confidence.** Spend your boldness in a single place — the
reviewer section on the landing page is the natural candidate — and keep everything around
it restrained.

Typography is the main instrument. A monospaced face is thematically right for commands and
file paths and should appear, but resist setting the entire page in mono. The current page
sets the wordmark in mono, which reads well: the name is a thing you type.

### Explicitly avoid

These are the current defaults of AI-generated design and they will make the page look
generated:

- Warm cream backgrounds with a serif display face and a terracotta accent.
- Near-black with a single acid-green or vermilion pop.
- Purple-to-blue gradient heroes.
- Inter or Space Grotesk as the reflexive body face.
- Emoji as section markers; centered everything; `rounded-lg` on every surface; accent bars
  on rounded cards.
- Numbered markers (01 / 02 / 03) on things that are not actually a sequence.

### Avoid, specifically for this project

- **Any brain imagery.** No anatomical brains, no neural networks, no glowing nodes, no
  synapses. The name is a directory in a repository, not a metaphor to illustrate.
- **Robot or android imagery**, and AI clip art generally.
- **Fake terminal output.** If you show a terminal, use the real commands and real output
  shapes from the appendix. An invented log line is a lie in a page about not lying.
- **Abstract "connected dots" hero graphics.** The page already has a real diagram; a
  decorative fake one next to it is embarrassing.

---

## 7. Hard technical constraints

- **One self-contained HTML file per page.** All CSS and JavaScript inline. No build step,
  no bundler, no package.
- **Zero external requests.** No CDN scripts, no external stylesheets, **no webfont URLs**,
  no remote images, no analytics, no fetch. A strict content-security policy blocks them,
  and the file must also work opened directly from disk (`file://`) with no network at all.
  If you want a non-system typeface, embed it as a `@font-face` data URI; otherwise design
  deliberately with system font stacks.
- **Any imagery must be inline SVG or a data URI.** Prefer CSS and SVG over raster.
- **No dependencies of any kind.** No Tailwind, no React, no icon library, no chart library.
- **Theme-aware.** Define the palette as custom properties; respond to
  `prefers-color-scheme`; also honor `:root[data-theme="dark"]` and
  `:root[data-theme="light"]`, which a host may stamp on the root element and which must win
  over the media query in both directions. Give both themes equal care — do not invert one
  to get the other.
- **Responsive from 360px to 1600px.** Wide content (tables, diagrams, code) scrolls inside
  its own container; the page body must never scroll sideways.
- **Accessible.** Real semantic elements, visible keyboard focus, contrast that passes AA,
  `prefers-reduced-motion` respected, interactive elements reachable by keyboard, and no
  meaning carried by colour alone.

---

## 8. Existing assets and conventions

- `docs/methodology-map/index.html` — the working methodology page. Its data arrays are
  correct and current; reuse them verbatim.
- `docs/methodology-map/README.md` — how the page is structured and extended.
- `README.md` at the repository root — the project's own description.
- `brain/core/methodology/*.md` — the source documents the page is drawn from. If you need
  to check a claim, check it here rather than inferring it.
- There is **no existing brand**: no logo, no defined palette, no chosen typeface. The
  current page's colours were a working choice, not an identity. You are free to define one —
  and if you do, define it once as tokens and use it on both pages.

---

## 9. Deliverables

1. `landing.html` — the landing page, self-contained.
2. `index.html` — the redesigned methodology page, self-contained, with the data arrays and
   interactions preserved.
3. A short design note (10–20 lines): the palette as named values, the type choices and why,
   the layout concept, and anything you deliberately left out.

Both pages must link to each other.

---

## 10. Acceptance checklist

- [ ] Opens correctly from `file://` with the network disabled.
- [ ] No external requests of any kind in the network panel.
- [ ] Legible and correct in light and dark, including a forced `data-theme` override.
- [ ] No horizontal page scroll at 360px, 768px, 1280px, 1600px.
- [ ] Keyboard-only: every control reachable, focus always visible.
- [ ] Methodology page: all 67 nodes render, the panel opens, filters work, deep links work,
      the local/GitHub link toggle works, the "Not closed yet" content is visible.
- [ ] Every factual claim on the landing page appears in §12 of this brief.
- [ ] No invented metrics, logos, testimonials, or terminal output.

---

## 11. The honesty rules — read twice

This project's entire premise is that a process is only trustworthy if it refuses to report
success it cannot demonstrate. A page that oversells it is off-brief no matter how good it
looks. Concretely:

1. **Claim only what §12 lists.** If you want to say something else, it must be verifiable in
   the repository, and you should quote where.
2. **Never invent numbers.** No "10× faster", no "used by N teams", no uptime, no adoption
   figures. None exist.
3. **Do not hide the pilot status or the known gaps.** They are stated in the product's own
   documentation; a landing page that omits them is contradicting the thing it describes.
4. **Do not imply it is finished.** Parts of the method are shipped, parts are proposed, and
   parts are in flight — the methodology page distinguishes the three and the landing page
   should not flatten them.
5. **Do not personify the agents.** No "your AI teammate". The whole design premise is that
   agents are bounded processes, not colleagues.

---

## 12. Approved claims — the only facts you may state

Every one of these is verifiable in the repository.

**What it is**
- A generic, project-agnostic system for AI-assisted software development.
- Three parts: a knowledge base, spec-driven change scaffolding, and git-based team memory.
- Self-hosting: brain's own repository is built with brain.

**How it is distributed**
- Installed from a pinned git tag — no package registry, works with private repositories.
- It never auto-updates. A new version is a notice; upgrading is an explicit command.
- On upgrade it overwrites only its own managed paths and never touches your project's
  directories, your config values, your environment file, or your memory.
- Package-manager agnostic: npm, pnpm, yarn, and bun are all covered by an end-to-end
  install test.

**The method**
- Every change to the main branch must reference an issue carrying an approval label applied
  by a human — and by someone other than the author.
- Every change produces four artifacts on disk: proposal, spec, design, tasks.
- A default budget of 400 changed lines per pull request, with an explicit, labelled
  exception path.
- A "golden path" of five commands — start, check, save, ship, next — where `next` derives
  the current state and prints the single next command.

**Governance**
- Four load-bearing invariants, enforced across six levels that read observable evidence.
- Five checks block a merge; three report without blocking.
- The gates read files, git history, and issue/PR metadata — never which tool produced them,
  which is what keeps the system agent- and harness-agnostic.
- Enforcement adapts to what the hosting platform can actually enforce, detected rather than
  declared, with a floor that works on every repository.
- The boundary is explicit and deliberate: the gates verify that the process happened, never
  that the work is correct.

**The reviewer**
- An automated reviewer that boots cold in its own clone, anchored to the commit the API
  reports rather than a branch name or a sha quoted in a report.
- Every finding carries a command the reviewer ran itself; a blocking finding must cite the
  authority it is enforcing.
- It cannot approve: three independent structural locks, described in §1.
- It stops rather than looping: after three rounds it must escalate to a human.

**Everything is swappable**
- The agent platform, the spec-driven engine, the memory backend, and the VCS provider are
  each selected by configuration and reached through a verb contract. GitHub and GitLab are
  both implemented.

**Honest status**
- v1.0.0 is a controlled pilot, for repositories the maintainer controls; open adoption is
  gated on upgrade safety work that is currently in flight.
- Known limitations are published in the repository and kept current.
- Parts of the reviewer protocol are proposed rather than signed off, and the page says so.

---

## 13. Appendix — real commands and output

Use these verbatim if you show a terminal. Do not extend them with invented lines.

```bash
npm run brain:day:start      # auth, sync main, ecosystem tools, memory, ticket board
npm run brain:session:start  # restore session context — read-only, local, no network
npm run brain:start 142      # verify the issue is approved, create the branch
npm run brain:project:feature -- --issue 142 --title export-invoices-csv
npm run brain:check          # the governance checks + tests + reference check
npm run brain:save           # materialise and commit session memory
npm run brain:ship           # re-check, then open the PR
npm run brain:next           # what is my next step?
npm run brain:review -- --pr 318
npm run brain:upgrade -- v1.1.0
```

Real output shapes:

```
brain:start: branch "feature/142-export-the-invoice-list-to-csv" created. Start working on issue #142.
```

```
brain:check results:

  [PASS] diffSize
  [PASS] issueLink
  [PASS] adrPresence
  [PASS] memoryPresence
  [PASS] npmTest
  [PASS] repoCheck

All checks passed. Ready to brain:ship.
```

```
brain:save: .memory/ committed — "chore(memory): sync .memory [brain:save]"
brain:ship: PR opened → https://github.com/acme/ledger/pull/318
```

A reviewer verdict, as it is posted on the pull request:

```yaml
protocol: brain-review/1
verdict: REVISE
head_sha: 9f2c1abf3d4e5b6a7c8d9e0f1a2b3c4d5e6f7a8b
rev: 1
gates:
  required: [issue-link, diff-size, local-checks, memory-gate, decision-gate]
  detection: [phase-order, actor-check, brain-writes-reviewed]
findings:
  - id: F1
    severity: blocker
    evidence: "npm test -- csv-export.test.mjs → 1 failing (column order)"
    cites: "REQ-142-3"
conditions: []
escalate: null
```

### Vocabulary

Use the project's own words; they are precise and consistent.

| Use | Not |
|---|---|
| gate, check | guardrail, safety net |
| verdict, finding, evidence | feedback, suggestion |
| the keystroke (approve / merge) | sign-off, human-in-the-loop |
| managed paths | files we control |
| durable memory / working memory | long-term / short-term memory |
| doctrine tier, substrate rung | plan, tier (as in pricing) |
| cold reviewer | AI reviewer, review bot |
| fail closed | safe default |
