// parse-failures.mjs — the ONE tested `[FAIL-SHA]` parser (REQ-D2-5).
//
// brain-audit.mjs emits one `[FAIL-SHA] <full-sha>` line per offending merge,
// additive to its `[FAIL]`/`[PASS]`/`[SKIP]` output. This is the
// never-a-second-parser lynchpin: the GitHub wrapper consumes it via the CLI
// mode below, and a future GitLab wrapper calls the SAME function — ZERO
// inline grep may ever appear in either platform's YAML/CI config.
//
// Re-derived from `scrap/d2-v1-broken` (read via `git show`, never
// `git cherry-pick`ed — cherry-picking would import that branch's
// `github-actions[bot]` mis-authorship into this commit; design §0 / tasks
// §9.3 note).

const FAIL_SHA_RE = /^\[FAIL-SHA\] ([0-9a-f]{40})$/;

/**
 * Extracts full 40-hex SHAs from `[FAIL-SHA] <sha>` lines. Order-preserving,
 * deduped via a Set keyed on the sha. Malformed lines (missing prefix, sha7,
 * non-hex) are ignored, never thrown on.
 * @param {string} text brain-audit.mjs stdout (or any text with the marker).
 * @returns {string[]} deduped, order-preserving list of full-hex SHAs.
 */
export function parseFailingShas(text) {
  const shas = [];
  const seen = new Set();
  for (const line of String(text ?? '').split('\n')) {
    const match = line.match(FAIL_SHA_RE);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      shas.push(match[1]);
    }
  }
  return shas;
}

// CLI entrypoint: reads stdin, prints the deduped full-sha list, one per
// line. The wrapper reads this via a safe `mapfile` — the fragile parse
// stays here, in the one tested function (REQ-D2-5).
import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    for (const sha of parseFailingShas(input)) console.log(sha);
  });
}
