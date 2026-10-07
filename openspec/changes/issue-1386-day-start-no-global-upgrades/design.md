# Design: #1386

- `brain/scripts/tools-update.mjs` exports `runToolsUpdate({spawn, env, isTTY, log, err})` (pure seam, recorded fake in tests); the CLI entry passes `process.stdin.isTTY && process.stdout.isTTY`. Header says it becomes a `brain:doctor` subcommand (#1130).
- day-start.mjs step 3 is rewritten, not gated: removing the update-parsing loop also removes the `%s` glitch (the only formatting site). A source guard pins that.
- Messages in i18n en/es (`tools.update.*`, `day.ecosystem.runToUpdate`); five dead `day.ecosystem.*` keys removed.
- Doctrine only as `brain-amendment/1` drafts (brain-drafts/), validated with planAmendment.
