// verdict.mjs — REQ-H1-4, REQ-H1-6: the `brain-review/1` verdict builder.
// Pure (no seams, design.md §5) — enforces the §6 hard rules + §7 rev>=3
// bound as BUILD-TIME invariants. The only place a block is constructed.

const YAML_SCALAR_SAFE_RE = /^[A-Za-z0-9._\-/:]+$/;

function yamlScalar(val) {
  if (val === null || val === undefined) return 'null';
  const s = String(val);
  if (s === '' || !YAML_SCALAR_SAFE_RE.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

// Evidence gate (drops findings without `evidence:`) + cites gate (an
// uncited blocker downgrades to `correction` — never invents a citation, §5).
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
  protocol = 'brain-review/1',
  priorRevCount = 0,
  findings = [],
  gates = {},
  conditions = [],
  pin,
  sequencing,
  escalate = null,
} = {}) {
  if (!headSha) throw new Error('brain-review/1: head_sha is mandatory — refusing to build a headless verdict.');

  const processed = processFindings(findings);
  const candidateFindings = [];
  const followUps = [];
  let unknownCausality = false;

  for (const f of processed) {
    const disp = f.causal_disposition;
    if (disp === 'unknown') {
      unknownCausality = true;
      candidateFindings.push(f);
    } else if (disp === 'pre-existing' || disp === 'base-only') {
      followUps.push(f);
    } else {
      candidateFindings.push(f);
    }
  }

  const boundHit = priorRevCount >= 3 && conclusion === 'REVISE';
  const shouldEscalate = boundHit || unknownCausality;
  const finalEscalate = shouldEscalate ? 'human' : escalate;
  
  let finalVerdict = conclusion;
  if (boundHit || unknownCausality) {
    finalVerdict = 'STOP';
  } else if (protocol === 'brain-review/2' && findings.length > 0 && candidateFindings.length === 0 && conclusion === 'REVISE') {
    finalVerdict = 'APPROVE';
  }

  return {
    protocol,
    verdict: finalVerdict,
    head_sha: headSha,
    rev: priorRevCount + 1,
    gates: { required: gates.required ?? [], detection: gates.detection ?? [] },
    findings: candidateFindings,
    follow_ups: followUps,
    conditions,
    pin,
    sequencing,
    escalate: finalEscalate,
  };
}

// Renders a built verdict as the fenced brain-review/1 or brain-review/2 YAML block (§6).
// Hand-rolled — zero npm deps and this schema is fixed, not generic YAML.
export function renderVerdict(v) {
  const proto = v.protocol ?? 'brain-review/1';
  const lines = [
    '```yaml',
    `protocol: ${proto}`,
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
      if (f.evidence_class) lines.push(`    evidence_class: ${f.evidence_class}`);
      if (f.causal_disposition) lines.push(`    causal_disposition: ${f.causal_disposition}`);
    }
  }

  if (v.follow_ups && v.follow_ups.length > 0) {
    lines.push('follow_ups:');
    for (const f of v.follow_ups) {
      lines.push(`  - id: ${yamlScalar(f.id)}`);
      lines.push(`    severity: ${f.severity}`);
      lines.push(`    evidence: ${yamlScalar(f.evidence)}`);
      if (f.cites) lines.push(`    cites: ${yamlScalar(f.cites)}`);
      if (f.evidence_class) lines.push(`    evidence_class: ${f.evidence_class}`);
      if (f.causal_disposition) lines.push(`    causal_disposition: ${f.causal_disposition}`);
    }
  }

  lines.push(`conditions: [${(v.conditions ?? []).map(yamlScalar).join(', ')}]`);
  if (v.pin) lines.push(`pin: ${yamlScalar(JSON.stringify(v.pin))}`);
  if (v.sequencing) lines.push(`sequencing: ${yamlScalar(JSON.stringify(v.sequencing))}`);
  lines.push(`escalate: ${v.escalate ?? 'null'}`, '```');

  return lines.join('\n');
}
