# ADR-0004 — Adapter de Memoria: MEMORY_BACKEND Selector + Dispatch

**Estado**: Accepted  
**Fecha**: 2026-06-26

## Contexto

La memoria de equipo necesita una implementación concreta para búsqueda semántica (engram, por defecto), pero acoplar todos los scripts a engram directamente impide cambiar de backend sin tocar múltiples archivos.

El patrón de harness reemplazable (ADR-0001) debe aplicarse simétricamente a la memoria.

## Decisión

La memoria sigue el mismo patrón adapter que el harness:

- **Selector**: `MEMORY_BACKEND` en `.env`. Default: `engram`.
- **Dispatcher**: `scripts/memory/cli.mjs`. Punto único de entrada. Lee `MEMORY_BACKEND` y delega a la implementación correspondiente. Verbos: `index`, `share`, `pull`, `setup`.
- **Backend**: `scripts/memory/backends/engram.mjs`. Encapsula todo lo específico de engram: la invocación del CLI binario, la creación del symlink `.engram → .memory` (necesario porque engram no tiene flag `--dir`), y el registro del merge driver.
- **Canónico**: `.memory/` es el directorio git real. El symlink `.engram → .memory` es un detalle de implementación del backend engram, no del sistema.

Para agregar un nuevo backend: crear `scripts/memory/backends/<nombre>.mjs` y agregar un `case` en `scripts/memory/cli.mjs`.

## Consecuencias

- **Positivo**: cambiar de backend de memoria = cambiar `MEMORY_BACKEND` en `.env` + `npm run env:init`.
- **Positivo**: el symlink `.engram → .memory` queda encapsulado en el backend — si engram agrega soporte de `--dir`, se elimina solo ahí.
- **Negativo**: añadir un backend nuevo requiere implementar todos los verbos (`index`, `share`, `pull`, `setup`) — no hay interfaz formal hoy, solo convención.
- **Negativo**: el manifiesto `.memory/manifest.json` sigue siendo necesario para todos los backends que usen la capa durable git.
