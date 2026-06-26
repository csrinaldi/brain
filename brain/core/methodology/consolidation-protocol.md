# Protocolo de Consolidación de Conocimiento (Momento 3)

> **status:** current | **last-reviewed:** 2026-06-24 | **owner:** @crinaldi

> **Propósito:** Forzar la escalabilidad de las micro-decisiones de diseño, trucos técnicos o antipatrones descubiertos en el chat de un branch hacia el cerebro global con costo de captura cero para el equipo chico.

## 1. Captura en Caliente (Durante el Chat con el Agente)
- El programador humano o el agente orquestador principal debe volcar los acuerdos técnicos de la sesión directamente en la sección `## Micro-decisiones en caliente` del `tasks.md` del change correspondiente en `./openspec/changes/[change-id]/`. No se permiten micro-decisiones flotantes en el historial del chat.
- Si el cambio directo no requiere SDD/OpenSpec, las micro-decisiones que deban persistir se documentan en el commit/MR y se promueven a `brain/` solo si aplican a más de un módulo, resuelven un riesgo recurrente o cambian una regla de trabajo.

### Escritura concurrente — patrón scratch-per-agent

Cuando múltiples agentes trabajan subtareas en paralelo dentro del mismo change, **no deben escribir directamente en `tasks.md`**. La escritura concurrente sobre un archivo mutable compartido produce conflictos y pérdida silenciosa de contexto.

Patrón obligatorio para cambios con sub-agentes paralelos:

- Cada agente escribe su contexto local en `openspec/changes/{iid}/scratch/{agent-id}.md` (ignorado por git durante el vuelo del change).
- El orquestador consolida los scratch files en `tasks.md` al cerrar cada batch.
- `openspec/changes/{iid}/scratch/` está en `.gitignore` — no se commitea ni persiste.
- **El orquestador es el único writer de `tasks.md`.** Los sub-agentes solo escriben su propio scratch file.

## 1b. Regla de mantenimiento de HOME.md

Cada vez que se crea un nuevo ADR o se agrega un archivo a `brain/methodology/` o
`brain/anti-patterns/`, el MR correspondiente **debe** actualizar `brain/HOME.md` para
incluir el nuevo enlace en la sección correspondiente. Sin esta actualización el MR
no está completo.

## 2. Promoción en el Merge Request (GitLab)

> **Hard Rule — Gate humano obligatorio:**
> Ningún agente de IA puede commitear directamente a `brain/decisions/`,
> `brain/anti-patterns/`, `brain/domain/` ni `brain/methodology/`.
> La promoción funciona así:
> 1. El agente redacta el borrador del artefacto (ADR, anti-pattern, entrada de glosario)
>    como archivo bajo `openspec/changes/{iid}/brain-drafts/`.
> 2. El humano revisa el borrador en el MR, lo edita si corresponde, y lo mueve a `brain/`
>    en un commit de su autoría.
> 3. La descripción del MR documenta qué se promovió y por qué.
>
> Ningún agente promueve sus propios artefactos a `brain/`. Esa firma es humana.
> Ver anti-pattern: `brain/anti-patterns/ia-escribe-brain-sin-gate.md`.

- Antes de quitar el estado *Draft* del MR en tu GitLab self-hosted, la skill de cierre de la organización procesará de forma analítica las micro-decisiones acumuladas en el branch.
- Si el aprendizaje aplica a múltiples microservicios o soluciona un bug crítico de compatibilidad (ej: serializaciones JSON de Jakarta), el agente debe redactar el borrador en `openspec/changes/{iid}/brain-drafts/` para que el humano lo revise y promueva.

## 3. Mapa de zonas — quién puede escribir qué

| Zona | Quién escribe | Operaciones permitidas | Enforcement |
|------|---------------|----------------------|-------------|
| `brain/**` | Humano únicamente | create, update, delete | CODEOWNERS + gate humano en MR |
| `openspec/changes/**` | Agente o humano | create, update | Ninguno — zona de vuelo |
| `openspec/changes/*/brain-drafts/**` | Agente (borrador) | create, update | Ninguno — zona de propuesta |
| `openspec/changes/archive/**` | Agente o humano | create (al archivar) | Ninguno |
| `openspec/specs/**` | Agente o humano | create, update | `npm run repo:check` valida referencias |
| `.engram/**` | Agente o humano | create, update | Merge driver content-addressed |
| `scripts/**`, `package.json` | Agente o humano | create, update, delete | `npm run repo:check` |
| `.gitlab-ci.yml`, `settings.xml` | Humano recomendado | update | Requiere issue + MR (no mecánico) |

