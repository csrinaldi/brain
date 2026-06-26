#!/usr/bin/env bash
# install-tools.sh — Installs the full development ecosystem on Ubuntu/Debian.
#
# Idempotent: skips already-installed tools.
# Run once per machine, before npm run env:init.
# Usage: bash scripts/install-tools.sh
#        npm run tools:install
set -euo pipefail

say()    { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
ok()     { printf '  ✓ %s\n' "$1"; }
warn()   { printf '  ⚠ %s\n' "$1"; }
skip()   { printf '  → %s (ya instalado)\n' "$1"; }
die()    { printf '\n  ✗ %s\n' "$1" >&2; exit 1; }

# ── Verify distro ─────────────────────────────────────────────────────────────
if ! command -v apt-get >/dev/null 2>&1; then
  die "Este script requiere apt-get (Ubuntu/Debian). Instalá las herramientas manualmente según brain/project/methodology/developer-environment.md."
fi

# ── Resolve VCS provider from brain.config.json (defaults to gitlab) ──────────
# node may not be installed yet — the || echo 'gitlab' fallback handles that case.
VCS_PROVIDER="$(node -p "(require('./brain.config.json').vcs||{}).provider||'gitlab'" 2>/dev/null || echo 'gitlab')"
case "$VCS_PROVIDER" in
  github) VCS_CLI="gh" ;;
  *)      VCS_CLI="glab" ;;
esac

# ── 1. apt packages ───────────────────────────────────────────────────────────
# The VCS CLI is handled separately (§1b): gh is not in the default Debian/Ubuntu
# apt repos, so a blanket `apt install gh` would abort under `set -e`.
say "Paquetes del sistema (apt)"
APT_PKGS=(git curl wget python3 openjdk-17-jdk maven)
MISSING_APT=()
for pkg in "${APT_PKGS[@]}"; do
  if dpkg -s "$pkg" >/dev/null 2>&1; then
    skip "$pkg"
  else
    MISSING_APT+=("$pkg")
  fi
done
if [ "${#MISSING_APT[@]}" -gt 0 ]; then
  echo "  Instalando: ${MISSING_APT[*]}"
  sudo apt-get update -qq
  sudo apt-get install -y "${MISSING_APT[@]}"
  ok "apt: ${MISSING_APT[*]}"
else
  ok "todos los paquetes apt ya presentes"
fi

# ── 1b. VCS CLI (gh / glab) ───────────────────────────────────────────────────
# Installed apart from the apt batch: gh may be absent from the default repos, so
# we try apt and fall back to printed install instructions (no abort under set -e).
say "CLI del VCS ($VCS_CLI)"
if command -v "$VCS_CLI" >/dev/null 2>&1; then
  skip "$VCS_CLI"
elif sudo apt-get install -y "$VCS_CLI" 2>/dev/null; then
  ok "$VCS_CLI instalado"
else
  warn "$VCS_CLI no está en apt — instalalo a mano:"
  if [ "$VCS_CLI" = "gh" ]; then
    printf '    https://github.com/cli/cli/blob/trunk/docs/install_linux.md\n'
  else
    printf '    https://gitlab.com/gitlab-org/cli#installation\n'
  fi
fi

# ── 2. Node.js via nvm ────────────────────────────────────────────────────────
say "Node.js (nvm)"
if command -v node >/dev/null 2>&1; then
  skip "node $(node --version)"
else
  NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -d "$NVM_DIR" ]; then
    echo "  Instalando nvm..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    ok "nvm instalado"
  fi
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install --lts
  nvm use --lts
  ok "node $(node --version) via nvm"
  warn "Abrí una terminal nueva o ejecutá: source ~/.bashrc"
fi

# ── 3. Claude Code ────────────────────────────────────────────────────────────
say "Claude Code (CLI de Anthropic)"
if command -v claude >/dev/null 2>&1; then
  skip "claude $(claude --version 2>/dev/null | head -1)"
else
  npm install -g @anthropic-ai/claude-code
  ok "claude instalado"
fi

# ── 4. gentle-ai (manages engram + gga + skills) ──────────────────────────────
say "gentle-ai + ecosistema (engram, gga)"
if command -v gentle-ai >/dev/null 2>&1; then
  skip "gentle-ai $(gentle-ai --version 2>/dev/null | head -1)"
else
  echo "  Instalando gentle-ai..."
  curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash
  ok "gentle-ai instalado"
fi

# gentle-ai install configures engram, gga and the SDD harness skills.
# Idempotent: confirms if already configured.
if command -v gentle-ai >/dev/null 2>&1; then
  if gentle-ai doctor 2>/dev/null | grep -q 'state file OK'; then
    skip "ecosistema gentle-ai ya configurado"
  else
    echo "  Configurando ecosistema (engram, gga, skills)..."
    gentle-ai install && ok "ecosistema configurado" || warn "gentle-ai install falló — reintentá a mano"
  fi
fi

# ── 5. Summary ────────────────────────────────────────────────────────────────
say "Instalación completa"
printf '  Siguiente paso:\n'
printf '    npm install && npm run env:init\n\n'
printf '  Verifica versiones:\n'
for tool in git java maven node npm claude gentle-ai engram gga "$VCS_CLI"; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf '    ✓ %-14s' "$tool"
    "$tool" --version 2>/dev/null | head -1 | sed 's/^//' || true
    echo
  else
    printf '    ✗ %s  (no encontrado — reiniciá la terminal)\n' "$tool"
  fi
done
