# Auditoría de memoria de brain — documento para revisión independiente

Fecha: 2026-09-10. Repositorio: https://github.com/csrinaldi/brain.

Base examinada: `main`, commit `5a928804955fb4c72e61e362e1a3eaf8a08034bb`.
Comparación anterior: `2ec2855`, auditado el 2026-09-09; 12 commits nuevos hasta esta base.

Este documento se puede entregar a otro agente sin la conversación original. Es un informe de hallazgos y una solicitud de verificación independiente; no es una aprobación de implementación ni una certificación de seguridad.

## Encargo para el agente receptor

Audita el sistema de memoria de brain de extremo a extremo. Verifica o refuta los hallazgos de este documento contra el código actual, busca problemas adicionales y cruza cada gap con los tickets abiertos. No des por correcto un hallazgo por estar escrito aquí ni por tener pruebas verdes alrededor.

Evalúa estas propiedades: durabilidad antes de cualquier backend, supervivencia al abandono de un feature, concurrencia entre sesiones/worktrees, llegada a otras máquinas, procedencia, corrección mediante `supersedes`, protección de secretos y recuperación después de fallos parciales.

El entregable esperado es una auditoría organizada por esas propiedades, con severidad, desencadenante, consecuencia, evidencia, reproducción, cobertura en tickets y propuesta de corrección. Distingue defectos confirmados, limitaciones deliberadas, trabajo pendiente y preguntas todavía sin comprobar. No implementes cambios ni publiques comentarios, PRs o registros de memoria remotos como parte de esta auditoría.

Antes de trabajar, lee las instrucciones vigentes del repositorio, registra el HEAD y revisa el estado del árbol. Si cambió la base, informa qué hallazgos siguen aplicando. Respeta los cambios de otros agentes y usa fixtures aisladas para reproducciones que escriben.

## Diagnóstico ejecutivo

La arquitectura es consistente: `.memory/records/` contiene la verdad durable, el backend debe ser un índice reconstruible y los registros deben llegar a `main` por un carril de PRs propio, sin esperar al feature.