**Regla de oro:** si el destino es `brain/`, la firma es humana. Todo lo demás puede
tener origen en agente, siempre con issue + MR como unidad de entrega.

## 4. Protocolo de conflictos semánticos en Engram

Engram puede acumular observaciones contradictorias entre sesiones — por ejemplo,
una decisión "Spring prohibido" coexistiendo con "Spring Boot como destino" antes de
que ADR-0007 se formalizara.

Este protocolo no depende de APIs propietarias del harness (scores de confianza,
`judgment_id`, `mem_judge`). La autoridad se determina por **tipo de observación**,
**autoría declarada**, y **supersesión explícita en el contenido** — todo ello
legible sin el harness activo.

### Convención de provenance en observaciones

Toda observación guardada en Engram debe declarar en su contenido:

| Campo | Formato | Ejemplo |
|-------|---------|---------|
| **Actor** | Primera línea del body | `**Actor:** @crinaldi (humano)` / `**Actor:** claude-sonnet-4-6 (agente)` |
| **Fuente** | Referencia a issue/MR si aplica | `**Fuente:** issue #78 / MR !72` |
| **Supersede** | Solo si reemplaza algo anterior | `**Supersede:** observación anterior "Spring prohibido"` |

Esta convención vive en el contenido — es portable a cualquier harness.

### Cómo detectar conflictos

```bash
# Listar observaciones candidatas a revisión
mem_review --action list --project plataforma-scit
```

Las observaciones con status `needs_review` son candidatas. Si `mem_review` no está
disponible, buscar observaciones con tipo `architecture` o `decision` cuyo contenido
contradiga ADRs activos en `brain/decisions/`.

### Criterios de resolución

| Condición | Acción |
|-----------|--------|
| Tipo `architecture`, `decision` o `policy` en conflicto | **El humano decide** — el agente presenta ambas versiones y espera confirmación explícita |
| Una observación declara `**Supersede:**` apuntando a la otra | La anterior se marca `needs_review`; el agente continúa sin escalar |
| Tipo `pattern`, `bugfix`, `config` o `discovery` en conflicto | El agente resuelve por recencia (la más nueva gana) salvo contradicción obvia |
| Una observación es de autoría humana y la conflictiva de agente, mismo tipo | La del humano tiene precedencia |

### Autoridad de resolución

El humano es la autoridad final sobre conflictos de tipo `architecture`, `decision` y
`policy`. La resolución se documenta con:

1. Una declaración explícita `**Supersede:**` en la observación ganadora
2. Si el conflicto cambia una regla durable: ADR nuevo o commit de corrección en `brain/`
3. Si es contexto desactualizado: `mem_review --action mark_reviewed` después de
   confirmación humana explícita — nunca automáticamente

## 5. Sincronización de la Memoria (Engram git-based)

`npm run day:start` cierra el ciclo completo al arrancar la jornada:
1. **import** (`engram sync --import`) — trae `.engram/` del repo → `~/.engram` local
2. **index** (`brain-to-engram.mjs`) — reproyecta `brain/` → `~/.engram`
3. **export** (`engram sync --export`) — publica `~/.engram` → `.engram/` del repo

El export del paso 3 captura la memoria acumulada de la sesión anterior y la reproyección de `brain/`. La memoria generada durante la jornada activa (llamadas a `mem_save` en sesión) se exporta con el próximo `day:start` o manualmente:

```bash
npm run memory:share   # export explícito en cualquier momento
```

Antes de pushear el branch, confirmar que `.engram/` refleja el estado actual:

```bash
npm run memory:share && git add .engram/ && git status
```

A partir de #81, un **pre-push hook** (`scripts/hooks/pre-push`) automatiza esa
confirmación: corre `engram sync --export` antes de cada push y aborta si `.engram/`
quedó sin commitear, indicando cómo materializarla. Se auto-instala vía `core.hooksPath`
(script `prepare` en `npm install` + self-heal en `day:start`), así que no depende de
re-correr `env:init`. El export es client-side por diseño — solo ocurre en la máquina del
dev; el hook maximiza su alcance, no lo vuelve inbypasseable (`git push --no-verify` sigue
siendo escape de emergencia).

Una vez mergeado el MR, el equipo asimila la memoria con `npm run memory:pull` o en el próximo `day:start`.

La capa **durable** (decisiones, anti-patrones) se promueve a `brain/` en Markdown, que es la fuente de verdad; engram es la capa **viva** compartida. Ver `../decisions/adr-0003-memoria-equipo-git-based.md`.
