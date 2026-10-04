// project-slug.mjs — the ONE resolver of "which repository is this" (#1273).
//
// Before this, every reader of `project.slug` resolved it on its own: `brain:start`, `brain:ship`
// and `brain:protect` refused an empty slug, `brain:next`, `brain:governance-status`, the review
// and memory CLIs and `brain:metrics` passed `undefined` on to the VCS port, and only
// `local-gate-context.mjs` fell back to the origin remote. ADR-0040 (#1263 slice 2) stopped
// `env:init` from backfilling an empty slug in an existing repository, so the readers `env:init`
// used to rescue now break. Same defect class #1114 removed for the axes: a fact resolved N ways.
//
// Order — unchanged from what `local-gate-context.mjs` did, and from every reader that already
// preferred the tracked value:
//   1. `config.project.slug` (the team's declared value),
//   2. the origin remote (`git remote get-url origin`, parsed by `vcs/lib/repo.mjs#parseRemote`),
//   3. refusal naming `npm run brain:config -- set project.slug <owner/repo>`.
//
// CI note: no reader consults `GITHUB_REPOSITORY` / `CI_PROJECT_PATH` for the slug today —
// `ci-context.mjs` carries those for the governance jobs, which read them from the environment
// directly. This resolver therefore keeps config-then-origin and does NOT add a CI step: adding
// one would silently change the precedence of the audit readers (`merge-walk`, `brain:metrics`).

import { gitTry } from '../governance/postmerge/git-seam.mjs';
import { parseRemote } from '../vcs/lib/repo.mjs';
import { t } from '../i18n/t.mjs';

export const PROJECT_SLUG_FIX = 'npm run brain:config -- set project.slug <owner/repo>';

/** Thrown when neither the tracked config nor the origin remote names the repository. */
export class ProjectSlugError extends Error {
  constructor() {
    super(`project.slug is not set in brain.config.json and no origin remote exists to read it from. Fix: ${PROJECT_SLUG_FIX}`);
    this.name = 'ProjectSlugError';
    this.code = 'NO_PROJECT_SLUG';
    this.i18nKey = 'config.slug.refused';
  }
}

// One origin lookup per (config object, cwd): the audit readers (`merge-walk`, `brain:metrics`) ask
// once per merge, and with an empty tracked slug each ask used to spawn `git remote get-url origin`.
// Only the default seam is memoised — an injected `git`/`identity` is the caller's own and never cached.
const _memo = new WeakMap();
function originMemo(config, cwd) {
  const key = config !== null && typeof config === 'object' ? config : null;
  const byCwd = key ? (_memo.get(key) ?? _memo.set(key, new Map()).get(key)) : null;
  if (byCwd?.has(cwd)) return byCwd.get(cwd);
  const r = gitTry(['remote', 'get-url', 'origin'], { cwd });
  const origin = r.status === 0 ? parseRemote(r.stdout).project : null;
  byCwd?.set(cwd, origin);
  return origin;
}

/**
 * @param {{ config?: object, cwd?: string, git?: { try: (argv: string[]) => { status: number, stdout: string } },
 *           identity?: () => ({ project: string|null }|null) }} [opts]
 *   `git` is the seam `postmerge/git-seam.mjs` established; `identity` is kept for the callers
 *   (`brain-check`) that already inject the origin as a whole.
 * @returns {{ slug: string, source: 'config'|'origin' }}
 * @throws {ProjectSlugError}
 */
export function resolveProjectSlug({ config, cwd = process.cwd(), git, identity } = {}) {
  const configured = config?.project?.slug;
  if (typeof configured === 'string' && configured.trim() !== '') return { slug: configured.trim(), source: 'config' };

  let origin = null;
  if (identity) {
    origin = identity()?.project ?? null;
  } else if (git) {
    const r = git.try(['remote', 'get-url', 'origin']);
    if (r.status === 0) origin = parseRemote(r.stdout).project;
  } else {
    origin = originMemo(config, cwd);
  }
  if (origin) return { slug: origin, source: 'origin' };
  throw new ProjectSlugError();
}

/** Best-effort form for readers that degrade rather than refuse: the slug, or `null`. Never throws. */
export function projectSlugOrNull(opts = {}) {
  try { return resolveProjectSlug(opts).slug; } catch (e) { if (e instanceof ProjectSlugError) return null; throw e; }
}

/** The refusal text in the active (or given) locale — what a CLI prints before exiting 1. */
export async function describeSlugRefusal(_err, { locale } = {}) {
  return t('config.slug.refused', { fix: PROJECT_SLUG_FIX }, { locale });
}
