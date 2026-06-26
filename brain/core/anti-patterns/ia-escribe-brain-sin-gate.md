# Anti-Pattern: IA escribe en `brain/` sin gate humano

**Categoría:** Governance agéntica  
**Riesgo:** Alto — contaminación de la fuente de verdad durable  
**Relacionado con:** `CONSTITUTION.md §4`, `methodology/consolidation-protocol.md §2`

## El problema

Un agente de IA que commitea directamente en `brain/decisions/`, `brain/anti-patterns/`,
`brain/domain/` o `brain/methodology/` puede introducir:

- Decisiones incorrectas o malinterpretadas sin revisión crítica.
- Anti-patrones que describen soluciones locales como si fueran reglas globales.
- Términos de dominio definidos desde el código, no desde el negocio.
- Reglas de metodología que reflejan el estado de una sesión, no el consenso del equipo.

`brain/` es la fuente de verdad **durable**. El costo de un error aquí es alto porque
otros agentes y sesiones futuras lo van a leer como hecho establecido.

## Por qué ocurre

El `consolidation-protocol.md §2` (versión anterior al issue #54) decía explícitamente
"el agente debe redactar y adjuntar un archivo append-only en `brain/anti-patterns/`
dentro del mismo commit". Sin gate humano, la intención de capturar conocimiento en caliente
se convierte en un vector de contaminación directa.

## La regla

**Ningún agente promueve sus propios artefactos a `brain/`. Esa firma es humana.**

El flujo correcto:

```
agente redacta borrador
    → openspec/changes/{iid}/brain-drafts/{nombre}.md
        → humano revisa en el MR
            → humano mueve a brain/ en commit de su autoría
```

## Detección

Un agente que propone escribir en `brain/` directamente debe ser detenido.
El síntoma visible: un commit donde el autor es un agente y los archivos modificados
están bajo `brain/`.

`check-refs.mjs` puede agregarse como validación futura si se expone el autor del commit.
