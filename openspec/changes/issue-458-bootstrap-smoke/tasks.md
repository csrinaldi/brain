---
status: draft
issue: 458
---

# Tareas — bootstrap-smoke (issue 458)

- [x] Resolver #590 primero, para decidir la ubicación con marco en vez de adivinarla
- [x] Medir los tres verbos en un fixture fresco: los tres salen 0 offline
- [x] Harness `test/bootstrap-smoke/smoke.mjs` + README
- [x] Workflow propio con `timeout-minutes`, no requerido, guard `.brain-source`
- [x] Replay de #446 → exit 127 y 6 aserciones rojas (criterio de aceptación 1)
- [x] Prueba por mutación: 6 mutaciones, cada diff impreso, releído de disco y revertido
- [x] `npm test`, `brain:repo:check`, `brain:nav` verdes con el workflow puesto
- [x] Re-verificar el replay a través del entry point final

## Micro-decisiones en caliente

Ver `design.md`.

## Fuera de alcance, reportado

- `.env` no es byte-idempotente entre corridas de `env:init` (reordena claves).
  Lo escribe `brain/scripts/bootstrap.sh`, fuera del reclamo. Merece ticket.
- Sin alias en `package.json` (fuera del reclamo): el workflow invoca por path.
