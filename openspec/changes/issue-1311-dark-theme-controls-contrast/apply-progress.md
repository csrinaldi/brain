# Apply progress — issue 1311

All 5 tasks done.

- RED: `tokens.test.mjs` extended with 3 tests; run before the CSS change: 2 failed (element rules, color-scheme), the contrast test passed (the token values were already AA; the defect was UA defaults, not tokens).
- GREEN: `color-scheme` on the three token blocks plus `button, select, input` and `a` base rules in `app.css`; 8/8 in the file.
- Mutation: removing `color` from the base button rule fails test 6 (first attempt did not: `\bcolor` matched `border-color`; fixed with a lookbehind).
- Sweep: select (theme switcher), input (app.js:261) covered by the base rule; summary/details unused.
- Contrast: light ink/surface 17.85, accent/paper 5.05, accent/surface 5.36; dark 15.66, 10.61, 9.49.
- `npm test`: 7615 tests, 7612 pass, 0 fail (3 skipped/other).
