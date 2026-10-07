# Apply progress: #1386 (strict TDD)

## RED
`node --import ./brain/scripts/lib/test-brain-home.mjs --test brain/scripts/tools-update.test.mjs brain/scripts/day-start.test.mjs`
-> tools-update.test.mjs: ERR_MODULE_NOT_FOUND (verb absent); day-start.test.mjs: 4 new tests `not ok`
(11 no update/upgrade spawn, 12 reminder key, 13 printf specifier, 14 catalogs). 10 pass / 5 fail.

## GREEN
Same files plus axis-port.guard.test.mjs and managed-script-keys-doctrine.test.mjs: 40 pass / 0 fail.
The guard accepted day-start max 2 and tools-update.mjs max 3.

## Doctrine drafts
planAmendment (today 2026-10-07): harness-contract draft ok:true; anti-pattern draft ok:true.

## Safety
No real gentle-ai was executed; tests use recorded fakes, and the CLI-entry test uses a PATH holding only a fake that writes a marker (asserted never created) under a sandboxed HOME.
