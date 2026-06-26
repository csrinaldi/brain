# ADR-0001 — Arquitectura de 3 Capas con Harness Reemplazable

**Estado**: Accepted  
**Fecha**: 2026-06-26

## Contexto

Un sistema de desarrollo asistido por IA necesita tres concerns bien separados:

1. **Artefactos SDD** (propuestas, specs, diseños, tasks): el conocimiento planificado de cada cambio.
2. **Harness SDD**: la herramienta que ejecuta el flujo (propone, verifica, archiva).
3. **Memoria de equipo**: el conocimiento acumulado que trasciende sesiones.

El problema de acoplar estos tres elementos es doble: el equipo queda rehén de una herramienta particular, y el sistema no puede evolucionar cada capa de forma independiente.

## Decisión

El sistema se divide en tres capas independientes:

- **Artefactos SDD (OpenSpec)**: archivos bajo `openspec/` — formato abierto, versionable con git, leíble por cualquier herramienta. Son el contrato duradero.
- **Harness**: elegido por el desarrollador vía `SDD_HARNESS` en `.env`. El harness ejecuta los verbos del contrato (`sdd-new`, `sdd-apply`, `sdd-verify`, etc.) definidos en `brain/core/methodology/harness-contract.md`. Default: `gentle-ai`.
- **Memoria**: elegida vía `MEMORY_BACKEND` en `.env`. Default: `engram`.

El binding entre capas ocurre en UN único punto (`scripts/bootstrap.sh` §6 para el harness, `scripts/memory/cli.mjs` para la memoria). Cambiar de herramienta implica cambiar la variable de entorno y re-correr `env:init`.

## Consecuencias

- **Positivo**: el equipo puede adoptar un harness mejor sin perder artefactos SDD ni historial de memoria.
- **Positivo**: los artefactos en `openspec/` son siempre legibles, incluso sin las herramientas instaladas.
- **Negativo**: el contrato de verbos (`harness-contract.md`) debe mantenerse actualizado cuando se añaden capacidades al flujo SDD.
- **Negativo**: cada harness nuevo requiere un `case` en `bootstrap.sh` §6 y validación manual.
