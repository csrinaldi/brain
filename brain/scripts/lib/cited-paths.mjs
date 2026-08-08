// cited-paths.mjs — rutas `brain/...` citadas entre backticks (issue #499).
//
// Vive en su propio módulo, y no dentro de check-brain-nav.mjs, porque ese script
// corre sus chequeos al importarse: un test que importara desde ahí ejecutaría la
// compuerta entera contra el repo real. Separarlo permite testear la extracción
// como función pura y la compuerta por spawn, que son dos afirmaciones distintas.
//
// POR QUÉ EXISTE ESTE CHEQUEO
//
// Un link markdown no es la única forma en que brain/ se apunta a sí mismo — la
// más frecuente en la doctrina es la cita entre backticks, y check-brain-nav.mjs
// no la veía. Medido en `main` @ 5313182: 22 rutas citadas en 6 archivos no
// resolvían, con `brain:nav` reportando "sin links rotos".
//
// Cuatro de ellas eran `brain/decisions/`, `brain/anti-patterns/`, `brain/domain/`
// y `brain/methodology/` — los cuatro directorios que la lista "Tier 3 —
// Prohibido" de agent-authorities.md nombra, y que la reorganización core/project
// dejó sin existir. La prohibición que lleva "even if explicitly asked" no cubría
// ningún directorio real.
//
// Sobre los GLOBS (`brain/**`): NO matchean, medido. El regex exige backtick de
// cierre y `*` está fuera de la clase de caracteres, así que la cita nunca cierra
// — no degrada a `brain/`, simplemente no produce match. El `.filter()` de abajo
// es entonces código muerto hoy: una mutación que lo desactiva no cambia el conteo
// (22 → 22). Queda como cinturón y tiradores y se anota como tal, porque una
// protección aparente es la clase de defecto que este mismo ticket persigue.
// (Una primera versión de este comentario afirmaba que el filtro descartaba
// `brain/` — falso, y lo corrigió el test, no la lectura.)
const CITED_RE = /`(brain\/[A-Za-z0-9_./-]+)`/g;

/**
 * @param {string} content  Markdown.
 * @returns {string[]}  Rutas citadas, en orden de aparición, sin globs.
 */
export function citedPathsIn(content) {
  return [...content.matchAll(CITED_RE)]
    .map((m) => m[1])
    .filter((p) => !p.includes("*"));
}
