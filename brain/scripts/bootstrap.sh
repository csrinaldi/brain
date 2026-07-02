#!/usr/bin/env bash
# bootstrap.sh — interactive development environment setup (verb: npm run brain:env:init | deprecated alias: env:init)
#
# Leaves a fresh clone operational: personal PAT in .env, HTTPS credential helper
# at repo level, VCS CLI authenticated, SDD harness chosen and initialized,
# team memory imported and indexed, and open tickets as a starting point.
# Idempotent: running again only completes what is missing.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Bootstrap brain.config.json before resolving identity.
# On a fresh clone the file doesn't exist: ensureBrainConfig creates it with the
# full schema and derives vcs.provider / gitHost / slug from the git origin so
# the mapfile below reads the correct provider (not the *)‐default gitlab).
# Non-fatal: degrades gracefully if git is absent or node is not yet available.
_config_existed=true
[ -f brain.config.json ] || _config_existed=false
node brain/scripts/lib/brain-config.mjs ensure || true

# Scaffold brain/HOME.md if absent (never overwrites an existing one — the file
# is consumer-owned once it exists). Non-fatal, idempotent: re-running env:init
# on a repo that already has HOME.md is a no-op.
node brain/scripts/lib/home-scaffold.mjs ensure || true

# Resolve project identity from brain.config.json, falling back to git origin.
# VCS_PROVIDER: env var wins, then brain.config.json vcs.provider.
# VCS_HOST:     brain.config.json project.gitHost, then origin host.
# PROJECT_PATH: brain.config.json project.slug, then origin project path.
# Read via mapfile (one value per line) — never eval — so repo-identity values
# (which can contain shell metacharacters) can't inject commands.
mapfile -t _IDENT < <(node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

let c = {};
try { c = JSON.parse(readFileSync('brain.config.json', 'utf8')); } catch {}

let originHost = '', originProject = '';
try {
  const url = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
  const m = url.match(/(?:https?:\/\/(?:[^@\/]+@)?|git@)([^\/:]+)(?::\d+)?[\/:](.+?)(?:\.git)?$/);
  if (m) { originHost = m[1]; originProject = m[2]; }
} catch {}

console.log(process.env.VCS_PROVIDER || c.vcs?.provider || '');
console.log(c.project?.gitHost || originHost  || '');
console.log(c.project?.slug    || originProject || '');
NODE
)

# Defaults guard against node not being available yet (empty array).
VCS_PROVIDER="${_IDENT[0]:-}"
VCS_HOST="${_IDENT[1]:-}"
PROJECT_PATH="${_IDENT[2]:-}"
export VCS_HOST

# Interactive: on a TTY, after a fresh creation, show derived values and let the
# developer confirm or override the VCS provider. Non-TTY → use derived silently.
if [ -t 0 ] && [ "$_config_existed" = false ] && [ -n "$VCS_PROVIDER$VCS_HOST$PROJECT_PATH" ]; then
  printf '\n  Derived from git origin:\n'
  printf '    provider : %s\n' "${VCS_PROVIDER:-?}"
  printf '    gitHost  : %s\n' "${VCS_HOST:-?}"
  printf '    slug     : %s\n' "${PROJECT_PATH:-?}"
  read -r -p "  VCS provider [${VCS_PROVIDER:-}]: " _override
  _override="${_override:-$VCS_PROVIDER}"
  if [ -n "$_override" ] && [ "$_override" != "$VCS_PROVIDER" ]; then
    VCS_PROVIDER="$_override"
    # Persist the override to brain.config.json — use env var to avoid injection.
    VCS_PROVIDER_OVERRIDE="$_override" node --input-type=module <<'NODE' || true
import { readFileSync, writeFileSync } from 'node:fs';
try {
  const cfg = JSON.parse(readFileSync('brain.config.json', 'utf8'));
  if (!cfg.vcs) cfg.vcs = {};
  cfg.vcs.provider = process.env.VCS_PROVIDER_OVERRIDE;
  writeFileSync('brain.config.json', JSON.stringify(cfg, null, 2) + '\n');
} catch {}
NODE
  fi
fi

# Generic credential env var (ADR-0007 / issue #33): a single VCS_TOKEN is used
# regardless of provider so that .env stays portable across GitHub, GitLab, and any
# future host.
VCS_TOKEN_VAR="VCS_TOKEN"

# Per-provider constants: credential helper username, PAT scope, CLI binary.
case "$VCS_PROVIDER" in
  github)
    VCS_CRED_USER="x-access-token"
    PAT_SCOPES="repo"
    VCS_CLI="gh"
    ;;
  *)
    # Default: gitlab (covers empty provider or explicit "gitlab").
    VCS_CRED_USER="oauth2"
    PAT_SCOPES="api"
    VCS_CLI="glab"
    ;;
