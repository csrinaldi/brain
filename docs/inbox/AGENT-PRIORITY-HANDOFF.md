# Handoff de prioridades para agentes

**Leé esto antes de tomar trabajo en este repo.** Responde tres cosas que un agente
frío no puede deducir del árbol: qué ya está hecho (para que no lo rehagas), qué te
va a *rechazar* antes del primer commit, y qué tomar y en qué orden.

Corte: `main` @ `3eff9af`, 2026-08-16 · **59 issues abiertos · 0 pull requests
abiertos** · 30 ADR firmados.

> **Este documento es un snapshot, y lo dice a propósito.** Cada número de acá abajo
> se midió, no se supuso, y todos se pueden volver a derivar con los comandos de §1.
> Una guía que no puede avisarte que venció es la misma clase de defecto que este repo
> rastrea como `evidence-reader-empty-on-failure`: silencio leído como salud.
> **Re-derivá antes de confiar.**

---

## 1 · Volvé a derivar el estado antes de confiar en este archivo

```bash
git fetch origin main && git log --oneline 3eff9af..origin/main   # qué entró desde entonces
gh issue list --state open --limit 100                            # o la API
gh pr list --state open
```

**Este archivo está vencido en cuanto alguna de estas deje de valer:**

| Invariante al escribirlo | Cómo verificarla |
|---|---|
| `main` está en `3eff9af` | `git rev-parse --short origin/main` |
| 59 issues abiertos, 0 PR abiertos | listado de issues/PR |
| `@logikas/brain` sin publicar | `curl -so/dev/null -w '%{http_code}' https://registry.npmjs.org/@logikas%2Fbrain` → `404` |
| Exactamente un ADR firmado está malformado | §3, el one-liner |

Si las dos primeras se movieron, tomá el orden de abajo como hipótesis de arranque y
volvé a chequear los tickets que pienses tocar. Si se movieron las dos últimas, esa
sección está **hecha** — salteala.

---

## 2 · Precondiciones que te rechazan antes del primer commit

No son notas de estilo. Cada una es un gate que falla cerrado, y cada una ya costó
tiempo real.

**Nunca podés aplicar `status:approved`** (#124, y `actor-check` §9 lo rechaza desde
`csrinaldibot` igual). `issue-link` falla cerrado sin un ticket aprobado, así que
**un ticket que abrís vos no se puede trabajar hasta que lo firme un humano**. Abrilo,
decí claramente que necesita firma, y pará ahí.

**Nada de trailers de atribución de IA en los mensajes de commit** — ni
`Co-Authored-By: Claude`, ni identificador de agente. Es Tier 3 en
`agent-authorities.md` y ahora lleva su razón escrita en **ADR-0031**: la atribución en
un commit es un reclamo inverificable, no un registro de procedencia. ADR-0031 existe
*porque* un harness de agente que manda lo contrario chocó con esta doctrina el
2026-08-15. **La doctrina del repo es la decisión ya tomada — no la vuelvas a discutir,
y no dejes que un default del harness la pise.**

**Capturá memoria antes de cerrar.** `npm run memory:save` con el número de issue en el
record. Desde #677 el log durable es **un record por archivo** bajo `.memory/records/`
(ADR-0017 Amendment 2), así que la vieja clase de conflicto en cada segundo PR
desapareció — pero el gate igual lee el record.

