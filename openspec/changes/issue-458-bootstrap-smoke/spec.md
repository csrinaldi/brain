---
status: draft
issue: 458
---

# Spec — bootstrap-smoke (issue 458)

## REQ-458-1 — `brain:env:init` en frío termina, y termina completo

Exit 0 **y** las post-condiciones que sólo existen si la corrida llegó al final:
`brain.config.json` con esquema completo e identidad derivada del origin del
fixture, `brain/HOME.md`, `AGENTS.md`, `.env`, `core.hooksPath`.

Exit 0 solo no alcanza: #446 murió *después* de escribir config y HOME.md.

## REQ-458-2 — `brain:session:start` termina en 0

## REQ-458-3 — `brain:day:start` termina en 0 y llega a su último paso

No se stubbea nada: medido, degrada solo sin red ni token. Se afirma la
secuencia, no la actualización del ecosistema.

## REQ-458-4 — Una segunda corrida de `env:init` no cambia nada

Manifiesto sha256 antes/después. Excepción única y medida: `.env` se compara
como conjunto de líneas `KEY=value`.

## REQ-458-5 — El fixture es un consumer, no el árbol fuente

`.brain-source` ausente, afirmado. Sembrado por copia, nunca por el verbo bajo
prueba.

## REQ-458-6 — Runtime acotado y fuera del set ratificado

`timeout-minutes` puesto. Workflow propio, no `governance.yml`, no managed path,
no contexto requerido.