esac

say()  { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
ok()   { printf '  ✓ %s\n' "$1"; }
warn() { printf '  ⚠ %s\n' "$1"; }

env_get() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true; }
env_set() {
  touch .env
  if grep -qE "^$1=" .env; then
    # key exists (maybe empty): replace the line instead of appending a duplicate
    local tmp; tmp="$(mktemp)"
    grep -vE "^$1=" .env > "$tmp" || true
    printf '%s=%s\n' "$1" "$2" >> "$tmp"
    mv "$tmp" .env
  else
    # guard: a final line without newline would swallow the appended key
    if [ -s .env ] && [ "$(tail -c1 .env | wc -l)" -eq 0 ]; then printf '\n' >> .env; fi
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

# --- i18n: source active locale catalog (graceful degradation) ────────────────
# Defines I18N_* vars for every key in the catalog using the active locale
# (brain.config.json docs.language) with English fallback applied per-key.
# Guard: only eval when node is available AND sh.mjs produces non-empty output.
# If node is absent or sh.mjs fails, the script falls through to inline English
# defaults (${I18N_VAR:-"…"}) used only in the pre-node section (§1 below).
if command -v node >/dev/null 2>&1; then
  _i18n_vars="$(node brain/scripts/i18n/sh.mjs 2>/dev/null)"
  [ -n "$_i18n_vars" ] && eval "$_i18n_vars"
  unset _i18n_vars
fi

# --- 1. Base dependencies (blocking) -----------------------------------------
say "${I18N_BOOTSTRAP_DEPS_SECTION:-Base dependencies}"
for tool in git python3; do
  command -v "$tool" >/dev/null 2>&1 || { printf "  ✗ ${I18N_BOOTSTRAP_DEPS_MISSING:-Missing '%s' (required). Install it and re-run env:init.}\n" "$tool" >&2; exit 1; }
done
# Require at least one supported package manager (npm/pnpm/yarn/bun).
_PM_FOUND=false
for _pm_bin in npm pnpm yarn bun; do
  if command -v "$_pm_bin" >/dev/null 2>&1; then _PM_FOUND=true; break; fi
done
if [ "$_PM_FOUND" = false ]; then
  printf "  ✗ ${I18N_BOOTSTRAP_DEPS_MISSING:-Missing '%s' (required). Install it and re-run env:init.}\n" "npm/pnpm/yarn/bun" >&2
  exit 1
fi
unset _PM_FOUND _pm_bin
# Detect the consumer's package manager for use in §7 memory steps.
PM="$(node brain/scripts/lib/pm.mjs name 2>/dev/null || echo npm)"
ok "$(printf "${I18N_BOOTSTRAP_DEPS_OK:-git, python3 present; package manager: %s}" "$PM")"

# --- 2. Ecosystem tools (degrade gracefully) ----------------------------------
say "$I18N_BOOTSTRAP_ECOSYSTEM_SECTION"

# Install hints per tool (Ubuntu/Debian)
declare -A INSTALL_HINT
INSTALL_HINT[$VCS_CLI]="npm run tools:install"
INSTALL_HINT[gentle-ai]="curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash"
INSTALL_HINT[engram]="gentle-ai install  (requires gentle-ai)"
INSTALL_HINT[gga]="gentle-ai install  (requires gentle-ai)"
INSTALL_HINT[claude]="npm install -g @anthropic-ai/claude-code"

MISSING_OPTIONAL=()
for tool in "$VCS_CLI" engram gentle-ai gga claude; do
  if command -v "$tool" >/dev/null 2>&1; then
    ok "$tool"
  else
    warn "$(printf "$I18N_BOOTSTRAP_ECOSYSTEM_NOTFOUND" "$tool" "${INSTALL_HINT[$tool]:-npm run tools:install}")"
    MISSING_OPTIONAL+=("$tool")
  fi
done

# --- 3. Personal PAT in .env --------------------------------------------------
say "$I18N_BOOTSTRAP_PAT_SECTION"
VCS_TOKEN="$(env_get "$VCS_TOKEN_VAR")"
if [ -n "$VCS_TOKEN" ]; then
  ok "$(printf "$I18N_BOOTSTRAP_PAT_ALREADYSET" "$VCS_TOKEN_VAR")"
elif [ ! -t 0 ]; then
  warn "$(printf "$I18N_BOOTSTRAP_PAT_NOTTY" "$VCS_TOKEN_VAR")"
else
  cat <<'EOT'
  You need a Personal Access Token from your Git hosting provider.
  It must be PERSONAL — not a project bot token — so your pushes, issues and
  MRs/PRs appear under your name.
EOT
  PAT_URL="$(node brain/scripts/vcs/cli.mjs pat-setup-url "{\"host\":\"$VCS_HOST\",\"name\":\"brain-dev\",\"scopes\":[\"$PAT_SCOPES\"]}" 2>/dev/null || true)"
  read -r -p "  $I18N_BOOTSTRAP_PAT_OPENPROMPT" OPEN_BROWSER
  case "${OPEN_BROWSER:-S}" in
    n|N)
      printf "  $I18N_BOOTSTRAP_PAT_MANUALURL\n" "$PAT_URL"
      ;;
    *)
      if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$PAT_URL" >/dev/null 2>&1 || true
      elif command -v open >/dev/null 2>&1; then
        open "$PAT_URL" >/dev/null 2>&1 || true
      fi
      printf "  $I18N_BOOTSTRAP_PAT_BROWSERFALLBACK\n" "$PAT_URL"
      ;;
  esac
  read -r -s -p "  $I18N_BOOTSTRAP_PAT_ENTERPROMPT" VCS_TOKEN
  echo
  if [ -z "$VCS_TOKEN" ]; then
    warn "$I18N_BOOTSTRAP_PAT_SKIPPED"
  else
    env_set "$VCS_TOKEN_VAR" "$VCS_TOKEN"
    ok "$(printf "$I18N_BOOTSTRAP_PAT_SAVED" "$VCS_TOKEN_VAR")"
  fi
