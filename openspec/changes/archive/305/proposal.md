---
status: approved
issue: 305
---

# Propuesta — 3-axis-decoupling (issue 305)

## Qué
Desacoplar la variable overloaded `SDD_HARNESS` en 3 ejes de configuración independientes (`AGENT_PLATFORM`, `SDD_ENGINE`, `MEMORY_BACKEND`), e implementar la emisión determinística de hooks de espacio de trabajo nativos (`.gemini/settings.json` para Antigravity y `.claude/settings.json` para Claude Code).

## Por qué
Actualmente `SDD_HARNESS` sobrecarga dos conceptos distintos: la plataforma del agente/runtime de LLM y el motor de implementación SDD. Confiar únicamente en la interpretación de prompts de texto (`AGENTS.md`) para invocar `brain:session:start` es probabilístico. Para garantizar una ejecución determinística sin vendor lock-in, la arquitectura del sistema debe separar responsabilidades en 3 ejes ortogonales y emitir hooks nativos de infraestructura por plataforma.

## Alcance
- **Incluye**:
  - Refactor de resolución en `bootstrap.sh` y `brain/scripts/harness/cli.mjs` para resolver los 3 ejes de forma independiente (`AGENT_PLATFORM`, `SDD_ENGINE`, `MEMORY_BACKEND`).
  - Extensión del backend de plataforma Antigravity (`brain/scripts/harness/backends/antigravity.mjs`) para emitir `.gemini/settings.json` con hooks de `SessionStart` (`npm run brain:session:start`) y `PreToolUse` (bloqueo de `--no-verify`).
  - Backend de plataforma Claude (`brain/scripts/harness/backends/claude.mjs`) para emitir `.claude/settings.json`.
  - Actualización del manifiesto de distribución (`brain/core/managed-paths.mjs`) para incluir `.gemini/settings.json`.
  - *Drift-guards* en tests para verificar sintaxis y byte-equality de la emisión de settings.
- **No incluye**:
  - Cambios en el motor de memoria subyacente de engram.
  - Soportar nuevos motores de SDD adicionales a `gentle-ai` y `plain`.

