// verdict.mjs — REQ-H1-4, REQ-H1-6: the `brain-review/1` verdict builder.
// Pure (no seams, design.md §5) — enforces the three §6 hard rules and the
// §7 rev>=3 bound as BUILD-TIME invariants: a violating verdict is not
// representable. The only place a `brain-review/1` block is constructed.

const YAML_SCALAR_SAFE_RE = /^[A-Za-z0-9._\-/:]+$/;

function yamlScalar(val) {
  if (val === null || val === undefined) return 'null';
  const s = String(val);
  if (s === '' || !YAML_SCALAR_SAFE_RE.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

/** Evidence gate (drops findings without `evidence:`) + cites gate (a
 * `severity: blocker` finding without `cites:` downgrades to `correction` —
 * never invents a citation, protocol §5). */
function processFindings(findings = []) {
  return findings
    .filter(f => Boolean(f?.evidence))
    .map(f => (f.severity === 'blocker' && !f.cites ? { ...f, severity: 'correction' } : f));
}

/** Pure builder. Throws when `headSha` is absent (protocol §6 — no headless
 * verdict). `priorRevCount` = count of prior blocks; at `rev >= 3` a REVISE
 * conclusion becomes `STOP` + `escalate:human` (protocol §7, REQ-H1-6). */
export function buildVerdict({
  headSha,
  conclusion,
  priorRevCount = 0,
  findings = [],
  gates = {},
  conditions = [],
  pin,
  sequencing,
  escalate = null,
} = {}) {
  if (!headSha) {
    throw new Error('brain-review/1: head_sha is mandatory — refusing to build a headless verdict.');
  }

  const boundHit = priorRevCount >= 3 && conclusion === 'REVISE';

  return {
    protocol: 'brain-review/1',
    verdict: boundHit ? 'STOP' : conclusion,
    head_sha: headSha,
    rev: priorRevCount,
    gates: { required: gates.required ?? [], detection: gates.detection ?? [] },
    findings: processFindings(findings),
    conditions,
    pin,
    sequencing,
    escalate: boundHit ? 'human' : escalate,
  };
}

/** Renders a built verdict as the fenced `brain-review/1` YAML block
 * (protocol §6 shape). Hand-rolled — brain ships zero npm deps and this
 * schema is fixed, not generic YAML. */
export function renderVerdict(v) {
  const lines = [
    '```yaml',
    'protocol: brain-review/1',
    `verdict: ${v.verdict}`,
    `head_sha: ${v.head_sha}`,
    `rev: ${v.rev}`,
    'gates:',
    `  required: [${v.gates.required.map(yamlScalar).join(', ')}]`,
    `  detection: [${v.gates.detection.map(yamlScalar).join(', ')}]`,
  ];

  if (v.findings.length === 0) {
    lines.push('findings: []');
  } else {
    lines.push('findings:');
    for (const f of v.findings) {
      lines.push(`  - id: ${yamlScalar(f.id)}`);
      lines.push(`    severity: ${f.severity}`);
      lines.push(`    evidence: ${yamlScalar(f.evidence)}`);
      if (f.cites) lines.push(`    cites: ${yamlScalar(f.cites)}`);
    }
  }

  lines.push(`conditions: [${(v.conditions ?? []).map(yamlScalar).join(', ')}]`);
  if (v.pin) lines.push(`pin: ${yamlScalar(JSON.stringify(v.pin))}`);
  if (v.sequencing) lines.push(`sequencing: ${yamlScalar(JSON.stringify(v.sequencing))}`);
  lines.push(`escalate: ${v.escalate ?? 'null'}`, '```');

  return lines.join('\n');
}
