---
status: draft
issue: 1014
---

# Propuesta — gemini-cold-review-stage (issue 1014)

## Qué
Incorporar soporte para Google Gemini como backend de transporte en la etapa de revisión fría (`cold-review`) y habilitar los parámetros `--engine` y `--model` en la CLI `brain:review` para sobreescribir dinámicamente la configuración de `brain.config.json`.

## Por qué
Actualmente `cold-review` sólo cuenta con adaptadores de transporte para Claude y Codex. Para ampliar la diversidad de modelos y permitir revisiones con Gemini (e.g. `gemini-2.5-pro`), se requiere un backend que cumpla con el contrato de aislamiento del revisor frío (ADR-0033). Además, `brain:review` rechaza cualquier flag no prevista, forzando a editar `brain.config.json` para alternar entre engines o modelos.

## Alcance
- **Incluye**:
  1. **CLI Overrides**: Soporte para `--engine <name>` y `--model <model>` en `brain/scripts/review/cli.mjs`, reflejando la selección en memoria sin mutar `brain.config.json`.
  2. **Backend Gemini**: Módulo `brain/scripts/harness/backends/gemini.mjs` que implementa `runStage({ stage, prompt, model, cwd, credentialEnv, forgeConfigDir, output, timeoutMs })` siguiendo el patrón desacoplado (`final-message`) con candidate read-only, depuración de variables sensibles (`withoutCredentials`) y aislamiento de forges (`withForgeConfigDir`).
  3. **Integración en Stage**: Soporte en `brain/scripts/review/lib/run-cold-review-stage.mjs` para enrutar el descriptor de salida `final-message` cuando el engine sea `gemini`.
  4. **Readiness y Setup**: Detección de CLI / SDK de Gemini e integración en `install-tools.sh` de forma condicional.
  5. **Tests**: Cobertura exhaustiva en `gemini.test.mjs` y `cli.test.mjs` (pruebas de timeout, captura de errores, forge probe y sobreescritura de flags).
- **No incluye**:
  - Modificación de otros stages del ciclo de vida de SDD fuera de `cold-review`.
  - Mutación persistente de `brain.config.json` desde invocaciones CLI.
