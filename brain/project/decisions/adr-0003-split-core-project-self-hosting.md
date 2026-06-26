# ADR-0003 — Split core/project y Self-Hosting

**Estado**: Accepted  
**Fecha**: 2026-06-26

## Contexto

brain empezó como documentación interna de un proyecto concreto. El sistema maduro tiene dos clases de contenido con ciclos de vida completamente distintos:

- **Genérico**: aplica a cualquier proyecto que adopte brain (metodología, adapters, motor de check-refs, harness-contract).
- **Específico del proyecto**: ADRs, dominio, reglas de negocio propias.

Mezclarlos impide extraer el sistema genérico como producto reusable.

Además, brain es el tipo de sistema que documenta su propia construcción — tiene sentido que sea self-hosting: que use su propio sistema para evolucionar.

## Decisión

El directorio `brain/` se divide en dos:

- `brain/core/`: el producto genérico. **Read-only para el consumidor.** Contiene metodología genérica, anti-patterns genéricos y el harness-contract. Las mejoras a core van upstream primero (ver `brain/core/methodology/consolidation-protocol.md`). core **jamás** referencia `brain/project/`.

- `brain/project/`: evolución propia del proyecto consumidor. ADRs, dominio, anti-patterns específicos. En el caso del repo `brain` mismo, contiene los ADRs del propio brain.

brain es self-hosting: el repo `github.com/csrinaldi/brain` usa brain para documentar y evolucionar brain. Sus propios ADRs viven en `brain/project/decisions/`. Su propio SDD usa `openspec/`. Esto es dogfooding total.

## Consecuencias

- **Positivo**: cualquier proyecto puede adoptar brain copiando `brain/core/` (o instalándolo vía npm — ver ADR-0006).
- **Positivo**: la numeración de ADRs es local a cada proyecto (brain empieza en adr-0001, el consumidor empieza en adr-0001 — sin colisión).
- **Negativo**: core y project deben mantenerse separados activamente. El invariante "core no referencia project" se valida en CI.
- **Negativo**: las mejoras genéricas requieren un paso extra (upstream-first) antes de llegar al proyecto consumidor.