fi
if [ -n "$VCS_TOKEN" ]; then export "$VCS_TOKEN_VAR=$VCS_TOKEN"; fi

# Export NO_PROXY from .env so Go binaries (VCS CLI) can bypass the internal proxy.
_NO_PROXY="$(env_get NO_PROXY)"
if [ -n "$_NO_PROXY" ]; then
  export NO_PROXY="$_NO_PROXY"
  export no_proxy="$_NO_PROXY"
fi

# --- 4. HTTPS credential helper (repo-local) ----------------------------------
# SSH is blocked at the infra level: only HTTPS works, with username=$VCS_CRED_USER
# and the PAT as password. The helper reads the token from .env on every use —
# nothing is hardcoded in the git config.
say "$I18N_BOOTSTRAP_CRED_SECTION"
HELPER='!f() { . "$(git rev-parse --show-toplevel)/.env" 2>/dev/null; [ -n "${'"$VCS_TOKEN_VAR"':-}" ] || { echo "env:init: '"$VCS_TOKEN_VAR"' vacío en .env" >&2; exit 1; }; echo username='"$VCS_CRED_USER"'; printf "password=%s\n" "${'"$VCS_TOKEN_VAR"'}"; }; f'
git config --local "credential.https://${VCS_HOST}.helper" "$HELPER"
ok "$I18N_BOOTSTRAP_CRED_OK"

# --- 5. VCS CLI authentication -----------------------------------------------
# Token is read from .env by the provider (Part A of the VCS adapter) —
# NOT passed in argv to avoid leaking it via /proc/*/cmdline.
say "$I18N_BOOTSTRAP_AUTH_SECTION"
if node brain/scripts/vcs/cli.mjs auth-check "{\"host\":\"$VCS_HOST\"}" >/dev/null 2>&1; then
  ok "$(printf "$I18N_BOOTSTRAP_AUTH_ALREADYOK" "$VCS_HOST")"
elif [ -n "$VCS_TOKEN" ]; then
  node brain/scripts/vcs/cli.mjs auth-login "{\"host\":\"$VCS_HOST\"}" \
    && ok "$(printf "$I18N_BOOTSTRAP_AUTH_OK" "$VCS_HOST")" \
    || warn "$I18N_BOOTSTRAP_AUTH_FAILED"
else
  warn "$I18N_BOOTSTRAP_AUTH_NOTOKEN"
fi

# --- 6. SDD implementation (replaceable harness, ADR-0012) --------------------
# Harness-specific init is now delegated to brain/scripts/harness/cli.mjs, which
# dispatches to brain/scripts/harness/backends/<SDD_HARNESS>.mjs. Adding a new
# harness requires only a new backend module — no edits to this file.
# Mirrors the memory (ADR-0004) and VCS (ADR-0008) adapter patterns.
# Runs BEFORE the memory sync so the ecosystem (skills, engram, gga) is
# ready when memory is imported.
say "$I18N_BOOTSTRAP_SDD_SECTION"
SDD_HARNESS="$(env_get SDD_HARNESS)"
if [ -z "$SDD_HARNESS" ]; then
  if [ -t 0 ]; then
    read -r -p "  $I18N_BOOTSTRAP_SDD_PROMPT" SDD_HARNESS
  fi
  SDD_HARNESS="${SDD_HARNESS:-gentle-ai}"
  env_set SDD_HARNESS "$SDD_HARNESS"
