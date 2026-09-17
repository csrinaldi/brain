# Design: Soporte para Gemini en Cold-Review y Overrides de CLI

## Enfoque Técnico

El revisor frío con Gemini se diseña estrictamente como un **transport producer** siguiendo los principios de [ADR-0033](file:///home/gandalf/IA/brain/brain/project/decisions/adr-0033-cold-review-transport.md) y el precedente de Codex ([#978](file:///home/gandalf/IA/brain/openspec/changes/archive/2026-09-16-issue-978-codex-cold-review/design.md)):
1. El candidato detached es de solo lectura.
2. El host (`runColdReviewStage`) crea un descriptor de salida `output: { mode: 'final-message', tempPath, artifactPath }` fuera del árbol del candidato.
3. El nuevo backend `brain/scripts/harness/backends/gemini.mjs` ejecuta el proceso no interactivo de Gemini contra el candidato, escribiendo la respuesta en `output.tempPath`.
4. El host valida que el candidato no fue modificado y mueve atómicamente el archivo generado a la ubicación canónica del artefacto (`openspec/reviews/pr-NNN/findings.json`).
5. En `brain/scripts/review/cli.mjs`, `parseArgs` incorpora `--engine` y `--model`, permitiendo sobreescribir la resolución de `sdd.map['cold-review']` en memoria durante la ejecución sin modificar `brain.config.json`.

## Decisiones de Arquitectura

| Decisión | Alternativas | Razón |
|---|---|---|
| **Patrón `final-message` (salida host-owned fuera del candidato)** | Tool-use directo dentro del worktree (patrón Claude) | Garantiza por construcción la inmutabilidad del código bajo revisión. Evita que el agente modifique accidentalmente archivos durante el análisis. |
| **CLI overrides en memoria en `cli.mjs`** | Modificar temporalmente `brain.config.json` en disco; variables de entorno ad-hoc | Mantiene el archivo de configuración inalterado (idempotencia y limpieza en git), permitiendo al operador elegir el evaluador al vuelo. |
| **Depuración estricta de credenciales de Forge** | Compartir entorno padre completo | ADR-0033 exige que el subagente productor jamás posea credenciales de escritura en forges (`gh`/`glab`/tokens). |
| **Modelo por defecto opaco (`gemini-2.5-pro`)** | Validar contra catálogo cerrado de modelos | Según ADR-0019 / #323, el nombre del modelo es un pass-through opaco que brain no interpreta. |

## Flujo de Datos

```text
brain:review CLI (con flags opcionales --engine / --model)
       │
       ▼
Sobreescribe en memoria config.sdd.map['cold-review']
       │
       ▼
runColdReviewStage (prepara candidate detached y output tempPath)
       │
       ├─► Sanitización de env (sin tokens de forge ni secrets)
       ├─► Forge shadow (directorio aislado)
       │
       ▼
stage-seam ──► gemini.mjs (runStage)
                    │
                    ▼
              Gemini Runner (lee candidato en read-only)
                    │
                    ▼
              output.tempPath (archivo temporal con el veredicto)
       │
       ▼
Host valida inmutabilidad y promueve tempPath -> artifactPath
       │
       ▼
Challenger & Evaluator leen el artefacto final
```

## Cambios de Archivos

| Archivo | Acción | Descripción |
|---|---|---|
| `brain/scripts/harness/backends/gemini.mjs` | Crear | Backend de transporte para Gemini: ejecución, timeout, sanitización y manejo de output. |
| `brain/scripts/harness/backends/gemini.test.mjs` | Crear | Pruebas unitarias de `gemini.mjs`: scrubbing, forge shadow, timeout, tail de errores. |
| `brain/scripts/review/cli.mjs` | Modificar | Agregar `--engine` y `--model` a `parseArgs` y aplicar override sobre `config`. |
| `brain/scripts/review/cli.test.mjs` | Modificar | Tests de aceptación para las opciones `--engine` y `--model`. |
| `brain/scripts/review/lib/run-cold-review-stage.mjs` | Modificar | Activar modo `final-message` cuando `routing.engine === 'gemini'`. |
| `brain/scripts/review/lib/run-cold-review-stage.test.mjs` | Modificar | Pruebas de integración de routing con Gemini y preservación del candidato. |
| `brain/scripts/harness/gemini-readiness.mjs` | Crear | Helper de comprobación de disponibilidad del runner y credenciales de Gemini. |

## Estrategia de Pruebas (TDD)

1. **Unit tests (`gemini.test.mjs`)**:
   - Validación del contrato de `runStage`: rechazo de prompt vacío, stage no enrutable, output faltante.
   - Comprobación de que credenciales sensibles son eliminadas del entorno del hijo.
   - Verificación del forge config dir.
   - Manejo de códigos de salida != 0 y timeouts con redacción de secretos en el mensaje de error.
2. **CLI tests (`cli.test.mjs`)**:
   - Parseo de `--engine` y `--model`.
   - Rechazo de flag sin valor (`--engine` solo).
   - Comprobación de que la configuración en disco no cambia.
3. **Integration tests (`run-cold-review-stage.test.mjs`)**:
   - Flujo completo simulado donde Gemini emite `output.tempPath` y el host materializa el artefacto.
