# ADR-0006 — Distribución: Installer Versionado por Git Tags

**Estado**: Accepted  
**Fecha**: 2026-06-26

## Contexto

`brain/core/` es un producto genérico que múltiples proyectos deberían poder adoptar. Las opciones de distribución son:

- **git subtree**: complejo de mantener, mezcla historial upstream con el repo consumidor.
- **npm registry**: requiere publicar en npmjs.com o un registry privado; overhead burocrático.
- **git tags + npm install**: instala directamente desde GitHub por tag de versión; compatible con repos privados; cero registry.
- **copia manual**: no hay forma de recibir actualizaciones de forma controlada.

## Decisión

La distribución usa **git tags + npm install**:

```bash
npm install --save-dev github:csrinaldi/brain#v1.0.0
```

Esto instala `brain/core/` y los scripts genéricos como una devDependency del proyecto consumidor. La versión queda fijada en `package.json` del consumidor.

**Regla clave**: `brain/core/` es **read-only en el consumidor**. Está en `node_modules/brain/` — no se edita ahí. Las mejoras van upstream (PR al repo brain), luego se actualiza la versión en el consumidor.

**Check-and-notify en day:start**: `scripts/day-start.mjs` verifica si hay una nueva versión de brain disponible y lo notifica. No auto-actualiza — respeta el anti-pattern `instaladores-autoactualizantes-no-inocuos` (ver `brain/core/anti-patterns/`).

**Migración de brain.config.json**: las migraciones son **additivas y se aplican automáticamente** en el upgrade (`brain:upgrade`). Cuando una versión nueva agrega claves al schema, las registra en `brain/core/config-migrations.mjs`; el installer las suma con sus defaults **sin pisar jamás un valor ya seteado por el consumidor** (incluidos valores falsy como `""`, `0`, `false`). El campo `schemaVersion` en `brain.config.json` registra hasta dónde migró. Renombrados/reestructuras (no additivos) usan una función `migrate()` explícita y deben documentarse en el changelog del tag.

## Consecuencias

- **Positivo**: instalación one-liner, sin registry, compatible con repos privados (GitHub).
- **Positivo**: la versión queda explícita en `package.json` del consumidor — upgrades son decisiones conscientes.
- **Positivo**: `git tag` es el mecanismo de release — cero CI complejo para publicar.
- **Positivo (Slice 6)**: las migraciones additivas de `brain.config.json` se aplican solas y son idempotentes; el consumidor solo lee el changelog para renombrados.
- **Negativo**: la distribución vía npm install de GitHub requiere que el consumidor tenga acceso al repo brain (autenticado, si es privado).
- **Implementado (Slice 6)**: `brain:upgrade` (`scripts/brain-upgrade.mjs`), el manifiesto de paths (`brain/core/managed-paths.mjs`), las migraciones (`brain/core/config-migrations.mjs`) y el check-and-notify en `day:start`. Ver `openspec/changes/installer-versionado/`.
