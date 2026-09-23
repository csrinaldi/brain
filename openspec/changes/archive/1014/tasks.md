---
status: draft
issue: 1014
---

# Tareas — gemini-cold-review-stage (issue 1014)

## Batch 1: CLI Overrides en `brain:review`
- [x] **1.1 Test RED**: Agregar pruebas en `brain/scripts/review/cli.test.mjs` para verificar que `parseArgs` acepta `--engine <name>` y `--model <model>`, rechazando flags incompletas y aplicando el override en memoria sobre `config.sdd.map['cold-review']` sin modificar el archivo de configuración en disco.
- [x] **1.2 Implementación**: Extender `parseArgs` y `main` en `brain/scripts/review/cli.mjs` para soportar `--engine` y `--model` y aplicar el override en memoria.

## Batch 2: Backend Gemini Transport (`gemini.mjs`)
- [x] **2.1 Test RED**: Crear `brain/scripts/harness/backends/gemini.test.mjs` con casos de prueba para el contrato de `runStage`:
  - Rechazo de prompt vacío y stages no enrutables.
  - Validación del descriptor `output` (`mode: 'final-message'`, paths absolutos, no contenido en el candidate).
  - Sanitización de variables de entorno sensibles (`withoutCredentials`).
  - Aplicación de forge shadow (`withForgeConfigDir`).
  - Manejo de timeout y códigos de salida no nulos con redacción de secretos en stderr.
- [x] **2.2 Implementación**: Crear `brain/scripts/harness/backends/gemini.mjs` exportando `runStage` cumpliendo todas las condiciones del contrato.

## Batch 3: Integración en `run-cold-review-stage.mjs`
- [x] **3.1 Test RED**: Añadir pruebas en `brain/scripts/review/lib/run-cold-review-stage.test.mjs` comprobando que cuando el stage se enruta a `gemini`, se activa el modo `final-message` y se promueve atómicamente el archivo temporal a `output.artifactPath`.
- [x] **3.2 Implementación**: Modificar `run-cold-review-stage.mjs` para admitir `gemini` en la configuración de salida `final-message`.

## Batch 4: Readiness y Verificación General
- [x] **4.1 Readiness**: Crear `brain/scripts/harness/gemini-readiness.mjs` para verificar la disponibilidad del CLI/API de Gemini.
- [x] **4.2 Verificación**: Ejecutar la suite completa, `npm run brain:repo:check` y `npm run brain:change:verify`.

## Micro-decisiones en caliente
- *2026-09-17*: Se adopta el patrón `final-message` (candidato de solo lectura y salida host-owned) para Gemini por paridad y seguridad con Codex.
- *2026-09-17*: Los overrides de `--engine` y `--model` en `cli.mjs` son estrictamente en memoria para la corrida actual; nunca mutan `brain.config.json`.
