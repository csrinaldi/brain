// verdict.mjs — REQ-H1-4, REQ-H1-6: the `brain-review/1` verdict builder.
// Pure (no seams, design.md §5) — enforces the §6 hard rules + §7 rev>=3
// bound as BUILD-TIME invariants. The only place a block is constructed.

const YAML_SCALAR_SAFE_RE = /^[A-Za-z0-9._\-/:]+$/;

/**
 * Is this finding's anchor USABLE — a non-empty path and a line that exists in a
 * diff? Diff lines are 1-based, so `0`, `''`, `'abc'`, `2.5` and `-3` are all
 * anchors already known not to attach. `Number()` because `parseVerdict` returns
 * entry scalars as text: a round-tripped `line` arrives as `'42'`.
 *
 * Exported and shared with `poster.mjs`'s `deriveInlineComments` ON PURPOSE. The
 * renderer's rule and the poster's were byte-identical duplicates until round 10
 * of PR #490's review tightened the poster's alone — leaving the block advertising
 * `line: 0` anchors the poster then refused, which is the exact state the
 * round-8 test forbids, one field-value class over. Two copies of one rule drift;
 * one function cannot.
 *
 * @param {{file?: string, line?: unknown}} f
 * @returns {boolean}
 */
export function hasUsableAnchor(f) {
  const line = Number(f?.line);
  return Boolean(f?.file) && Number.isInteger(line) && line >= 1;
}

/**
 * Emits a value as a YAML scalar. `parse-verdict.mjs`'s `unyamlScalar` is its
 * exact inverse — change one and the other moves in the same commit.
 *
 * Line breaks are ESCAPED, not merely quoted (issue #481, ruled in scope for
 * #452). A quoted scalar containing a RAW newline puts its continuation lines
 * at column 0, which terminates the findings list. Measured through the real
 * chain: a two-finding verdict whose first `evidence:` carried multi-line
 * command stdout — exactly what `checkpoint.mjs` interpolates from
 * `brain-governance-status` — re-parsed to ONE finding, silently dropping a
 * blocker. `\r` is escaped for the same reason: CRLF content would otherwise
 * leave a stray carriage return inside a parsed value.
 *
 * Order matters — backslashes first, so the escapes introduced after are not
 * themselves re-escaped.
 */
function yamlScalar(val) {
  if (val === null || val === undefined) return 'null';
  const s = String(val);
  if (s === '' || !YAML_SCALAR_SAFE_RE.test(s)) {
    return `"${s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')}"`;
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
      lines.push(`    severity: ${yamlScalar(f.severity)}`);
      lines.push(`    evidence: ${yamlScalar(f.evidence)}`);
      if (f.cites) lines.push(`    cites: ${yamlScalar(f.cites)}`);
      if (f.evidence_class) lines.push(`    evidence_class: ${yamlScalar(f.evidence_class)}`);
      if (f.causal_disposition) lines.push(`    causal_disposition: ${yamlScalar(f.causal_disposition)}`);
      // The inline-comment anchor (issue #405, REQ-405-2). BOTH optional, and
      // emitted only when the pair is USABLE — see `hasUsableAnchor`. Not "when
      // present": a finding carrying `line: 0` or `line: 'abc'` has them and gets
      // neither, because a block that advertises an anchor the poster refuses is
      // the same defect read from the emitting end. A finding without them renders
      // exactly as it does today — that is what keeps the feature additive for every
      // evaluator shipping now. Through yamlScalar like every other scalar (`line` after the coercion, so the block carries the same integer the wire does).
      if (hasUsableAnchor(f)) {
        lines.push(`    file: ${yamlScalar(f.file)}`);
        lines.push(`    line: ${yamlScalar(Number(f.line))}`);
      }
    }
  }

  if (v.follow_ups && v.follow_ups.length > 0) {
    lines.push('follow_ups:');
    for (const f of v.follow_ups) {
      lines.push(`  - id: ${yamlScalar(f.id)}`);
      lines.push(`    severity: ${yamlScalar(f.severity)}`);
      lines.push(`    evidence: ${yamlScalar(f.evidence)}`);
      if (f.cites) lines.push(`    cites: ${yamlScalar(f.cites)}`);
      if (f.evidence_class) lines.push(`    evidence_class: ${yamlScalar(f.evidence_class)}`);
      if (f.causal_disposition) lines.push(`    causal_disposition: ${yamlScalar(f.causal_disposition)}`);
      // The inline-comment anchor (issue #405, REQ-405-2). BOTH optional, and
      // emitted only when the pair is USABLE — see `hasUsableAnchor`. Not "when
      // present": a finding carrying `line: 0` or `line: 'abc'` has them and gets
      // neither, because a block that advertises an anchor the poster refuses is
      // the same defect read from the emitting end. A finding without them renders
      // exactly as it does today — that is what keeps the feature additive for every
      // evaluator shipping now. Through yamlScalar like every other scalar (`line` after the coercion, so the block carries the same integer the wire does).
      if (hasUsableAnchor(f)) {
        lines.push(`    file: ${yamlScalar(f.file)}`);
        lines.push(`    line: ${yamlScalar(Number(f.line))}`);
      }
    }
  }

  lines.push(`conditions: [${(v.conditions ?? []).map(yamlScalar).join(', ')}]`);
  if (v.pin) lines.push(`pin: ${yamlScalar(JSON.stringify(v.pin))}`);
  if (v.sequencing) lines.push(`sequencing: ${yamlScalar(JSON.stringify(v.sequencing))}`);
  lines.push(`escalate: ${v.escalate ?? 'null'}`, '```');

  return lines.join('\n');
}
