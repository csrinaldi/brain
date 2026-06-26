#!/usr/bin/env bash
# bootstrap.sh — interactive development environment setup (verb: npm run env:init)
#
# Leaves a fresh clone operational: personal PAT in .env, HTTPS credential helper
# at repo level, VCS CLI authenticated, SDD harness chosen and initialized,
# team memory imported and indexed, and open tickets as a starting point.
# Idempotent: running again only completes what is missing.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

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

# Per-provider constants: token env var, credential helper username, PAT scope, CLI binary.
case "$VCS_PROVIDER" in
  github)
    VCS_TOKEN_VAR="GITHUB_TOKEN"
    VCS_CRED_USER="x-access-token"
    PAT_SCOPES="repo"
    VCS_CLI="gh"
    ;;
  *)
    # Default: gitlab (covers empty provider or explicit "gitlab").
    VCS_TOKEN_VAR="GITLAB_TOKEN"
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

# --- 1. Base dependencies (blocking) -----------------------------------------
say "Dependencias base"
for tool in git npm python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "  ✗ Falta '$tool' (requerido). Instalalo y volvé a correr env:init." >&2; exit 1; }
done
ok "git, npm, python3 presentes"

# --- 2. Ecosystem tools (degrade gracefully) ----------------------------------
say "Herramientas del ecosistema"

# Install hints per tool (Ubuntu/Debian)
declare -A INSTALL_HINT
INSTALL_HINT[$VCS_CLI]="npm run tools:install"
INSTALL_HINT[gentle-ai]="curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash"
INSTALL_HINT[engram]="gentle-ai install  (requiere gentle-ai)"
INSTALL_HINT[gga]="gentle-ai install  (requiere gentle-ai)"
INSTALL_HINT[claude]="npm install -g @anthropic-ai/claude-code"

MISSING_OPTIONAL=()
for tool in "$VCS_CLI" engram gentle-ai gga claude; do
  if command -v "$tool" >/dev/null 2>&1; then
    ok "$tool"
  else
    warn "$tool no encontrado — ${INSTALL_HINT[$tool]:-npm run tools:install}"
    MISSING_OPTIONAL+=("$tool")
  fi
done

# --- 3. Personal PAT in .env --------------------------------------------------
say "Token personal de acceso (.env)"
VCS_TOKEN="$(env_get "$VCS_TOKEN_VAR")"
if [ -n "$VCS_TOKEN" ]; then
  ok "$VCS_TOKEN_VAR ya configurado en .env"
elif [ ! -t 0 ]; then
  warn "sin TTY: agregá $VCS_TOKEN_VAR a .env y volvé a correr env:init"
else
  cat <<'EOT'
  You need a Personal Access Token from your Git hosting provider.
  It must be PERSONAL — not a project bot token — so your pushes, issues and
  MRs/PRs appear under your name.
EOT
  PAT_URL="$(node scripts/vcs/cli.mjs pat-setup-url "{\"host\":\"$VCS_HOST\",\"name\":\"brain-dev\",\"scopes\":[\"$PAT_SCOPES\"]}" 2>/dev/null || true)"
  read -r -p "  ¿Abro el navegador con el formulario pre-llenado? [S/n]: " OPEN_BROWSER
  case "${OPEN_BROWSER:-S}" in
    n|N)
      printf '  Crealo a mano en: %s\n' "$PAT_URL"
      ;;
    *)
      if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$PAT_URL" >/dev/null 2>&1 || true
      elif command -v open >/dev/null 2>&1; then
        open "$PAT_URL" >/dev/null 2>&1 || true
      fi
      printf '  Si el navegador no se abrió, entrá a: %s\n' "$PAT_URL"
      ;;
  esac
  read -r -s -p "  Pegá tu PAT (no se muestra): " VCS_TOKEN
  echo
  if [ -z "$VCS_TOKEN" ]; then
    warn "Sin token: se salta la autenticación del VCS. Volvé a correr env:init cuando lo tengas."
  else
    env_set "$VCS_TOKEN_VAR" "$VCS_TOKEN"
    ok "$VCS_TOKEN_VAR guardado en .env (gitignored)"
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
say "Credential helper de git (HTTPS)"
HELPER='!f() { . "$(git rev-parse --show-toplevel)/.env" 2>/dev/null; [ -n "${'"$VCS_TOKEN_VAR"':-}" ] || { echo "env:init: '"$VCS_TOKEN_VAR"' vacío en .env" >&2; exit 1; }; echo username='"$VCS_CRED_USER"'; printf "password=%s\n" "${'"$VCS_TOKEN_VAR"'}"; }; f'
git config --local "credential.https://${VCS_HOST}.helper" "$HELPER"
ok "push/pull por HTTPS usan tu PAT personal de .env"

# --- 5. VCS CLI authentication -----------------------------------------------
# Token is read from .env by the provider (Part A of the VCS adapter) —
# NOT passed in argv to avoid leaking it via /proc/*/cmdline.
say "Autenticación del VCS"
if node scripts/vcs/cli.mjs auth-check "{\"host\":\"$VCS_HOST\"}" >/dev/null 2>&1; then
  ok "ya autenticado contra $VCS_HOST"