fi
ok "$(printf "$I18N_BOOTSTRAP_SDD_OK" "$SDD_HARNESS")"
node brain/scripts/harness/cli.mjs init \
  || warn "$I18N_BOOTSTRAP_SDD_INITFAILED"

# --- 7. Team memory (replaceable backend, ADR-0003) --------------------------
# MEMORY_BACKEND mirrors the SDD_HARNESS pattern from §6: read from .env,
# prompt on TTY if unset, default to "engram".
say "$I18N_BOOTSTRAP_MEMORY_SECTION"
MEMORY_BACKEND="$(env_get MEMORY_BACKEND)"
if [ -z "$MEMORY_BACKEND" ]; then
  if [ -t 0 ]; then
    read -r -p "  $I18N_BOOTSTRAP_MEMORY_PROMPT" MEMORY_BACKEND
  fi
  MEMORY_BACKEND="${MEMORY_BACKEND:-engram}"
  env_set MEMORY_BACKEND "$MEMORY_BACKEND"
fi
ok "$(printf "$I18N_BOOTSTRAP_MEMORY_BACKEND" "$MEMORY_BACKEND")"

git config core.hooksPath brain/scripts/hooks \
  && ok "$I18N_BOOTSTRAP_MEMORY_HOOKOK" \
  || warn "$I18N_BOOTSTRAP_MEMORY_HOOKFAILED"

case "$MEMORY_BACKEND" in
  engram)
    # Delegate setup (symlink + merge driver) to the backend module — no duplication.
    if command -v node >/dev/null 2>&1; then
      node brain/scripts/memory/cli.mjs setup \
        && ok "$I18N_BOOTSTRAP_MEMORY_ENGRAM_OK" \
        || warn "$I18N_BOOTSTRAP_MEMORY_ENGRAM_FAILED"
    else
      warn "$I18N_BOOTSTRAP_MEMORY_NODEABSENT"
    fi
    $PM run --silent memory:pull  && ok "$I18N_BOOTSTRAP_MEMORY_PULL_OK"  || warn "$I18N_BOOTSTRAP_MEMORY_PULL_FAILED"
    $PM run --silent memory:index && ok "$I18N_BOOTSTRAP_MEMORY_INDEX_OK" || warn "$I18N_BOOTSTRAP_MEMORY_INDEX_FAILED"
    ;;
  *)
    warn "$(printf "$I18N_BOOTSTRAP_MEMORY_UNKNOWNBACKEND" "$MEMORY_BACKEND")"
    ;;
esac

# --- 8. Open tickets: starting point -----------------------------------------
say "$(printf "$I18N_BOOTSTRAP_BOARD_SECTION" "$PROJECT_PATH")"
node brain/scripts/tracker-board.mjs \
  || warn "$(printf "$I18N_BOOTSTRAP_BOARD_FAILED" "$VCS_HOST" "$PROJECT_PATH")"

# --- 9. Next steps ------------------------------------------------------------
say "$I18N_BOOTSTRAP_DONE_SECTION"
cat <<'EOT'
  Next steps:
    1. Read brain/HOME.md — the entry point to all project knowledge.
    2. Every morning: brain:day:start
       (pulls memory, shows open tickets, checks for brain updates)
    3. Pick a ticket and create your branch: {type}/issue-{iid}-{slug}.
    4. Plan a feature with SDD: brain:project:feature -- --issue [ID]
    5. Before pushing: brain:repo:check && npm run memory:share
EOT
if [ "${#MISSING_OPTIONAL[@]}" -gt 0 ]; then
  printf "  $I18N_BOOTSTRAP_DONE_PENDING\n" "${MISSING_OPTIONAL[*]}"
  printf '  %s\n' "$I18N_BOOTSTRAP_DONE_INSTALL"
fi

# --- ADMIN ONLY (one-time) -------------------------------------------------------
# Branch protection is a repo setting, not a per-developer concern.
# After S3 of the governance change merges to the tracker branch, a repo admin
# must run:
#
#   npm run brain:protect
#
# This activates protection on main (required status checks + ≥1 review + no
# force-push). It is idempotent and requires repo-admin permissions.
# See brain/core/methodology/workflow-governance.md for recovery steps.
# ---------------------------------------------------------------------------------
