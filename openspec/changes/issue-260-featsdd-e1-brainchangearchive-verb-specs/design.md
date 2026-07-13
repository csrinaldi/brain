---
status: approved
issue: 260
---

# Diseño — E1 brain change archive verb (issue 260)

## Decisiones técnicas

### 1. Ubicación y Estructura del Script CLI
- Se creará un nuevo script en `brain/scripts/archive.mjs`.
- Se registrará en `package.json` como `"brain:change:archive": "node ./brain/scripts/archive.mjs"`.
- Utilizará funciones de `sdd-layout.mjs` de forma exclusiva para la resolución de rutas físicas:
  - `changeDir(id)`
  - `archivePath(iid)`
  - `parseChangeId(id)`

### 2. Algoritmo de Fusión de Especificaciones (Delta Spec Merge)
Para un cambio dado `<changeId>`:
- Si existe `changeDir/specs` (formato legacy-accepted):
  - Listar los directorios hijos de `specs`. Cada uno es una `<capability>`.
  - Leer `specs/<capability>/spec.md`.
- Si no existe `changeDir/specs` pero existe `changeDir/spec.md` (formato plano):
  - Leer `changeDir/spec.md`.
  - Extraer los metadatos YAML.
  - Si tiene la clave `capability`, usarla como `<capability>`.
  - Si no tiene la clave `capability`, mostrar una advertencia en consola y **omitir la fusión del spec** (pero continuar con el archivado del directorio).
- Para cada especificación a fusionar:
  - Extraer el cuerpo eliminando el bloque de frontmatter YAML (delimitado por los primeros `---` y `---`).
  - Escribir en `openspec/specs/<capability>/spec.md`.
  - Si el spec central no existe, crearlo vacío.
  - Generar el encabezado de procedencia (provenance header):
    ```markdown
    
    ### [issue-<iid>] <slug> — <YYYY-MM-DD>
    ```
    Donde `<iid>` y `<slug>` se obtienen al parsear el `changeId`.
  - Agregar el provenance header y el cuerpo al final del archivo central (`appendFileSync`).

### 3. Archivación Física
- Se usará `fs.renameSync` para mover el directorio `openspec/changes/<changeId>` a `openspec/changes/archive/<iid>`.
- Si el directorio de destino ya existe, el comando fallará de forma cerrada y segura con un error descriptivo.
- Se asegurará la existencia del directorio padre `openspec/changes/archive` usando `fs.mkdirSync` con `{ recursive: true }`.

---

## Respuestas a la micro-decisión de diseño: el sellado de `LEGACY_GRANDFATHERED`
1. **¿El accessor resuelve grandfathered-in-archive o son mutuamente excluyentes?**
   - El accessor `isGrandfathered(changeId)` seguirá retornando `true` si el ID está en `LEGACY_GRANDFATHERED`. Sin embargo, a nivel del sistema de archivos, el cambio archivado ya no está "in-flight" (en vuelo) y no reside en `openspec/changes/`. Por lo tanto, son conceptualmente excluyentes para validaciones de cambios activos, pero el ID sigue estando en la lista inmutable para consultas históricas.
2. **¿Mover directorios grandfathered a archive/ rompe el golden de B1?**
   - No. El test golden ordinario de B1 (`sdd-layout-golden.test.mjs`) no realiza llamadas al file system real en su ejecución normal, sino que se alimenta del fixture inyectado `sdd-layout.golden.json`. Sin embargo, si en el futuro se realizara una recaptura (la cual está bloqueada y requiere acción humana explícitamente), estos directorios no aparecerían, lo cual es correcto puesto que han dejado de ser cambios en vuelo.
3. **Justificación del sellado frente a mutaciones silenciosas.**
   - No se modificará el array congelado `LEGACY_GRANDFATHERED` in `sdd-layout.mjs`. Se mantendrá intacto para garantizar la inmutabilidad de la lista histórica definida en B0. No se requiere su actualización ni alteración puesto que el comportamiento se preserva de manera limpia.

---

## Alternativas descartadas
- **Hacer configurable la ruta de archivo**: Descartado por B0 (el accessor `archivePath` de `sdd-layout.mjs` es el único dueño de la ubicación).
- **Modificar la lista `LEGACY_GRANDFATHERED` al archivar**: Descartada por violar la inmutabilidad establecida en B0.
