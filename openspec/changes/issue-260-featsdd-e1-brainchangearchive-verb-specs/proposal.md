---
status: approved
issue: 260
---

# Propuesta — E1 brain change archive verb (issue 260)

## Qué
Implementar el verbo `brain:change:archive <changeId>` en la CLI para archivar cambios SDD y fusionar sus especificaciones delta en el repositorio central de especificaciones bajo `openspec/specs/`. Luego, realizar un backfill de los cambios de brain completados para poblar `openspec/specs/`.

## Por qué
Consolidación prometida por el diseño de SDD (ADR-0014). Actualmente, `openspec/specs/` se encuentra vacío mientras que los cambios pasados almacenan deltas que van quedando dispersos. Resolver esto cierra la brecha de persistencia y previene el desvío de especificaciones (spec drift).

## Alcance
- **Incluye**:
  - Nuevo verbo CLI `brain:change:archive <changeId>` que use la estructura de layouts provista en [sdd-layout.mjs](file:///home/gandalf/IA/brain-issue-260/brain/scripts/lib/sdd-layout.mjs).
  - Lógica de fusión de especificaciones delta (`openspec/changes/<changeId>/spec.md` o deltas heredados) a `openspec/specs/<capability>/spec.md` conservando un encabezado de procedencia (provenance header).
  - Mudanza física del directorio de cambios completados al path retornado por `archivePath(iid)` (`openspec/changes/archive/<iid>`).
  - Ejecutar un proceso de backfill para archivar de forma automatizada los cambios completados de brain y poblar `openspec/specs/`.
- **No incluye**:
  - Detección de staleness de especificaciones (eso es de la slice E2).
  - Modificación o reescritura de los evaluadores de los governance gates.
  - Modificaciones a `sdd-layout.mjs` más allá de lo requerido por la micro-decisión de diseño sobre el sellado de `LEGACY_GRANDFATHERED`.
