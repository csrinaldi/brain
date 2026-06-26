# ADR-0005 — Adapter de Harness: SDD_HARNESS Selector + Contrato de Verbos

**Estado**: Accepted  
**Fecha**: 2026-06-26

## Contexto

El harness SDD (la herramienta que ejecuta el flujo spec-driven) es una elección por desarrollador, no por repositorio. Diferentes devs de un mismo equipo pueden preferir diferentes herramientas.

Sin un punto de indirección, el repo quedaría acoplado a una herramienta concreta (gentle-ai, Cursor, un script custom) y cambiar de harness requeriría editar múltiples archivos.

## Decisión

El harness sigue el patrón adapter:

- **Contrato de verbos**: `brain/core/methodology/harness-contract.md`. Define los verbos abstractos del flujo SDD que cualquier harness debe implementar (`sdd-new`, `sdd-apply`, `sdd-verify`, `sdd-archive`, etc.). El repo no sabe ni le importa cómo los implementa el harness elegido.

- **Selector**: `SDD_HARNESS` en `.env`. Default: `gentle-ai`.

- **Punto de binding**: `scripts/bootstrap.sh` §6. Contiene el `case "$SDD_HARNESS"` que inicializa la implementación elegida. Para gentle-ai: `gentle-ai install` configura skills, engram y gga. Para un harness custom: el `case` debe implementar su init o hacer `warn "sin rutina de init conocida"`.

- **Skills por dev**: cada desarrollador configura sus skills del harness en su entorno local (no en el repo). El repo solo define el contrato de verbos.

## Consecuencias

- **Positivo**: el repo es agnóstico al harness. Los artefactos SDD en `openspec/` son leíbles por cualquier herramienta.
- **Positivo**: un dev puede usar un harness diferente al resto del equipo sin romper el flujo del repo.
- **Negativo**: `bootstrap.sh` §6 requiere un `case` por harness conocido — no es extensible sin editar el archivo.
- **Negativo**: la calidad de los artefactos SDD producidos depende del harness elegido; el contrato de verbos no garantiza la calidad del output.
