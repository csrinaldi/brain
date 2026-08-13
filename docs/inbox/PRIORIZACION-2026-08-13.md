# Priorización 1.1 — líneas de desarrollo × segmentos del producto (2026-08-13)

> **Fuentes.** `main` @ `0d8d04d` · épico **#313** (cuerpo + handoff 2026-08-13) ·
> `MASTER-PLAN-1.0.md` (snapshot, #313 manda) · artefacto de medición
> «brain · estado contra el épico #313» (sexto corte, `main` @ `3f3bdfd`, 12 ago) ·
> estado de tickets leído por API hoy: **67 abiertos** (40 aprobados / 27 sin firma) ·
> **32 cerrados desde el corte del artefacto**.
>
> Este documento cruza tres cosas: (1) qué segmento del producto mueve cada ticket,
> (2) cuánto evolucionó cada segmento desde el último corte medido, y (3) en qué
> orden y por qué rutas conviene invertir. No re-mide el código: usa el artefacto
> como línea base y los cierres del 13 ago como delta.

---

## 1 · Evolución por segmento (artefacto → hoy)

### 1a. Milestones del épico (método del artefacto: tickets nombrados por #313)

| Milestone | 12 ago | hoy | Qué lo movió / qué falta |
|---|---:|---:|---|
| M0 · Housekeeping | 100 | **100** | — |
| M1 · Gates de integridad | 83 | **100** | **#94 cerró** (requiredReviews tier-derived). M1 completo |
| M2 · Decoupling al usuario | 25 | **75** | **#123 ✓ #315 ✓** cerraron hoy. Queda solo **#316** (.env unify) |
| M3 · Reviewer real | 100 | **100** | criterio de salida cumplido; lo abierto es post-M3 (línea B) |
| M4 · Distribución / self-update | 100 | **100** | núcleo completo; **#458 ✓** cerró; cola: #414 #415 #436 |
| M5 · Role-as-port | 0 | **0 (desbloqueado)** | **#555 ✓** cerró — #312 ya no hereda la ambigüedad del set de artefactos |
| M6 · Paridad de proveedor | 45 | **45** | sin movimiento en los nombrados (#124 #131 #129 #348 #349 #361) |
| M7 · Backlog & scope | 25 | **25** | sin movimiento (#268 #280 #256 #247 #117 #327) |
| M8 · Routing por stage | 0 | **0** | #323 espera a #312; #456 espera a #323 |
| M9 · Observabilidad | 100 | **100** | #457 sigue abierto como follow-up |
| M10 · Cobertura de seams | 50 | **50** | #335 #336 abiertos; #348 #349 «locked, not fixed» |
| Decisiones Q | 38 | **~50** | **D6 cerró de verdad: #617 ✓** (ADR que supersede la 0006, registrada antes del mecanismo). Q2 (#356) y Q3 (#357) siguen sin ratificar |

**Épico total** (tickets nombrados cerrados / nombrados): 33,5/54 = 62 % → **37/54 ≈ 69 %**.
Los +7 puntos salieron de M1, M2 y la cola de adopción — de nuevo el camino barato.
Lo que queda arriba (M5/M8 en 0, M6/M7/M10 planos) no sube sin las rutas E, V y O de abajo.

### 1b. Los 8 ejes de «¿aguanta un proyecto grande?» (base 5,0/10)

| Eje | 12 ago | tendencia hoy | evidencia del delta |
|---|---:|:--|---|
| Equipo mixto (agentes/humanos) | 0,72 | ↑ | #580 #581 #586 #590 #584 ✓ (protocolo firmado, L5 corregido, citas curadas). Abierto: **#604** — la frialdad del reviewer no es verificable |
| Gestión del trabajo | 0,58 | ↑ | #557 ✓ (sweep de changes/) · #509 ✓ (promote). Abierto: **#564** — la regla de partir trabajo sigue sin prosa |
| Mostrar la evolución | 0,64 | ↑ leve | #591 ✓. Abiertos: #639 (parser del grafo), #280, #457 |
| Compartir memoria aprendida | 0,48 | ↑ con residuo | **#574 ✓** (el duplicado silencioso ya se detecta) — pero dejó cola nueva: #633 #634 #635 #636 #637 |
| Generalidad de la memoria | 0,74 | = | #641 abierto (share/pull no pineados al backend agnóstico) · #361 |
| Generalidad de VCS | 0,70 | ↑ leve | #570 ✓ (scaffold GitLab). Abiertos: #602 #603 |
| Generalidad de plataforma | 0,38 | ↑ leve | #123 ✓ (day:start deja de asumir claude) · #315 ✓. El puerto sigue en `VALID_OPS=['init']` — solo **#312** lo mueve de fondo |
| Generalidad del SDD | 0,42 | ↑ leve | **#555 ✓** (un solo set de artefactos). Etapas siguen congeladas — solo **#456** (tras #312→#323) lo cierra |

**Lectura.** Los dos ejes más débiles (plataforma 0,38 y SDD 0,42) siguen siendo los
más débiles: nada de lo cerrado ayer/hoy los mueve de fondo, y **toda su subida está
encadenada detrás de #312**. Eso convierte a la ruta E en la inversión de mayor
apalancamiento por punto de segmento.

---

## 2 · Líneas de desarrollo (por tipo de solución)

Agrupadas por el tipo de solución que entregan, con su ruta/milestone y el segmento
que mueven. **Negrita** = aprobado (agent-startable hoy); resto necesita firma.

### Línea A · Adopción y distribución — ruta A / M4→D6 · *el gate externo*
- **#435** (go-public + paquete scopeado) — todo su pre-flight cerró entre ayer y hoy: #458 ✓ #607 ✓ #610 ✓ #617 ✓ #619 ✓ #623 ✓ #625 ✓ #629 ✓. Queda el go/no-go humano.
- Correcciones de instalador/bootstrap que #435 destapó: **#628** · **#627** · #644 · #601 · #643.
- Cola de upgrade (M4): **#436** · **#415** · **#414**.
- Segmento: abre adopción externa; era el «lo que el 100 % del lazo deja afuera».

### Línea E · Configuración del SDD — ruta E / M5→M8 · *los dos ejes más débiles*
- Cadena: **#312** (role-as-port, desbloqueado por #555 ✓) → **#323** (mapa stage→engine) → **#456** (stage-set configurable). Las tres firmadas; las tres ADR se diseñan juntas (fallo 2026-08-05).
- Segmento: plataforma 0,38 y SDD 0,42 — premisa 2 del scorecard clavada en 40 % desde julio.

### Línea B · Reviewer — post-M3 / premisa 3
- Evolución (detrás de #312): **#576** (roles de referencia) → **#552** (productor inferencial) → **#575** (review-as-stage). **#284** es el paraguas v2.
- Reparación (independiente, empezable ya): **#612** · **#495** · #606 · #631 · **#604** (gobernanza de identidad del reviewer).
- Segmento: premisa 3 (45 % al corte, «up» en el handoff).

### Línea M · Memoria — premisas 4/7
- Cola de #574: #633 #634 #637 (bugs) · #636 (reconciliar 139 líneas) · #635 (docs). Sin firma aún.
- **#641** (share/pull mueren donde save no) · **#461** (Case 4 round-trip) · **#247** → **#256** (migración C4, luego Antigravity) · #361.
- Segmento: compartir memoria 0,48 — el eje que la primera compartición real entre agentes estresó.

### Línea G · Gobernanza y consistencia doctrinal — M10 + transversal
- Deriva doctrina↔código: #600 (6 superficies post-#516) · #603 · **#599** · #588 (needs-review) · #611 · **#564**.
- Endurecimiento de guards: **#569** (priority:high) · **#560** · **#559** · **#545** · **#489** · **#488** · **#453** · #632.
- M10/M6 gobernanza: **#335** · **#336** · **#124** · **#131** · #327.
- Segmento: equipo mixto 0,72 (el más alto — esta línea lo mantiene, no lo sube).

### Línea V · Paridad de proveedor — M6
- #602 (PR template GitLab) · #603 (pipeline por tier) · #129 · #348 · #349 · #117 (decisión de alcance).
- Segmento: VCS 0,70 / premisa 5 en 75 %.

### Línea O · Visibilidad — M7/M9
- #280 (`brain:status`) · #639 (bug del epic-map) · **#457** (métrica de tokens — premisa 8 sin medir) · #268.
- Segmento: mostrar evolución 0,64 / premisa 6 en 55 %.

### Línea X · Calidad de superficie (i18n)
- #642 · #638 · **#605**. Baratas, independientes, sin efecto en segmentos — relleno de paralelismo.

---

## 3 · Orden de prioridad (cruce prioridad × segmento)

Regla usada: primero lo que abre gates (A), después lo que mueve los segmentos más
bajos por punto invertido (E), después lo que protege la herramienta con la que se
revisa todo lo demás (B-reparación, G-guards), y el resto por paralelismo.

| P | Qué | Línea | Por qué (cruce con el segmento) |
|---|---|---|---|
| **P0** | **#435** go/no-go + **#628 #627** | A | El pre-flight ya está pagado (8 tickets cerrados). Es el único ítem que convierte el 100 % del lazo en adopción externa. #628/#627 son los bugs que ese mismo camino destapó |
| **P0b** | **#612 · #495 · #569** | B/G | Protegen al reviewer y a los guards que revisan todo el resto. Chicos, firmados, sin dependencias |
| **P1** | **#312 → #323 → #456** (ADRs juntas) | E | Única palanca de los dos ejes más débiles (0,38 / 0,42) y de la premisa 2 (40 %). #555 ✓ ya quitó el bloqueo. Mientras no arranque, esos segmentos no se mueven |
| **P2** | **#576 → #552 → #575** | B | Premisa 3. Secuenciada detrás de #312 (#576 es el paso B de #312). #575 hace que los veredictos persistan por protocolo |
| **P3** | Cola de #574 (#633 #634 #636 #637 #641) → luego **#247 → #256** · **#461** | M | Arreglar la compartición antes de hacerla crecer (regla del handoff). #641 está firmado y es el único del grupo empezable hoy |
| **P4** | **#316** · **#436 #415 #414** · #602 #603 · **#124 #131** · **#453 #488 #489** · **#560 #559 #545 #564 #599** | M2/A/V/G | Independientes entre sí — fodder de agentes en paralelo. Cierra M2 (75→100) y mantiene el eje de equipo mixto |
| **P5** | #280 · **#457** · #639 · #268 · #642 #638 **#605** | O/X | Fuera del camino crítico. #457 gana con arranque temprano (ventana de medición más larga) |

### Llaves humanas (nada de esto avanza solo)
1. **Go/no-go de #435** — el pre-flight está ejecutado y documentado (#610 ✓).
2. **Firmar la tanda del 13 ago**: #631–#639, #642–#644, #600, #602, #603, #606, #611 — hoy 27 abiertos no tienen `status:approved`; la cola de #574 (P3) está entera sin firma.
3. **#588** (needs-review, cláusula MUST del presupuesto sin tier) y **Q2 (#356) / Q3 (#357)** — la revisión de Q2 está viva desde que abrió M4.
4. Decisión de alcance de **#117** (Bitbucket) — cerrar o diferir explícitamente.

### Paralelismo máximo hoy (sin pisarse por archivos)
`#435(humano)` ∥ `#312` ∥ `#612` ∥ `#641` ∥ `#316` ∥ `#569` — seis frentes
aprobados y file-disjuntos; el resto de P4 entra a medida que se liberan agentes.

---

*Este archivo es un snapshot como el MASTER-PLAN: en conflicto, #313 manda. La
versión viva del grafo es `brain:epic:map` sobre los bloques `brain-graph/1`
(ADR-0029) — el backfill de bloques del handoff del 13 ago sigue pendiente de
aplicar.*
