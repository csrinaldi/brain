#!/usr/bin/env node
// check-brain-nav.mjs — integridad de navegación de brain/.
//
// La base de conocimiento solo sirve si es ABSORBIBLE: un humano o agente que
// arranca en brain/HOME.md tiene que poder llegar, siguiendo links, a TODO doc
// durable. Este check garantiza dos invariantes, de forma determinista y sin
// engram (corre en CI sobre node:alpine):
//
//   1. Sin links rotos: todo [[wikilink]] y link markdown a un .md resuelve a un
//      archivo real (resuelto contra el filesystem completo — un link a la raíz
//      como ../../AGENTS.md es válido).
//   2. Sin huérfanos: todo brain/**/*.md es alcanzable TRANSITIVAMENTE desde
//      brain/HOME.md (siguiendo links a través de índices como los README).
//
// Exit 1 si hay huérfanos o links rotos; exit 0 si la navegación está íntegra.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BRAIN = join(ROOT, "brain");
const HOME = join(BRAIN, "HOME.md");

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const brainFiles = walk(BRAIN).filter((f) => f.endsWith(".md"));
const brainSet = new Set(brainFiles);

// Resuelve el target de un link a una ruta absoluta existente, o null.
// - mdlink: ruta de filesystem relativa al archivo origen (resuelta contra el FS real).
// - wikilink: slug → brain/<slug>.md, o por basename dentro de brain/.
function resolveLink(fromFile, raw, kind) {
  const target = raw.split("#")[0].trim(); // descartar anchor
  if (!target) return fromFile; // link solo-anchor → mismo archivo
  if (kind === "mdlink") {
    const abs = normalize(join(dirname(fromFile), target));
    return existsSync(abs) ? abs : null;
  }
  const norm = target.replace(/\.md$/, "");
  const bySlug = join(BRAIN, `${norm}.md`);
  if (brainSet.has(bySlug)) return bySlug;
  return brainFiles.find((f) => basename(f) === `${basename(norm)}.md`) ?? null;
}

// Extrae links de un doc: [[wikilinks]] y [texto](ruta.md) (solo destinos .md).
function linksOf(file) {
  const c = readFileSync(file, "utf8");
  const out = [];
  for (const m of c.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g))
    out.push({ raw: m[1], kind: "wikilink" });
  for (const m of c.matchAll(/\]\(([^)\s]+\.md(?:#[^)]*)?)\)/g))
    out.push({ raw: m[1], kind: "mdlink" });
  return out;
}

// 1. Links rotos en cualquier doc de brain/.
const dead = [];
for (const f of brainFiles) {
  for (const { raw, kind } of linksOf(f)) {
    if (resolveLink(f, raw, kind) === null) {
      const shown = kind === "wikilink" ? `[[${raw}]]` : raw;
      dead.push(`${relative(ROOT, f)} → ${shown}`);
    }
  }
}

// 2. Huérfanos: BFS transitivo desde HOME.md por links que caen dentro de brain/.
const seen = new Set([HOME]);
const queue = [HOME];
while (queue.length) {
  const f = queue.shift();
  for (const { raw, kind } of linksOf(f)) {
    const r = resolveLink(f, raw, kind);
    if (r && brainSet.has(r) && !seen.has(r)) {
      seen.add(r);
      queue.push(r);
    }
  }
}
const orphans = brainFiles.filter((f) => !seen.has(f));

// Reporte.
if (orphans.length) {
  console.error(
    `\n✗ ${orphans.length} documento(s) huérfano(s) — no alcanzables desde brain/HOME.md:`,
  );
  for (const o of orphans) console.error(`  • ${relative(ROOT, o)}`);
  console.error(
    "  Agregalos a un índice navegable (HOME.md o el README de su carpeta).",
  );
}
if (dead.length) {
  console.error(`\n✗ ${dead.length} link(s) roto(s) en brain/:`);
  for (const d of dead) console.error(`  • ${d}`);
}

const problems = orphans.length + dead.length;
if (problems === 0) {
  console.log("✓ Navegación de brain/ íntegra: sin huérfanos, sin links rotos.");
  process.exit(0);
}
console.error(`\n${problems} problema(s) de navegación en brain/.`);
process.exit(1);
