---
status: draft
issue: 590
---

# Propuesta — adr-0018-gitlab-fragment (issue 590)

## Qué

Escribir ADR-0018 desde lo que el código hace HOY, y agregar un check que falla
cuando un `ADR-NNNN` citado no resuelve a un archivo.

## Por qué

Cinco sitios vivos citan `ADR-0018` y el archivo no existe (#590). La superficie
GitLab —fragmento managed que viaja a consumers, dogfooded por este repo, auditada
por `workflow-auth.mjs`, fijada por dos tests— corre sobre una decisión que nadie
puede leer. Es la clase de #586 un paso peor: allá el puntero había *movido*, acá
no hay destino.

## Alcance

- Incluye: el draft ADR-0018 (re-derivado del árbol, no promovido del draft de
  2026-07-10); el check de resolución de citas; el registro honesto de la brecha
  ADR-0023 que el check destapa.
- No incluye: tocar los cinco sitios que citan ADR-0018 — si el ADR se escribe
  ya son correctos (#590 lo pide explícito); promover el ADR (firma humana,
  ADR-0028); ADR-0023 (brecha real, ticket propio).

## Decisión tomada

**Escribirlo**, no renumerar a ADR-0016. Las decisiones que el fragmento encarna
—fragmento-no-root, opt-in por `include:`, entry points Node, mapeo
REQUIRED/DETECTION, pin único de imagen, scoping a `merge_request_event`, la
auditoría de credenciales propia— no están en ADR-0016 y no son su materia.
Redirigir las citas ahí las haría resolver a un documento que no contiene el
razonamiento: un puntero que resuelve al lugar equivocado es más difícil de
detectar que uno que no resuelve.
