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

// Reverses verdict.mjs's `yamlScalar()`: a value it had to quote comes back with
// its outer quotes stripped and its escapes decoded; an unquoted scalar is
// already literal.
//
// `\n` and `\r` decode to the CHARACTERS, not to the letters (issue #481).
// yamlScalar escapes line breaks so a multi-line value cannot terminate the
// findings list mid-way; the generic `\X -> X` rule this used to apply would
// have turned that escape into a bare "n" and lost the newline a different way.
// Every other escape keeps the generic rule, which covers yamlScalar's `\\` and
// `\"` — and, because backslashes are escaped on the way out, `\\n` still decodes
// to a literal backslash followed by "n" rather than to a newline.
function unyamlScalar(raw) {
  const s = raw.trim();
  if (!(s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"')) return s;
  return s.slice(1, -1).replace(/\\(u2028|u2029|.)/g, (_, c) =>
    (c === 'n' ? '\n' : c === 'r' ? '\r' : c === 'u2028' ? '\u2028' : c === 'u2029' ? '\u2029' : c));
}

// Matches the two line shapes renderVerdict emits inside a findings /
// follow_ups list: `  - key: value` opens an entry, `    key: value` extends
// the entry above it. Anchored to the exact indentation the renderer uses —
// this parser is the inverse of ONE fixed emitter, not a general YAML reader.
const ENTRY_OPEN_RE = /^ {2}- ([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/;
const ENTRY_CONT_RE = /^ {4}([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/;
// The only lines that legitimately END a list: THIS PROTOCOL's own top-level
// keys, at zero indentation — what renderVerdict emits after a list.
//
// Naming them is load-bearing (third cold review of PR #478). A generic
// `/^[A-Za-z_][A-Za-z0-9_]*:/` accepted ANY `word:` at column 0, so unreadable
// content whose first line merely LOOKED like a key was read as a clean end and
// the truncated prefix came back as a confident, complete list — the same
// defect the "unreadable → null at any entry count" rule was written to close,
// surviving in its own predicate. The falsifying shape is the likeliest one in
// production, not a corner case: `brain-governance-status`'s stdout, which
// checkpoint.mjs interpolates into `evidence:`, contains lines like `Tier: 2`.
//
// Kept in sync with verdict.mjs by a drift test that renders a fully-populated
// verdict and asserts every column-0 key it emits is accepted here.
const TOP_LEVEL_KEYS = [
  'protocol', 'verdict', 'head_sha', 'rev', 'gates',
  'findings', 'follow_ups', 'conditions', 'pin', 'sequencing', 'escalate',
];
const TOP_LEVEL_KEY_RE = new RegExp(`^(?:${TOP_LEVEL_KEYS.join('|')}):`);

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
 * States and answers on the LIST encoding (issue #452; the UNREADABLE row and
 * then its "at any entry count" qualifier were each added by a cold-review
 * round on PR #478 — the drafts conflated them with the rows above):
 *
 *   key absent                            → `null`
 *   key present, scan ended cleanly:
 *      nothing parsed                     → `[]`     genuinely empty
 *      entries parsed                     → the entries
 *   key present, scan stopped on content
 *   it could not read — AT ANY ENTRY
 *   COUNT                                 → `null`   uncomputable, never `[]`
 *                                                    and never a truncated prefix
 *
 * "Unreadable" is real and common, and not only for foreign input:
 *   - these entry regexes are anchored to the exact indentation ONE emitter
 *     produces, so a verdict written in 0-indent YAML block sequence — what
 *     `yaml.dump` emits by default — carries findings this parser cannot read;
 *   - `renderVerdict` quotes but does not ESCAPE newlines, so brain's own
 *     multi-line `evidence:` (checkpoint.mjs interpolates command stdout) emits
 *     a block no parser can read. Measured: a two-finding verdict re-parsed to
 *     ONE finding, silently dropping a blocker. The renderer defect is its own
 *     ticket; what this function owes is to refuse the partial read rather than
 *     present it as the whole set.
 *
 * NOT covered by the table above: a trailing space on the key line routes the
 * key into the INLINE branch below (`scalar`'s `(.+)` captures the space), so it
 * returns `null` even with entries under it. Pre-existing and pinned by test.
 * Deferred to #477 on SCOPE — `scalar`'s contract for whitespace-only values
 * belongs with the sentinel policy being settled there. Measured, not assumed:
 * applying the candidate repair (`(.+)` → `(\S.*)`) fails exactly one test in
 * the whole suite, the pin that documents this defect.
 *
 * Until #452 the last line collapsed the middle state into `null`, so
 * `parseVerdict`'s `!== null` guard dropped the field and a consumer could not
 * tell "the block said nothing about this" from "the block said: nothing" —
 * `evidence-reader-empty-on-failure` in the parser, and the third appearance
 * of the #381 class in this pair of functions.
 *
 * @returns {Array<object>|null} `null` when the key is absent — or, on the
 *   INLINE encoding, when `parseJsonScalar` could not read the value. That
 *   second overload is a separate defect of the same class (a corrupt list
 *   reads as no list); ticketed, not fixed here, because changing it is a
 *   contract change against this parser's never-throws guarantee.
 */
function parseEntryList(block, key) {
  const inline = scalar(block, key);
  if (inline !== null) return parseJsonScalar(inline);

  const lines = block.split('\n');
  const start = lines.findIndex(l => l.trimEnd() === `${key}:`);
  if (start === -1) return null;

  const entries = [];
  let i = start + 1;
  for (; i < lines.length; i++) {
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
    break; // a line this parser does not recognise as list content
  }
  // The `start === -1` early return established that the key's line WAS found,
  // so how the scan ENDED is what separates the remaining answers, and the
  // anti-pattern doctrine requires them to differ:
  //
  //   evidence-reader-empty-on-failure.md — "null = uncomputable (the fetch
  //   failed), [] / '' = genuinely empty."
  //
  // The scan ended CLEANLY if only blank lines remain before the next top-level
  // key or the end of the block. Otherwise there was a body here that these two
  // indentation-anchored regexes could not read — a foreign 0-indent YAML
  // sequence, a tab, a quoted entry key, or a multi-line scalar the renderer
  // emitted unescaped.
  //
  // This test is applied REGARDLESS of how many entries parsed (second cold
  // review of PR #478). A first correction ran it only when nothing parsed, so
  // a list that read one entry and then hit unreadable content returned the
  // truncated prefix as a confident, complete list — the same inversion one
  // branch further up, and reachable from brain's OWN renderer: a two-finding
  // verdict with multi-line `evidence:` re-parsed to ONE finding, silently
  // dropping a blocker, with `'findings' in result === true`.
  //
  //   unreadable (any entry count) → `null`  — uncomputable, never a prefix
  //   clean end, nothing parsed    → `[]`    — genuinely empty
  //   clean end, entries parsed    → the entries
  while (i < lines.length && lines[i].trim() === '') i++;
  const endedCleanly = i >= lines.length || TOP_LEVEL_KEY_RE.test(lines[i]);
  if (!endedCleanly) return null;
  return entries;
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
