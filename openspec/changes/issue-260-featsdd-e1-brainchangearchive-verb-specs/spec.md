---
status: draft
issue: 260
---

# Spec — E1 brain change archive verb (issue 260)

## Requisitos delta

### REQ-E1-1: Comando CLI `brain:change:archive`
- Se debe registrar y exponer el comando a través de los aliases CLI existentes en el repositorio (`brain:change:archive <changeId>`).
- Debe aceptar un argumento obligatorio `<changeId>` que identifica el cambio a archivar (ej. `issue-138-session-start`).
- El comando debe validar que el cambio existe bajo el directorio activo de cambios de `sdd-layout.mjs` (`openspec/changes/<changeId>`).

### REQ-E1-2: Acceso exclusivo a través de `sdd-layout.mjs`
- El script no debe calcular o deducir rutas de forma directa en su código. Debe obtener todas las rutas físicas a través del accessor [sdd-layout.mjs](file:///home/gandalf/IA/brain-issue-260/brain/scripts/lib/sdd-layout.mjs), en particular `changeDir(id)` y `archivePath(iid)`.

### REQ-E1-3: Archivo físico del directorio
- Se debe mover el directorio del cambio de `openspec/changes/<changeId>` a `openspec/changes/archive/<iid>` (donde `<iid>` se obtiene mediante `parseChangeId(changeId)`).
- Si el directorio de destino `archive/<iid>` ya existe, el comando debe fallar de forma segura para evitar sobreescribir datos archivados previamente, a menos que se indique explícitamente una fuerza (o simplemente fallar cerrado por seguridad).

### REQ-E1-4: Fusión de Especificaciones Delta (Deltas → Spec central)
- El proceso de archivo debe buscar especificaciones delta dentro del cambio:
  - **Formato legacy-accepted**: Si existe `openspec/changes/<changeId>/specs/`, se escanea cada subdirectorio. El nombre de este subdirectorio es la `<capability>`. Se lee el archivo `spec.md` allí.
  - **Formato plano**: Si no hay carpeta `specs/` pero existe `openspec/changes/<changeId>/spec.md` en la raíz, se lee dicho archivo. Se buscará en su frontmatter YAML la clave `capability`. Si no existe la clave `capability`, se emitirá un warning y no se realizará fusión para ese spec, pero el cambio se archivará.
- Para cada especificación delta encontrada con su respectiva `<capability>`:
  - Se debe localizar o crear el archivo de especificación central en `openspec/specs/<capability>/spec.md`.
  - Se debe fusionar el contenido del spec delta en el spec central.
  - La fusión debe añadir un **encabezado de procedencia** (provenance header) que indique claramente qué cambio y qué issue introdujo los requisitos.
  - Ejemplo de provenance header:
    ```markdown
    
    ### [issue-138] session-start — 2026-07-13
    ```
    Seguido por el cuerpo de los requisitos del spec delta (sin el frontmatter YAML).

### REQ-E1-5: Proceso de Backfill automático de dogfooding
- Debe existir un comando o script interno que permita archivar automáticamente los cambios ya completados del repositorio (`governance`, `feature-working-memory`, `issue-138-session-start`, `install-home-scaffold`, `installer-versionado`, `vcs-adapter`, etc.) para poblar `openspec/specs/`.
- Este proceso servirá como test de aceptación para verificar la fusión correcta y la persistencia sin romper las invariantes de SDD.

---

## Escenarios

### Escenario 1: Archivar un cambio legacy válido
- **GIVEN** que el cambio `issue-138-session-start` tiene especificaciones delta en `openspec/changes/issue-138-session-start/specs/session/spec.md`.
- **WHEN** ejecutamos `npm run brain:change:archive -- issue-138-session-start`.
- **THEN** el directorio se mueve a `openspec/changes/archive/138/`.
- **AND** el contenido de `spec.md` se añade a `openspec/specs/session/spec.md` precedido por su metadata de procedencia.

### Escenario 2: Archivar un cambio plano con capability
- **GIVEN** un cambio `issue-999-my-change` con `spec.md` plano en su raíz que tiene `capability: memory` en su frontmatter.
- **WHEN** ejecutamos el comando de archivo.
- **THEN** se mueve a `archive/999/` y su spec se fusiona en `openspec/specs/memory/spec.md`.
