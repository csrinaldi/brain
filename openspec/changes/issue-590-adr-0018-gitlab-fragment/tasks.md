---
status: draft
issue: 590
---

# Tareas — adr-0018-gitlab-fragment (issue 590)

- [x] Medir el estado en `main` @ `51bbcaa`: 5 sitios citan ADR-0018, no existe
- [x] Decidir escribir vs renumerar → escribir (proposal.md)
- [x] RED FIRST: el check de resolución de citas, rojo antes de cualquier arreglo
- [x] Corregir el check: auto-exclusión + lectores que fallan fuerte
- [x] Prueba por mutación: 6 mutaciones, cada una roja, cada diff impreso y
      revertido byte a byte
- [x] Probe de dos vías: con el ADR en disco el suite queda 7/7 verde
- [x] Escribir el draft ADR-0018 re-derivado del árbol
- [x] Verificar que `brain:promote` lo transforma (destino, header, commit cmd)
- [ ] **HUMANO**: `npm run brain:promote -- openspec/changes/issue-590-adr-0018-gitlab-fragment/brain-drafts/adr-0018-gitlab-governance-fragment.md`
      y commitear la firma en esta rama. Hasta entonces `npm test` está rojo por
      construcción.

## Micro-decisiones en caliente

Ver `design.md` — se consolidaron ahí durante el vuelo.

## Fuera de alcance, reportado

- `.gitlab-ci.yml:1` dice que `phase-order`, `actor-check` y `brain-writes-reviewed`
  son DETECTION vía `allow_failure`. El fragmento no tiene ningún `allow_failure`
  (las 3 ocurrencias son comentario). El comentario del root quedó viejo tras la
  promoción de #358 Phase 5. Archivo fuera del reclamo.
- ADR-0023: citado por dos archivos en `docs/inbox/**`, draft sin promover en
  `brain-drafts/adr-0023-sdd-role-port.md`. Misma clase que #590. Ticket propio.
