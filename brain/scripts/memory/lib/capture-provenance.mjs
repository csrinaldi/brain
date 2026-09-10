// capture-provenance.mjs — the capture door's three provenance questions
// (#738, design A1/A2; spec "a record carries its provenance").
//
// Pure: no `fs`, no `child_process`. Every git/env fact this module reasons
// about is read by the caller (`plainfiles.mjs`, via `lib/git-config.mjs`'s
// `gitConfigGet` and `process.env`) and passed in — that is what keeps these
// resolvers zero-seam unit tests.
//
// Named for what it does, not `actor-identity.mjs` (the proposal's name):
// this module also derives `issue` from the branch, and `provenance.mjs` is
// already the §4 prose parser (`engram-export.mjs`) — it must not become two
// things.

/** Default agent-marker env var name, overridable via `git config brain.agentEnv`. */
export const AGENT_ENV_DEFAULT = 'AI_AGENT';

/**
 * Actor values `resolveActor` refuses regardless of shape. `@legacy` is the
 * export fallback's sentinel (`engram-export.mjs`) — without this refusal,
 * `git config brain.actor @legacy` mints that sentinel through the capture
 * door and the "brain's own capture path never emits @legacy" guard (spec)
 * is true only by convention.
 */
export const RESERVED_ACTORS = new Set(['@legacy']);

/** `<type>/issue-<N>` or `<type>/issue-<N>-<slug>` — never a bare number, never case-insensitive. */
export const ISSUE_BRANCH_RE = /^[a-z]+\/issue-(\d+)(?:-|$)/;

// The positive handle shape (design A2). Also rehomed to `format.mjs` as
// `HANDLE_RE` (#738 unit 3) for the write-gate's own classification; kept as
// a private literal copy here rather than importing `format.mjs`, because
// this module's contract is "pure, zero dependency" and a schema-owner
// import would blur that line for no behavioural gain — the two patterns are
// asserted identical by both modules' own test suites.
const HANDLE_RE = /^@[A-Za-z0-9][A-Za-z0-9-]*$/;

/**
 * Resolves `actor` from the raw `git config brain.actor` read.
 *
 * @param {{ configured: string|null|undefined }} input
 * @returns {{ok:true, actor:string, evidence:string} | {ok:false, reason:'unset'|'malformed'|'reserved', value: string|null}}
 */
export function resolveActor({ configured }) {
  const value = typeof configured === 'string' ? configured.trim() : '';
  if (!value) return { ok: false, reason: 'unset', value: configured ?? null };
  if (RESERVED_ACTORS.has(value)) return { ok: false, reason: 'reserved', value };
  if (!HANDLE_RE.test(value)) return { ok: false, reason: 'malformed', value };
  return { ok: true, actor: value, evidence: 'actor from git config brain.actor' };
}

/**
 * Resolves `actorKind` by MEASURING the agent-marker env, never a hardcoded
 * constant. `agentEnvConfig` is the raw `git config brain.agentEnv` value —
 * a comma-separated list of variable NAMES (default: `AGENT_ENV_DEFAULT`
 * alone). The first name whose value is non-empty wins. A marker set but
 * EMPTY counts as absent (⇒ `human`), recorded in evidence rather than
 * silently treated the same as "never set" (#888 set-but-blank discipline).
 *
 * @param {{ env: Record<string,string|undefined>, agentEnvConfig?: string|null }} input
 * @returns {{actorKind:'human'|'agent', marker:string|null, rawValue:string|null, evidence:string}}
 */
export function resolveActorKind({ env = {}, agentEnvConfig } = {}) {
  const names = typeof agentEnvConfig === 'string' && agentEnvConfig.trim()
    ? agentEnvConfig.split(',').map((s) => s.trim()).filter(Boolean)
    : [AGENT_ENV_DEFAULT];

  const emptyNames = [];
  for (const name of names) {
    const raw = env ? env[name] : undefined;
    if (raw === undefined) continue;
    if (raw === '') {
      emptyNames.push(name);
      continue;
    }
    return { actorKind: 'agent', marker: name, rawValue: raw, evidence: `actorKind agent from env ${name}` };
  }

  const evidence = emptyNames.length
    ? `actorKind human — ${emptyNames.join(',')} set but empty`
    : `actorKind human — no agent marker among ${names.join(',')}`;
  return { actorKind: 'human', marker: null, rawValue: null, evidence };
}

/**
 * Resolves `issue`: `declared` (from `--issue`) wins; otherwise derived from
 * `branch` matching `ISSUE_BRANCH_RE`; otherwise absent, NEVER fabricated.
 *
 * @param {{ declared: number|string|undefined|null, branch: string|null|undefined }} input
 * @returns {{issue: number|undefined, derived: boolean, branch?: string, evidence: string|null}}
 */
export function deriveIssue({ declared, branch }) {
  if (declared !== undefined && declared !== null && declared !== '') {
    const n = Number(declared);
    if (Number.isInteger(n)) {
      return { issue: n, derived: false, evidence: `issue ${n} declared via --issue` };
    }
  }
  if (typeof branch === 'string') {
    const m = ISSUE_BRANCH_RE.exec(branch);
    if (m) {
      const n = Number(m[1]);
      return { issue: n, derived: true, branch, evidence: `issue ${n} derived from branch ${branch}` };
    }
  }
  return { issue: undefined, derived: false, evidence: null };
}

/** Whitespace-collapsed, 64-char-sliced — agent-controlled text landing in a durable field (design A2). */
function collapseAndTruncate(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 64);
}

/**
 * Composes ONE trimmed physical line (W1-safe, `format.mjs`'s `source` rule)
 * from the other three resolvers' results plus the capturing host.
 *
 * @param {{ host: string, actor: {evidence:string}, kind: {actorKind:string, marker:string|null, rawValue:string|null, evidence:string}, issue: {evidence:string|null} }} input
 * @returns {string}
 */
export function composeSource({ host, actor, kind, issue }) {
  const parts = [`plainfiles save on ${host}`];
  if (actor && actor.evidence) parts.push(actor.evidence);
  if (kind) {
    if (kind.actorKind === 'agent' && kind.rawValue) {
      parts.push(`actorKind agent from env ${kind.marker}=${collapseAndTruncate(kind.rawValue)}`);
    } else if (kind.evidence) {
      parts.push(kind.evidence);
    }
  }
  if (issue && issue.evidence) parts.push(issue.evidence);
  return parts.join('; ').replace(/\s+/g, ' ').trim();
}