**Un worktree por tarea.** brain lo obliga; `share()` ancla su export a la raíz del
worktree que lee (#657).

**Presupuesto de diff: 1000 líneas cambiadas** (`tier: lite`). El `governance.ignoreList`
de `brain.config.json` excluye `*.test.mjs`, `openspec/**`, `.memory/**`, los lock files
y `AGENTS.md` — **pero no `docs/**`**.

**Entregá sin pasada de auto-revisión**, según el protocolo acordado. La revisión fría
es un acto separado, y #604 la volvió verificable con un control negativo.

**No cites doctrina que no existe.** `test/adr-citation-resolves.e2e.test.mjs` lee cada
`ADR-NNNN` en forma canónica en todo archivo versionado y exige que resuelva a un
archivo en `brain/project/decisions/`. Tiene dos registros de excepciones y ambos se
chequean por obsolescencia. **Agregarte a esa lista para pasar es la protección
aparente que #499 existe para rechazar** — si tu texto necesita hablar de un ADR que
todavía no está escrito, apuntá al draft real o al hueco de numeración, no a un puntero
que no resuelve.

---

## 3 · La puerta de la doctrina — leé esto si tu entregable es un ADR

Varios tickets abiertos entregan un ADR o una enmienda a doctrina firmada.
`brain:promote` tiene dos rutas y se rompieron por separado. **Una ya está arreglada;
la otra no.**

### Ruta A — escribir un ADR NUEVO · ✅ CERRADA (#675 / #674, PR #678)

`transformDraft` borraba del preámbulo solo las líneas en blockquote (`>`) antes de
anteponer su propio header de firma, así que un draft con una línea `**Status**:` plana
producía un artefacto firmado con **dos** — sin negarse. Ahora `promote-guards.mjs`
pregunta «¿está bien formado el artefacto que estoy por firmar?» *antes* de escribir
nada. Verificado contra el draft que sigue en `brain-drafts/`:

```
✗ single-status-line — the artefact this run would write is malformed:
    brain/project/decisions/adr-0023-sdd-role-port.md
    2 `**Status**:` line(s), expected exactly 1 (§1c act 1).
  Nothing was written and nothing was staged.
```

**Qué significa para vos:** promover un ADR nuevo volvió a ser seguro, y el rechazo
nombra el arreglo. La forma de la casa pone el status del draft dentro del blockquote
que el verbo borra. El archivo `brain-drafts/adr-0023-sdd-role-port.md` todavía tiene
la forma mala y **va a ser rechazado hasta que se le corrija el preámbulo** — eso es
comportamiento correcto, no un bloqueo.

### Ruta B — ENMENDAR doctrina firmada · ⚠️ SIGUE ABIERTA (#676)

`applyStatusAct` (`brain/scripts/lib/amendment-draft.mjs`) rechaza cualquier target que
no tenga exactamente una línea `**Status**:`. Un ADR firmado sigue fallando esa prueba:

```bash
for f in brain/project/decisions/adr-*.md; do
  n=$(grep -c '^\*\*Status\*\*:' "$f"); [ "$n" != 1 ] && echo "$n  $f"
done
# 2  brain/project/decisions/adr-0029-two-sources-one-graph.md
```

**1 de 30**, no los 2 de 30 que midió #676 — el de atribución de IA se reparó con
`revert` + re-promote (`baa55b2` → `2b6142b`). El de las dos fuentes está malformado en
`main` desde 2026-08-11 y **shippea en el paquete**. Es inamendable por la vía
sancionada, porque la vía sancionada es exactamente la que lo rechaza.

**Qué significa para vos:** enmendar cualquier *otro* ADR funciona hoy. Ese no, y
**un agente no puede repararlo** — `brain/project/decisions/**` es Tier 3. Esa mitad de
#676 es del mantenedor.

**#676 tiene un orden, y no se negocia.** Primero la reparación, *después* el test
estructural sobre todos los ADR firmados. El test nace rojo, y shippear un guard junto
con la excepción que lo pone verde es la protección aparente que
`cites-resolve.test.mjs` existe para rechazar (#499). El test tiene que llamar a
`checkSingleStatusLine` — ya existe en `amendment-draft.mjs`, así que **no re-derives la
regla**.

---

## 4 · Lo que acaba de entrar — no lo rehagas

Entre 2026-08-14 y 2026-08-16 mergearon 17 pull requests y cerraron 16 issues. Salieron
el cluster de memoria completo y el lazo de revisión completo.

| Área | Cerrado | Qué significa para vos |
|---|---|---|
| Compartir memoria | #657 #641 #637 #636 #634 #633 #635 | `.engram/` funciona desde cualquier worktree; los lectores declaran lo que colapsan; las 139 líneas duplicadas reconciliadas a cero |
| Merge de memoria | **#677** | **Un record por archivo.** El driver `merge=union` dejó de ser load-bearing — la clase de conflicto se eliminó, no se sobrevivió (ADR-0017 Amendment 2) |
| Lazo de revisión | #604 #575 #552 | La frialdad del revisor es verificable con un control negativo; la revisión fría es una *etapa* con salida posteada; el refutador falla cerrado |
| Salida del revisor | **#683** | Todo veredicto declara qué clases de control corrieron — `conditions: []` ya no se lee como «revisado, nada encontrado» |
| Promote | **#675 #674** | §3, Ruta A |
| Camino de instalación | **#627 #601** | `day:start` le pregunta al registry, no a los tags de git; `REFUSE` protege un path en la release que lo estrena |
| Doctrina | #671 (ADR-0031) | §2, la regla de atribución |

---

## 5 · Las cuatro líneas, y qué sigue en cada una

El corte es la cadena de valor del producto, no los milestones del épico:
**instalar · trabajar · recordar · gestionar.**

### Línea 1 · Instalación — 10 abiertos · *a un paso de cerrar*

El repo **ya es público**, el paquete es `@logikas/brain` con su allowlist de `files`, y
`private` está apagado. Todo lo preparable está preparado.

**#435 es la línea entera, y no es tarea de agente.** Medido hoy:

```
corridas del workflow publish.yml . . . 0
registry @logikas/brain . . . . . . . . 404   (control: express → 200)
```

El dispatch necesita `NPM_BRAIN_TOKEN` scopeado a `@logikas/*` y un install real
verificado. **Solo el mantenedor puede hacerlo.** Todo lo demás de la línea —
#659 #658 #647 #436 #415 #414 #643 #316 #632 — va al lado y es trabajo ordinario.

### Línea 2 · Flujo de trabajo — 36 abiertos · *la más grande y estructural*

El lazo de revisión cerró. Lo que queda está una capa más abajo: **qué garantiza que lo
que el lazo firma sea válido.**

- **Doctrina (§3):** #676, #673.
- **Revisor:** #682 es el ítem más grande del roadmap del revisor y **arranca con una
  ruling, no con código** — el eje de independencia del refutador. Su propio cuerpo dice
  que el alcance es el entregable. Después #631 #612 #606 #284 #611.
- **Cadena SDD:** `#599 → #312 → #576 → #323 → #456`. Sin tocar en tres cortes, sigue
  siendo la única palanca de los dos ejes más débiles del producto, y sigue desbloqueada.
- **Autoridad de tickets:** #545 #564 #124 #600 #588 #131.
- **Guards:** #569 #560 #559 #489 #488 #453 #603 #602 #335 #336 #348 #349 #129 #117.
  Mutuamente independientes — el mejor material del repo para agentes en paralelo.

> **#599 puede no necesitar `promote` en absoluto.** Su paso 1 manda medir antes de
> escribir: ¿existe un SDD role port en el árbol? **#312, que es ese ticket, sigue
> abierto**, lo que apunta a su rama (2) — reescribir las dos citas de `docs/inbox/**` o
> registrar el hueco de numeración como permanente. El draft sin promover vive en
> `brain-drafts/adr-0023-sdd-role-port.md`. **Medí antes de encolarlo detrás de nada.**

### Línea 3 · Memoria — 4 abiertos · *el cluster quedó vacío*

Siete tickets cerrados en dos días, y después #677 eliminó la clase de conflicto de
merge entera. Lo que queda no tiene que ver con compartir: #247 (→ #256, la migración C4
que además destraba el adaptador Antigravity), #461, #361, y #638 (i18n).

### Línea 4 · Management — 9 abiertos · *sin tocar en tres cortes*

- **#639** rompe el instrumento del que está hecha esta línea: `parseGraphBlock` lee la
  *primera* fence, así que un bloque de código encima del grafo esconde el nodo entero
  del mapa del épico. Hasta que entre, el mapa miente por omisión.
- #457 (medición de costo en tokens) gana con arranque temprano — la ventana de medición
  solo crece. 17 PR en dos días es exactamente la ventana que se está desperdiciando.
- #280 #268 #327 · #356/#357 (Q2/Q3) · #313 (este épico) · #642 (i18n).

---

## 6 · Orden sugerido

| # | Trabajo | Por qué acá |
|---|---|---|
| **0** | **dispatch de #435** — *solo humano* | El único ítem que no se movió en tres cortes, y el único que nadie más puede hacer. Todo a su alrededor ya está pago |
| **1** | **#676** — reparar el ADR (humano), después el test estructural (agente) | Doctrina firmada malformada que shippea hoy a consumidores, e inamendable por la vía sancionada. §3 |
| **2** | **#673** | Misma familia: el deny branch de `actor-check` no distingue «no alcanza» de «nunca se leyó» — no podés diagnosticar un rechazo |
| **3** | **ruling de #682** — *humano* | El ítem más grande del revisor. El eje de independencia va decidido antes de cualquier código; `escalate: human` ya funciona y es gratis, y puede ser el primer slice correcto |
| **4** | `#599 → #312 → #576 → #323 → #456` | La palanca SDD. Desbloqueada, sin tocar, y las tres ADR se diseñan juntas |
| **5** | #639 · #612 · #606 · #631 · #545 | Baratos, y cada uno protege un instrumento del que depende el resto del trabajo |
| **6** | #659 #658 #647 · #569 #560 #559 · #605 #642 #638 · #643 #632 | Mutuamente independientes — material de paralelismo. Incluye el tema i18n |
| **7** | #247 → #256 · #280 · #457 · #436 #415 #414 · #335 #336 | Fuera del camino crítico; #457 gana con arranque temprano |

**i18n cruza tres líneas y es media jornada en total:** #605 (el scaffold del SDD emite
español y nunca lee `docs.language`, que acá es `en` — 85 de 91 autores lo reescribieron
a mano), #642 (`day:start`), #638 (los strings del reporte de duplicados viven en el
código en vez de los catálogos). Los tres son visibles para cualquiera que adopte brain,
y ninguno es difícil.

