> **SUPERSEDED · 2026-08-20** — Este documento está vencido y se conserva como archivo fechado. La fuente de verdad para estado, prioridad y la línea M5 → M8 es [`ROADMAP-M5-M8.md`](./ROADMAP-M5-M8.md) (#755). Invariante que falló: "`@logikas/brain` unpublished (404)" → publicado `@logikas/brain@1.1.0` el 18/08.

# Handoff de prioridades para agentes

**Leé esto antes de tomar trabajo en este repo.** Responde tres cosas que un agente
frío no puede deducir del árbol: qué ya está hecho (para que no lo rehagas), qué te
va a *rechazar* antes del primer commit, y qué tomar y en qué orden.

Corte: `main` @ `9e9cd36`, 2026-08-18 · **66 issues abiertos · 0 pull requests
abiertos** · 31 ADR firmados.

> **Este documento es un snapshot, y lo dice a propósito.** Cada número de acá abajo
> se midió, no se supuso, y todos se pueden volver a derivar con los comandos de §1.
> Una guía que no puede avisarte que venció es la misma clase de defecto que este repo
> rastrea como `evidence-reader-empty-on-failure`: silencio leído como salud.
> **Re-derivá antes de confiar.**

---

## 1 · Volvé a derivar el estado antes de confiar en este archivo

```bash
git fetch origin main && git log --oneline 9e9cd36..origin/main   # qué entró desde entonces
gh issue list --state open --limit 200                            # o la API
gh pr list --state open
```

**Este archivo está vencido en cuanto alguna de estas deje de valer:**

| Invariante al escribirlo | Cómo verificarla |
|---|---|
| `main` está en `9e9cd36` | `git rev-parse --short origin/main` |
| 66 issues abiertos, 0 PR abiertos | listado de issues/PR |
| `@logikas/brain` sin publicar | `curl -so/dev/null -w '%{http_code}' https://registry.npmjs.org/@logikas%2Fbrain` → `404` |
| **Cero** ADR firmados malformados | §3, el one-liner |

Si las dos primeras se movieron, tomá el orden de abajo como hipótesis de arranque y
volvé a chequear los tickets que pienses tocar. La tercera es #435 y **no se movió en
cuatro cortes**. La cuarta cambió de signo: era «exactamente uno malformado» y ahora es
**cero** — si vuelve a haber uno, §3 volvió a abrirse.

> **Esta es la segunda vez que el archivo vence, y la segunda vez que se refresca a
> mano** (#717, y antes #688). El bloque de estado de esta sección es el único contenido
> del archivo que caduca por sí solo, y es justo el que se escribe a dedo. **Vale
> decidir aparte si se genera** — no está propuesto acá, queda marcado. Ojo con la
> tentación de leer esto como «entonces #459 no se hizo»: `brain:epic:map` **sí**
> shippeó y #459 está cerrado. Lo que estuvo roto durante todo este tiempo es el
> *locator* del mapa — #639 → #702 → #709 → #723, §5 Línea 4 — así que la regeneración
> automática existía y no se podía confiar en ella.

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

> **Un aviso que vas a ver al leer memoria, y que no es un error.** Hoy el store
> reporta `1 duplicate record id` en
> `.memory/records/2026-08-rec-95740755792f0f1c.jsonl` — el único archivo del store con
> más de una línea. Las dos copias difieren **solo en `source`**, que no está hasheado;
> todo campo hasheado es idéntico. Entró en el merge **local** `0724f0f` (2026-08-16),
> donde el driver `merge=union` de `.gitattributes` sí corre — en el botón de merge de
> la forge no corre, y eso es exactamente lo que #677 dictaminó. Se resuelve
> first-wins, y la copia que gana es la que **conserva** la atribución del issue.
> **No lo trates como corrupción.** Su única consecuencia real es que
> `wc -l .memory/records/*.jsonl` sobre-cuenta el store en 1. La causa de fondo es
> **#461** (`issue` y `source` comparten una sola línea `**Fuente:**`, así que las dos
> copias son indistinguibles en el cable), y sigue abierto.

**Un worktree por tarea.** brain lo obliga; `share()` ancla su export a la raíz del
worktree que lee (#657).

**Presupuesto de diff: 1000 líneas cambiadas** (`tier: lite`). El `governance.ignoreList`
de `brain.config.json` excluye `*.test.mjs`, `openspec/**`, `.memory/**`, los lock files
y `AGENTS.md` — **pero no `docs/**`**. (Que `docs/inbox/**` no esté gobernado es **#327**,
todavía abierto y todavía sin firma.)

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

`brain:promote` tiene dos rutas y se rompieron por separado. **Las dos están cerradas
ahora** — esta sección quedó como referencia operativa, no como bloqueo.

### Ruta A — escribir un ADR NUEVO · ✅ CERRADA (#675 / #674, PR #678)

`transformDraft` borraba del preámbulo solo las líneas en blockquote (`>`) antes de
anteponer su propio header de firma, así que un draft con una línea `**Status**:` plana
producía un artefacto firmado con **dos** — sin negarse. Ahora `promote-guards.mjs`
pregunta «¿está bien formado el artefacto que estoy por firmar?» *antes* de escribir
nada.

**Reproducido el 2026-08-18** contra el draft que sigue en `brain-drafts/`, corriendo
`transformDraft` + `checkShippedContent` en proceso:

```
✗ single-status-line — the artefact this run would write is malformed:
    brain/project/decisions/adr-0023-sdd-role-port.md
    2 `**Status**:` line(s), expected exactly 1 (§1c act 1).

  found at:
    line 3 (preamble)  **Status**: Accepted
    line 6 (preamble)  **Status**: Draft (not ratified — queued behind the v2.0.0 → main merge)

  Nothing was written and nothing was staged.
```

**Qué significa para vos:** promover un ADR nuevo volvió a ser seguro, y el rechazo
nombra el arreglo. La forma de la casa pone el status del draft dentro del blockquote
que el verbo borra. El archivo `brain-drafts/adr-0023-sdd-role-port.md` todavía tiene
la forma mala y **va a ser rechazado hasta que se le corrija el preámbulo** — eso es
comportamiento correcto, no un bloqueo.

> **No lo midas con `grep -c '^\*\*Status\*\*:'` sobre el draft.** Esa cuenta da `1` y
> te va a hacer creer que el draft está sano. El guard cuenta las líneas del **artefacto
> que el run escribiría**, después de que `transformDraft` antepone su propio header de
> firma. El one-liner de abajo sirve para ADR **ya firmados**, no para drafts.

### Ruta B — ENMENDAR doctrina firmada · ✅ CERRADA (#676, PRs #692 + #696)

`applyStatusAct` (`brain/scripts/lib/amendment-draft.mjs`) rechaza cualquier target que
no tenga exactamente una línea `**Status**:`. El censo sobre los 31 ADR firmados hoy no
devuelve nada:

```bash
for f in brain/project/decisions/adr-*.md; do
  n=$(grep -c '^\*\*Status\*\*:' "$f"); [ "$n" != 1 ] && echo "$n  $f"
done
# (sin salida)
```

`adr-0029-two-sources-one-graph.md` estaba malformado en `main` desde 2026-08-11 y
shippeaba en el paquete. Se reparó a mano (PR #692) y **después** entró el test
estructural (PR #696).

**El orden se respetó, y es la parte que conviene llevarse.** El test nace rojo, y
shippearlo junto con la excepción que lo pone verde es la protección aparente que #499
existe para rechazar. Primero la reparación, después el guard. El test llama a
`checkSingleStatusLine` en `amendment-draft.mjs` — **no re-derives la regla** si tocás
esto.

**Qué significa para vos:** enmendar cualquier ADR firmado funciona hoy. Si el one-liner
vuelve a imprimir una línea, §3 se reabrió y la reparación es del mantenedor —
`brain/project/decisions/**` es Tier 3.

---

## 4 · Lo que acaba de entrar — no lo rehagas

Desde el corte anterior (`3eff9af`) entraron **11 merges a `main`** y cerraron **10
issues** que la versión previa de este archivo no podía conocer. Dos cadenas largas
llegaron a destino.

| Área | Cerrado | Qué significa para vos |
|---|---|---|
| Doctrina — Ruta B | **#676** (PRs #692 + #696) | §3. El único ADR firmado malformado se reparó y el guard estructural entró **después**. El censo da cero |
| Diagnóstico de rechazos | **#673** (PR #693) | El deny branch de `actor-check` ya distingue «no alcanza» de «nunca se leyó». Un rechazo se puede diagnosticar |
| Localizador del grafo | **#639** (PR #695) → **#709** (PRs #720 · #722 · #721) | El bloque de grafo se declara por su **fence tag** (` ```brain-graph/1 `), no por un escalar interior — ADR-0032. El splitter `lib/fenced-blocks.mjs` pasó a acordar con el renderer que produjo el texto. **Queda un hueco: #723** (abajo) |
| Puerto SDD / M5 | **#599** (PR #711) | Cerrado **por medición**, no por escritura: no hay role port en el árbol. Cambia M5 de «ratificar un ADR» a «construir el puerto y después escribir el ADR» — §5 Línea 2 |
| Causa de fallos en el port VCS | **#606** (PR #700) | `prStatusRollup` ya no se traga la causa. **#699** abre los otros catorce verbos que todavía sí |
| Lectura de bloques | **#612** (PR #698) | Un espacio al final de una línea clave ya no hace que `scalar()` se coma el valor |
| Memoria — export scope | **#701** (PRs #705 #706 #707 #708 #718 #719) | Cerrado, pero **el hallazgo es la cadena, no el fix**: se entregó como `feature-branch-chain`, los cuatro PR hijos mergearon y **el PR terminal nunca se abrió**. Once commits varados y todos los gates en verde. Es **#713** |
| Salida del revisor | #690 (PR #691) | La declaración de controles dice qué corrió, no que corrió |
| Este archivo | #688 (PR #689) | Su primera versión. Venció en un día hábil — por eso existe #717 |

**Cerrado sin mergear: PR #703.** Una revisión fría ciega encontró que el fix no cerraba
la clase para la que se escribió e introducía dos regresiones. Se refiló como #709
(cerrado) y **#710** (abierto). No lo revivas.

**#709 cerró su cadena entera, terminal incluido** — `#720 → #722 → #721 → main`, issue
cerrado. Es la **primera** reproducción en vivo de una `feature-branch-chain` que llega
a destino, y por eso mismo es el caso de prueba contra el que conviene medir #713.

---

## 5 · Las cuatro líneas, y qué sigue en cada una

El corte es la cadena de valor del producto, no los milestones del épico:
**instalar · trabajar · recordar · gestionar.** Los cuatro números suman 66.

### Línea 1 · Instalación — 10 abiertos · *a un paso de cerrar, y sin moverse*

El repo **ya es público**, el paquete es `@logikas/brain` con su allowlist de `files`, y
`private` está apagado. Todo lo preparable está preparado.

**#435 es la línea entera, y no es tarea de agente.** Medido hoy, sin cambios respecto
de los tres cortes anteriores:

```
corridas del workflow publish.yml . . . 0
registry @logikas/brain . . . . . . . . 404   (control: express → 200)
```

El dispatch necesita `NPM_BRAIN_TOKEN` scopeado a `@logikas/*` y un install real
verificado. **Solo el mantenedor puede hacerlo.** Todo lo demás de la línea —
#659 #658 #647 #436 #415 #414 #643 #316 #632 — va al lado y es trabajo ordinario.

### Línea 2 · Flujo de trabajo — 35 abiertos · *la más grande y estructural*

El lazo de revisión cerró y la puerta de la doctrina también. Lo que queda está una capa
más abajo: **qué garantiza que lo que el lazo firma sea válido.**

- **Revisor:** **#682** es el ítem más grande del roadmap del revisor y **arranca con
  una ruling, no con código** — el eje de independencia del refutador. Su propio cuerpo
  dice que el alcance es el entregable. Después #631 #284 #611.
- **Cadena SDD:** `#312 → #576 → #323 → #456`. **#599 cerró y le dejó el punto de
  partida honesto** (ver el recuadro). Sin tocar en cuatro cortes, y sigue siendo la
  única palanca de los dos ejes más débiles del producto.
- **Entrega:** **#713** — una cadena que se corta a la mitad es invisible para todos los
  gates, porque el defecto es un PR que nunca se abrió y los seis chequeos corren *sobre
  un PR*. #697 (`brain:ship` no puede shippear ninguna rama que `brain:ticket:start`
  crea) es de la misma familia práctica.
- **Autoridad de tickets:** #545 #564 #124 #600 #588 #131 #694.
- **Guards y causa:** #699 (catorce verbos del port que todavía se tragan la causa)
  #569 #560 #559 #489 #488 #453 #603 #602 #335 #336 #348 #349 #129 #117 #256 #267 #605.

> **#599 ya midió, así que no vuelvas a medir.** ¿Existe un SDD role port en el árbol?
> **No.** `brain/roles/` no existe; `brain/scripts/harness/cli.mjs:99` sigue en
> `export const VALID_OPS = ['init'];` — una sola op ruteada. `brain-drafts/adr-0023-sdd-role-port.md`
> es un draft para trabajo que nunca se hizo, y #599 reescribió sus dos citas a forma de
> draft reservado en vez de escribir un ADR para un mecanismo inexistente. **M5 está en
> cero implementación**, no a una ratificación de distancia, y como M8 (#323) depende de
> M5, M8 también. El orden correcto es **construir el puerto, después escribir el ADR
> desde lo que existe** — no al revés.

### Línea 3 · Memoria — 8 abiertos · *el cluster de sharing quedó vacío; abrió el de lectura*

Compartir memoria está cerrado (siete tickets + #677). Lo que queda es otra cosa:
**qué pasa cuando lo que se lee no se puede parsear.**

- **#461** — `issue` y `source` comparten una sola línea `**Fuente:**`, así que dos
  records distintos son indistinguibles en el cable. Es la causa del aviso de duplicado
  de §2, y su resolución es una decisión de arquitectura, no un fix.
- **#712** — un `brain.config.json` ilegible tira en silencio todos los patrones de
  secreto custom; el scan cae a defaults y **no para**. Un archivo, dos lectores, uno
  solo endurecido.
- **#714** — `npm test` da verde en shell limpia y **rojo** con `BRAIN_ME*` en el
  ambiente. Una suite que depende del entorno no mide lo que decís que mide.
- **#247** — la migración C4, que además destraba el adaptador Antigravity contado en la
  Línea 2. **#361**, **#638** (i18n), **#715** y **#716** (los strings del config
  ilegible, y tres sitios que imprimen «is not valid JSON» dos veces).

### Línea 4 · Management — 13 abiertos · *el instrumento se está arreglando ahora mismo*

Acá es donde más se movió, y donde queda el trabajo más barato con más apalancamiento.

- **El arco del localizador.** #639 cerró, #703 se cerró sin mergear, **#709 cerró
  completo con ADR-0032**. Quedan tres:
  - **#723** — *recién firmado*. `epic-graph.mjs` nunca desestructura `skipped`, así que
    la fila 4 de D6 nunca se cableó: **cuatro formas que esconden una declaración
    completa devuelven `null`** en vez de negarse en voz alta — blockquote, indentado
    4+, comentario HTML, y una fence foránea sin cerrar que la tapa. Es
    `evidence-reader-empty-on-failure` adentro del delivery que existía para
    terminarlo. **La suite está en verde y no dice nada al respecto: ningún test varía
    ese eje.** El impacto va en la dirección segura — omite, no fabrica.
  - **#710** — el locator responde ABSENT a bodies que declaran, más dos regresiones.
    Sus findings 1 y 4 son el mismo eje que #723 visto del otro lado; conviene decidirlos
    juntos.
  - **#702** y **#704** — la clase original, y el hardcode de idioma en la salida de
    `brain:epic:map` (dos ADR Accepted en desacuerdo).
- **#457** (medición de costo en tokens) gana con arranque temprano — la ventana solo
  crece, y se llevan **35 merges a `main` desde el 2026-08-14** sin medir.
- #280 #268 #327 · #356/#357 (Q2/Q3) · #313 (este épico) · #642 (i18n) · #717 (este
  archivo).

---

## 6 · Orden sugerido

| # | Trabajo | Por qué acá |
|---|---|---|
| **0** | **dispatch de #435** — *solo humano* | El único ítem que no se movió en **cuatro** cortes, y el único que nadie más puede hacer. Todo a su alrededor ya está pago |
| **1** | **ruling de #682** — *humano* | Ahora que §3 cerró, es el ítem humano más grande que queda. El eje de independencia va decidido antes de cualquier código; `escalate: human` ya funciona y es gratis, y puede ser el primer slice correcto |
| **2** | **#723 + #710, juntos** | #723 está firmado y es barato: cablear un campo que el splitter ya produce. #710 findings 1 y 4 son el mismo eje del otro lado. Arreglan el instrumento del que depende la Línea 4 entera, y ninguno de los dos tiene test que varíe su eje — **la mutación es el entregable, no el fix** |
| **3** | **#713** | Una cadena cortada a la mitad es invisible. #709 acaba de dar la primera reproducción en vivo de una cadena que **sí** llega a destino: medí contra ese caso |
| **4** | `#312 → #576 → #323 → #456` | La palanca SDD. Desbloqueada, sin tocar en cuatro cortes, y #599 ya dejó el punto de partida honesto. Construí el puerto, después escribí el ADR |
| **5** | #699 · #631 · #545 · #694 · #697 | Baratos, y cada uno protege un instrumento del que depende el resto del trabajo. #699 es #606 aplicado a los catorce verbos que quedaron |
| **6** | #659 #658 #647 · #569 #560 #559 · #605 #642 #638 #715 #716 · #643 #632 #714 | Mutuamente independientes — material de paralelismo. Incluye el tema i18n |
| **7** | #247 → #256 · #280 · #457 · #436 #415 #414 · #335 #336 · #461 #712 | Fuera del camino crítico; #457 gana con arranque temprano. #461 necesita una decisión antes que código |

**i18n cruza tres líneas y es media jornada en total:** #605 (el scaffold del SDD emite
español y nunca lee `docs.language`, que acá es `en`), #642 (`day:start`), #638 (los
strings del reporte de duplicados viven en el código en vez de los catálogos), y ahora
#715/#716 (los strings del config ilegible). Los cinco son visibles para cualquiera que
adopte brain, y ninguno es difícil.

---

## 7 · Lo que solo puede hacer el humano

1. **Disparar el publish de #435** y cerrarlo. Sigue siendo el ítem cero.
2. **Rulear el eje de independencia de #682** antes de que se escriba código.
3. **Firmar 6 tickets sin aprobar:** **#268 #327 #588 #631 #697 #699.** Nada de eso
   puede arrancar sin la firma, y un agente nunca puede aplicar la etiqueta.
   (`#588` tiene `status:needs-review`, que no es una firma.)
4. **Rulear #117** (Bitbucket) — cerrarlo con la decisión registrada es la recomendación
   vigente — y **ratificar Q2/Q3** (#356/#357). Q2 vale más ahora que el repo es público.

> **Corrección al corte anterior, y vale la pena leerla.** Esa versión listaba **13**
> tickets sin firmar. Nueve ya están firmados (#600 #361 #357 #356 #349 #348 #280 #129
> #117) y se firmaron sin que el documento se enterara. La cola era menos de la mitad de
> lo que el archivo decía, y un agente que le hubiera creído habría dejado trabajo
> firmado sin tomar. **Una cola de bloqueos que se mantiene a mano sobre-reporta el
> bloqueo** — es la misma clase que §8 nombra, del lado en que el silencio se lee como
> obstáculo en vez de como salud.
>
> Ya no está en esta lista: **reparar el ADR malformado** (#676 parte 1, hecho — §3) y
> **firmar #709 #710 #712 #713 #714 #723**, todos firmados.

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

**Y #723 la encontró adentro del cambio que la había escrito.** #709 shippeó para
terminar exactamente esta conflación, y dejó `skipped` producido y nunca consumido: el
lector sigue contestando «nadie declaró» cuando quiere decir «no lo pude obtener». Se
escapó porque la tarea que lo pedía se tildó contra la mitad que era construible en ese
momento — el campo lo creaba el PR siguiente, y cuando llegó nadie volvió. **Si tu
cambio parte un requisito en dos PR por una restricción de orden, la segunda mitad no
tiene quién la reclame. Anotala donde se vea.**

Cuando termines un ticket acá, la pregunta que rindió todas las veces no es «¿mi cambio
funciona?» sino **«¿esto es un incidente o una tasa?»** — #676 existe porque alguien se
la hizo sobre #675.

---

**Fuentes:** este archivo se derivó de la API de GitHub (66 issues, 0 PR), de `git log`
sobre `3eff9af..9e9cd36`, del censo de `**Status**:` sobre los 31 ADR firmados en disco,
de una corrida en proceso de `transformDraft` + `checkShippedContent` (§3 Ruta A), y de
sondas en vivo al registry de npm y al workflow de publish. Donde entre en conflicto con
#313, **manda #313**; donde entre en conflicto con el árbol, **manda el árbol**.
