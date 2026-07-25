---
status: approved
issue: 305
---

# Spec — 3-axis-decoupling (issue 305)

## Requisitos delta

### REQ-3AX-1: Desacoplamiento de ejes de configuración
- `resolvePlatform({ env, envVars, config })` resuelve `AGENT_PLATFORM`: `antigravity | claude | openai | opencode | pi | plain` (default: `antigravity`).
- `resolveEngine({ env, envVars, config })` resuelve `SDD_ENGINE`: `gentle-ai | plain` (default: `gentle-ai`).
- `resolveMemory({ env, envVars, config })` resuelve `MEMORY_BACKEND`: `engram | plainfiles` (default: `engram`).
- `SDD_HARNESS` se mantiene como alias retrocompatible que mapea el motor o plataforma según aplique.

### REQ-3AX-2: Emisión determinística de hooks en Antigravity
- El backend `antigravity.mjs#init()` debe emitir `AGENTS.md` y `.gemini/settings.json`.
- El archivo `.gemini/settings.json` debe definir:
  - Hooks de `SessionStart` invocando `npm run brain:session:start`.
  - Hooks de `PreToolUse` impidiendo `git commit --no-verify` / `git commit -n`.

### REQ-3AX-3: Emisión determinística de hooks en Claude
- El backend `claude.mjs#init()` debe emitir `.claude/settings.json`.

### REQ-3AX-4: Manifiesto de distribución actualizado
- `managed-paths.mjs` incluye `.gemini/settings.json` en la lista `managed`.

### REQ-3AX-5: Drift-guards de CI
- Unit tests y drift tests validan que la salida compilada de `.gemini/settings.json` y `.claude/settings.json` pase la validación de JSON y concuerde con las especificaciones.

## Escenarios

### ESC-1: Inicialización con Antigravity como plataforma
- **GIVEN** la variable `AGENT_PLATFORM=antigravity` (o por defecto).
- **WHEN** se ejecuta `npm run brain:env:init` / `harness:cli init`.
- **THEN** se compila `AGENTS.md` y se escribe `.gemini/settings.json` con el hook de `SessionStart` (`npm run brain:session:start`).

### ESC-2: Compatibilidad hacia atrás con `SDD_HARNESS`
- **GIVEN** un entorno legado con `SDD_HARNESS=antigravity` en `.env`.
- **WHEN** el CLI resuelve la plataforma y el motor.
- **THEN** infiere `AGENT_PLATFORM=antigravity` y `SDD_ENGINE=gentle-ai` sin romper la ejecución.

