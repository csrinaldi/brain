# Anti-patrones — Conocimiento append-only del equipo

> Destino de promoción del **Momento 3** descrito en
> [`../methodology/consolidation-protocol.md`](../methodology/consolidation-protocol.md).

## Qué vive acá

Antipatrones técnicos descubiertos durante el desarrollo que aplican a **múltiples
microservicios** o que resuelven un bug crítico de compatibilidad (ej: serializaciones
JSON de Jakarta). No micro-decisiones de una sola feature — esas viven en la sub-tarea
correspondiente en `openspec/changes/[change-id]/tasks.md` hasta que se consoliden.

## Reglas

1. **Append-only.** No se reescribe un archivo existente; se agrega uno nuevo o se suma
   una entrada. El historial es el valor.
2. **Un antipatrón por archivo.** Naming descriptivo: `serializacion-jakarta-json.md`,
   `guice-singleton-eager.md`.
3. **Se promueve en el MR**, dentro del mismo commit que el código que lo descubrió —
   antes de quitar el estado *Draft*.
4. **Se indexa** con `npm run memory:index` cuando haga falta reproyectar el conocimiento
   durable de `brain/` a engram.

## Formato sugerido por entrada

```markdown
# <Nombre del antipatrón>

- **Descubierto en:** ISSUE-<id> / <microservicio>
- **Aplica a:** <qué módulos/servicios>

## Síntoma
<Cómo se manifiesta — el error o comportamiento observable.>

## Causa
<Por qué pasa, técnicamente.>

## Solución / patrón correcto
<Qué hacer en su lugar, con ejemplo mínimo.>
```

## Registrados

Índice navegable — agregá una entrada acá al promover un nuevo anti-pattern
(lo exige el check `brain:nav` en CI: ningún doc puede quedar huérfano).

- [config.yaml mezcla secuencia y mapping (YAML inválido tolerado por el harness)](config-yaml-seq-map-mezclados.md)
- [git diff no ve archivos untracked](git-diff-no-ve-untracked.md)
- [IA escribe en `brain/` sin gate humano](ia-escribe-brain-sin-gate.md)
- [IA que promueve sus propios artefactos](ia-promueve-sus-propios-artefactos.md)
- [Instaladores auto-actualizantes no son inocuos](instaladores-autoactualizantes-no-inocuos.md)

> Solo anti-patrones genéricos del harness. Los específicos del proyecto (stack, infra,
> dominio) los indexa el proyecto consumidor por separado — `core/` no referencia `project/`,
> para poder extraerse de forma autónoma.
