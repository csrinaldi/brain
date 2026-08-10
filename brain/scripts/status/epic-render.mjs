// epic-render.mjs — the graph as a mermaid block, and the marker-bounded body write
// (issue #459).
//
// Mermaid because it renders NATIVELY in issue bodies on both GitHub and GitLab — no
// external hosting, no image to regenerate, no provider lock (ADR-0008 parity). The
// rich hand-authored diagram stays a deluxe manual artifact; the embedded,
// self-updating form is mermaid.

export const BEGIN = '<!-- brain:epic:map BEGIN -->';
export const END = '<!-- brain:epic:map END -->';

const ESC = /["<>[\]{}()|]/g;

/** Mermaid labels are not HTML-escaped by the renderer, and a `|` or `[` in a title
 *  breaks the node syntax rather than merely looking wrong. Titles are user text, so
 *  they are sanitised on the way in — never trusted because "our titles are fine". */
function label(s) {
  return String(s).replace(ESC, ' ').replace(/\s+/g, ' ').trim().slice(0, 72);
}

/**
 * Renders the graph. Deterministic: nodes sorted by number, edges by endpoints, so
 * two runs over unchanged server state produce byte-identical output — which is what
 * makes the body write idempotent rather than merely usually-idempotent.
 *
 * @param {{nodes:Array,edges:Array}} graph
 * @returns {string}
 */
export function renderMermaid({ nodes = [], edges = [] } = {}) {
  const shown = [...nodes].sort((a, b) => a.number - b.number);
  const lines = ['```mermaid', 'graph LR'];

  for (const n of shown) {
    lines.push(`  N${n.number}["#${n.number} ${label(n.title)}"]`);
  }
  for (const e of [...edges].sort((a, b) => a.from - b.from || a.to - b.to)) {
    // An edge to a node outside the set is kept and drawn to a stub: dropping it
    // would make the map claim there is no dependency, which is a stronger and
    // falser statement than "there is one, and it is out of scope here".
    if (!shown.some(n => n.number === e.to)) lines.push(`  N${e.to}["#${e.to} (fuera del alcance)"]`);
    lines.push(`  N${e.from} --> N${e.to}`);
  }

  const cls = { ready: [], blocked: [], 'awaiting-human': [], unclassified: [] };
  for (const n of shown) cls[n.status]?.push(`N${n.number}`);
  lines.push('  classDef ready fill:#DEF7E5,stroke:#216E43,color:#0B2E1C;');
  lines.push('  classDef blocked fill:#F6E2DF,stroke:#A33227,color:#3A100C;');
  lines.push('  classDef human fill:#FBF0D9,stroke:#8F6410,color:#3A2A05;');
  lines.push('  classDef unknown fill:#ECEEF0,stroke:#7A828A,color:#242A2F;');
  if (cls.ready.length) lines.push(`  class ${cls.ready.join(',')} ready;`);
  if (cls.blocked.length) lines.push(`  class ${cls.blocked.join(',')} blocked;`);
  if (cls['awaiting-human'].length) lines.push(`  class ${cls['awaiting-human'].join(',')} human;`);
  if (cls.unclassified.length) lines.push(`  class ${cls.unclassified.join(',')} unknown;`);

  lines.push('```');
  return lines.join('\n');
}

/**
 * Renders the reading the hand-made map proved valuable: what is startable now, what
 * is blocked on what, and what waits on a human rather than on code.
 *
 * `unclassified` is reported with its count and never hidden. A map that silently
 * omits what it could not read is a map that overstates its own coverage.
 */
export function renderSummary({ nodes = [], tracks = new Map() } = {}) {
  const by = (s) => nodes.filter(n => n.status === s).sort((a, b) => a.number - b.number);
  const ref = (ns) => (ns.length ? ns.map(n => `#${n.number}`).join(' ') : '—');
  const lines = [
    `**Listos ahora:** ${ref(by('ready'))}`,
    `**Bloqueados:** ${by('blocked').map(n => `#${n.number} ← ${n.blockedBy.map(b => `#${b}`).join(' ')}`).join(' · ') || '—'}`,
    `**Esperando firma humana:** ${ref(by('awaiting-human'))}`,
  ];
  const un = by('unclassified');
  if (un.length) {
    lines.push(`**Sin declarar** (${un.length}) — no llevan bloque \`brain-graph/1\`, así que el grafo no los ubica: ${ref(un)}`);
  }
  const conflicts = by('ready').filter(n => (n.conflictsWith ?? []).length > 0);
  if (conflicts.length) {
    lines.push(`**No paralelizables entre sí** (reclaman los mismos archivos): ${conflicts.map(n => `#${n.number}↔${n.conflictsWith.map(c => `#${c}`).join(',')}`).join(' · ')}`);
  }
  lines.push('', `_Regenerado por \`brain:epic:map\` sobre ${nodes.length} issues y ${tracks.size} tracks. No editar a mano: la próxima corrida lo pisa._`);
  return lines.join('\n');
}

/**
 * Replaces the marker region in `body`, leaving everything outside it byte-identical.
 *
 * READ-ONLY OUTSIDE THE MARKERS is the property that makes this verb safe to run on a
 * hand-written epic. It is asserted by test, not by care: the whole value of a
 * regenerated projection evaporates if regenerating it can lose the prose around it.
 *
 * An absent marker region APPENDS one rather than rewriting anything, so a first run
 * on an untouched epic is additive.
 *
 * @param {string} body @param {string} content
 * @returns {string}
 */
export function replaceMapRegion(body, content) {
  const src = typeof body === 'string' ? body : '';
  const region = `${BEGIN}\n${content}\n${END}`;
  const i = src.indexOf(BEGIN);
  const j = src.indexOf(END);
  if (i === -1 || j === -1 || j < i) {
    return src.trimEnd() + (src.trim() ? '\n\n' : '') + region + '\n';
  }
  return src.slice(0, i) + region + src.slice(j + END.length);
}
