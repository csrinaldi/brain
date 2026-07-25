#!/usr/bin/env node
// brain/scripts/harness/backends/antigravity.mjs — antigravity harness backend
// (issue #256, Track B / B2 Half 1).
//
// Implements the harness verb contract for Antigravity (design.md §"init()
// shape"). Antigravity reads AGENTS.md — the multi-harness standard file
// (measured, Exp 1, #604) — never a hand-authored file. This backend
// COMPILES that file from brain's canonical source docs (Fork 5: compile,
// never `@path` memport) so every standard reader (Gemini, Codex, Claude-as-
// observer) sees the same self-contained content.
//
// Exported functions are called by brain/scripts/harness/cli.mjs; callers
// should never invoke Antigravity directly. Zero cli.mjs change — the
// dispatcher is already backend-agnostic (plain.mjs/gentle-ai.mjs are the
// n=2 precedent this extends to n=3).
//
// Verbs:
//   init() — reads the 5 SOURCE_DOCS, compiles AGENTS.md via compileAgentsMd(),
//            writes it to AGENTS_EMIT_PATH. Never throws.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, posix as posixPath } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

// ---------------------------------------------------------------------------
// Frozen contract: canonical source docs (design's exact list and order) +
// the emitted file's repo-root-relative path (MEASURED target, Exp 1).
// ---------------------------------------------------------------------------

/** The 5 canonical brain/ docs AGENTS.md is compiled from, in this exact order. */
export const SOURCE_DOCS = Object.freeze([
  'brain/HOME.md',
  'brain/core/methodology/agent-authorities.md',   // Tier table VERBATIM (Exp 4)
  'brain/core/methodology/harness-contract.md',     // verb table
  'brain/core/methodology/sdd-layout.md',           // layout summary
  'brain/core/methodology/workflow-governance.md',  // gate list + skip labels (Fork B)
]);

/** Repo-root-relative path Antigravity reads (measured, Exp 1). */
export const AGENTS_EMIT_PATH = 'AGENTS.md';

/** Repo-root-relative path for Antigravity native settings hooks (issue #305). */
export const GEMINI_SETTINGS_EMIT_PATH = '.gemini/settings.json';

const REGENERATE_HINT = 'AGENT_PLATFORM=antigravity npm run brain:env:init';

/**
 * Compiles .gemini/settings.json content with native workspace hooks.
 * Pure, fs-free.
 *
 * @returns {string} The formatted JSON content.
 */
export function compileGeminiSettingsJson() {
  const obj = {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: "node -e \"const cmd = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).tool_input?.command ?? ''; if (/--no-verify/.test(cmd) || /\\bgit commit\\b[^|&\\n]*\\s+-n\\b/.test(cmd)) { process.stderr.write('\\n[brain:hook] BLOCKED: --no-verify / git commit -n bypasses governance hooks.\\nSee ADR-0014 §9. Fix the hook that is causing the false-positive instead.\\n'); process.exit(2); }\"",
            },
          ],
        },
      ],
      SessionStart: [
        {
          hooks: [
            {
              type: 'command',
              command: 'npm run brain:session:start',
            },
          ],
        },
      ],
    },
  };
  return JSON.stringify(obj, null, 2) + '\n';
}

// ---------------------------------------------------------------------------
// Relative-link rebasing (CP-B2 inaugural-read finding, owner ruling).
//
// A splice-verbatim compile reproduces each source doc's relative markdown
// links UNCHANGED — but a relative link is only correct relative to ITS OWN
// source doc's location. Spliced into AGENTS.md at repo root, the SAME link
// text resolves to a DIFFERENT (often outside-the-repo) target: e.g.
// brain/HOME.md's `../docs/adoption.md` resolves to `<repo>/docs/adoption.md`
// from brain/, but to a path OUTSIDE the repo from AGENTS.md at repo root.
// Antigravity follows the file (Exp 4, #604) — a broken link is a real
// consumer defect. This rewrites each relative link's TARGET (never its
// visible text) to resolve identically from AGENTS_EMIT_PATH's location.
// Left untouched: absolute URLs (scheme://…, mailto:…), pure anchors (#…),
// and links already root-relative (/…).
// ---------------------------------------------------------------------------

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g;

function isSchemeAnchorOrRootRelative(url) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return true; // scheme: http:, https:, mailto:, ...
  if (url.startsWith('#')) return true;               // pure anchor
  if (url.startsWith('/')) return true;                // already root-relative
  return false;
}

/**
 * Rebases one relative link target so it resolves identically from
 * `emitDir` as it did from `sourceDir`. Preserves any `#anchor` suffix.
 */
function rebaseLinkTarget(url, sourceDir, emitDir) {
  const hashIdx = url.indexOf('#');
  const rawPath = hashIdx === -1 ? url : url.slice(0, hashIdx);
  const anchor = hashIdx === -1 ? '' : url.slice(hashIdx);
  const resolved = posixPath.join(sourceDir, rawPath);
  const rebased = posixPath.relative(emitDir, resolved) || '.';
  return rebased + anchor;
}