El carril ya tiene recolector, envío, gates y disparadores. También están implementados el escritor de `supersedes` y la procedencia de captura. Sin embargo, siguen pendientes la captura uniforme record-first con hidratación inmediata (#874) y el retiro del transporte por PRs de features (#890).

Se reprodujo un defecto de recuperación posterior al push: un reintento sin registros nuevos puede omitir la reconciliación del PR. Además, el recolector conserva un lector de configuración que degrada silenciosamente a los patrones básicos de secretos y omite del resultado los worktrees cuyo `git status` falla.

No hay evidencia en esta auditoría que permita declarar resuelta la latencia entre máquinas: se probaron componentes y se inspeccionó el flujo, pero no se realizó una publicación remota ni una medición nueva de learn→main.

## Fuentes y mapa de código

Leer primero:

- `brain/core/methodology/memory-backend-contract.md`: verbos y reglas del backend.
- `brain/core/methodology/memory-format.md`: formato durable e integridad.
- `brain/project/decisions/adr-0017-memory-format-owned-by-brain.md`: propiedad del formato.
- `brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md`: carril de memoria.
- `brain/core/methodology/consolidation-protocol.md`: relación entre registros y conocimiento promovido.
- Issue #864: objetivo del sistema de memoria 2.0 y métricas de salida.

Implementación:

| Tramo | Archivos principales |
|---|---|
| Entrada pública | `package.json`, `brain/scripts/memory/cli.mjs` |
| Captura durable | `brain/scripts/memory/backends/plainfiles.mjs`, `memory/lib/store.mjs`, `memory/lib/format.mjs` |
| Procedencia | `brain/scripts/memory/lib/capture-provenance.mjs`, `brain/scripts/lib/git-config.mjs` |
| Correcciones | `brain/scripts/memory/lib/supersedes.mjs` |
| Backend y flujo antiguo | `brain/scripts/memory/backends/engram.mjs`, `memory/lib/engram-export.mjs` |
| Carril | `brain/scripts/memory/lane/{plan,collect,ship}.mjs` |
| Gates | `brain/scripts/governance/checks/lane.mjs`, `governance/lane-paths.mjs`, `governance/lane-scrub.mjs` |
| Disparadores | `brain/scripts/memory/session-end-ship.mjs`, `memory/day-start-sweep.mjs`, `harness/backends/settings-hooks.mjs` |
| Consumo al iniciar sesión | `brain/scripts/session-start.mjs`, `brain/scripts/context/synthesizer.mjs` |
| Instalación y configuración | `brain/core/managed-paths.mjs`, `brain/core/config-migrations.mjs`, `brain/scripts/lib/installer.mjs` |
| Observabilidad | `brain/scripts/memory/lib/audit.mjs`, `memory/index-lag.mjs`, `brain/scripts/brain-audit.mjs` |

Las rutas abreviadas dentro de una celda conservan el prefijo `brain/scripts/`. Los números de línea citados abajo corresponden a la base examinada; usa los símbolos para localizar el código si cambian.

## Estado de las entregas en la base examinada

| Entrega | Estado comprobado | Precisión necesaria |
|---|---|---|
| #738: procedencia | Implementada | Actor configurado, tipo de actor por marcador de entorno e issue declarado/derivado. No demuestra integración con todas las plataformas. |
| #805: escritor `supersedes` | Implementado | Valida la referencia antes de escribir. No asumir sin comprobar que todos los lectores interpretan una corrección como se espera. |
| #888: envío | Implementado | Push, búsqueda/creación de PR y solicitud de auto-merge según tier. Existe el fallo M1. |
| #889/#905: gobernanza | Implementada | Predicado del carril, adiciones permitidas, validación de registros/secretos y reconocimiento en auditoría. |
| #906: disparadores | Implementados | Cierre de sesión y barrido en `day:start`, condicionados por `memory.lane.enabled`. |
| #247: chunks | Frontera y guard implementados | No equivale a eliminación completa: `engram.share()` conserva exportación. El retiro restante se conecta con #874. |
| #874: record-first uniforme | Pendiente | `memory:save` sigue fijado a `plainfiles`; falta hidratación inmediata del backend y retiro de exportación en `share`. |
| #890: retiro del flujo de features | Pendiente | Su secuencia exige #874 y demostrar el primer escenario real del carril. |

En el `brain.config.json` examinado no existe `memory.lane.enabled=true`. Los disparadores automáticos están inactivos por diseño. No activar la opción durante una auditoría de lectura: puede iniciar publicaciones.

## Hallazgos confirmados

### M1 — Alta: un fallo después del push no se recupera sin registros nuevos

Evidencia: `brain/scripts/memory/lane/ship.mjs`, `shipLane()`, retorno `if (commit === null && ahead === 0)` alrededor de la línea 243; `findOrCreatePr()` se llama después, alrededor de la línea 281.

Secuencia:

1. El recolector produce un commit y el push tiene éxito.
2. Falla la consulta o creación del PR.
3. El usuario reintenta sin nuevas capturas: el recolector devuelve `commit:null` y la rama remota coincide con la local (`ahead:0`).
4. El retorno anticipado omite la búsqueda/creación del PR.

Consecuencia: los registros quedan en una rama remota sin completar su llegada a `main`. El mismo retorno omite reintentar el armado del auto-merge si ese paso falló en una ejecución anterior. Esta última variante se deduce del flujo; la reproducción ejecutada cubrió el fallo de consulta de PRs.

Reproducción ejecutada con seams simuladas, sin Git remoto ni escrituras:

```bash
node --input-type=module <<'JS'
import { shipLane } from './brain/scripts/memory/lane/ship.mjs';

let phase = 0;
let calls = [];
const collect = () => ({
  ref: 'refs/heads/memory/test-2026-09-10',
  commit: phase === 0 ? 'abc' : null,
  collected: phase === 0 ? 1 : 0,
  skipped: [], duplicates: {}, baseFetched: true,
});
const git = (argv) => ({
  status: 0,
  stdout: argv[0] === 'rev-list' ? '0\n'
    : argv[0] === 'diff' ? '.memory/records/test.jsonl\n' : 'abc\n',
  stderr: '',
});
const vcs = {
  mrList: async () => { calls.push('mrList'); throw Error('temporary outage'); },
  mrCreate: async () => { calls.push('mrCreate'); },
  mrAutoMerge: async () => { calls.push('mrAutoMerge'); },
};
const args = {
  root: '/tmp', project: 'fixture', tier: 'lite',
  host: 'test', date: '2026-09-10', collect, git, vcs,
};
try { await shipLane(args); }
catch (error) { console.log('first:', error.message); }
phase = 1;
calls = [];
const result = await shipLane(args);
console.log('retry:', JSON.stringify({ pushed: result.pushed, pr: result.pr, calls }));
JS
```

Resultado observado:

```text
first: memory.ship.prLookupFailed: mrList failed — temporary outage
retry: {"pushed":false,"pr":null,"calls":[]}
```

La simulación demuestra el retorno incorrecto, pero no sustituye una reproducción de integración. Repetir con un bare remote local y un puerto falso: push exitoso, fallo de PR, reintento sin capturas. Cubrir también fallo de auto-merge, PR ya mergeado y rama remota eliminada.

Dirección propuesta: separar «commits por enviar» de «entrega remota por reconciliar». No crear PRs vacíos ni repetir entregas ya mergeadas. No encontré un ticket abierto específico en el listado consultado.

### M2 — Alta: el recolector pierde patrones personalizados ante errores de configuración

Evidencia: `brain/scripts/memory/lane/collect.mjs`, `_defaultLoadConfig()` alrededor de la línea 94. Un `catch` general devuelve `{}`. `resolveSecretConfig()` recibe entonces únicamente las reglas predeterminadas.

El mismo patrón sigue en `_defaultLoadBrainConfig()` de `memory/backends/engram.mjs`, alrededor de la línea 503.

Consecuencia: JSON inválido o configuración ilegible pueden reducir silenciosamente el conjunto de patrones de secretos en estas rutas. Los patrones básicos siguen activos. No afirmar que se desactiva todo el escaneo ni que todas las entradas CLI alcanzan el lector degradado: verificar qué loaders anteriores pueden rechazar la operación.

Cobertura: https://github.com/csrinaldi/brain/issues/712 describe Engram; su alcance debe incorporar el recolector. El problema fue confirmado por inspección del código; falta una reproducción de integración de cada entrada alcanzable.

Dirección propuesta: configuración ausente y configuración presente pero ilegible deben ser resultados diferentes; fallar antes de escribir/publicar cuando no se puede aplicar la política configurada.

### M3 — Media: worktrees inaccesibles desaparecen de la contabilidad

Evidencia: `collectLane()` en `memory/lane/collect.mjs`, alrededor de la línea 241:

```js
if (statusResult.status !== 0) continue;
```

Consecuencia: puede devolverse una recolección vacía aunque parte del universo no pudo inspeccionarse. Continuar con los árboles sanos puede ser correcto; ocultar la omisión impide distinguir «nada pendiente» de «inspección incompleta».

Confirmado por inspección. Reproducir con un resultado de `git status` fallido en uno de varios worktrees y comprobar el informe público. Proponer contabilidad explícita de árboles omitidos y causas. No encontré un ticket abierto específico.

### M4 — Media: la procedencia requiere integración de plataforma para Codex

Evidencia: `memory/lib/capture-provenance.mjs`, `resolveActorKind()`. El marcador predeterminado es `AI_AGENT`; `brain.agentEnv` permite configurar otros nombres.

En la sesión auditora se observó:

```text
AI_AGENT presente: false
CODEX_THREAD_ID presente: true
brain.agentEnv: no configurado
resolveActorKind({ env: process.env }).actorKind: human
```

No se escribió un registro para probarlo: se ejecutó el resolvedor con el entorno real. El escritor consulta este resolvedor, por lo que una captura con esa configuración podría quedar clasificada como humana.

Esto no refuta el mecanismo de #738: identifica la integración pendiente. No asumir que todas las sesiones/clientes de Codex exponen las mismas variables. Verificar cada runtime soportado y el camino público de captura. La configuración de plataforma debe aportar la señal sin atribuir a agentes las capturas humanas.

## Brechas conocidas que siguen abiertas

### Captura e hidratación — #874

El npm script `memory:save` fija `MEMORY_BACKEND=plainfiles`. El backend Engram todavía rechaza `save` y `share()` conserva `sync --export`. El record-first uniforme y `hydrate({recordId})` siguen pendientes.

Criterio decisivo: el archivo durable debe existir antes de actualizar el backend; si la hidratación falla, la captura debe sobrevivir y poder recuperarse. Dos capturas del mismo tema antes de cualquier `share` deben permanecer como dos registros, con corrección explícita cuando corresponda.

Ticket: https://github.com/csrinaldi/brain/issues/874.

### Convivencia de carriles — #890

El retiro de `pre-push`/`brain-save` y de las instrucciones que transportan memoria dentro del feature está secuenciado. No tratarlos como código muerto eliminable sin verificar los prerrequisitos.

Criterio decisivo: un registro llega a `main` antes de terminar su feature, y un PR posterior del feature pasa el gate con la memoria ya existente, sin llevar nuevos registros en su diff.

Ticket: https://github.com/csrinaldi/brain/issues/890.

### Instalación consumidora

`MANAGED_SCRIPT_KEYS` en `brain/core/managed-paths.mjs` contiene diez comandos; se agregó `brain:memory:session-end`. No incluye `memory:save`, `memory:ship`, `memory:audit` ni `brain:config`.

Los archivos pueden estar distribuidos sin que las entradas npm que recomiendan las instrucciones existan en el consumidor. Verificar instalación limpia y upgrade por sus entradas públicas. No confundir «puedo llamar el archivo Node manualmente» con «el onboarding funciona». No encontré un ticket dedicado al catálogo completo.

### Configuración — #806/#807

`migrateConfig()` en `brain/scripts/lib/installer.mjs` utiliza `schemaVersion` para seleccionar migraciones y después lo avanza a `targetVersion`. La lista tiene una migración `1.6.0` para `memory.lane.enabled`, mientras el paquete examinado es `1.5.0`. La propia descripción documenta diferencias entre creación nueva y upgrade.

Verificar que habilitación, diagnóstico y actualización del carril no dependan de una migración omitida. La ausencia de `enabled` se interpreta correctamente como false; eso no resuelve la semántica general de migraciones.

Tickets: https://github.com/csrinaldi/brain/issues/806 y https://github.com/csrinaldi/brain/issues/807.

### Consumo de memoria y diagnóstico — #267

`runSessionStart()` no llama a `step5SynthesizeContext()`. `step2HydrateEngram()` reduce el resultado a `{ok:boolean}` y descarta el motivo del fallo. Guardar registros, transportarlos e hidratar un índice no demuestra que el agente reciba la memoria relevante para su tarea.

Separar pruebas de persistencia, transporte, hidratación, búsqueda y selección de contexto. Preservar la causa de una hidratación fallida sin hacer fatal todo inicio de sesión.

Ticket del contexto: https://github.com/csrinaldi/brain/issues/267. No encontré uno específico para preservar la causa de hidratación.

## Preguntas adicionales para la revisión independiente

Estas son líneas de investigación, no defectos confirmados:

1. ¿Qué ocurre al añadir registros después de que el PR del mismo host/día fue squash-mergeado, con y sin eliminación automática de la rama remota?
2. ¿Qué recupera un cambio de fecha cuando quedó pendiente una entrega del día anterior?
3. ¿El recolector recupera registros ya commiteados en un feature pero ausentes de `main`, o solamente los visibles en `git status`? ¿Quién posee el caso excluido durante la transición?
4. ¿Dos recolectores simultáneos convergen tras un CAS fallido sin perder registros ni sobrescribir decisiones de duplicados?
5. ¿La identidad configurada para el puerto de PR también corresponde a la usada por Git para el push? Distinguir ambos canales de autenticación.
6. ¿Las correcciones `supersedes` se conservan en importación, búsquedas y reconstrucción, y qué interpretación ofrecen los lectores de registros corregidos?
7. ¿Los disparadores de cierre funcionan en los sistemas operativos soportados? Revisar las comprobaciones POSIX de propietario/permisos antes de declarar portabilidad.
8. ¿La supervivencia del proceso desacoplado está demostrada cuando termina el runtime de agente o su contenedor?
9. ¿`--dry-run` comunica correctamente sus efectos locales? `shipLane()` llama al recolector incluso en dry-run; no asumir que equivale a lectura pura.
10. ¿Los gates de la rama remota están realmente requeridos en el proveedor? Su presencia en archivos de workflow no prueba la configuración del servidor.

## Pruebas ya ejecutadas y límites

En la base examinada pasaron:

```bash
npm run brain:repo:check

node --test --test-concurrency=2 \
  'brain/scripts/memory/**/*.test.mjs' \
  'brain/scripts/harness/**/*.test.mjs'

node --test --test-concurrency=2 \
  brain/scripts/governance/lane-paths.test.mjs \
  brain/scripts/governance/lane-scrub.test.mjs \
  brain/scripts/governance/checks/lane.test.mjs \
  brain/scripts/governance/run-check.test.mjs \
  brain/scripts/brain-audit.test.mjs
```

Resultados: 1.105 pruebas de memoria/plataforma y 206 de gobernanza, cero fallos en las repeticiones autorizadas fuera del sandbox. La primera corrida restringida sufrió `spawnSync ... EPERM`; no se interpretó como un defecto del producto. No se ejecutó la suite completa del repositorio.

No se ejecutaron agentes reales, publicaciones remotas, auto-merges ni mediciones nuevas entre máquinas. M1 se reprodujo con seams simuladas. M2/M3 se confirmaron por inspección; deben ampliarse con pruebas de integración. M4 se comprobó en el resolvedor con el entorno de la sesión, sin escribir registros.

No dependas de logs en `/tmp` ni de archivos privados del agente anterior: este documento contiene la evidencia necesaria para repetir las comprobaciones. Consulta los tickets actuales, porque sus estados pueden haber cambiado.

## Criterio de cierre recomendado

No cerrar el eje memoria por número de módulos o pruebas. Exigir una demostración desde una instalación consumidora: capturar → persistir → publicar por el carril → superar gates → llegar a `main` → recuperar en otro checkout/backend → consultar la corrección, incluyendo un fallo entre cada par de pasos relevante.

Primero corregir recuperación posterior al push y lecturas silenciosas de política; completar #874; demostrar el flujo real; después retirar las superficies de #890. Mantener separados «dato durable», «publicación completada», «backend actualizado» y «contexto entregado al agente» en el informe y en los criterios de aceptación.
