# brain (csrinaldi/brain) — Análisis unificado, decisión de arquitectura y cola de trabajo

> **Documento de handoff.** Destinatario: un agente que va a ejecutar trabajo sobre el repo.
> **Fecha:** 2026-07-27 · **Commit analizado:** `dc9a85e` (merge PR #343) · **Rama:** `main`
> **Revisión 3** — incorpora la resolución de Q1 (el reviewer recupera su capa de juicio LLM), el
> diseño del port `REVIEWER_ENGINE` con los jueces de gentle-ai como adapters, la identidad de
> finding por hunk (§5.5) y el acoplamiento Q3 ↔ Tanda 3 (§9).
> **Fuentes unificadas:** Análisis A (Claude, con lectura de código verificada) + Análisis B (otra IA,
> sin acceso al árbol) + épico #313 + `docs/inbox/brain-v2-merge-audit.md` +
> `docs/inbox/reviewer-mechanisms-comparison.md` + decisiones del owner en sesión.

---

## 0. Cómo usar este documento

1. **Leé la sección 1 antes que nada.** Es el sustrato verificado del repo. El Análisis B falló porque razonó sobre una arquitectura imaginada; no repitas el error.
2. **Toda afirmación fáctica lleva cita `archivo:línea` o comando reproducible.** Si vas a actuar sobre un hallazgo, reverificalo — el árbol se mueve.
3. **La sección 5 es la decisión de arquitectura ya tomada.** No la reabras; implementala.
4. **La sección 8 es la cola de trabajo.** Todo lo anterior es su justificación.
5. **La sección 9 tiene lo que sigue abierto** y requiere decisión de @csrinaldi.

---

## 1. Sustrato verificado del repo

**Confirmado por inspección directa. No asumas nada distinto.**

| Dimensión | Realidad verificada | Comando |
|---|---|---|
| Lenguaje | JavaScript ESM puro (`.mjs`), Node ≥22 | `find . -name "*.mjs" \| wc -l` → 259 |
| Framework | **Ninguno.** Cero dependencias, cero devDependencies | `jq '.dependencies, .devDependencies' package.json` → `null, null` |
| TypeScript / NestJS | **No existen.** Ni `.ts`, ni `tsconfig.json`, ni `nest-cli.json` | `find . -name "*.ts" -o -name "tsconfig*.json"` → vacío |
| LOC | ~49.000 líneas en `.mjs` | `find . -name "*.mjs" -print0 \| xargs -0 wc -l` |
| Tests | **1940 tests, 0 fallas, ~22s** | `npm test` |
| Memoria | `.memory/` (records + index + manifest). **No existe `.brain/`** | `ls .memory` |
| Estructura | `brain/core` (producto) · `brain/project` (consumidor) · `brain/scripts` (harness) · `openspec/` (SDD) · `.memory/` | `find brain -maxdepth 2 -type d` |
| Invocación de LLM | **Ninguna en todo `brain/scripts/`** — hoy | `grep -rn "anthropic\|openai\|completions" brain/scripts` → vacío |
| Historia | 501 commits, 2026-06-28 → 2026-07-26. 495 de @csrinaldi, 4 de csrinaldibot | `git log --format='%an' \| sort \| uniq -c` |
| Licencia | **No hay archivo LICENSE** | `ls \| grep -i licen` → vacío |
| Versión | v1.0.0 cortado y tagueado (piloto controlado). #313 traquea la línea 1.1 | `CHANGELOG.md:8` |

**Modelo mental correcto:** brain es un conjunto de scripts Node sin dependencias que (a) impone estructura sobre artefactos SDD en `openspec/`, (b) mantiene un formato de memoria durable content-addressed en `.memory/`, (c) corre gates determinísticos en CI, y (d) expone verbos de VCS a través de un port con adapters `github`/`gitlab`. Los agentes lo consumen leyendo `AGENTS.md` y ejecutando `npm run brain:*`.

**brain es la capa de evidencia que además orquesta un motor de juicio enchufable.** No es un orquestador de agentes.

---

## 2. Auditoría de validez del Análisis B

### 2.1 Afirmaciones fácticas — todas falsas

| Afirmación de B | Verificación |
|---|---|
| "módulos en NestJS/TypeScript: core, projects, memory, workflows, engines" | **FALSO.** Sin NestJS, sin TS, sin esos módulos |
| "`.brain/runs/{run_id}/state.json`" | **FALSO.** No existe `.brain/` ni `runs/` |
| "`.brain/architecture/*.md`" | **FALSO.** Los ADRs viven en `brain/project/decisions/` |
| "interfaz `EngramAdapter`" / clases adapter | **FALSO.** Los backends son módulos ESM con funciones exportadas |
| "consulta vectores" en la memoria | **FALSO.** `plainfiles.search()` es `String.includes()`; `engram.search()` es `unsupportedOp` (`engram.mjs:635`) |
| "el orquestador crea el PR directamente" / pipeline Spec→Code→Test Agent | **FALSO.** No hay orquestador de agentes |
| "wrappers ad-hoc en NestJS para invocar agentes por stage" | **FALSO.** No hay invocación de agentes en ninguna parte |

**Las 4 "falencias estructurales" de B están diagnosticadas sobre software que no existe. No las tomes como hallazgos.**

### 2.2 Lo que B aportó de valor real

- **B1 — Superficie MCP.** Diagnóstico falso, problema real: hoy la neutralidad de plataforma se paga con un compilador de settings/hooks por plataforma (`harness/backends/claude.mjs`, `antigravity.mjs`), o sea un archivo de mantenimiento por cada plataforma nueva. Confirmado independientemente por `docs/inbox/brain-v2-merge-audit.md:135`: *"superficie MCP (ellos MCP-native, brain no expone verbos por MCP)"*. **Está en un doc de inbox y nunca llegó a #313.**
- **B2 — Tiers explícitos en el contrato de memoria.** brain tiene los tiers como doctrina (ADR-0002, ADR-0011, core floor del sintetizador) pero **el contrato de recuperación no los conoce**: la firma es `search(query, {root, mode})`, sin scope (`plainfiles.mjs:146`). El argumento de *prompt distraction* por mezclar tiers es correcto y refuerza H2.
- **B3 — Gatekeeper local antes de tocar Git.** Ya existe (hooks `pre-commit`/`pre-push`, `brain:check`, `brain:next`). Lo que falta es el bucle de re-prompt, que ahora sí es alcanzable — ver §5.

### 2.3 Convergencias A + B + auditoría propia (señal fuerte)

1. **El nicho es B2B de gobernanza en organizaciones reguladas**, no productividad individual. Tres fuentes independientes coinciden; `brain-v2-merge-audit.md:136` lo llama *"el frame ganador es governance-first"*.
2. **La memoria git-native / soberana es el diferenciador estructural.**
3. **El aislamiento y la selección de contexto son un problema no resuelto.**
4. **Distribución y onboarding son el cuello de botella de adopción**, no la ingeniería.

---

## 3. Hallazgo BLOQUEANTE

### H1 — No hay archivo LICENSE
- **Evidencia:** `ls | grep -i licen` → vacío.
- **Impacto:** legalmente el repo es *all rights reserved*. Nadie puede adoptarlo aunque quiera. El criterio de salida de M4 ("un equipo externo adopta y actualiza") es inalcanzable por construcción.
- **En #313:** NO.

---

## 4. Hallazgos ALTOS

### H2 — La recuperación de memoria es el eslabón más débil (y ahora es precondición de M3)
El gate de **escritura** está sobre-construido (procedencia, hash de contenido, aprobación humana verificable). El gate de **lectura** es esto:

- `memory/backends/plainfiles.mjs:146` — `search()` es `String.includes()` sobre todos los registros. Sin ranking, sin recencia, sin resolución de `supersedes` en query time, sin dedup. `rg` es solo acelerador que explícitamente *no cambia el resultado*.
- `memory/backends/engram.mjs:635` — `search()` es `unsupportedOp`. **Con el backend default (`engram`), brain no tiene búsqueda propia**: delega en `mem_search` de una herramienta de terceros.
- `brain/core/methodology/consolidation-protocol.md` existe como doctrina pero **nada lo ejecuta**. Los registros solo crecen.

**Datos medidos (un mes, un desarrollador):**
```
records:  1714 líneas / 1575 ids únicos / 49 ids duplicados (139 líneas redundantes = 8,1% bloat)
index:    1575 líneas / 1575 únicos / 0 drift en ambas direcciones (el índice está sano)
```
El problema no es performance: es que **la precisión colapsa**. #332 (techo de 1 MiB en `execFileSync`) ya es el primer síntoma del crecimiento no acotado, tratado como bug de buffer en vez de problema de crecimiento.

**Por qué ahora es precondición de M3.** El §5 del `reviewer-protocol.md` le exige al reviewer *"enumerar las autoridades que restringen — cada ADR, REQ, id de registro durable o nombre de gate que incide sobre la bifurcación"*. Eso es una query de recuperación de doctrina. Si el paquete de revisión se arma por substring matching, el motor de juicio va a citar la ADR equivocada, y se va a diagnosticar como "el modelo alucina" un fallo que fue de retrieval. **La calidad del reviewer está techada por la calidad de la recuperación.**

**En #313:** NO (M9 mide governance, no recuperación).

### H3 — `brain:context:compile` está inerte en producción — es la clase M10 y no está en M10
- `brain/scripts/context/cli.mjs:10`:
  ```js
  execSync('git diff --name-only origin/feature/v2.0.0...HEAD')
  ```
  Esa rama ya no existe. `execSync` tira → el `catch` lo traga → `touchedFiles = []` → el sintetizador devuelve **siempre solo el core floor**, en cualquier repo.
- **Por qué está verde:** `context/cli.test.mjs` solo assertea que el header aparece en stdout.
- **Además:** `matchedMemories` se declara, se retorna y **nunca se puebla** — el spec de #267 prometía matching contra memoria. El matching de ADRs es `filename.includes(substring)` con un caso especial hardcodeado (`clean.includes('review') && fileLower.includes('reviewer')`).
- **Dos llamadores, dos semánticas:** `session-start.mjs:334` le pasa `change.matches` (directorios de cambio) en vez de archivos tocados.
- **Por qué importa el doble:** este componente decide qué contexto ve cada agente por sesión — y con §5 pasa a alimentar también el paquete de revisión.

**En #313:** NO. **Acción: hijo de M10 P2, alto en el ranking de blast radius.**

### H4 — Falta el eje TRACKER en ADR-0024
ADR-0024 define `AGENT_PLATFORM` · `SDD_ENGINE` · `MEMORY_BACKEND`. Hay un cuarto colapsado dentro de `vcs.provider`: **el issue tracker**.
- Change dirs `openspec/changes/issue-<N>-<slug>/` (`sdd-layout.md`).
- `issue-link` grepea `Closes/Fixes/Resolves #N` del body (`.github/workflows/governance.yml:58-80`).
- `brain:next`, `brain:ship`, `brain:audit` derivan estado de issues del proveedor de VCS.

Para una organización con Jira / Redmine / Azure DevOps hay que re-derivar la identidad de ticket entera. **VCS provider e issue tracker no son el mismo eje.**

**En #313:** NO.

### H5 — Superficie MCP ausente
Ver §2.2 B1. Colisiona con ADR-0019/ADR-0024: es de alcance ADR, no de implementación directa. Ver Q3.

**En #313:** NO.

### H6 — No hay tiers de doctrina (palanca de adopción, y ahora también de costo de revisión)
Hoy la doctrina es todo-o-nada: 4 artefactos obligatorios + checkpoint report + registro de memoria + ADR condicional + budget de 400 líneas. Justificado para brain construyendo governance; 3–5x de overhead para un equipo shipeando CRUD.

`brain:governance-status` reporta *qué soporta la plataforma*, no *cuánta doctrina el equipo adopta*. Falta un perfil (`lite` / `standard` / `regulated`).

**Nuevo:** el mismo sistema de tiers debe gobernar la **intensidad de revisión** (motor único vs panel de jueces) — ver §5.5. Una palanca, dos problemas.

**En #313:** NO.

### H7 — Validación n=1 del lado humano
495 de 501 commits de una persona. Más grave que el bus factor: **el modelo de governance está diseñado para un equipo y validado por un individuo.** #329 lo expone — L5 ("aprobador ≠ autor") y #124 ("aprobación es firma humana") son mutuamente insatisfacibles para un mantenedor solo.

Consecuencia: `phase-order`, `actor-check` y `brain-writes-reviewed` están todos **detection-only** en `governance.yml`. L5/L6 no llevan peso hoy y **no se pueden promover a `required` hasta que haya un segundo humano.**

**En #313:** parcialmente (#329, #94). El problema de fondo no está nombrado.

---

## 5. DECISIÓN DE ARQUITECTURA — el port `REVIEWER_ENGINE`

> **Q1 resuelta.** Esta sección es decisión tomada del owner, no propuesta. Implementala; no la reabras.

### 5.1 El diagnóstico corregido

El reviewer nació como un **loop manual**: cada salida del agente implementador (pregunta de diseño o PR) se le pasaba a un Claude web aislado con acceso al repo; su respuesta volvía como input del implementador, y el humano respondía lo que era decisión humana.

Al automatizarlo, el script capturó el **protocolo** (schema de veredicto, locks, cold-boot, anchor de staleness) y **perdió el juicio**. Eso es una regresión, no una decisión de diseño.

**Evidencia de que el diseño anticipaba un LLM:** los tres locks estructurales, la regla *"aplica doctrina, nunca la crea"* con salida `STOP` + escalate, la never-auto-rule del evaluador de ruling que solo admite `REVISE|STOP`, y el anchor `head_sha` contra staleness. **Nada de eso hace falta contra un script** — un script no sufre prompt injection, no inventa doctrina, no se tienta con aprobar. Todo ese andamiaje es la ingeniería correcta contra un modelo. Los zócalos están puestos; falta el enchufe.

### 5.2 Contrato del port

```
REVIEWER_ENGINE

  entrada:  paquete de revisión compilado
            { baseSha, headSha, diff, changedFiles,
              sddArtifacts, doctrinaAplicable[], priorVerdicts[] }

  salida:   findings[] con provenance: judged

  invariantes:
    writeSurface: none        ← NO configurable por adapter
    sin acceso al VCS         ← el engine devuelve datos, nunca postea
    blindness: cold | warm    ← declarado por invocación
```

**El engine no postea.** `poster.mjs` sigue siendo de brain y sigue hardcodeando `event: 'COMMENT'`. Un adapter de un tercero —o uno malicioso— **no tiene camino de código hacia la API del VCS**. Así el lock 2 sobrevive a la apertura del ecosistema. Si le dieras el token al engine, regalás en la primera integración lo que costó tres locks construir.

### 5.3 Restricción 1 — Provenance por hallazgo (`derived` vs `judged`)

Los evaluadores determinísticos ya producen `findings[]` con `evidence` y `cites`. El motor de juicio produce la misma forma. **Tienen que ser distinguibles en el schema, no por convención de redacción:**

```yaml
protocol: brain-review/2
findings:
  - id: budget-exceeded
    provenance: derived           # recomputado, reproducible, re-verificable
    evidence: "412 líneas contadas vs 400 declaradas"
  - id: leaky-abstraction
    provenance: judged            # producido por un modelo, NO reproducible
    engines: [claude-code@2.1.4, gemini-cli@0.9]
    consensus: 2/2                # ver 5.5
    cites: adr-0019
    evidence: "..."
```

Es la doctrina de *"todo reclamo diagnóstico incluye el comando que lo estableció, o se etiqueta como hipótesis"* llevada al schema. Mismo eje que `actorKind: human|agent` del formato de memoria, un nivel más abajo.

**Sin esto, `brain:audit` deja de poder re-verificar historia mergeada:** un hallazgo de modelo no se recomputa, y cambiar de engine o de versión vuelve la historia irreproducible. Con esto, un auditor separa limpio *"la máquina midió 412/400"* de *"un modelo opina que esta abstracción filtra"*. **Para el wedge de compliance esa distinción es el producto.**

### 5.4 Restricción 2 — El juicio solo ajusta hacia arriba

Orden de severidad `APPROVE < REVISE < STOP`:

```
veredictoFinal = max(veredictoDeterminístico, veredictoJuzgado)
```

Un blocker determinístico nunca se afloja porque el modelo esté conforme. Misma regla de tightening monotónico que ya rige `labelRemove`.

**No hay tensión de seguridad que negociar:** el reviewer ya no puede bloquear un merge por construcción (locks 1+2+3, COMMENT-only). Lo único nuevo que introduce el LLM es el problema de reproducibilidad de auditoría, y lo resuelve 5.3.

### 5.5 Los jueces de gentle-ai como adapters + política de consenso

`docs/inbox/reviewer-mechanisms-comparison.md` documenta los dos mecanismos del ecosistema: **judgment-day** (dos jueces ciegos en paralelo, confirmado solo si ambos coinciden, ataca falsos positivos) y **brain-reviewer** (reviewer frío único con refuter, persistente, COMMENT-only, ataca falsos bloqueos). El propio doc ya proponía *"un modo panel para veredictos de alto riesgo"* como candidato a M3 (`:66`).

**Decisión:** no es un modo dentro del reviewer — son **N motores detrás del mismo port, con una política de consenso encima**.

**Separación crítica.** judgment-day tiene dos mitades:
- **jueces** (leen y dictaminan) → entran al `REVIEWER_ENGINE` limpio.
- **fix agent** (escribe código) → **NO entra**. Rompe el lock 2 y borra el eje *write-surface × blindness-contract* de la taxonomía de 4 arquetipos. Su lugar es role-as-port (#312 / M5), con superficie de escritura declarada.

**La ceguera es parte del contrato, no un detalle de implementación.** Dos motores llamados secuencialmente detrás de una interfaz común **no son independientes** si son el mismo modelo — están correlacionados y el consenso pasa a ser teatro. En modo panel:
- cada motor recibe **su propio paquete**;
- ningún motor ve los findings de otro;
- la política de consenso corre **después**, fuera de los adapters;
- idealmente, motores de familias distintas (dos adapters Claude dan redundancia de muestreo, no de sesgo).

**Definición de "coincidir".** Dos jueces casi nunca redactan igual; comparar texto nunca dispara consenso. Pero exigir coincidencia de **línea exacta** falla igual de mal en la otra dirección: un juez marca la firma de la función (línea 42) y el otro la sentencia que rompe (línea 46), y el consenso colapsa a `1/2 SUSPECT` casi siempre por desalineación, no por desacuerdo.

**La unidad de identidad es el hunk del diff, no la línea:**
```
identidad:  (archivo , hunk , autoridad citada)
severidad:  NO forma parte de la clave
```

*Por qué el hunk y no una ventana de ±N líneas:* una ventana introduce un número mágico que hay que tunear por lenguaje y estilo, y **colapsa en silencio dos hallazgos genuinamente distintos** que caen cerca. En un mecanismo de consenso, un falso merge es peor que un falso SUSPECT: el SUSPECT se ve, el merge no. El hunk, en cambio, es una unidad semántica real —el bloque que efectivamente cambió, que es lo que se está revisando— y **es la misma unidad que usan las APIs de comentarios inline de GitHub y GitLab**, o sea el transporte que M3 va a construir. Identidad de finding y posición de comentario quedan alineadas sin traducción intermedia.

Dentro de un mismo hunk el discriminador es la cita: dos hallazgos en el mismo hunk citando ADRs distintas **son hallazgos distintos**, no un merge.

**La severidad se reconcilia después del match, no dentro de la clave.** Si dos jueces coinciden en el problema pero uno dice `blocker` y otro `warning`, meter la severidad en la identidad los separa en dos hallazgos, ambos `1/2 SUSPECT` — reportando como sospecha doble lo que en realidad es **consenso 2/2 con desacuerdo de severidad**, el peor resultado posible. Entonces:
```
severidad final = max(severidades de los jueces que coincidieron)   ← regla §5.4
consensus       = k/n sobre la identidad (archivo, hunk, cites)
```

La redacción de cada juez se conserva por separado en el payload — es evidencia, no ruido.

**Políticas de composición** (capa aparte de los adapters):
- `single` — comportamiento actual.
- `panel-consensus` — confirmado solo si k de n coinciden. Semántica judgment-day. `consensus: 1/2` renderiza como **SUSPECT** y nunca como confirmado.
- `panel-union` — cualquier finding cuenta. Más paranoico, más falsos positivos.

**Cuándo se paga el panel.** judgment-day es 2× tokens + re-judge, y el propio doc dice que sin `brain:metrics` no hay forma de saber cuándo vale. Entonces **se ata a los tiers de doctrina (H6)**: panel para PRs con label `decision` y escrituras en `brain/core/**`; motor único para lo rutinario.

### 5.6 Adapters iniciales (paridad n=2 desde el arranque)

| Adapter | Nota |
|---|---|
| `plain` / `none` | Solo determinístico. **Default seguro** — es el comportamiento actual |
| `claude-code` | Spawnea el CLI local; reusa el setup existente, sin API key |
| `judgment-day` | Los jueces de gentle-ai. Solo la mitad juez; el fix agent queda afuera |
| `anthropic-api`, `gemini-cli`, … | Después |

### 5.7 El canal de issues es la superficie de mayor valor

Mayor que los comentarios inline: la revisión de **diseño antes del código** es donde está el apalancamiento, y es donde vivía el loop manual original. El verbo `issueComment`, las etiquetas `needs-ruling`/`needs-decision` y el evaluador de ruling con su never-auto-rule ya existen. El camino de ruling está literalmente diseñado para un modelo que tiene que escalar.

### 5.8 Dos advertencias

1. **Lo que se perdió no fue solo el LLM, fue la iteración conversacional.** Una llamada one-shot no la reconstruye. La respuesta propia del proyecto es el refuter (#284) — segundo pase adversarial — hoy código muerto por #317. **Reviewer engine + refuter + provenance es la reconstrucción real del loop manual.**
2. **Cada adapter es una costura nueva** = superficie fresca para la clase M10. La suite de contrato tiene que estar **parametrizada sobre motores desde el día uno**, igual que `providers/vcs.contract.test.mjs` lo está sobre github/gitlab. Adapters antes que su contract test = sembrar el defecto que M10 existe para cerrar.

### 5.9 El moat no es el adapter

Los adapters son commodity: cualquiera escribe uno en una tarde. Lo que hace que valga la pena conformarse a la interfaz es **el paquete de revisión compilado** — cold-booted, con las autoridades doctrinales enumeradas, anclado a `head_sha`, con veredictos previos resueltos. Eso es lo que nadie más tiene.

**El artefacto público que hay que especificar y versionar es el paquete, no el adapter.** Los adapters se vuelven triviales por consecuencia, y el ecosistema se engancha al paquete.

### 5.10 Efecto sobre el posicionamiento

No cambia, se refuerza. CodeRabbit y Greptile dan opiniones. brain da **opiniones acotadas, citadas, etiquetadas por procedencia, con consenso declarado y estructuralmente incapaces de aprobar**. El LLM entra como componente *dentro* del frame de evidencia, no como pivote fuera de él. Seguís liderando con los dientes; el modelo es el cómo, no el titular.

---

## 6. Hallazgos MEDIOS

### H8 — #330: la solución correcta es más simple que la planeada
Estado real del `.gitattributes`:
```
/.memory/manifest.json     merge=engram-manifest
/.memory/records/*.jsonl   merge=union
# .memory/index.jsonl  →  SIN REGLA  ← el origen del problema
```
Pero `index.jsonl` es **derivado y regenerable por definición** (`memory-format.md`: *"nunca es la verdad; si se pierde, se reconstruye desde records/"*), ya existe `memory:reindex` backend-agnóstico (`memory/cli.mjs:83`), y ya existe un hook `post-merge` que hoy solo hace `memory import`.

**Fix completo, dos líneas:**
```gitattributes
/.memory/index.jsonl merge=ours
```
```sh
# brain/scripts/hooks/post-merge — después del import
node "$repo_root/brain/scripts/memory/cli.mjs" reindex >/dev/null 2>&1 || true
```
Nunca hay conflicto porque el índice **no se mergea**: se reconstruye desde los registros, que ya tienen `merge=union` y cuyo hash de contenido colapsa duplicados en el rebuild. No hace falta driver custom.

### H9 — `memory:share` no es idempotente
Los 49 ids duplicados en `records/` son un bug del **exporter**, no del merge. El épico los mezcla dentro de #330. Necesita ticket separado.

### H10 — Falta `memory:verify` y el enforcement de una-línea-por-registro
`memory-format.md` declara como requisito duro que *"el validador rechaza cualquier registro multilínea"* — porque `merge=union` es line-based y un registro partido se corrompe en silencio. **No hay nada que lo enforcee** en `brain/scripts/hooks/pre-commit`. Invariante documentada sin dientes: el patrón exacto que M10 combate.

### H12 — Riesgo de cadena de suministro en el camino por defecto
`brain/scripts/install-tools.sh:114`:
```sh
curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash
```
Sin pin de versión, apuntando a `main` de un repo de terceros. Y es el **camino por defecto**: `MEMORY_BACKEND` default es `engram` (`memory/cli.mjs:48`) y el motor SDD default es `gentle-ai`. El escape hatch (`plain`/`plainfiles`) existe pero M4 admite que es indescubrible.

---

## 7. Hallazgos BAJOS y lo que NO hay que tocar

### Bajos
- **H13** — `install-tools.sh:134` chequea `java` y `maven` en un instalador genérico. Misma clase que #129, no listado junto a él.
- **H14** — `AGENTS.md` son 24 KB (~6–7k tokens) por concatenación de 5 docs, cargados cada sesión, contra una premisa de "minimizar tokens".
- **H15** — `.memory/chunks/` **ya está gitignoreado** (`.gitignore:84`), pero el cuerpo de #313 sigue diciendo que no. Instancia del meta-defecto que el propio épico identifica.
- **H16** — El nombre "brain" es inbuscable. Costo de cambio hoy: bajo.

### No tocar
- **El formato de memoria durable es lo mejor del repo.** ID = hash de contenido con canonicalización pinneada a **RFC 8785 JCS**, un registro por línea física con newlines escapados *porque* `merge=union` es line-based, `supersedes` en vez de edición in-place, índice derivado declarado no-autoritativo. Podría ser un estándar independiente.
- **Los tres locks contra reviewer-as-authorizer.** El lock 2 — `prReviewComment` hardcodea `event: 'COMMENT'`, sin verbo hermano APPROVE — es **remoción de capacidad, no instrucción al modelo**. No lo debilites por conveniencia, y menos al abrir el port de §5.
- **El two-key split** (`reviewActors` vs `approvalActors`).
- **Los drift-guards** que leen el YAML real y lo comparan contra la constante en código; la suite de contrato parametrizada sobre providers; los fixtures con procedencia declarada.
- **Fail-closed sobre evidencia incomputable**, implementado como regla generalizada.

---

## 8. Cola de trabajo priorizada

### Tanda 0 — Desbloqueo (horas)
| # | Tarea | Criterio de aceptación |
|---|---|---|
| T0.1 | Agregar `LICENSE` (H1) | Archivo en la raíz; licencia elegida por el owner |
| T0.2 | Fix de #330 vía `merge=ours` + `reindex` en post-merge (H8) | Dos ramas con registros divergentes mergean sin conflicto y `memory:reindex` deja 0 drift contra `records/` |
| T0.3 | Ticket separado para idempotencia de `memory:share` (H9) | Issue abierto y linkeado; NO mezclado con #330 |

### Tanda 1 — Cerrar la clase M10 donde falta (días)
| # | Tarea | Criterio de aceptación |
|---|---|---|
| T1.1 | `brain:context:compile` a M10 P2; arreglar `cli.mjs:10` (H3) | El diff base sale de `ci-context`/`prView().baseRefOid`, nunca de rama hardcodeada. Test que falle si `touchedFiles` queda vacío en un repo con cambios reales |
| T1.2 | Decidir destino de `matchedMemories` (H3) | O se implementa contra `.memory/`, o se borra del retorno y del spec de #267. No queda declarado-y-muerto |
| T1.3 | `memory:verify` + enforcement de una-línea-por-registro en pre-commit (H10) | Un registro multilínea inyectado a mano es rechazado por el hook |

### Tanda 2 — Precondiciones de M3
| # | Tarea | Criterio de aceptación |
|---|---|---|
| T2.1 | **Recuperación de memoria: scope por tier + ranking + `supersedes` en query time (H2 + B2)** | `search()` acepta scope (GLOBAL/FEATURE/SCRATCHPAD); resultados ordenados; registros superseded excluidos por defecto. **Bloquea T3.x** |
| T2.2 | **Adelantar M9 (`brain:metrics`)** por encima de M4 | Corre retroactivamente sobre 501 commits y produce números reales. Detection-only: no bloquea nada, y cuanto antes arranque más larga la ventana de medición |
| T2.3 | Especificar y versionar el **paquete de revisión** (§5.9) | Schema publicado y versionado; es el artefacto público, no el adapter. **Requiere Q3 resuelta primero** — si la respuesta es MCP, el paquete se diseña con forma MCP (ver §9/Q3) |

### Tanda 3 — El port `REVIEWER_ENGINE` (§5)
| # | Tarea | Criterio de aceptación |
|---|---|---|
| T3.1 | Schema `brain-review/2` con `provenance` + `engines` + `consensus` (§5.3) | Un finding `judged` nunca se confunde con uno `derived` en el veredicto ni en `brain:audit` |
| T3.2 | Regla de tightening monotónico (§5.4) | Test: un blocker `derived` no se afloja por un engine que devuelve APPROVE |
| T3.3 | Contrato del port + contract test **parametrizado sobre motores** (§5.2, §5.8) | La suite corre igual sobre `plain` y `claude-code` antes de que exista el segundo adapter real |
| T3.4 | Adapters `plain` (default) y `claude-code` | `writeSurface: none` verificado por test; ningún adapter puede alcanzar la API del VCS |
| T3.5 | Política de consenso + identidad de finding por hunk (§5.5) | `consensus: 1/2` renderiza SUSPECT; dos redacciones distintas del mismo `(archivo, hunk, cites)` colapsan a un finding aunque apunten a líneas distintas; dos hallazgos en el mismo hunk con citas distintas NO colapsan; severidades divergentes se resuelven por `max`, sin partir el consenso |
| T3.6 | Adapter `judgment-day` (solo la mitad juez) | El fix agent queda explícitamente fuera del port y documentado como #312/M5 |
| T3.7 | Reactivar el refuter (#284), bloqueado por #317 | Reviewer engine + refuter + provenance = reconstrucción del loop manual |

### Tanda 4 — Alcance ADR (requiere §9)
| # | Tarea | Depende de |
|---|---|---|
| T4.1 | Tiers de doctrina `lite`/`standard`/`regulated`, gobernando también la intensidad de revisión (H6, §5.5) | Q5 |
| T4.2 | Eje `TRACKER` como cuarto puerto (H4) | Q2 |
| T4.3 | Servidor MCP exponiendo los verbos de brain (H5) | Q3 |

---

## 9. Preguntas abiertas — requieren decisión de @csrinaldi

- **~~Q1 — ¿brain invoca al reviewer o es la capa de evidencia?~~ RESUELTA.** Es la capa de evidencia que además orquesta un motor de juicio enchufable. Ver §5.
- **Q2 — ¿El tracker es un eje propio o se acepta el acoplamiento a issues del VCS?** Aceptarlo cierra el mercado empresarial con Jira. Abrirlo es un ADR más trabajo real en `sdd-layout`, `issue-link` y los verbos golden-path.
- **Q3 — ¿MCP es superficie adicional o reemplazo del eje `AGENT_PLATFORM`?** Si es reemplazo, ADR-0024 necesita enmienda o supersede y `harness/backends/{claude,antigravity}.mjs` entran en deprecación. Es la misma pregunta "enmienda vs supersede" que #323 arrastra sobre ADR-0019 — resolver ambas juntas.

  > **Q3 no es diferible como parecía: cambia la forma de la Tanda 3.**
  > MCP y el port `REVIEWER_ENGINE` **se solapan**. Si brain se vuelve servidor MCP exponiendo memoria + validación como herramientas, un motor de juicio deja de necesitar adapter propio: pasa a ser **un cliente MCP que se conecta a brain**. Eso colapsaría T3.4 y T3.6 dentro de la superficie MCP.
  >
  > Consecuencia operativa: **decidir Q3 ANTES de escribir el primer adapter.**
  > - Si la respuesta es MCP → el paquete de revisión (T2.3) se diseña con forma MCP desde el día uno, y los adapters quedan como *fallback* para herramientas que no hablan el protocolo.
  > - Si la respuesta es "superficie adicional" → los adapters son la superficie definitiva y T2.3 se especifica libre.
  >
  > Nota sobre la urgencia real de H5: la deuda de los compiladores por plataforma **no crece sola** — crece cuando aparecen adoptantes con plataformas nuevas, o sea río abajo de M4. Hoy hay dos backends y ninguno más en cola. El motivo para resolver Q3 temprano NO es la deuda acumulada: es este solapamiento con la Tanda 3.
- **Q4 — ¿Cuándo entra el segundo humano al repo? (H7)** Sin n≥2 no se puede validar ni promover `actor-check` ni `brain-writes-reviewed`. Es precondición de M6.
- **Q5 — ¿Cuántos tiers de doctrina y qué corta cada uno?** Define tanto el overhead de proceso del adoptante como cuándo se paga el panel de jueces.
- **Q6 — ¿Los findings `judged` pueden disparar `needs-revision`, o solo informan?** Estructuralmente no bloquean (COMMENT-only), así que el riesgo es bajo — pero conviene que quede declarado antes de que el primer engine postee.

---

## 10. Advertencia final para el agente destinatario

El proyecto está **sobre-invertido en el gate de escritura y sub-invertido en el gate de lectura.**

Hay infraestructura excepcional para garantizar que el conocimiento *entra* al repo con procedencia, evidencia y aprobación humana verificable. Pero la *salida* — cómo un agente encuentra el registro correcto entre 1575 y sabe que sigue vigente — es `String.includes()`.

Con la decisión de §5, eso deja de ser un gap paralelo y pasa a ser **la restricción activa**: el motor de juicio que se va a enchufar solo puede ser tan bueno como el paquete de contexto que se le entrega. **T2.1 antes que la Tanda 3.**