/**
 * Rewrites every relative markdown link `[text](url)` in `content` — whose
 * own location is `sourceRelPath` — to resolve to the SAME target from
 * `emitRelPath`'s location. Fs-free, pure.
 */
function rebaseRelativeLinks(content, sourceRelPath, emitRelPath) {
  const sourceDir = posixPath.dirname(sourceRelPath);
  const emitDir = posixPath.dirname(emitRelPath);

  return content.replace(MARKDOWN_LINK_RE, (match, text, url, title) => {
    if (isSchemeAnchorOrRootRelative(url)) return match;
    return `[${text}](${rebaseLinkTarget(url, sourceDir, emitDir)}${title})`;
  });
}

// ---------------------------------------------------------------------------
// Pure compiler — fs-free by design (design's "one coherent unit" rationale):
// the same function is exercised by the unit test AND the drift-guard, so a
// non-deterministic compiler would make byte-equality flaky by construction.
// ---------------------------------------------------------------------------

/**
 * Compiles the self-contained AGENTS.md content from an injected docs map.
 * Splices each SOURCE_DOCS entry's content behind a provenance banner —
 * verbatim except for relative markdown links, which are REBASED (target
 * only, never the visible text) so they resolve correctly from
 * AGENTS_EMIT_PATH's location instead of the source doc's own location
 * (REQ-B2-2 binds the outcome — a working, provenance-declared file — not a
 * byte-identical splice of link targets that would only be correct in situ).
 *
 * @param {{ [relPath: string]: string }} docs Keyed by SOURCE_DOCS relative path.
 * @returns {string} The compiled AGENTS.md content.
 */
export function compileAgentsMd(docs) {
  const banner =
    `<!-- generated from ${SOURCE_DOCS.join(', ')} — do not edit.\n` +
    `     Regenerate: ${REGENERATE_HINT}\n` +
    `     Drift-guarded by antigravity.drift.test.mjs — hand-edits fail CI. -->`;

  const sections = SOURCE_DOCS.map((relPath) => {
    const rebased = rebaseRelativeLinks(docs[relPath] ?? '', relPath, AGENTS_EMIT_PATH);
    return `<!-- source: ${relPath} -->\n\n${rebased}`;
  });

  return [banner, ...sections].join('\n\n---\n\n') + '\n';
}

// ---------------------------------------------------------------------------
// Default injectable implementations
// ---------------------------------------------------------------------------

function _defaultReadDoc(relPath, root) {
  return readFileSync(join(root, relPath), 'utf8');
}

function _defaultWriteFile(relPath, content, root) {
  const fullPath = join(root, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
}

// ---------------------------------------------------------------------------
// Verb: init
// ---------------------------------------------------------------------------

/**
 * Compiles and writes AGENTS.md from the 5 canonical SOURCE_DOCS and
 * emits .gemini/settings.json hooks. Never throws.
 *
 * @param {object} [opts] Injectable seams.
 * @param {(relPath: string) => string} [opts._readDoc]
 *   Reads one source doc's content. Defaults to real readFileSync from _repoRoot.
 * @param {(relPath: string, content: string) => void} [opts._writeAgents]
 *   Writes the compiled content to relPath.
 * @param {(relPath: string, content: string) => void} [opts._writeGeminiSettings]
 *   Writes the compiled .gemini/settings.json content.
 * @param {string} [opts._repoRoot] Repo root used by the default seams.
 * @returns {Promise<void>}
 */
export async function init({
  _readDoc,
  _writeAgents,
  _writeGeminiSettings,
  _repoRoot = repoRoot,
} = {}) {
  const readDoc = _readDoc ?? ((relPath) => _defaultReadDoc(relPath, _repoRoot));
  const writeAgents = _writeAgents ?? ((relPath, content) => _defaultWriteFile(relPath, content, _repoRoot));
  const writeGeminiSettings = _writeGeminiSettings ?? ((relPath, content) => _defaultWriteFile(relPath, content, _repoRoot));

  const docs = {};
  for (const relPath of SOURCE_DOCS) {
    try {
      docs[relPath] = readDoc(relPath);
    } catch (err) {
      console.warn(`  harness: antigravity could not read ${relPath} — ${err.message}`);
      docs[relPath] = '';
    }
  }

  const content = compileAgentsMd(docs);

  try {
    writeAgents(AGENTS_EMIT_PATH, content);
  } catch (err) {
    console.warn(`  harness: antigravity could not write ${AGENTS_EMIT_PATH} — ${err.message}`);
  }

  const settingsContent = compileGeminiSettingsJson();
  try {
    writeGeminiSettings(GEMINI_SETTINGS_EMIT_PATH, settingsContent);
  } catch (err) {
    console.warn(`  harness: antigravity could not write ${GEMINI_SETTINGS_EMIT_PATH} — ${err.message}`);
  }
}
