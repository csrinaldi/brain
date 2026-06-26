# config.yaml mezcla secuencia y mapping (YAML inválido tolerado por el harness)

- **Descubierto en:** issue #94 / `openspec/config.yaml`
- **Aplica a:** `openspec/config.yaml` y cualquier consumidor que lo parsee con un YAML estricto

## Síntoma

`python3 -c "import yaml; yaml.safe_load(open('openspec/config.yaml'))"` falla con
`expected <block end>, but found '?'`. Un linter de YAML, un pre-commit, o una migración a
otra herramienta de parseo romperían la config del harness SDD — aunque `gentle-ai` la lee
sin problema hoy.

## Causa

Bajo `rules.apply:` y `rules.verify:` el archivo mezcla items de secuencia (`- Follow ...`)
con claves de mapping (`tdd:`, `test_command:`) en el mismo nivel de indentación. Por spec,
un nodo YAML no puede ser secuencia y mapping a la vez. El parser de `gentle-ai` es tolerante
y lo acepta; PyYAML y la mayoría de los linters no.

## Solución / patrón correcto

No "arreglar" la estructura a ciegas: una corrección mecánica puede romper la lectura del
harness. Si hay que endurecerla, separar las listas de las claves — mover los bullets a una
clave propia (p. ej. `guidelines: [...]`) y dejar `tdd`/`test_command` como mapping hermano.
Validar SIEMPRE con `gentle-ai sdd-status --json` (que el harness siga parseando) antes de
mergear cualquier cambio a `openspec/config.yaml`.
