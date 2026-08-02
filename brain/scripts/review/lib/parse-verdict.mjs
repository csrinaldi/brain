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

// Reverses verdict.mjs's `yamlScalar()`: a value it had to quote comes back
// with its outer quotes stripped and `\X` -> `X` un-escaped (the only escapes
// yamlScalar emits are `\\` and `\"`); an unquoted scalar is already literal.
function unyamlScalar(raw) {
  const s = raw.trim();
  return s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"'
    ? s.slice(1, -1).replace(/\\(.)/g, '$1')
    : s;
}

// Matches the two line shapes renderVerdict emits inside a findings /
// follow_ups list: `  - key: value` opens an entry, `    key: value` extends
// the entry above it. Anchored to the exact indentation the renderer uses —
// this parser is the inverse of ONE fixed emitter, not a general YAML reader.
const ENTRY_OPEN_RE = /^ {2}- ([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/;
const ENTRY_CONT_RE = /^ {4}([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/;

/**
 * Parses a findings-shaped key in EITHER encoding (issue #381):
 *   - same-line  — `findings: []`, and any JSON-scalar form, via parseJsonScalar
 *   - list       — the multi-line `- id:` / `severity:` block renderVerdict
 *                  actually emits for a non-empty array
 *
 * Before #381 only the same-line form was read, so every non-empty findings
 * array the renderer produced was silently dropped on re-parse — the empty
 * case (`findings: []`) round-tripped, which is why the defect stayed hidden.
 *
 * @returns {Array<object>|null} null when the key is absent or unparseable.
 */
function parseEntryList(block, key) {
  const inline = scalar(block, key);
  if (inline !== null) return parseJsonScalar(inline);

  const lines = block.split('\n');
  const start = lines.findIndex(l => l.trimEnd() === `${key}:`);
  if (start === -1) return null;

  const entries = [];
  for (let i = start + 1; i < lines.length; i++) {
    const open = lines[i].match(ENTRY_OPEN_RE);
    if (open) {
      entries.push({ [open[1]]: unyamlScalar(open[2]) });
      continue;
    }
    const cont = lines[i].match(ENTRY_CONT_RE);
    if (cont && entries.length > 0) {
      entries[entries.length - 1][cont[1]] = unyamlScalar(cont[2]);
      continue;
    }
    break; // first non-entry line ends the list — the next top-level key
  }
  return entries.length > 0 ? entries : null;
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

  // Optional (v2 REQ-H2-2, fixed in #381) — findings and follow_ups are read
  // in whichever encoding the block carries. Both are rendered as YAML lists
  // by renderVerdict; `follow_ups` was never parsed at all before #381.
  const findings = parseEntryList(block, 'findings');
  if (findings !== null) result.findings = findings;

  const followUps = parseEntryList(block, 'follow_ups');
  if (followUps !== null) result.follow_ups = followUps;

  return result;
}
