// parse-verdict.mjs — parses a `brain-review/1` fenced-YAML block out of a
// review body (protocol §6). Purpose-built for this ONE fixed schema — not a
// generic YAML parser (zero npm deps). Extracts only the scalars H1-1 needs
// (rev derivation + doctrine load); nested findings/gates land with H1-5's
// board. Shared by cold-boot, the anti-loop lock (H1-2), and the board
// (H1-5) — extracted once so they read the same parser (design.md §2).

const FENCE_RE = /```(?:yaml)?\s*\n([\s\S]*?)```/;

function scalar(block, key) {
  const m = block.match(new RegExp(`^${key}:[ \\t]*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

// Reverses verdict.mjs's `yamlScalar(JSON.stringify(...))` encoding: strips
// the outer quotes (if present) and un-escapes `\X` -> `X` (covers both
// `\\` -> `\` and `\"` -> `"`, the only two escapes yamlScalar ever
// produces), then JSON.parses the result. Never throws — an unparseable
// scalar (hand-edited comment, corruption) yields `null`, tolerated by the
// caller (board.mjs treats an absent/unparseable sequencing as "nothing to
// reconcile from this block", never a crash).
function parseJsonScalar(raw) {
  try {
    const unquoted =
      raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"'
        ? raw.slice(1, -1).replace(/\\(.)/g, '$1')
        : raw;
    return JSON.parse(unquoted);
  } catch {
    return null;
  }
}

/** @returns {{ head_sha: string, rev: number|null, verdict: string, author: string|null, sequencing?: * } | null} */
export function parseVerdict({ body, author = null } = {}) {
  if (typeof body !== 'string' || body.length === 0) return null;

  const fence = body.match(FENCE_RE);
  if (!fence) return null;
  const block = fence[1];

  const proto = scalar(block, 'protocol');
  if (proto !== 'brain-review/1' && proto !== 'brain-review/2') return null;

  const headSha = scalar(block, 'head_sha');
  const verdict = scalar(block, 'verdict');
  if (!headSha || !verdict) return null;

  const revRaw = scalar(block, 'rev');
  const result = {
    head_sha: headSha,
    rev: revRaw !== null ? Number(revRaw) : null,
    verdict,
    author,
  };
  if (proto === 'brain-review/2') {
    result.protocol = proto;
  }

  // Optional (H1-5c board.mjs) — only set when the block actually carries a
  // parseable `sequencing:` line; omitted otherwise (not `null`), so a
  // block without it round-trips through parseVerdict unchanged.
  const sequencingRaw = scalar(block, 'sequencing');
  if (sequencingRaw !== null) {
    const parsed = parseJsonScalar(sequencingRaw);
    if (parsed !== null) result.sequencing = parsed;
  }

  // Optional (v2 REQ-H2-2) — parse findings array if JSON-scalar encoded.
  const findingsRaw = scalar(block, 'findings');
  if (findingsRaw !== null) {
    const parsed = parseJsonScalar(findingsRaw);
    if (parsed !== null) result.findings = parsed;
  }

  return result;
}
