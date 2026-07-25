---
status: approved
issue: 260
---

# Tareas — E1 brain change archive verb (issue 260)

## Fase 1: Pruebas unitarias RED (TDD)
- [x] Crear el archivo de pruebas `brain/scripts/archive.test.mjs`.
- [x] Escribir una prueba unitaria RED para la función de extracción y parseo de frontmatter.
- [x] Escribir una prueba unitaria RED para la fusión de especificaciones delta a especificaciones centrales (con provenance header).
- [x] Escribir una prueba unitaria RED para validar que la lógica de archivo falla de forma segura si el directorio de destino ya existe.

## Fase 2: Implementación de la lógica pura
- [x] Crear el módulo principal en `brain/scripts/lib/archive-logic.mjs`.
- [x] Implementar la función de extracción de cuerpo de spec (remover frontmatter).
- [x] Implementar la función de fusión (`mergeSpecs`).
- [x] Verificar que las pruebas unitarias pasen a GREEN.

## Fase 3: Cableado del comando y CLI
- [x] Crear el archivo de entrada CLI `brain/scripts/archive.mjs`.
- [x] Cablear la resolución de rutas mediante `sdd-layout.mjs`.
- [x] Implementar la mudanza física del directorio de cambios al path de destino (`archivePath(iid)`).
- [x] Registrar el script `"brain:change:archive"` en `package.json`.

## Fase 4: Pruebas de integración
- [x] Escribir pruebas de integración en `brain/scripts/archive.test.mjs` que simulen la ejecución CLI de archivo sobre un cambio fixture (flat y legacy) y validen el filesystem resultante.
- [x] Validar que no hay regresiones y que las pruebas pasen.

## Fase 5: Proceso de Backfill (Dogfooding)
- [x] Identificar la lista de cambios completados históricos a archivar en el repositorio.
- [x] Ejecutar el comando de archivo sobre cada uno de estos cambios completados para poblar `openspec/specs/`.
- [x] Verificar que la carpeta `openspec/changes/` quede limpia de los cambios completados y que `openspec/specs/` contenga las especificaciones fusionadas correctamente con sus provenance headers.

## Fase 6: Verificación de calidad final
- [x] Ejecutar `npm run brain:repo:check` y asegurar que no hay referencias prohibidas.
- [x] Ejecutar `npm run brain:nav` y asegurar integridad de la navegación de docs.
- [x] Ejecutar la suite completa de pruebas (`npm test`) y asegurar que todo está verde.
- [x] Ejecutar `npm run brain:change:verify` para validar el cambio en curso.
- [ ] Exportar la memoria de trabajo con `MEMORY_BACKEND=plainfiles npm run memory:share`.

## Micro-decisiones en caliente
- El accessor `isGrandfathered` mantiene el array `LEGACY_GRANDFATHERED` intacto y sellado. Archivar cambia la existencia física pero no la clasificación histórica de los IDs legacy.
