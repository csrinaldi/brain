---
status: draft
issue: 590
---

# Diseño — adr-0018-gitlab-fragment (issue 590)

## D1 — Escribir el ADR, no renumerar

Ver `proposal.md`. ADR-0016 es la normalización del contexto CI; el fragmento
GitLab es otra decisión.

## D2 — El check vive en `test/**`, no en `check-refs-rules.mjs`

`repo:check` valida *referencias prohibidas*; esto es una resolución. Además
`brain/project/check-refs-rules.mjs` queda fuera del reclamo de archivos de esta
línea de trabajo.

## D3 — El check se excluye a sí mismo

Medido: escaneándose a sí mismo produjo 8 hallazgos de 13, todos sobre su propio
texto (los registros deben *nombrar* los números que eximen). La exclusión es de
un único path, anclado a `import.meta.url` por un guard, para que no pueda
re-apuntarse a un segundo archivo. Costo declarado: un puntero podrido en los
comentarios de ese archivo no se detecta.

## D4 — Dos registros con semánticas distintas

`FIXTURE_CITATIONS` (números falsos deliberados en material de test — nunca
resuelven) y `KNOWN_GAPS` (podredumbre real que este ticket no repara, cada
entrada con su motivo). Ambos con guard de caducidad.

## D5 — El PR queda ROJO hasta la firma

El check pasa cuando el ADR existe en `brain/project/decisions/`, y el agente no
puede ponerlo ahí (ADR-0028: el commit es la firma; `brain:promote` se niega en
non-TTY). Es deliberado: un PR verde significaría que el ADR se escribió a mano
o que la cita se excusó, y ambas cosas son el defecto.

## Micro-decisiones en caliente

- El probe de que el check pone verde con el ADR presente se hizo creando el
  archivo destino, corriendo, y borrándolo — nunca commiteado. Un nombre en
  mayúsculas no matchea `ADR_FILE_RE`, lo que confirmó de paso que la forma del
  nombre está anclada igual que en `brain:promote`.
- La brecha ADR-0023 (`docs/inbox/**`, draft sin promover en `brain-drafts/`)
  apareció al medir. Queda en `KNOWN_GAPS` con motivo, no reparada: los archivos
  están fuera del reclamo y es otro ticket.
