# ADR-0007 — Configuración VCS-Agnóstica y Motor de Check-Refs

**Estado**: Accepted  
**Fecha**: 2026-06-26

## Contexto

Los scripts del harness necesitan conocer el host VCS, el identificador de proyecto y el owner para operar (listar tickets, crear MRs/PRs, push, etc.).

El problema con hardcodear valores VCS en los scripts es doble: el sistema deja de ser reusable (queda atado a GitLab, a un host específico, a un project ID concreto), y los consumidores no pueden adoptar brain sin parchear los scripts.

Paralelamente, el validador de referencias prohibidas (`repo:check`) necesita un mecanismo para que cada proyecto defina sus propias reglas sin modificar el motor genérico.

## Decisión

### Configuración VCS-agnóstica

`brain.config.json` (raíz del repo) es la única fuente de verdad de identidad del proyecto:

```json
{
  "project": {
    "name": "",
    "slug": "",
    "gitHost": "",
    "gitProjectId": "",
    "owner": ""
  }
}
```

Las keys son agnósticas al VCS: `gitHost` funciona para GitLab, GitHub, Bitbucket o cualquier otro. `slug` es el path del proyecto en ese host (ej. `org/repo`). `gitProjectId` es el ID numérico cuando el VCS lo requiere (GitLab API).

Todos los scripts importan `scripts/lib/brain-config.mjs` en lugar de hardcodear valores. `brain.config.json` está gitignoreado — se configura por repo en `env:init`.

### Motor de check-refs con reglas externas

`scripts/check-refs.mjs` es el motor genérico (incluido en `brain/core/`). Las reglas prohibidas son PROJECT-specific: viven en `brain/project/check-refs-rules.mjs` (exporta `prohibitedRefs` y `globalExempt`).

El motor carga las reglas del proyecto en runtime. Si el archivo no existe, el motor opera con reglas vacías (solo las estructurales genéricas aplican).

## Consecuencias

- **Positivo**: brain funciona con GitLab, GitHub, Bitbucket — cualquier host con API REST.
- **Positivo**: el consumidor define sus propias reglas de check-refs sin tocar el motor.
- **Negativo**: `brain.config.json` debe completarse manualmente en cada clone — `env:init` guía al dev pero no lo puede pre-llenar.
- **Negativo**: si un VCS requiere autenticación para la API (GitLab private, GitHub private), el dev debe configurar el token en `.env` además de `brain.config.json`.
