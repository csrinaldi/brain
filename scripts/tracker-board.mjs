#!/usr/bin/env node
// tracker-board.mjs — Tablero vivo del tracker GitLab: mis tickets + sin asignar.
//
// Imprime markdown listo para consumo del skill `retomar` (y cualquier otro consumidor).
// Detecta host y proyecto desde el git remote. Degrada con aviso si glab no está
// autenticado o el remote no es GitLab.
//
// Uso: node scripts/tracker-board.mjs
//      npm run tracker:board

import { execSync } from 'node:child_process';

const sh = (cmd, opts = {}) =>
  execSync(cmd, { encoding: 'utf8', ...opts }).trim();

const api = (path) =>
  JSON.parse(sh(`glab api "${path}"`, { env: { ...process.env } }));

// --- Detectar remote GitLab ---------------------------------------------------
let gitlabHost, projectPath, projectId;
try {
  const remote = sh('git remote get-url origin');
  const m = remote.match(/https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (!m) throw new Error(`remote sin formato reconocido: ${remote}`);
  gitlabHost = m[1];
  projectPath = m[2];
} catch (e) {
  console.log(`⚠ No se pudo detectar el remote GitLab: ${e.message}`);
  process.exit(0);
}

// Verificar auth
try {
  sh(`glab auth status --hostname ${gitlabHost} 2>&1`);
} catch {
  console.log(`⚠ glab sin auth para ${gitlabHost} — mirá https://${gitlabHost}/${projectPath}/-/issues`);
  process.exit(0);
}

// Resolver project ID desde la API (evita hardcodear)
try {
  const encoded = projectPath.replace(/\//g, '%2F');
  const project = api(`projects/${encoded}`);
  if (!project?.id) throw new Error(`respuesta inesperada de la API: ${JSON.stringify(project)}`);
  projectId = project.id;
} catch (e) {
  console.log(`⚠ No se pudo resolver el proyecto ${projectPath}: ${e.message}`);
  process.exit(0);
}

// --- Resolver usuario actual --------------------------------------------------
let currentUser;
try {
  currentUser = api('user').username;
} catch {
  currentUser = null;
}

// --- Fetch de issues ---------------------------------------------------------
const fetchIssues = (query) => {
  try {
    const result = api(`projects/${projectId}/issues?state=opened&per_page=50&${query}`);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
};

const myIssues = currentUser ? fetchIssues(`assignee_username=${currentUser}`) : [];
const unassigned = fetchIssues('assignee_id=None');

// --- Formato markdown ---------------------------------------------------------
const formatIssue = (i) => {
  const labels = i.labels?.length ? ` \`${i.labels.join('` `')}\`` : '';
  return `- #${i.iid}${labels} ${i.title}`;
};

console.log('## Tus tickets');
if (myIssues.length === 0) {
  console.log('- (ninguno)');
} else {
  for (const i of myIssues) console.log(formatIssue(i));
}

console.log('\n## Sin asignar');
if (unassigned.length === 0) {
  console.log('- (ninguno)');
} else {
  for (const i of unassigned) console.log(formatIssue(i));
}