elif [ -n "$VCS_TOKEN" ]; then
  node scripts/vcs/cli.mjs auth-login "{\"host\":\"$VCS_HOST\"}" \
    && ok "autenticado contra $VCS_HOST" \
    || warn "auth falló — verificá el token en .env"
else
  warn "Sin token: VCS queda sin autenticar"
fi

# --- 6. SDD implementation (replaceable harness, ADR-0002) --------------------
# The harness is a per-developer choice, not hardcoded in the repo. Its init
# configures the full ecosystem (for gentle-ai: skills, engram and gga), so it
# runs BEFORE the memory sync.
say "Implementación SDD (harness)"
SDD_HARNESS="$(env_get SDD_HARNESS)"
if [ -z "$SDD_HARNESS" ]; then
  if [ -t 0 ]; then
    read -r -p "  ¿Qué implementación SDD usás? [gentle-ai]: " SDD_HARNESS
  fi
  SDD_HARNESS="${SDD_HARNESS:-gentle-ai}"
  env_set SDD_HARNESS "$SDD_HARNESS"
fi
ok "harness: $SDD_HARNESS (.env)"
case "$SDD_HARNESS" in
  gentle-ai)
    if ! command -v gentle-ai >/dev/null 2>&1; then
      warn "gentle-ai ausente — brew install gentle-ai y volvé a correr env:init"
    elif gentle-ai doctor 2>/dev/null | grep -q 'state file OK'; then
      ok "ecosistema ya inicializado (gentle-ai doctor)"
    elif [ -t 0 ]; then
      # interactive and self-updating: configures skills, engram and gga
      gentle-ai install \
        && ok "ecosistema configurado (skills, engram, gga)" \
        || warn "gentle-ai install falló — corrélo a mano y volvé a correr env:init"
    else
      warn "sin TTY: corré 'gentle-ai install' manualmente"
    fi
    if command -v gentle-ai >/dev/null 2>&1; then
      gentle-ai skill-registry refresh >/dev/null 2>&1 && ok "skill registry actualizado" || warn "skill-registry refresh falló (no bloqueante)"
    fi
    ;;
  *)
    warn "harness '$SDD_HARNESS' sin rutina de init conocida — configurá sus skills a mano"
    ;;
esac

# --- 7. Team memory (replaceable backend, ADR-0003) --------------------------
# MEMORY_BACKEND mirrors the SDD_HARNESS pattern from §6: read from .env,
# prompt on TTY if unset, default to "engram".
say "Memoria de equipo"
MEMORY_BACKEND="$(env_get MEMORY_BACKEND)"
if [ -z "$MEMORY_BACKEND" ]; then
  if [ -t 0 ]; then
    read -r -p "  ¿Qué backend de memoria usás? [engram]: " MEMORY_BACKEND
  fi
  MEMORY_BACKEND="${MEMORY_BACKEND:-engram}"
  env_set MEMORY_BACKEND "$MEMORY_BACKEND"
fi
ok "backend de memoria: $MEMORY_BACKEND (.env)"

git config core.hooksPath scripts/hooks \
  && ok "pre-push hook activado (materializa .memory/ antes del push — ADR-0003)" \
  || warn "no se pudo activar core.hooksPath (pre-push hook)"

case "$MEMORY_BACKEND" in
  engram)
    # Delegate setup (symlink + merge driver) to the backend module — no duplication.
    if command -v node >/dev/null 2>&1; then
      node scripts/memory/cli.mjs setup \
        && ok "backend engram configurado (symlink + merge driver)" \
        || warn "memory setup falló (no bloqueante)"
    else
      warn "node ausente — setup del backend engram salteado"
    fi
    npm run --silent memory:pull  && ok "memoria importada (.memory/ → engram)"  || warn "memory:pull falló (no bloqueante)"
    npm run --silent memory:index && ok "índice durable reproyectado (brain/ → engram)" || warn "memory:index falló (no bloqueante)"
    ;;
  *)
    warn "backend '$MEMORY_BACKEND' sin rutina de init conocida — configuralo a mano"
    ;;
esac

# --- 8. Open tickets: starting point -----------------------------------------
say "Tickets abiertos en $PROJECT_PATH"
node scripts/tracker-board.mjs \
  || warn "no se pudo listar tickets — mirá https://${VCS_HOST}/${PROJECT_PATH}"

# --- 9. Next steps ------------------------------------------------------------
say "Entorno listo"
cat <<'EOT'
  Next steps:
    1. Read brain/HOME.md — the entry point to all project knowledge.
    2. Every morning: npm run day:start
       (pulls memory, shows open tickets, checks for brain updates)
    3. Pick a ticket and create your branch: {type}/issue-{iid}-{slug}.
    4. Plan a feature with SDD: npm run project:feature -- --issue [ID]
    5. Before pushing: npm run repo:check && npm run memory:share
EOT
if [ "${#MISSING_OPTIONAL[@]}" -gt 0 ]; then
  printf '  Pendiente: %s\n' "${MISSING_OPTIONAL[*]}"
  printf '  Corré: npm run tools:install  (instala todo de una)\n'
fi
