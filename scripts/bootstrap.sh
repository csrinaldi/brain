#!/usr/bin/env bash
# bootstrap.sh — entrypoint interactivo del entorno de desarrollo (verbo: npm run env:init)
#
# Deja un clone fresco operativo: PAT personal en .env, credential helper HTTPS
# oauth2 a nivel repo, glab autenticado, harness SDD elegido e inicializado,
# memoria de equipo importada e indexada, y tickets abiertos como punto de
# partida. Idempotente: correrlo de nuevo solo completa lo que falte.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Read project identity from brain.config.json (single source of truth).
# Done after cd to REPO_ROOT so the relative path resolves regardless of the
# caller's cwd (npm run env:init or `bash scripts/bootstrap.sh` from anywhere).
# node -p prints the expression result; require() parses the JSON synchronously.
GITLAB_HOST="$(node -p "require('./brain.config.json').project.gitHost")"
PROJECT_PATH="$(node -p "require('./brain.config.json').project.slug")"
export GITLAB_HOST

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

# --- 1. Dependencias base (bloqueantes) --------------------------------------
say "Dependencias base"
for tool in git npm python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "  ✗ Falta '$tool' (requerido). Instalalo y volvé a correr env:init." >&2; exit 1; }
done
ok "git, npm, python3 presentes"

# --- 2. Herramientas opcionales (degradan con gracia) ------------------------
say "Herramientas del ecosistema"

# Comandos de instalación por herramienta (Ubuntu/Debian)
declare -A INSTALL_HINT
INSTALL_HINT[glab]="sudo apt install glab"
INSTALL_HINT[gentle-ai]="curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash"
INSTALL_HINT[engram]="gentle-ai install  (requiere gentle-ai)"
INSTALL_HINT[gga]="gentle-ai install  (requiere gentle-ai)"
INSTALL_HINT[claude]="npm install -g @anthropic-ai/claude-code"

MISSING_OPTIONAL=()
for tool in glab engram gentle-ai gga claude; do
  if command -v "$tool" >/dev/null 2>&1; then
    ok "$tool"
  else
    warn "$tool no encontrado — ${INSTALL_HINT[$tool]:-npm run tools:install}"
    MISSING_OPTIONAL+=("$tool")
  fi
done

# --- 3. PAT personal en .env --------------------------------------------------
say "Token personal de GitLab (.env)"
GITLAB_TOKEN="$(env_get GITLAB_TOKEN)"
if [ -n "$GITLAB_TOKEN" ]; then
  ok "GITLAB_TOKEN ya configurado en .env"
elif [ ! -t 0 ]; then
  warn "sin TTY: agregá GITLAB_TOKEN a .env y volvé a correr env:init"
else
  cat <<'EOT'
  You need a Personal Access Token (scope: api) from your Git hosting provider.
  It must be PERSONAL — not a project bot token — so your pushes, issues and
  MRs/PRs appear under your name.
EOT
  # GitLab >= 18 accepts a pre-filled token creation form via querystring.
  # Adjust the URL pattern if using GitHub (Settings → Developer settings → Tokens)
  # or another provider.
  PAT_URL="https://${GITLAB_HOST}/-/user_settings/personal_access_tokens?name=brain-dev&scopes=api"
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
  read -r -s -p "  Pegá tu PAT (no se muestra): " GITLAB_TOKEN
  echo
  if [ -z "$GITLAB_TOKEN" ]; then
    warn "Sin token: se salta auth de GitLab. Volvé a correr env:init cuando lo tengas."
  else
    env_set GITLAB_TOKEN "$GITLAB_TOKEN"
    ok "GITLAB_TOKEN guardado en .env (gitignored)"
  fi
fi
if [ -n "$GITLAB_TOKEN" ]; then export GITLAB_TOKEN; fi

# Exportar NO_PROXY desde .env para que binarios Go (glab) bypaseen el proxy interno.
_NO_PROXY="$(env_get NO_PROXY)"
if [ -n "$_NO_PROXY" ]; then
  export NO_PROXY="$_NO_PROXY"
  export no_proxy="$_NO_PROXY"
fi

# --- 4. Credential helper HTTPS oauth2 (repo-local) ---------------------------
# SSH está bloqueado a nivel infra: solo funciona HTTPS con username=oauth2 +
# token. El helper lee el token de .env en cada uso — nada queda hardcodeado.
say "Credential helper de git (HTTPS oauth2)"
HELPER='!f() { . "$(git rev-parse --show-toplevel)/.env" 2>/dev/null; [ -n "${GITLAB_TOKEN:-}" ] || { echo "env:init: GITLAB_TOKEN vacío en .env" >&2; exit 1; }; echo username=oauth2; printf "password=%s\n" "$GITLAB_TOKEN"; }; f'
git config --local "credential.https://${GITLAB_HOST}.helper" "$HELPER"
ok "push/pull por HTTPS usan tu PAT personal de .env"

# --- 5. glab autenticado -------------------------------------------------------
say "Autenticación de glab"
if ! command -v glab >/dev/null 2>&1; then
  warn "glab ausente — sin listado de tickets ni creación de issues/MRs por CLI"
elif glab auth status --hostname "$GITLAB_HOST" >/dev/null 2>&1; then
  ok "glab ya autenticado contra $GITLAB_HOST"
elif [ -n "$GITLAB_TOKEN" ]; then
  # --stdin keeps the token out of the process list (/proc/*/cmdline)
  printf '%s' "$GITLAB_TOKEN" | glab auth login --hostname "$GITLAB_HOST" --stdin \
    && ok "glab autenticado contra $GITLAB_HOST" \
    || warn "glab auth falló — verificá el token"
else
  warn "Sin token: glab queda sin autenticar"
fi

# --- 6. Implementación SDD (harness reemplazable, ADR-0002) --------------------
# El harness es elección por dev, no hardcodeo del repo. Su init deja el
# ecosistema completo configurado (para gentle-ai: skills, engram y gga), por
# eso corre ANTES de la sincronización de memoria.
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

# --- 7. Memoria de equipo (backend reemplazable, ADR-0003) --------------------
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

# --- 8. Tickets abiertos: tu punto de partida ------------------------------------
say "Tickets abiertos en $PROJECT_PATH"
if command -v glab >/dev/null 2>&1 && glab auth status --hostname "$GITLAB_HOST" >/dev/null 2>&1; then
  _issues=$(glab issue list -R "$PROJECT_PATH" 2>&1) \
    && printf '%s\n' "$_issues" \
    || warn "no se pudo listar tickets (servidor no disponible) — mirá https://${GITLAB_HOST}/${PROJECT_PATH}/-/issues"
else
  warn "glab sin auth — mirá los tickets en https://${GITLAB_HOST}/${PROJECT_PATH}/-/issues"
fi

# --- 9. Próximos pasos -------------------------------------------------------------
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
