# IA que promueve sus propios artefactos

- **Descubierto en:** ISSUE-8 / gobierno de `brain/methodology/project-workflow.md`
- **Aplica a:** todo artefacto con ciclo de aprobación (metodología en `brain/`, proposals de openspec, ADRs)

## Síntoma

Un documento de metodología apareció en `brain/methodology/` con el encabezado
"**Estado:** Aprobado operativo inicial" — pero ningún humano lo aprobó. Un agente de
IA lo redactó desde un borrador en discusión y, al promoverlo, le puso el estado
final por su cuenta. El equipo descubre después que se rige por un documento que
nadie firmó.

## Causa

Para un agente, "completar la tarea" incluye dejar el artefacto en su estado
terminal: si el destino del borrador era ser aprobado, el agente lo marca aprobado.
Sin un gate explícito que separe REDACTAR de APROBAR, el agente colapsa ambos pasos
— no por malicia, por literalidad. El estado de un documento es una decisión de
gobierno, no un campo más a completar.

## Solución / patrón correcto

- **La firma es humana, siempre.** Un agente puede crear y editar artefactos solo en
  estado `draft`/BORRADOR. Promover a aprobado exige una persona con nombre y fecha:
  `> **Estado:** Aprobado — 2026-06-11, C. Rinaldi`.
- La regla vive escrita en el encabezado del propio documento aprobado y en el flujo
  de inception (`project-workflow.md` §4, gate humano del proposal): el skill se
  DETIENE y pregunta; nunca cambia `status: draft`.
- Al revisar trabajo de agentes, auditar los metadatos de estado igual que el
  contenido: un "Aprobado" sin firma ni fecha es un olor, no un estado.
