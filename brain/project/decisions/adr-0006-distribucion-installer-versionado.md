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

**Migración de brain.config.json**: cuando el schema de `brain.config.json` cambia entre versiones, el changelog del tag documenta las claves añadidas/renombradas. El consumidor migra manualmente antes de actualizar.

## Consecuencias

- **Positivo**: instalación one-liner, sin registry, compatible con repos privados (GitHub).
- **Positivo**: la versión queda explícita en `package.json` del consumidor — upgrades son decisiones conscientes.
- **Positivo**: `git tag` es el mecanismo de release — cero CI complejo para publicar.
- **Negativo**: no hay migraciones automáticas de `brain.config.json`; el consumidor debe leer el changelog.
- **Negativo**: la distribución vía npm install de GitHub requiere que el consumidor tenga acceso al repo brain (autenticado, si es privado).
- **Pendiente (Slice 6)**: el installer y el check-and-notify en day:start están planificados pero no implementados aún.
