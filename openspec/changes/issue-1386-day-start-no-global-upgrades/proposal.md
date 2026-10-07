# Proposal: #1386 day:start must not upgrade global tools

Problem: `day:start` step 3 ran `gentle-ai upgrade` unconditionally; one run in a scratch consumer
upgraded the machine's `engram` 2.0.0 to 3.2.1 (see explore.md). Maintainer rulings (2026-10-07):
day:start updates nothing and does not spawn `gentle-ai update` either (not known read-only);
step 3 prints a reminder; a new interactive-only verb `brain:tools:update` applies updates and
refuses under CI or without a TTY; skill-registry refresh is unchanged; doctrine goes through
drafts; the `%s` glitch is fixed.

Non-goals: opt-in flag or user-layer key (rejected by ruling 1), changing `env:init`/`tools:install`.
