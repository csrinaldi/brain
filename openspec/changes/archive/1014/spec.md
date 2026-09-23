---
status: draft
issue: 1014
---

# Spec — gemini-cold-review-stage (issue 1014)

## Requisitos delta

- **REQ-GEMINI-1 (CLI Overrides)**: `brain/scripts/review/cli.mjs` debe aceptar los flags `--engine <name>` y `--model <model>`. Si se especifican, deben sobreescribir en memoria el objeto `config.sdd.map['cold-review']` para la ejecución actual sin persistir cambios en `brain.config.json`. Un flag sin valor debe ser rechazado.
- **REQ-GEMINI-2 (Backend Gemini Transport)**: `brain/scripts/harness/backends/gemini.mjs` debe exportar `runStage` satisfaciendo el contrato de harness:
  - Validar que el stage sea enrutable y que el prompt no esté vacío.
  - Soportar el modelo especificado o default (`gemini-2.5-pro` para CLI `gemini` con API key; mapeado a `gemini-3.1-pro-high` cuando el runner activo es `agy` para suscripciones Google One AI Premium / Google AI Pro).
  - Soportar runners duales: runner `agy` (Antigravity CLI para suscripciones Google AI Pro) con preferencia sobre `gemini` CLI (API key) cuando está autenticado.
  - Requerir y validar el descriptor `output` (`mode: 'final-message'`, paths absolutos, resolviendo fuera del candidato).
  - Depurar variables de entorno sensibles con `withoutCredentials` (y excluir credenciales de API key en ejecuciones bajo `agy`).
  - Aplicar el shadow de forges con `withForgeConfigDir`.
  - Ejecutar el runner de Gemini de forma no interactiva contra el candidato en modo solo lectura (`--approval-mode plan` en `gemini` CLI; `--sandbox --dangerously-skip-permissions --disable-slash-commands` en `agy`).
  - Capturar y escribir la respuesta en `output.tempPath` (deduplicando bloques idénticos consecutivos en stdout si el runner emite múltiples bloques) y retornar `{ ok: true, elapsedMs }` o fallo estructurado con diagnóstico acotado.
- **REQ-GEMINI-3 (Integración de Stage en Host)**: `brain/scripts/review/lib/run-cold-review-stage.mjs` debe activar el descriptor de salida `output` de tipo `final-message` cuando `routing.engine === 'gemini'`, y promover atómicamente el archivo temporal a `output.artifactPath` tras una ejecución exitosa.
- **REQ-GEMINI-4 (Readiness y Entorno)**: Proveer verificación de readiness para Gemini (`brain/scripts/harness/gemini-readiness.mjs`), comprobando presencia del ejecutable y disponibilidad de autenticación (`agy` autenticado para Google AI Pro o `gemini` CLI con `GEMINI_API_KEY` o ADC) sin fallar cuando el stage no esté enrutado a Gemini o `brain.config.json` esté ausente.

## Escenarios

### Escenario 1: CLI override de engine y modelo
- **GIVEN** un repositorio con `sdd.map['cold-review'] = { engine: 'claude', model: 'sonnet' }`
- **WHEN** se ejecuta `npm run brain:review -- 1014 --engine gemini --model gemini-2.5-pro --dry-run`
- **THEN** la ejecución despacha la etapa utilizando el backend `gemini` y el modelo `gemini-2.5-pro`
- **AND** el archivo `brain.config.json` en disco permanece inalterado.

### Escenario 2: Ejecución exitosa de Gemini transport
- **GIVEN** un candidato detached y un descriptor `output` válido fuera del candidato
- **WHEN** `gemini.mjs:runStage` se ejecuta con éxito
- **THEN** el archivo temporal en `output.tempPath` contiene el artefacto emitido
- **AND** el entorno del proceso no recibe credenciales de forge ni tokens sensibles
- **AND** el método retorna `{ ok: true, elapsedMs }`.

### Escenario 3: Fallo o timeout en Gemini transport
- **GIVEN** una ejecución de Gemini que supera el timeout o finaliza con código de error
- **WHEN** `gemini.mjs:runStage` captura la terminación
- **THEN** retorna `{ ok: false, elapsedMs, reason }` con el stderr acotado y sanitizado de secretos
- **AND** no deja archivos basura en el árbol del candidato.

### Escenario 4: Candidato protegido
- **GIVEN** un worktree detached para revisión fría
- **WHEN** se ejecuta la revisión fría con Gemini
- **THEN** el candidato no sufre modificaciones de archivos, adiciones ni commits (verificado por snapshot/git status).
