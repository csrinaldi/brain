# openspec/ — Artefactos SDD (formato OpenSpec)

> **Fuente de verdad** del diseño spec-driven, en Markdown tool-agnostic.
> El harness (gentle-ai hoy) es reemplazable; engram es índice descartable.
> Ver [`../brain/decisions/adr-0002-harness-reemplazable-openspec.md`](../brain/decisions/adr-0002-harness-reemplazable-openspec.md).

## Estructura

```
openspec/
├── specs/                      # requisitos vivos consolidados
│   └── [feature]/spec.md
└── changes/                    # cambios en curso (uno por ticket)
    └── [change-id]/
        ├── proposal.md         # qué y por qué
        ├── design.md           # cómo (decisiones técnicas)
        ├── tasks.md            # checklist de implementación
        └── specs/[feature]/spec.md   # deltas de requisitos del cambio
```

## Reglas

1. **MD manda.** Si engram y estos archivos divergen, estos archivos ganan.
2. **Un change por ticket.** `change-id` se vincula al ID del issue de GitLab.
3. **Committeado siempre.** Los artefactos viajan con el código en el mismo MR.
4. **Reemplaza** a la convención previa `docs/sdd/tasks/` (deprecada).
