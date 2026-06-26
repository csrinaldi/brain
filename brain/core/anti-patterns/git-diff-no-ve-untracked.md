# git diff no ve archivos untracked

- **Descubierto en:** ISSUE-13 / macro `change:verify`
- **Aplica a:** toda automatización que decida algo a partir del changeset (validación selectiva, generación de MRs, clasificación de scope, CI)

## Síntoma

Una validación construida sobre `git diff --name-only` (rama vs main + staged +
working tree) clasifica el cambio como "solo docs" cuando el cambio incluye un script
NUEVO. El archivo más importante del changeset — el que se está creando — es
invisible para la validación. En el caso real: `verify-change.mjs` no se detectaba a
sí mismo en su propio plan de validación.

## Causa

`git diff` (en todas sus variantes: contra base, `--cached`, working tree) solo
compara contenido CONOCIDO por git. Un archivo nunca agregado al índice no participa
de ningún diff: no es una "modificación" de nada. La intuición "diff = todo lo que
cambió" es falsa para lo nuevo sin trackear.

## Solución / patrón correcto

Toda recolección de changeset debe sumar explícitamente los untracked:

```js
collect(`git diff --name-only ${base}...HEAD`);   // commits de la rama
collect('git diff --name-only --cached');          // staged
collect('git diff --name-only');                   // working tree
collect('git ls-files --others --exclude-standard'); // untracked: git diff NO los lista
```

Y el test de humo correcto es dogfooding: correr la automatización sobre el cambio
que la introduce — si no se ve a sí misma, está ciega.
