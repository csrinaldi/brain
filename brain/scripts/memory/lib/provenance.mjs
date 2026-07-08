// provenance.mjs — the §4 provenance grammar: ONE shared parser/renderer PAIR
// for the consolidation-protocol.md §4 prose convention (issue #217, C2).
//
// The three markers below are the SINGLE source of truth for the grammar —
// parseProvenance() and renderProvenance() both build their regexes/output
// from these same constants, never from two independently-typed "equivalent"
// literals (the same principle format.mjs applies to computeRecordId: one
// hasher, never a parallel one).
//
// Anchored to brain/core/methodology/consolidation-protocol.md §4:
//   **Actor:**     @crinaldi (humano)  |  claude-sonnet-4-6 (agente)
//   **Fuente:**    issue #78 / MR !72
//   **Supersede:** observación anterior "Spring prohibido"
//
// KNOWN FACT (verified against the real store, 2026-07): 0/278 real engram
// observations carry this prose — this pair exists for FUTURE first-class
// writers and the C4 round-trip contract, not as a description of the
// current store (see engram-export.mjs's fallback convention for that case).

export const ACTOR_MARKER = '**Actor:**';
export const FUENTE_MARKER = '**Fuente:**';
export const SUPERSEDE_MARKER = '**Supersede:**';

const ACTOR_KIND_TO_LABEL = { human: 'humano', agent: 'agente' };
const LABEL_TO_ACTOR_KIND = { humano: 'human', agente: 'agent' };

function escapeMarker(marker) {
  return marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ACTOR_LINE_RE = new RegExp(`^${escapeMarker(ACTOR_MARKER)}\\s*(\\S+)\\s*\\((humano|agente)\\)\\s*$`);
const FUENTE_LINE_RE = new RegExp(`^${escapeMarker(FUENTE_MARKER)}\\s*(.+)$`);
const SUPERSEDE_LINE_RE = new RegExp(`^${escapeMarker(SUPERSEDE_MARKER)}\\s*(.+)$`);
const ISSUE_IN_FUENTE_RE = /issue #(\d+)/;

/**
 * parseProvenance() — recover `{actor, actorKind, issue?, supersedes?, source?}`
 * from §4 prose, plus the CLEANED content (the provenance block + its one
 * blank-line separator removed).
 *
 * Provenance is ONLY the contiguous LEADING block of `content`
 * (consolidation-protocol.md §4: "Actor: First line of body") — never a
 * whole-content scan. This is a fixed-order state machine, not a per-line
 * regex scan: start at line 0, require an `**Actor:**` line first (its
 * absence means there is no provenance block at all), then optionally an
 * immediately-following `**Fuente:**` line, then optionally an
 * immediately-following `**Supersede:**` line. The first line that does not
 * continue this expected sequence ends the block; everything from that point
 * on — including the one blank-line separator `renderProvenance()` always
 * emits — is `content`, returned byte-for-byte unchanged. This makes the BODY
 * inert: a marker-shaped line inside the body (after the block has already
 * ended) is never scraped into a field, so `parse(render(record))` is
 * lossless even when the body itself contains `**Actor:**`/`**Fuente:**`/
 * `**Supersede:**`-shaped text.
 *
 * A `content` with no leading §4 prose returns every field `undefined` and
 * `content` unchanged — this is the expected shape for the current real
 * store (0/278 observations carry the prose; see engram-export.mjs's
 * fallback path).
 *
 * @param {string} content
 * @returns {{actor?:string, actorKind?:string, issue?:number, supersedes?:string,
 *            source?:string, content:string}}
 */
export function parseProvenance(content) {
  if (typeof content !== 'string') return { content };

  const lines = content.split('\n');
  const result = {};
  let idx = 0;

  const actorMatch = ACTOR_LINE_RE.exec(lines[idx] ?? '');
  if (!actorMatch) {
    // No leading Actor line — there is no provenance block at all (Actor
    // must be the first line of the block per §4). Content is untouched.
    return { content };
  }
  result.actor = actorMatch[1];
  result.actorKind = LABEL_TO_ACTOR_KIND[actorMatch[2]];
  idx += 1;

  const fuenteMatch = FUENTE_LINE_RE.exec(lines[idx] ?? '');
  if (fuenteMatch) {
    result.source = fuenteMatch[1].trim();
    const issueMatch = ISSUE_IN_FUENTE_RE.exec(result.source);
    if (issueMatch) result.issue = Number(issueMatch[1]);
    idx += 1;
  }

  const supersedeMatch = SUPERSEDE_LINE_RE.exec(lines[idx] ?? '');
  if (supersedeMatch) {
    result.supersedes = supersedeMatch[1].trim();
    idx += 1;
  }

  // The block is followed by exactly one blank-line separator (the render
  // side always emits `\n\n` between the block and the body when any field
  // is present) — consume that ONE separator only, never more.
  if (lines[idx] === '') idx += 1;

  result.content = lines.slice(idx).join('\n');
  return result;
}

/**
 * renderProvenance() — the inverse of parseProvenance(): re-serialize a
 * record's structured provenance fields back into §4 prose, prepended to
 * `content`. Fields are rendered in Actor → Fuente → Supersede order,
 * matching the canonical convention. A record with no provenance fields at
 * all passes `content` through unchanged (no empty block, no stray blank
 * line).
 *
 * Round-trip note: `source` is the literal Fuente text; `issue` is a
 * structured extraction FROM that text on the parse side. Passing a `source`
 * whose embedded `issue #N` matches the `issue` field (the natural case,
 * since both come from one Fuente line in practice) round-trips exactly via
 * parseProvenance(renderProvenance(record)) — the mandatory property test.
 *
 * @param {{actor?:string, actorKind?:string, issue?:number, supersedes?:string,
 *          source?:string, content:string}} record
 * @returns {string}
 */
export function renderProvenance({ actor, actorKind, issue, supersedes, source, content }) {
  const lines = [];
  if (actor !== undefined && actorKind !== undefined) {
    const label = ACTOR_KIND_TO_LABEL[actorKind];
    if (!label) throw new Error(`renderProvenance: unknown actorKind '${actorKind}'`);
    lines.push(`${ACTOR_MARKER} ${actor} (${label})`);
  }
  if (source !== undefined) {
    lines.push(`${FUENTE_MARKER} ${source}`);
  } else if (issue !== undefined) {
    lines.push(`${FUENTE_MARKER} issue #${issue}`);
  }
  if (supersedes !== undefined) {
    lines.push(`${SUPERSEDE_MARKER} ${supersedes}`);
  }
  if (lines.length === 0) return content;
  return `${lines.join('\n')}\n\n${content}`;
}
