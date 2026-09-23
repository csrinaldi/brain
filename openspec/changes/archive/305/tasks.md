---
status: approved
issue: 305
---

# Tareas — 3-axis-decoupling (issue 305)

- [x] **Tarea 1**: Actualizar `brain/core/managed-paths.mjs` para incluir `.gemini/settings.json` y actualizar sus tests (`managed-paths.test.mjs`).
- [x] **Tarea 2**: Refactorizar resolución en `brain/scripts/harness/cli.mjs` y `bootstrap.sh` para soportar `AGENT_PLATFORM`, `SDD_ENGINE` y `MEMORY_BACKEND`.
- [x] **Tarea 3**: Extender `brain/scripts/harness/backends/antigravity.mjs` para compilar y emitir `.gemini/settings.json`.
- [x] **Tarea 4**: Formalizar `brain/scripts/harness/backends/claude.mjs` para compilar y emitir `.claude/settings.json`.
- [x] **Tarea 5**: Crear/actualizar unit tests y drift-guards (`antigravity.test.mjs`, `antigravity.drift.test.mjs`, `cli.test.mjs`).
- [x] **Tarea 6**: Ejecutar `npm run brain:repo:check` y la suite de tests completa para verificar todo en verde.

## Micro-decisiones en caliente

