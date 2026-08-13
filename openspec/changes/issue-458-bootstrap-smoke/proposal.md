---
status: draft
issue: 458
---

# Propuesta — bootstrap-smoke (issue 458)

## Qué

Un job de CI que corre en frío los tres verbos que todo adoptante ejecuta —
`brain:env:init`, `brain:session:start`, `brain:day:start`— sobre un fixture de
consumer fresco, más idempotencia del primero.

## Por qué

#446: una clave de catálogo i18n con guión hizo abortar `brain:env:init` en exit
127 a mitad del bootstrap. `main` estuvo roto para todo adoptante fresco y CI
verde: ningún job ejecuta esos verbos. #449 puso dos guards sobre *ese catálogo*
—el síntoma—. Con #435 (repo público) el costo se corre del mantenedor al
adoptante en su primer contacto.

## Alcance

- Incluye: el harness, el workflow propio, y el registro de lo que se midió.
- No incluye: reparar la no-idempotencia de `.env` que el propio suite encontró
  (la escribe `brain/scripts/bootstrap.sh`, fuera del reclamo); agregar un flag
  offline a `day-start.mjs` (no hizo falta: ya degrada); un alias en
  `package.json` (fuera del reclamo).

## El marco que dio #590

La pregunta de #458 —¿el smoke es red propia de brain o parte del producto?— es
la que ADR-0018 contesta desde el otro lado: brain *envía* el fragmento GitLab a
los consumers y no lo corre en su propio CI, porque "lo que brain distribuye" y
"lo que brain chequea sobre sí mismo" son dos superficies. El smoke es la
segunda. De ahí: workflow propio, NO `governance.yml`, NO managed path, NO
contexto requerido.
