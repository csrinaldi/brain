# Contrato del Harness SDD

> **status:** current | **last-reviewed:** 2026-06-24 | **owner:** @crinaldi

> **Propósito:** define los verbos abstractos que cualquier harness SDD debe implementar
> para ser compatible con este proyecto. Referenciado por ADR-0002.

El harness actual es `gentle-ai`. Otro harness puede reemplazarlo siempre que implemente
este contrato — sin cambios en `project-workflow.md` ni en `developer-environment.md`.

---

## Verbos requeridos

| Verbo (npm) | Verbo (Claude) | Responsabilidad |
|-------------|----------------|-----------------|
| `npm run env:init` | — | Bootstrap del entorno: instala herramientas, configura auth, importa memoria, refresca skill registry. Idempotente. |
| `npm run day:start` | — | Arranque diario: auth glab, actualizaciones del ecosistema, memoria de equipo, tablero de tickets. |
| `npm run ticket:start -- <iid>` | `/ticket-start <iid>` | Toma un issue, crea la rama con la convención `{tipo}/issue-{iid}-{slug}` desde main. |
| `npm run project:feature -- --issue <iid>` | `/sdd-new <iid>` | Inicia un change SDD: crea `openspec/changes/issue-<iid>-<slug>/` con `proposal.md`, `design.md`, `tasks.md`, `spec.md`. |
| `npm run repo:check` | — | Valida referencias prohibidas en todo el árbol. Gate mínimo antes de cualquier commit. |
| `npm run change:verify` | `/sdd-verify` | Valida el scope del cambio activo: clasifica el diff, corre solo las verificaciones necesarias. |
| `npm run memory:share` | — | Exporta engram local → `.memory/` (versionado en git). Corre antes de pushear. |
| `npm run memory:pull` | — | Importa `.memory/` → engram local. Trae la memoria del equipo. |
| `npm run memory:index` | — | Reproyecta `brain/` → engram local. Necesario cuando cambian ADRs o glosario. |

## Verbos opcionales (recomendados)

| Verbo (Claude) | Responsabilidad |
|----------------|-----------------|
| `/sdd-explore <idea>` | Investigación previa al proposal. No crea artefactos. |
| `/sdd-continue` | Avanza la siguiente fase lista del ciclo SDD. |
| `/sdd-apply` | Implementa las tareas del change activo. |
| `/sdd-archive` | Cierra el change y consolida artefactos. |
| `/retomar` | Recupera el contexto de la sesión anterior desde engram + tablero GitLab. |
| `/gitlab-issue` | Crea un issue en GitLab desde descripción o changeset. |
| `/gitlab-merge-request` | Abre un MR vinculado a un issue. |

## Contrato de artefactos

Un change SDD produce exactamente estos artefactos bajo `openspec/changes/issue-<iid>-<slug>/`:

```
proposal.md   — PRD aprobado por humano (obligatorio)
spec.md       — requisitos delta del cambio
design.md     — decisiones técnicas y approach
tasks.md      — checklist de implementación
```

Los artefactos viven en `openspec/` durante el vuelo del change.
Solo el residuo durable (ADRs, anti-patterns, glosario) se promueve a `brain/` — ver
`brain/methodology/consolidation-protocol.md`.

## Implementación actual (gentle-ai)

`gentle-ai` implementa este contrato. Los skills de Claude se instalan con
`gentle-ai install` y se mantienen con `gentle-ai upgrade`. El registry local se
refresca automáticamente en `day:start` y en `env:init`.

Ver `brain/methodology/agent-skills.md` para el inventario completo de skills.

## Nota de implementación — capa de memoria materializada

`.memory/` es el directorio canónico versionado en git para la memoria materializada del equipo.
El binding a engram (implementación actual) usa un symlink `/.engram → .memory/`, de modo que
engram escribe a `.engram/` (su convención interna) y los archivos aterrizan en `.memory/`.
ADR-0003 documenta el modelo de memoria; este symlink es un detalle de implementación agnóstico.
