---
status: draft
issue: 590
---

# Spec — adr-0018-gitlab-fragment (issue 590)

## REQ-590-1 — ADR-0018 existe y describe el mecanismo actual

El draft registra lo que el árbol hace hoy. Toda divergencia con el draft de
2026-07-10 queda tabulada en el propio ADR, no reconciliada en silencio.

## REQ-590-2 — Ningún archivo vivo cita un ADR que no se puede abrir

Un check falla nombrando archivo, línea y número por cada cita que no resuelve a
`brain/project/decisions/adr-NNNN-*.md`.

Superficie: todo archivo trackeado salvo `.memory/`, `openspec/` y `brain-drafts/`
—donde una cita sin destino no es podredumbre sino un borrador— y el propio
archivo del check.

## REQ-590-3 — Las excepciones son exactas y caducan

Pares `(archivo, número)`, nunca patrones. Una entrada que ya no corresponde a
una cita real falla. `ADR-0018` no es registrable como excepción: un test lo
impide, porque asentarlo registraría el defecto en vez de arreglarlo.

## REQ-590-4 — Los lectores fallan fuerte

Ningún lector devuelve vacío ante un fallo: un scan que no corrió y un árbol
limpio deben ser distinguibles. Verificado manejando ambos lectores contra
entradas ilegibles.
