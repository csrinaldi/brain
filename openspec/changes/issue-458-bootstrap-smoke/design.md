---
status: draft
issue: 458
---

# Diseño — bootstrap-smoke (issue 458)

## D1 — Sin docker, a diferencia de sus dos hermanos

`test/fresh-install` instala desde un tag publicado y pide `VCS_TOKEN`;
`test/upgrade` arma un remote git y corre `npm i` reales. Este corre tres verbos
que deben funcionar sin nada disponible, y redirige `HOME` al scratch. Un
contenedor compraría un aislamiento ya obtenido y dejaría el suite incorrible en
una máquina sin docker — que es donde suele estar el mantenedor cuando el
bootstrap se rompe.

## D2 — Un solo entry point, y es node

El wrapper `run.sh` inicial reprobó el drift guard de `auditWorkflowAuth`:
`bash` no está en su lista inerte, así que `bash …/run.sh` se lee como un paso
que alcanza el servidor sin declarar credencial. El guard tiene razón en ser
conservador; el arreglo es tener un entry point que sepa clasificar, no ampliar
su lista. Medido: con `node test/bootstrap-smoke/smoke.mjs`, `npm test` queda
3349/3350 verde.

## D3 — La única relajación: `.env` por conjunto

Medido: la segunda corrida escribe las mismas tres claves en otro orden
(`AGENT_PLATFORM` pasa de la línea 1 a la 3). Es una no-idempotencia real de
`bootstrap.sh`, fuera del reclamo. Se compara el conjunto de líneas
`KEY=value`: una clave ganada, perdida o revaluada sigue fallando, y un guard
extra impide que el conjunto vacío convierta la relajación en "aceptar todo"
(mutación G).

## Micro-decisiones en caliente

- No hizo falta flag offline en `day-start.mjs` (criterio 3 del ticket decía "un
  flag existe o se agrega"): los tres verbos salen 0 sin red. Se afirma además
  que `day:start` **llega a su último paso**, porque salir 0 temprano también
  saldría 0.
- El replay de #446 se hizo con el defecto exacto que arregló `1170df4`:
  renombrar `memory.import.stateUnreadable` a la forma con guión. Reprodujo exit
  127 y la firma de bootstrap parcial.
