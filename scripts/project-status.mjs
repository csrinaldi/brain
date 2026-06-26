#!/usr/bin/env node
// project-status.mjs — Proyección en vivo del estado del monorepo (Tier 2).
//
// Imprime a stdout: reactor Maven (módulos, versiones, parents), poms fuera
// del reactor, estado del frontend y trabajo abierto en GitLab. NO escribe
// archivos: el estado se GENERA a demanda, nunca se versiona ni se edita a
// mano (AGENTS.md §0, Tier 2: proyección reconstruible, no fuente).
//
// Se ejecuta con `npm run project:status`. Sin dependencias externas.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadBrainConfig } from './lib/brain-config.mjs';

const ROOT = process.cwd();
const { project } = loadBrainConfig();
const GITLAB_HOST = project.gitHost;
const PROJECT_ID = project.gitProjectId;
const PROJECT_PATH = project.slug;

const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1].trim() : null;
};

console.log('# Estado del monorepo — proyección generada, NO editar ni guardar\n');

// --- Reactor Maven -------------------------------------------------------------
console.log('## Reactor Maven\n');

// Recorre el reactor RECURSIVAMENTE: un <module> puede ser otro agregador
// (backend/core, backend/services) cuyos módulos también participan del build.
const rows = [];
const visitedPoms = new Set(['pom.xml']);
function walkModules(dirRel, depth) {
  const pomAbs = join(ROOT, dirRel, 'pom.xml');
  const pomRel = dirRel ? `${dirRel}/pom.xml` : 'pom.xml';
  if (!existsSync(pomAbs)) {
    rows.push({ artifact: `(pom AUSENTE: ${dirRel})`, version: '-', packaging: '-', parent: '-', depth });
    return;
  }
  visitedPoms.add(pomRel);
  const pom = readFileSync(pomAbs, 'utf8');
  const modules = [...pom.matchAll(/<module>([^<]+)<\/module>/g)].map((m) => m[1].trim());
  if (dirRel) {
    const parentBlock = pom.match(/<parent>[\s\S]*?<\/parent>/);
    const own = parentBlock ? pom.replace(parentBlock[0], '') : pom;
    rows.push({
      artifact: tag(own, 'artifactId') ?? '?',
      version: tag(own, 'version') ?? `${tag(parentBlock?.[0] ?? '', 'version') ?? '?'} (del parent)`,
      packaging: tag(own, 'packaging') ?? 'jar',
      parent: parentBlock ? tag(parentBlock[0], 'artifactId') ?? '-' : '(sin parent)',
      depth,
    });
  }
  for (const mod of modules) walkModules(dirRel ? `${dirRel}/${mod}` : mod, depth + 1);
}
walkModules('', 0);

const pad = (s, n) => String(s).padEnd(n);
console.log(`  ${pad('artifactId', 30)}${pad('versión', 26)}${pad('packaging', 11)}parent`);
for (const r of rows) {
  const indent = '  '.repeat(r.depth);
  console.log(`  ${pad(indent + r.artifact, 30)}${pad(r.version, 26)}${pad(r.packaging, 11)}${r.parent}`);
}
console.log(`\n  ${rows.length} módulo(s) en el reactor (incluye agregadores).`);

// Poms trackeados que NO participan del reactor: candidatos a olvido.
const trackedPoms = sh('git ls-files "**/pom.xml"').split('\n').filter(Boolean);
const orphans = trackedPoms.filter((p) => !visitedPoms.has(p));
if (orphans.length > 0) {
  console.log('\n  ⚠ Poms trackeados FUERA del reactor (no se construyen con backend:build):');
  for (const o of orphans) console.log(`      ${o}`);
}

// --- Frontend --------------------------------------------------------------------
console.log('\n## Frontend (Nx)\n');
let nxProjects = [];
try {
  nxProjects = sh('git ls-files "frontend/**/project.json"').split('\n').filter(Boolean);
} catch {
  /* sin matches */
}
if (nxProjects.length === 0) {
  console.log('  Sin proyectos Nx aún (frontend vacío).');
} else {
  for (const p of nxProjects) console.log(`  ${p.replace('/project.json', '')}`);
  console.log(`\n  ${nxProjects.length} proyecto(s) Nx.`);
}

// --- GitLab: trabajo abierto -------------------------------------------------------
console.log('\n## Trabajo abierto en GitLab\n');
const glabReady = (() => {
  try {
    sh(`glab auth status --hostname ${GITLAB_HOST} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
})();

if (!glabReady) {
  console.log(`  ⚠ glab sin auth — mirá https://${GITLAB_HOST}/${PROJECT_PATH}/-/issues`);
} else {
  const api = (path) =>
    JSON.parse(
      execSync(`glab api "${path}"`, {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, GITLAB_HOST },
      }),
    );
  try {
    const issues = api(`projects/${PROJECT_ID}/issues?state=opened&per_page=50`);
    console.log(`  Issues abiertos (${issues.length}):`);
    for (const i of issues) {
      const labels = i.labels?.length ? `  [${i.labels.join(', ')}]` : '';
      console.log(`    #${i.iid}  ${i.title}${labels}`);
    }
    const mrs = api(`projects/${PROJECT_ID}/merge_requests?state=opened&per_page=50`);
    console.log(`\n  MRs abiertos (${mrs.length}):`);
    for (const m of mrs) {
      console.log(`    !${m.iid}  ${m.title}  (${m.source_branch})`);
    }
    if (mrs.length === 0) console.log('    (ninguno)');
  } catch (e) {
    console.log(`  ⚠ No se pudo consultar GitLab: ${e.message.split('\n')[0]}`);
  }
}

console.log('\n— Fin de la proyección. Para regenerar: npm run project:status');
