// parse-verdict.mjs — parses a `brain-review/1` fenced-YAML block out of a
// review body (protocol §6). Purpose-built for this ONE fixed schema — not a
// generic YAML parser (brain ships zero npm dependencies). Extracts only the
// scalars H1-1's consumers need (cold-boot's rev derivation + doctrine load);
// nested `findings`/`gates` parsing is not needed until H1-5's board.
//
// Shared by three consumers (design.md §2): cold-boot (load prior blocks),
// the anti-loop lock (H1-2), and the board (H1-5) — extracted once so `rev`
// derivation and label reconciliation read the same parser.

const FENCE_RE = /```(?:yaml)?\s*\n([\s\S]*?)```/;

function scalar(block, key) {
  const m = block.match(new RegExp(`^${key}:[ \\t]*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

/**
 * @param {{ body?: string|null, author?: string|null }} review
 * @returns {{ head_sha: string, rev: number|null, verdict: string, author: string|null } | null}
 */
export function parseVerdict({ body, author = null } = {}) {
  if (typeof body !== 'string' || body.length === 0) return null;

  const fence = body.match(FENCE_RE);
  if (!fence) return null;
  const block = fence[1];

  if (scalar(block, 'protocol') !== 'brain-review/1') return null;

  const headSha = scalar(block, 'head_sha');
  const verdict = scalar(block, 'verdict');
  if (!headSha || !verdict) return null;

  const revRaw = scalar(block, 'rev');
  return {
    head_sha: headSha,
    rev: revRaw !== null ? Number(revRaw) : null,
    verdict,
    author,
  };
}
