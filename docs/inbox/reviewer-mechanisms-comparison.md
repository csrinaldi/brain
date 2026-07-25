# Comparación de mecanismos de revisión: judgment-day vs brain-reviewer

> Fecha: 2026-07-24 · Compara los DOS mecanismos de revisión del ecosistema:
> **judgment-day** (dual-blind-consensus, skill) y **el reviewer externo de brain**
> (`brain:review`, cold external reviewer). No es un juicio de uno sobre el otro — es una
> comparación de cómo funciona cada uno.

---

## Los dos mecanismos en una frase

- **judgment-day:** DOS jueces ciegos en paralelo juzgan el mismo target; sólo es "confirmado" si
  **ambos coinciden**; se aplican fixes de lo confirmado y se **re-juzga** hasta APPROVED/ESCALATED.
  Es redundancia para matar **falsos positivos**.
- **brain-reviewer:** UN reviewer externo frío reconstruye el estado del PR (cold-boot), elige modo
  según el estado del repo, corre evaluadores + un **refuter**, y **postea un veredicto COMMENT-only**
  en el PR. Es persistencia + no-autoridad + un adversario contra **falsos bloqueos**.

---

## Comparación por mecanismo

| Dimensión | judgment-day | brain-reviewer |
|---|---|---|
| **Disparador** | el humano lo invoca (juzgar / dual review) | derivado del estado del repo (modo `tranche`/`checkpoint`/`ruling`), corre sobre el PR |
| **Nº de agentes** | 2 jueces ciegos en paralelo + fix agent + re-judge | 1 reviewer externo (identity), con sub-evaluador refuter |
| **Modelo de consenso** | confirmado **sólo si ambos coinciden**; 1 juez = sospechoso; se contradicen = escala | veredicto único; el refuter **degrada** blockers inferenciales a correcciones/escalación |
| **Falla que ataca** | **falsos positivos** (redundancia: dos deben acordar) | **falsos bloqueos / over-blocking** (el refuter baja el blocker inferencial) |
| **Persistencia** | efímero, síntesis in-session al humano | **persistente**: veredicto comentado en el PR (bloque `brain-review`), sobrevive sesiones |
| **Autoridad** | advisory al humano que lo corre; puede disparar fix agents | **COMMENT-only, estructuralmente nunca autoriza merge** (ADR-0020) |
| **Integración VCS** | ninguna — agentes puros in-session | **provider-neutral** (puerto vcs github/gitlab), postea a PR/MR |
| **Control de loop** | rondas, máx 2 iteraciones y pregunta | **anti-loop + anti-stale** (anclado a head-sha) + fence `deny-set` |
| **Estado** | stateless por corrida | **stateful**: cold-boot reconstruye desde disco + server, ancla cursor/head |
| **Ciclo** | fix → re-judge hasta APPROVED/ESCALATED | postea veredicto; humano/agente actúa; re-corre en head nuevo |
| **Costo de tokens** | **alto** (2 jueces + fix + re-judge por ronda) | **moderado** (1 reviewer + refuter), cold-boot acotado |
| **Corrige o sólo señala** | puede **aplicar fixes** (fix agent) y re-verificar | **sólo señala** (nunca escribe código ni aprueba) |

---

## La lectura clave: son COMPLEMENTARIOS, no competidores

Atacan **fallas opuestas**:

- **judgment-day** minimiza **falsos positivos** por redundancia — dos jueces independientes tienen
  que coincidir para que algo cuente. Su precio es tokens (2×) y que es efímero + sin integración VCS.
- **brain-reviewer** minimiza **falsos bloqueos** con el refuter, y está diseñado para lo que
  judgment-day NO tiene: persistencia en el PR, neutralidad de provider, no-autoridad estructural, y
  control de loop anclado a SHA. Su precio: un solo par de ojos (sin el consenso dual).

Dicho de otro modo: **judgment-day es un mecanismo de CONFIANZA** (¿esto es real? que dos lo firmen),
**brain-reviewer es un mecanismo de FLUJO** (revisión continua, persistente, integrada, no-bloqueante).

---

## Qué puede aprender cada uno del otro (accionable)

- **brain-reviewer ← judgment-day:** un **modo "panel"** para veredictos de alto riesgo — correr 2
  evaluadores ciegos y confirmar sólo por consenso, matando el falso positivo del reviewer único.
  Encaja como opción sobre el modo `ruling`. (Candidato para M3.)
- **judgment-day ← brain-reviewer:** **persistencia + posteo inline por línea** — hoy judgment-day
  vuelca al humano in-session; podría anclar sus confirmados como comentarios en el PR (el mismo
  `comments[]` de `brain-review/2` que M3 va a construir), y heredar el fence anti-loop/deny-set.
- **Ambos ← premisa #7 (tokens):** judgment-day es caro por diseño (2× + re-judge). Un `brain:metrics`
  (Track G, sin construir) permitiría medir cuándo el consenso dual vale el costo vs el reviewer
  único — hoy no hay forma de saberlo.

---

## Síntesis

No hay que elegir uno. **judgment-day** es la herramienta de *veredicto puntual de alta confianza*
(invocado, redundante, efímero, puede arreglar). **brain-reviewer** es la herramienta de *revisión
continua de flujo* (automática, persistente, integrada, no-autoritativa). El movimiento correcto es
hacer que se **nutran**: darle al reviewer un modo-panel opcional (consenso dual para lo caro), y
darle a judgment-day la persistencia/inline del reviewer. Eso conecta directo con M3 del épico.

---

## Evidencia en vivo: el judgment-day sobre el propio reviewer

Se corrió judgment-day (2 jueces ciegos) sobre el reviewer. **Ambos jueces coincidieron
independientemente** en un CRITICAL y varios WARNING(real) — lo que demuestra la tesis de esta
comparación: **el mecanismo de consenso dual detectó lo que el reviewer único (y su propia suite de
tests) no ven.**

Confirmados (ambos jueces):
- **CRITICAL:** en producción `prReviews` devuelve `{state, author}` **sin `body`** en ambos
  providers (en GitLab lee *approvals*, no las notas del veredicto), así que `parseVerdict` da null
  y **`priorVerdicts` queda SIEMPRE vacío**. Consecuencia: el **anti-loop, el `rev≥3→STOP` y la
  carga de veredictos previos y la reconciliación del board están INERTES**. Los tests pasan sólo
  porque los fixtures inyectan un `body` que el código real nunca emite.
- **WARNING(real):** el refuter + schema-v2 + el downgrade causal (#284) son **dead code** — el CLI
  nunca pasa `protocol`, default `/1`; la doctrina §13 (que afirma `/2` "strictly") **miente contra
  el árbol**.
- **WARNING(real):** los `findings` no hacen round-trip (render YAML list vs parse JSON scalar).
- **WARNING(real):** la abstención de self-review está **inactiva en el config default** (`handle:""`).
- **POSITIVO (ambos):** el **límite de seguridad es sólido** — no hay path a APPROVE, COMMENT-only
  hardcodeado, deny-set fail-closed en add y remove. El "nunca autoriza merge" **se sostiene**.

**Lo que esto le dice a la comparación:** el mecanismo de FLUJO (brain-reviewer) tiene el límite de
seguridad sólido pero sus **garantías operativas cableadas contra un shape de puerto que no existe en
runtime** — justo el tipo de falso-negativo que el mecanismo de CONFIANZA (consenso dual) está hecho
para cazar. Es el argumento más fuerte para el **modo-panel** propuesto arriba: si el reviewer
hubiera corrido con dos evaluadores ciegos sobre su propio contrato, el `prReviews`-sin-body no
habría sobrevivido a la suite verde.
