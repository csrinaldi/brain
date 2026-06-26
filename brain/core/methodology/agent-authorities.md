# Autoridades de los agentes IA

> **status:** current | **last-reviewed:** 2026-06-24 | **owner:** @crinaldi

> **Propósito:** define qué puede hacer un agente autónomamente, qué requiere
> confirmación humana y qué está prohibido. Companion de `consolidation-protocol.md`
> y `anti-patterns/ia-escribe-brain-sin-gate.md`.
>
> **Este documento es de autoría humana.** Los cambios a las tiers requieren MR
> con revisión humana — están cubiertos por CODEOWNERS.

---

## Tiers de autoridad

### Tier 1 — Autónomo

El agente puede ejecutar sin pedir permiso:

- Leer cualquier archivo del repo (`brain/`, `openspec/`, código, scripts)
- Crear/modificar archivos en `openspec/changes/**` (artefactos SDD en vuelo)
- Crear/modificar archivos en `.engram/**` (memoria viva)
- Escribir en `scratch/{agent-id}.md` dentro de un change activo
- Correr `npm run repo:check`, `npm run backend:build`, `npm run change:verify`
- Crear issues en GitLab (`/gitlab-issue`)
- Proponer commits para revisión humana (pero no pushear ni mergear sin confirmación)
- Guardar observaciones en Engram (`mem_save`, `mem_session_summary`)
- Refrescar el skill registry (`gentle-ai skill-registry refresh`)

### Tier 2 — Confirmar antes de ejecutar

El agente propone y espera aprobación explícita del humano:

- **Push a cualquier rama** — el humano aprueba cada push
- **Crear o mergear un MR** — el humano revisa el MR antes de mergear
- **Modificar archivos en `brain/`** — el agente redacta el borrador en
  `openspec/changes/{iid}/brain-drafts/`; el humano lo mueve a `brain/`
- **Modificar `.gitlab-ci.yml`, `settings.xml`, `CODEOWNERS`** — cambios de
  infraestructura que afectan a todo el equipo
- **Borrar ramas o archivos commiteados** — acciones destructivas irreversibles
- **Resolver conflictos semánticos de tipo `architecture`/`decision`** en Engram
  (ver `consolidation-protocol.md §4`)
- **Deploy al Package Registry** (`npm run backend:deploy`) — afecta artefactos
  compartidos por todos los consumidores

### Tier 3 — Prohibido

El agente nunca debe hacer esto, incluso si se lo piden explícitamente:

- Commitear directamente en `brain/decisions/`, `brain/anti-patterns/`,
  `brain/domain/` o `brain/methodology/`
- Aprobar o mergear su propio MR
- Modificar el historial de git (`--force`, `--amend` de commits publicados,
  `rebase` de ramas que otros usan)
- Añadir atribución de IA en commits (`Co-Authored-By: Claude...`)
- Publicar JARs al Package Registry sin instrucción explícita del humano
- Escalar decisiones a otros agentes sin conocimiento del humano

---

## Regla de escalada

Si el agente no tiene claro a qué tier pertenece una acción: **pausar y preguntar**.
La duda sobre el tier ya es motivo suficiente para escalar al humano.

---

## Revisión

Este documento debe revisarse cuando:
- Se agrega un nuevo tipo de herramienta o capacidad al harness
- Una acción del Tier 2 demuestra ser rutinaria y de bajo riesgo (candidata a Tier 1)
- Una acción del Tier 1 produce un incidente (candidata a Tier 2 o 3)

Los cambios a este documento requieren MR con revisión de `@crinaldi`.
