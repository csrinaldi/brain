# EPIC — Terminar brain v2.0.0 (plan de acción sobre `feature/v2.0.0`)

> Fecha: 2026-07-24 · Basado en: auditoría de merge (`brain-v2-merge-audit.md`) + 3 escaneos
> (salud general, instalación·distribución, instalación·auto-update).
> Objetivo: **producto serio** — mergeable a `main`, adoptable por otros proyectos y capaz de
> actualizarse sin romperlos. Cubre TODOS los tickets abiertos + hallazgos sin ticketear.

---

## Estado real (código vs lo que los tickets dicen)

- **Sustancia sana.** Sin TODO/FIXME/stubs en producción, sin tests skippeados, sin asserts
  tautológicos, contract-testing fuerte (~1.6x test-a-src). No hay bloqueante profundo nuevo.
- **La deuda es de INTEGRIDAD, no de sustancia:** el feature titular (3-axis) shippeó en
  `cli.mjs` pero `day-start.mjs` —el driver diario— lo ignora y hardcodea `gentle-ai` + un remote
  personal; dos resolvers exportados muertos (`resolveMemory`, `resolveHarness`); el schema del
  reviewer emite `/1` por default contra la doctrina que exige `/2`.
- **Instalación/actualización: endurecida pero no a nivel producto serio.** Frontera managed/local
  enforced en código y fix de clobber #180 en pie — PERO cero rollback, clobber asimétrico
  (`.gemini`/`CODEOWNERS`/`AGENTS.md`/workflows se pisan plain-copy), soft-lockout con archivo
  corrupto, downgrade que sube `schemaVersion` en silencio, `adopt` a medio construir (S1 sólo).
- **Distribución:** git-tag de repo privado github-only; primer install exige editar `package.json`
  a mano (chicken-and-egg, no hay `npx brain init`/`bin`/`postinstall`). El escape hatch real
  (`plain`+`plainfiles`) existe y funciona, pero no se descubre.

### Universo de tickets (20 abiertos) + hallazgos nuevos sin ticket

