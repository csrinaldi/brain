# ADR-0002 — Memoria de Equipo Git-Based en Dos Capas

**Estado**: Accepted  
**Fecha**: 2026-06-26

## Contexto

La memoria de equipo necesita dos propiedades aparentemente contradictorias:

- **Viva**: accesible en tiempo real por los agentes IA durante una sesión.
- **Durable**: recuperable sin la implementación (sin engram, sin engram CLI, sin internet), solo con `git clone`.

Un único mecanismo no puede satisfacer ambas. Engram (la implementación default) es rápido para búsqueda semántica pero escribe a un directorio local que no es un artefacto git estándar.

## Decisión

La memoria opera en dos capas:

1. **`.memory/` (durable)**: directorio versionado en git. Contiene chunks content-addressed (`.memory/chunks/`) y un manifiesto (`.memory/manifest.json`). Es la fuente de verdad recuperable. El merge driver (`scripts/merge-engram-manifest.mjs`) resuelve conflictos en el manifiesto.

2. **Backend de memoria (viva)**: implementación elegida por `MEMORY_BACKEND`. Engram indexa `.memory/` en su store local para búsqueda semántica. El symlink `.engram → .memory` (creado por `scripts/memory/backends/engram.mjs setup`) es necesario porque el CLI de engram no tiene flag de directorio configurable.

El flujo canónico:
- `memory:pull` → importa `.memory/` al backend activo.
- `memory:index` → reproyecta `brain/` durable al backend activo.
- `memory:share` → materializa el backend activo a `.memory/` antes del push.
- El hook `pre-push` ejecuta `memory:share` automáticamente.

## Consecuencias

- **Positivo**: el conocimiento del equipo sobrevive a cualquier rotación de herramientas.
- **Positivo**: `git log .memory/` muestra la historia de la memoria.
- **Negativo**: el manifiesto es un punto de conflicto en merges concurrentes — el merge driver es obligatorio.
- **Negativo**: el symlink `.engram → .memory` es una solución de workaround al límite de engram CLI; si engram implementa `--dir`, el symlink se elimina.
