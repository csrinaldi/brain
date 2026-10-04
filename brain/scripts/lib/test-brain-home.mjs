// test-brain-home.mjs — preloaded into every test process by `npm test` (`node --import …`), ADR-0040 ratified point 1.
//
// The user layer lives in `<BRAIN_HOME>/config.json`, else `~/.brain` (lib/user-config.mjs). No test may ever read a developer's
// real home, so every test process starts with `BRAIN_HOME` pointing at an EMPTY temp dir (an empty user layer), and any child
// it spawns with the inherited env gets the same one. A BRAIN_HOME the caller already set is left alone. Without this preload,
// a test that reaches the user layer without `BRAIN_HOME` THROWS (`UserHomeUnderTestError`): the failure is loud, not a leak.
import { testTmp } from './test-tmp.mjs';

if (!process.env.BRAIN_HOME || process.env.BRAIN_HOME.trim() === '') process.env.BRAIN_HOME = testTmp('brain-home-');
