# brain v2.0.0 — Auditoría de Mergeabilidad a `main`

> Fecha: 2026-07-23 · Rama: `feature/v2.0.0` · Método: 6 auditores en paralelo
> (arquitectura, comandos/gates, motor SDD & roles, issues/tracks, memoria, competitivo)
> Cada hallazgo con evidencia `archivo:línea` o `#issue`.

---

## Veredicto de una línea

**v2 ES mergeable a `main` — condicional.** No hay bloqueante de código profundo. La
sustancia (puertos VCS/memoria, contrato de artefactos SDD, exit-code contract, memoria
durable) es sólida y está fuertemente testeada (~1.6x test-a-src, 107 src / 136 test).
Lo que impide un merge **limpio** es una mezcla de: **1 bug real**, **1 decisión pendiente**,
y **deuda de documentación/higiene** — todo acotado y barato.

---

## 0-bis. Scorecard de conformidad de diseño (¿cumplimos la tesis?)

Medición de las 7 premisas del producto contra el código, no contra la intención. `%` = qué tan
completa está la premisa como capacidad real y usable por un consumidor. Cada brecha mapea a un
milestone del épico (`brain-v2-epic-plan.md`).

| # | Premisa | Estado | % | Evidencia clave | Brecha → milestone |
|---|---------|--------|---|-----------------|--------------------|
| 1 | **Harness agnóstico** | 🟡 Parcial | 60 | `AGENT_PLATFORM` es puerto real (dispatch-by-import); backends antigravity/claude/gentle-ai/plain | allow-list fantasma (`openai/opencode/pi`), default=antigravity traiciona neutralidad, `day-start` hardcodea gentle-ai → **M1/M2** |
| 2 | **SDD agnóstico + config de etapas** | 🟠 Parcial-débil | 40 | `SDD_ENGINE` (gentle-ai/plain), lifecycle de artefactos neutral | `SDD_ENGINE` rutea **solo `init`**; las etapas son **fijas** (`REQUIRED_ARTIFACTS` const, no configurables); sin roles por etapa → **M5 (#312)** |
| 3 | **Reviewer externo agnóstico + refuter** | 🟠 Parcial-débil | 45 | límite de seguridad sólido (no-APPROVE, COMMENT-only, deny-set fail-closed) — confirmado por 2 jueces | **judgment-day confirmó (ambos jueces):** `prReviews` sin `body` → `priorVerdicts` siempre vacío → **anti-loop / rev-bound / board INERTES**; refuter+schema-v2 = **dead code** (CLI default `/1`); findings no round-trip; self-review off en config default; sin inline por línea → **M3 (ahora con bug CRITICAL)** |
| 4 | **Memoria agnóstica** | 🟢 Fuerte | 90 | engram + plainfiles n=2 real, portable (Node+git), integridad (scrub/id/round-trip), records git-native | retiro de chunks (#247), `.gitignore` nit → **M0/M7** |
| 5 | **VCS agnóstico** | 🟢 Bueno | 75 | github + gitlab, puerto más limpio, contract test de paridad, sin `gh/glab` fuera de `providers/` | rung-2/rung-3 github-only, `brain-governance-status` con `gh` crudo, issue-link diverge → **M6** |
| 6 | **Ver flujo del proyecto** | 🟡 Parcial | 55 | `day:start`, `tracker-board`, `review:board/queue`, sintetizador de contexto (#267), `session-start` | **`brain:status` (#280) NO construido** — falta la vista cold-boot del humano; `project-status` con leak Maven (#129) → **M7 (#280)** |
| 7 | **Memoria evolutiva en el repo para agentes** | 🟢 Fuerte | 85 | `.memory/records/*.jsonl` commiteados, `session-start` hidrata, formato brain-owned (ADR-0017), recuperable con `git clone` + editor | matching del sintetizador es naive (substring de filename) → **M3/M7** |
| 8 | **Minimizar uso de tokens** | 🟡 Parcial | 50 | sintetizador = slice dirigido + core-floor + failsafe (emite referencias, no dumps); `session-start` read-only/local/sin red; search truncado; executor doctrine = zero prompt drift | **sin medición** (Track G `brain:metrics` nunca se construyó), sin presupuesto de bytes/tokens ni truncado explícito en el sintetizador → **M7 (Track G)** |

**Lectura del scorecard:**
- **Fuertes (cumplen la tesis):** memoria agnóstica (4), memoria evolutiva en repo (6), VCS (5). Son los ejes donde brain YA es un producto.
- **El talón de Aquiles es la premisa 2 (SDD con config de etapas, 40%):** el motor rutea solo `init` y las etapas están hardcodeadas. Es la promesa más lejos de cumplirse — y #312 (role-as-port) es el primer paso, pero "configurar etapas" (agregar/quitar/reordenar fases) ni siquiera está en el roadmap todavía.
- **La #7 (tokens) no se puede afirmar sin medir:** hay intención de diseño, pero sin `brain:metrics` no hay forma de saber si efectivamente minimiza. "Minimizar sin medición es aspiración."
- **Neutralidad general sobre-declarada:** premisas 1 y 3 tienen la arquitectura pero no el alcance (default no-neutral, feature que no llega al entrypoint, reviewer sin inline).
- **La premisa #3 cayó de 70% a 45% tras el judgment-day:** el límite de seguridad es sólido, pero un CRITICAL confirmado por 2 jueces (`prReviews` sin `body` → garantías anti-loop/rev-bound INERTES en producción, tapado por la suite verde) + el refuter como dead code bajan el eje del reviewer de "parcial-bueno" a "parcial-débil". El scorecard promedia ahora **~63%** — sólido como sistema, incompleto como producto que cumple su propia tesis.

---

## 1. Estado por eje

### Arquitectura & diseño — *conditional-go, no limpio*
- Seam real de ports+adapters vía `cli.mjs` dispatcher + dynamic `import()`, repetido de forma
  consistente en 3 subsistemas (harness, memory, vcs). El **puerto VCS es el más limpio**
  (`vcs/cli.mjs`, contrato de verbos + `vcs.contract.test.mjs` que fuerza paridad + guard
  anti path-traversal). Aislamiento real verificado: no hay `gh/glab` fuera de `providers/`,
  no hay `engram` fuera de `memory/backends/` (regression tests lo protegen).
- **PERO el "3-axis decoupling" — feature titular de la rama — es la parte menos terminada:**
  - Allow-list de plataformas anuncia `openai/opencode/pi` que **no existen** → hard-fail en
    dispatch (`harness/cli.mjs:49` vs `backends/` real).
  - Default real de plataforma = `antigravity` (escribe `.gemini/settings.json`), mientras el
    README promete `gentle-ai` (`cli.mjs:53` vs `README.md:160`).
  - Compilador de hooks **duplicado byte-a-byte** entre `claude.mjs:22-49` y `antigravity.mjs:55-82`.
  - `resolveMemory` exportado pero **muerto** — `memory/cli.mjs:48` re-lee el env por su cuenta
    (3 parsers `.env` independientes).
  - **No hay ADR** del split AGENT_PLATFORM/SDD_ENGINE. ADR-0019 todavía describe UN solo puerto
    `SDD_HARNESS`. Para un repo cuya tesis ES la gobernanza documentada, esto es una brecha de
    integridad de diseño.
  - README "Adapters" lista `SDD_HARNESS/MEMORY_BACKEND/vcs.provider` pero **no** `AGENT_PLATFORM`/
    `SDD_ENGINE`, que son los que el código lee primero. Docs y código divergieron.

### Funcionalidad & superficie de comandos — *broad y sólido en el core, no honesto como historia completa*
- ~30 verbos. Core SDD/governance/memoria: sólido y testeado.
- **Bugs/gaps severos (no cosméticos):**
  - **#210 (bug real):** `release.yml` corre en push de tag, DESPUÉS de que el tag ya existe →
    el `exit 1` no puede bloquear nada. Evidencia: v0.9.2/v0.9.3 shippearon con el gate en rojo.
  - **Auto-revert postmerge (rung 3) es 100% GitHub-only** — usa `gh` crudo, sin abstracción
    vcs, **sin equivalente GitLab**. Un consumidor GitLab no tiene red de seguridad rung-3.
  - GitHub issue-link job compara contra el literal `"main"`, mientras `run-check.mjs` (que usa
    GitLab y los tests de paridad) compara contra el default-branch real. Divergencia de policy.
- **Comandos grandes y recientes SIN documentar:** `brain:review` (subsistema ~10 módulos,
  maduro) y `brain:context:compile` (#267, último commit) — invisibles en README/AGENTS.
- **`brain:status` no existe** (#280 abierto). El "loop day:start → status → review" no está
  shippeado como loop coherente: 1 real+documentado (day:start), 1 real+indescubrible (review),
  1 inexistente (status).
- `project:status` **no es genérico** — filtra lógica Maven/reactor (#129).

### Motor SDD & roles de agente — *coherente como contrato de artefactos; NO es un motor de roles*
- **Respuesta a la pregunta central:** brain **NO** define roles de agente por acción SDD como
  gentle-ai — **por diseño (ADR-0019)**. Brain posee el **contrato de artefactos** y **verbos**;
  el rol (modelo, tools, prompt) lo delega al harness (gentle-ai).
- Cero bindings de modelo/tools en `brain/` (búsqueda tree-wide: 0 hits reales).
- `SDD_ENGINE` **suena** a motor pluggable pero enruta **una sola op: `init`** (`cli.mjs:99`
  `VALID_OPS=['init']`). El lifecycle SDD (scaffold/verify/archive/phase-order) es UNA
  implementación neutral, no ruteada por engine.
- Solo existen **2 roles reales**: el *executor doctrine* (§13 reviewer-protocol, subagente =
  ejecutor puro sin drift) y el *reviewer/refuter* (`review/evaluators/refuter.mjs`, es una
  función read-only, no un agente con modelo). **Ninguno atado a una fase SDD.**
- **Los 8 actions SDD (explore/propose/spec/design/tasks/apply/verify/archive) son role-less del
  lado de brain.** Ese es el gap que preguntaste: real, total, y by-design.
- Inconsistencia viva: reviewer-protocol §6 dice esquema `brain-review/1`, §13 dice `/2`
  (#284 landeó v2 sin actualizar §6). El código soporta ambos.

### Issues / tracks — *no limpio, pero no bloqueado por código faltante*
- Tracks A(VCS)/B(harness ports)/C(memoria)/D(auto-revert)/E(archive)/H(reviewer) mayormente
  ejecutados y cerrados. C y D2 code-complete en la rama.
- **#217 y #247 abiertos son artefactos de bookkeeping** — el código ya está mergeado en
  `feature/v2.0.0`; siguen abiertos solo porque merges a rama no-default no auto-cierran issues.
- **Redundancias:** #130 pide lo que Track A (A2/A3) ya shippeó; #217 huérfano por sus propios
  hijos; #305 re-deriva y renombra los puertos de B/C sin reconciliar vocabulario (dos modelos
  mentales para "qué backend está activo"); dirs duplicados `issue-267/` y
  `issue-267-context-synthesizer/` (el bare viola la regla de slug obligatorio).
- **Trabajo diferido SIN ticket (silenciosamente dropeado, no formalmente diferido):** D1
  (memory-gate session-record mode), D3 (diffBudget configurable), E2 (spec-staleness), B3
  (adapter Fission — el "n=2 real"), Track G entero (`brain:metrics`).
- **Scope creep:** #117 (Bitbucket) contradice la no-goal explícita del propio plan
  (`PLAN-adapters-v3.md:455-457`, "no speculative n=3").
- **Ironía de gobernanza:** #268 (registro de track-letters) abierto 8+ días para arreglar el
  caos de nombres, mientras #305/#267/#280 entran SIN letra — el drift que #268 debía prevenir.

### Memoria & durabilidad — *mergeable, NO bloqueante*
- Write-truth = `.memory/records/*.jsonl` (append-only, `merge=union`, git-native).
- **Cutover C0–C2b SÍ ocurrió** (PR #223/#224/#225 mergeados, corrida real: 275 escritos/index 136).
  #222 abierto = higiene de GitHub, no trabajo incompleto.
- Pluggability **real** (engram + plainfiles, mismo op-surface; plainfiles rechaza ruidosamente
  lo que no soporta). Portabilidad **real**: plainfiles se banca solo (solo Node + git, `rg`
  opcional) — un consumidor adopta la memoria sin MCP de engram.
- Integridad presente y enforced: secret-scrub fail-closed (2 gates), id-integrity
  (sha256 sobre JCS-canonicalizado), round-trip contract testeado.
- Único item abierto real: #247 — `engram sync --export` sigue materializando `.memory/chunks/`
  como efecto colateral del binario. Follow-up scopeado, no sorpresa. **Nit:** falta `.gitignore`
  para `.memory/chunks/` (3.6MB de cruft sin trackear ensuciando `git status`).

### Competitivo / mercado — *gana como sistema, pierde como producto*
- **Value prop diferenciada y real:** único en el landscape 2026 que fusiona governance con
  DIENTES en el merge (fail-closed en CI, no sugerencias) + SDD + memoria de equipo git-native +
  neutralidad de agente, en un solo harness.
- **Pierde en lo que decide adopción:** distribución (instalás desde tag de repo privado vs
  spec-kit 111k★ / OpenSpec 52k★ / Task Master 25k★), DX de onboarding (multi-paso vs "sin keys,
  minutos"), superficie MCP (ellos MCP-native, brain no expone verbos por MCP), docs, credibilidad.
- **Posicionamiento:** lee como 3 productos grapados. Contra cada competidor mono-eje brain parece
  un also-ran; solo gana en la INTEGRACIÓN. El frame ganador es **governance-first** — liderar con
  los dientes que nadie más tiene; SDD y memoria como el *cómo*, no co-headliners.
- Riesgo que toca la pregunta de roles: la neutralidad es aspiración — único harness implementado
  = gentle-ai, único backend = engram (default). "Todo swappable" aún no demostrado en amplitud.

---

## 2. Gates de merge (hacer ANTES de cortar `main`)

| # | Gate | Severidad | Por qué |
|---|------|-----------|---------|
| G1 | **#210** — arreglar o aceptar-el-riesgo del release-gate (corre tras el tag) | ALTA | Único item que amenaza integridad de release; el gate "fail-closed" está inerte al nivel de outcome |
| G2 | **#94** — decidir tier de branch protection (Pro/public/self-hosted) | MEDIA-ALTA | Sin esto, `main` no tiene enforcement rung-1, por más limpio que esté el código |
| G3 | **ADR del split AGENT_PLATFORM/SDD_ENGINE** + reconciliar README adapters + default de plataforma | MEDIA | Brecha de integridad de diseño en un repo cuya tesis es la gobernanza documentada |
| G4 | **Trim allow-list** de `resolvePlatform` a backends implementados (sacar openai/opencode/pi) | MEDIA | Anuncia capacidades que hard-failean |
| G5 | Cierre administrativo de **#217/#247/#222** | BAJA | Ruido puro para quien lee la lista de issues para juzgar readiness |
| G6 | 1-línea de doc para **`brain:review`** y **`brain:context:compile`** + `.gitignore` de `.memory/chunks/` | BAJA | ~1/3 de lo que shippea es indescubrible hoy |

**Post-merge (backlog legítimo, no bloquea):** paridad GitLab de rung-2/rung-3, `brain:status`
(#280), reviewer v2 (#284), de-duplicar hook compiler, reconciliar #305 vs vocabulario B/C,
resolver #268, cerrar/re-scopear #117, fix §6/§13 `brain-review/1` vs `/2`, resolver dirs
duplicados issue-267.

---

## 3. La decisión estratégica que la auditoría fuerza (roles de agente)

Tu pregunta —"¿nos faltan definir roles de agentes como gentle-ai con SDD?"— tiene una respuesta
que es una **bifurcación de producto**, no un bug:

- **Opción A — brain sigue role-agnostic (status quo, ADR-0019).** Brain es el *contrato*
  (artefactos + gates + memoria + governance); cada harness trae sus roles. Pro: separación
  limpia, neutralidad real. Contra: brain **no es usable standalone** — un consumidor NECESITA
  gentle-ai (u otro harness que aún no existe) para tener roles por fase. La "neutralidad" es
  teórica hasta que exista un segundo harness (B3 nunca se ticketeó).
- **Opción B — brain define una capa de roles de referencia** (modelo/tools/reads-writes por
  acción SDD), que un harness puede overridear. Pro: brain deja de depender de gentle-ai para ser
  útil; demuestra la neutralidad con ≥2 inhabitantes. Contra: rompe la frontera de ADR-0019,
  más superficie que mantener.

**Recomendación:** para "usable por otros proyectos para su gestión" (tu objetivo declarado),
la Opción A tal como está **no alcanza** — obliga a adoptar gentle-ai. O bien ships el harness
`plain` con roles mínimos reales (probando n=2), o brain define la capa de roles de referencia
(Opción B). Sin una de las dos, "agent-neutral" es marketing, no producto.

### DECISIÓN (2026-07-24): C ahora → B después

Camino elegido: **implementar C ahora, aspirar a B como futuro. C es el primer paso hacia B,
no es trabajo desechable.**

- **C — el ROL como PUERTO:** brain posee el contrato de lo que un rol declara
  (`{action, model-tier, tools, reads, writes}`), implementado por gentle-ai **y** `plain`, con
  test de paridad. Replica el patrón que ya funciona en VCS (contrato de verbos + 2 providers) y
  memoria (op-surface + 2 backends). Cierra el único eje donde brain tiene contrato pero no n=2.
- **B (futuro) — implementación de referencia de primera parte:** brain publica su propio set de
  roles por acción. B **no reemplaza** a C; B es un tercer implementador del puerto de C, autoría
  de brain. Por eso el orden C→B no tira nada.
- **Mínimo concreto para que C sea n=2 real hoy:** el engine `plain` debe implementar el puerto de
  rol de verdad (no solo `init`). Requiere un ADR que extienda/supersede ADR-0019 (que hoy dice
  que los roles son trabajo del harness).

---

## 4. Capacidad a sumar: revisión de código INLINE por línea (pedido 2026-07-24)

**Estado hoy (verificado en código):** el reviewer analiza y rendera UN bloque-veredicto
`brain-review/1` y lo postea como **un review a nivel PR** vía `prReviewComment`
(`review/poster.mjs`). El provider (`vcs/providers/github.mjs:373`) hace
`POST /repos/{p}/pulls/{n}/reviews` con `{ body, event: 'COMMENT' }` — **solo cuerpo, sin
`comments[]`**. Los hallazgos citan `archivo:línea` en prosa dentro del cuerpo, pero **no son
comentarios anclados** al diff. El dev lee un muro de texto separado del código.

**Lo que se quiere:** cuando el reviewer no entiende algo o pide un cambio, que lo emita como
**comentario inline anclado a `path:line`**, empaquetado DENTRO del mismo review, de modo que en
el PR aparezca la revisión de código en las líneas del diff (igual que una review humana) + el
comentario-resumen a nivel PR que la vincula. Un dev ve todo en el mismo PR.

**Por qué es alto leverage:** esto es exactamente lo que separa un "bot que comenta" de una
herramienta de review que un dev adopta. Es el eje donde brain puede diferenciarse del resto
(reviewer con dientes + comentario por línea anclado), y hoy está a mitad de camino.

**Qué hay que cambiar (aterrizado):**
1. **Schema del veredicto** — `brain-review/2` (ya existe por #284) debe llevar un `comments[]`
   con `{ path, line, side, body, kind: 'question' | 'change-request' }`. Hoy los hallazgos son
   prosa en el cuerpo renderizado.
2. **Verbo `prReviewComment`** — aceptar un `comments` opcional y reenviarlo al payload de la
   reviews API (`comments: [{ path, line, side, body }]`). En GitHub es la MISMA llamada, casi
   gratis. **GitLab NO** — usa `POST /merge_requests/{iid}/discussions` con `position` (base/head
   SHAs + path + line). Es una tarea real de paridad de provider, no un free-ride.
3. **Evaluadores** (refuter/tranche/checkpoint) — deben emitir hallazgos anclados (`path`+`line`),
   no solo un veredicto global, para que el poster tenga qué adjuntar.
4. **Idempotencia** — extender los locks anti-loop / anti-stale y el `deny-set` a los comentarios
   inline: no re-postear el mismo comentario de línea en cada corrida. El anclaje por `head_sha`
   ya existe en `poster.mjs`; los inline necesitan la misma disciplina.
5. **Restricción de ADR-0020 (respetarla, no romperla):** sigue siendo `event: 'COMMENT'`, nunca
   `APPROVE`/`REQUEST_CHANGES`. El "change-request" es un COMENTARIO advisory, no un estado de
   review bloqueante de GitHub — el reviewer NUNCA es autorizador de merge. Esto se documenta como
   constraint de diseño: los inline dan la UX de una review humana, pero sin la autoridad.

**Ubicación natural:** es la evolución del reviewer v2 (#284) — encaja como una slice de Track H,
no como feature suelto. Candidato a issue propio una vez ratificada la dirección.

---

## 5. Bottom line

- **¿Mergeable a `main`?** Sí, tras G1–G4 (G1 y G3 son los que de verdad importan). G5/G6 son
  higiene que igual conviene.
- **¿Usable por otros proyectos?** El core de memoria/governance/SDD-contract: sí, hoy. Pero la
  promesa "agent-neutral, todo swappable" está **sobre-declarada** — un solo harness, un solo
  backend por default, roles delegados a un harness que el consumidor está forzado a adoptar.
- **¿A la altura del mercado?** Como ingeniería, adelante. Como producto, no todavía: el gap es
  go-to-market (distribución, DX, MCP, docs), no sustancia. Y el moat real —governance con
  dientes— está enterrado bajo un feature-list de 3 productos.