| Nuevos sin ticket (de los escaneos) | Origen |
|---|---|
| `resolveHarness` dead export (2º resolver muerto) | salud D2 |
| `brain-to-engram.mjs` sin un solo test (corre en cada day:start) | salud D4 |
| Remote personal hardcodeado en `day-start.mjs:252` | salud DR3 |
| Dual `schemaVersion` namespaces (semver vs `'1'`) | salud DR4 |
| 4 parsers `.env` independientes (no 3) | salud |
| Hook compiler byte-idéntico sin test de igualdad | salud |
| Clobber asimétrico: `.gemini`/`CODEOWNERS`/PR-template/`AGENTS.md`/workflows plain-copy | update U3 / dist |
| Sin rollback / atomic-write en upgrade | update U4 |
| Downgrade sube `schemaVersion` sin guard/warn/test | update U5 |
| Archivo consumidor corrupto bloquea TODO upgrade (soft-lockout) | update U6 |
| `--abort-on-collision` opt-in y ausente del `--help` | update U7 |
| e2e ciego a collision/clobber/downgrade/corrupt/partial-write | update U9 |
| `brain-governance-status.mjs` usa `gh` crudo fuera del puerto vcs | dist |
| `brain:adopt` S2 (--apply/migrate/reconcile) nunca construido (#121 cerrado en S1) | dist |
| String en español en el credential helper (`bootstrap.sh:226`) fuera de i18n | dist |
| Primer install exige editar `package.json` a mano (no `npx init`/`bin`/`postinstall`) | dist |

---

## El épico — milestones secuenciados sobre v2

Cada milestone tiene criterio de salida. Las dependencias van de arriba hacia abajo.

### M0 — Higiene cero-riesgo (desbloquea claridad, barato)
- Cerrar #217 y #222 (código ya mergeado; abiertos sólo por no-autoclose de rama no-default).
- Resolver dir duplicado `issue-267/` vs `issue-267-context-synthesizer/` (+ violación de slug).
- `.gitignore` para `.memory/chunks/` (parte de #247).
- **Salida:** la lista de issues abiertos refleja trabajo real, no bookkeeping.

### M1 — Gates de integridad de merge (G1–G4) · *puerta para cortar `main`*
- **G1 / #210** — reordenar el release-gate (correr antes del tag) o registrar risk-acceptance.
- **G2 / #94** — decisión humana de tier de branch protection (Pro/public/self-hosted).
- **G3 / #305** — ADR del split AGENT_PLATFORM/SDD_ENGINE + reconciliar README adapters/default.
- **G4 / #305** — recortar allow-list (`openai/opencode/pi` fantasma) + borrar los 2 resolvers
  muertos (`resolveMemory`, `resolveHarness`).
- **Salida:** v2 puede mergear a `main` con claims honestos y sin capacidades fantasma.

### M2 — Que el decoupling LLEGUE al usuario (hacer real la tesis)
- **#123** — `day:start` usa el harness configurado (hoy hardcodea `gentle-ai`, DR2).
- **DR3** — sacar el remote personal `csrinaldi/brain.git` del check de versión.
- Dedup del hook compiler + test que asegure que ambos emisores quedan iguales.
- Unificar los 4 parsers `.env` en un módulo compartido.
- **Salida:** `AGENT_PLATFORM` funciona end-to-end, no sólo en `cli.mjs`.

### M3 — El reviewer como herramienta de code-review real (el moat)
- **#284 / #266** — reviewer v2 (refuter + causal admission).
- **Review inline por línea** — comentarios anclados a `path:line` dentro del mismo review
  (`event:'COMMENT'` por ADR-0020); schema `brain-review/2` con `comments[]`; GitLab vía
  discussions API (paridad real). Ver §4 del informe de auditoría.
- **DR1** — resolver el default `/1` vs doctrina `/2` (que el código y `reviewer-protocol.md`
  digan lo mismo).
- `brain-governance-status.mjs` a través del puerto vcs (paridad GitLab).
- **Salida:** un dev ve la revisión de código inline en el PR, en GitHub y GitLab.

### M4 — Distribución & auto-update a nivel producto serio (adopción externa)
Distribución:
- `npx brain init` / `bin` / `postinstall` — matar el hand-edit de `package.json` del primer install.
- Decisión de distribución: registry público / mirror / repo público (gap GTM #1 del mercado).
- Fix del string español en `bootstrap.sh:226` (i18n).
- Surfacear `plain`/`plainfiles`/`AGENT_PLATFORM` en los prompts (descubrir el escape hatch).
- **#121-S2 / `brain:adopt`** — `--apply` + migración estructural + reconciliación openspec (brownfield).
Auto-update (riesgo mortal):
- **U3** — clobber asimétrico: gatear `.gemini` por plataforma, mergear/regenerar `AGENTS.md`,
  proteger `CODEOWNERS`/PR-template/workflows (merge o skip-if-edited).
- **U4** — rollback / atomic-write (backup + restore ante fallo a mitad de upgrade).
- **U5** — guard de downgrade + test.
- **U6** — archivo consumidor corrupto no debe bloquear el core update (copiar core antes/indep. del merge, o fail-soft).
- **U7** — hacer descubrible `--abort-on-collision` (y reconsiderar el default).
- **U9** — e2e de los caminos peligrosos (collision/clobber/downgrade/corrupt/partial-write).
- **Salida:** un equipo externo adopta y actualiza sin fricción y sin riesgo de perder su trabajo.

### M5 — Role-as-port (C) · #312 — la prueba de neutralidad
- Ratificar **ADR-0023** (promover el draft a `decisions/` + HOME.md).
- Módulo `roles/` (contrato) + providers `gentle-ai` y `plain` (real, no stub) + `roles.contract.test`.
- **Salida:** neutralidad de agente demostrada con n=2 y test de paridad, no asertada.

### M6 — Paridad de provider & completitud de gobernanza
- **#130** — GitLab rung-2 (release gate) + rung-3 (postmerge auto-revert): hoy github-only.
- **#124** — aprobación como firma HUMANA (el agente nunca aplica `status:approved`).
- **#131** — diff-size excluye líneas de test/fixture del budget de 400.
- **#129** — `project-status.mjs` genérico (sacar el leak Maven/reactor).
- **Salida:** un consumidor GitLab tiene el mismo enforcement que uno GitHub.

### M7 — Backlog & decisiones de scope
- **#268** — registro canónico de track-letters (o adoptar issue-number-as-identity y cerrar).
- **#280** — `brain:status` (cold-boot para el humano).
- **#263** — doc worktree-per-task.
- **#256** — B2 baptism (gated en #247).
- **#247** — retirar materialización de chunks (`engram sync` sin transporte propio).
- **#117** — Bitbucket: **DECIDIR** cerrar (scope creep vs no-goal del plan) o diferir formalmente.
- **D4** — tests para `brain-to-engram.mjs`. **DR4** — unificar namespaces de `schemaVersion`.
- **Salida:** cero trabajo diferido sin registro; scope creep resuelto.

### M8 — Per-stage SDD engine routing (etapas configurables) · *supersede ADR-0019*
La forma final de la premisa #2, según aclaración del owner (2026-07-24): no sólo "configurar qué
etapas existen", sino un **router etapa→engine** — cada fase SDD la maneja un engine distinto,
con varios engines coexistiendo y el owner definiendo cuál en cada etapa.

- **Hoy:** un solo `SDD_ENGINE`, lifecycle neutral, el engine rutea sólo `init` (ADR-0019).
- **Meta:** un mapa `stage → engine` configurable, p.ej. `sdd-new → gentle-ai`, `sdd-verify →
  brain-sdd`, `sdd-archive → gentle-ai`. Múltiples engines por proyecto, binding por fase.
- **Implicación de diseño (crítica):** esto es *exactamente* la alternativa que **ADR-0019 rechazó**
  (`adr-0019-harness-port.md:63-66`, "expandir VALID_OPS para rutear scaffold/verify/archive
  por-backend"). Adoptarla exige un **ADR nuevo que supersede el core de ADR-0019** (el lifecycle
  deja de ser una sola implementación neutral). Es una reversión consciente, no un incremento.
  Invariante a preservar: el **contrato de artefactos** (`openspec/` layout) sigue fijo aunque el
  engine difiera por etapa — los engines normalizan a la misma evidencia.
- **Depende de M5 (#312):** el puerto de rol y el binding etapa→engine comparten superficie de
  config; hacer M8 antes de M5 duplicaría el contrato.
- **Deliverables:** ADR (supersede ADR-0019) · resolver `stage→engine` + schema en
  `brain.config.json` · ≥2 engines cableados por etapa (gentle-ai + un `brain-sdd`/`plain` real) ·
  contract/parity test · guard que el contrato de artefactos no se forkee.
- **Salida:** el owner compone su pipeline SDD eligiendo engine por etapa; neutralidad SDD real
  (premisa #2 de 40% → cumplida).

Secuencia con M8: `… → M5 (role-port) → M8 (stage→engine routing) → M6 → M7`.

### Terminal — Cortar `feature/v2.0.0` → `main`

---

## DECISIÓN (2026-07-24, actualizada): cortar 1.0 AHORA (piloto controlado) → 1.1 = el épico

**Elegido:** mergear `feature/v2.0.0 → main` y **tagear 1.0 ahora**, adoptado por un **piloto
controlado** (repos propios / Sinergia). Como el entorno se controla, la **auto-update-safety NO
bloquea 1.0** — el riesgo de upgrade es propio y se cierra en 1.1. Todo lo nuevo (M2–M8) va a la
línea **1.1**.

### 1.0 (piloto) — set mínimo honesto
- Merge `feature/v2.0.0 → main` + tag **1.0**.
- **REQUERIDO — `KNOWN-LIMITATIONS` en las release notes:** un 1.0 que no miente sobre su madurez.
  Documentar que NO está battle-tested: upgrade sin rollback (no apto para adopters externos),
  garantías de flujo del reviewer inertes (#317), backends fantasma no implementados, primer install
  con paso manual de `package.json`.
- **Barato y recomendado (1-liners):** trim del allow-list fantasma (G4), ADR del 3-axis (G3).

### Línea 1.1 = el épico (M2–M8)
Secuenciado en chained PRs (skill `chained-pr`, budget 400 líneas). Orden sugerido:
`M2 → M3 → M4 → M5 → M8 → M6 → M7`.

### GATE duro antes de abrir a adopción EXTERNA
La **auto-update-safety** (M4 subset — rollback/atomic-write U4, clobber asimétrico U3, lockout U6)
DEBE landear **antes** de que un tercero que no controlás corra `brain:upgrade`. Ese es el límite
entre "piloto" y "producto abierto". Hasta entonces, cada adopter se acompaña a mano.

### Numeración
El tag público arranca en **1.0**; la próxima línea es **1.1** (no 2.1 — `v2.0.0` era el nombre
interno de la rama, el semver público empieza acá). Un solo esquema, sin conviviencia (evita el
problema que #268 intenta resolver).

Secuencia global: `[trim G4 + KNOWN-LIMITATIONS] → merge v2→main + tag 1.0 → 1.1(M2…M8) → [gate: auto-update-safety] → externos`.

### Alternativas descartadas

- **Shape A — Cortar temprano, seguir en `main`:** M1 → cut → M2–M7 como slices sobre `main`.
  Branch chico, `main` limpio rápido, features iteran sobre base estable. (Recomendación previa.)
- **Shape B — Terminar todo en v2, cortar una vez:** M1–M6 sobre v2, un solo cut. Coincide con
  "siempre sobre v2 de todos los tickets para terminar", pero v2 se vuelve una rama gigante de
  larga vida (el riesgo que hace peligrosos los merges).

**Recomendación — Híbrido:** cortar `main` después de **M1 + M2** (main honesto Y el feature
titular funcionando end-to-end), y correr M3–M7 como slices secuenciados sobre `main` bajo la
línea v2.x. Evita la mega-rama sin perder la coherencia de "la línea v2 es dueña de todo esto".
Cada milestone = chained PRs (skill `chained-pr`) para respetar el budget de 400 líneas.