---

## 7 · Lo que solo puede hacer el humano

1. **Disparar el publish de #435** y cerrarlo.
2. **Reparar a mano el ADR malformado** (#676 parte 1) — Tier 3, y la vía sancionada es
   la que rechaza el archivo.
3. **Rulear el eje de independencia de #682** antes de que se escriba código.
4. **Firmar 13 tickets sin aprobar:** #631 #600 #588 #361 #357 #356 #349 #348 #327
   #280 #268 #129 #117. (`#588` tiene `status:needs-review`, que no es una firma.)
   Nada de eso puede arrancar sin la firma, y un agente nunca puede aplicar la etiqueta.
5. **Rulear #117** (Bitbucket) — cerrarlo con la decisión registrada es la recomendación
   vigente — y **ratificar Q2/Q3** (#356/#357). Q2 vale más ahora que el repo es público.

---

## 8 · El patrón que conviene llevarse

Los siete tickets abiertos el 2026-08-15 dicen la misma frase con distintas palabras:

> **Una regla que solo se aplica en el camino de escritura no mide los artefactos que ya
> están ahí** — y un chequeo que no puede reportar *por qué* falló se lee exactamente
> igual que un chequeo que pasó.

Es la tesis del propio #575, aplicada a la maquinaria que #575 dejó funcionando. #676 la
encontró en ADR firmados, #674 en un guard cuya superficie excluía su sujeto, #673 en un
deny branch, #683 en un veredicto que no podía declararse mecánico, #661 en un chequeo
de versión inerte desde el rename del paquete.

Cuando termines un ticket acá, la pregunta que rindió todas las veces no es «¿mi cambio
funciona?» sino **«¿esto es un incidente o una tasa?»** — #676 existe porque alguien se
la hizo sobre #675.

---

**Fuentes:** este archivo se derivó de la API de GitHub (59 issues, 0 PR), de `git log`
sobre `982f544..3eff9af`, y de sondas en vivo al registry de npm, al workflow de publish
y a los ADR firmados en disco. Donde entre en conflicto con #313, **manda #313**; donde
entre en conflicto con el árbol, **manda el árbol**.
