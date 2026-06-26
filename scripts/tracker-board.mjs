#!/usr/bin/env node
// tracker-board.mjs — Tablero vivo del tracker: mis tickets + sin asignar.
//
// Provider-agnóstico: pasa por el adapter de VCS (scripts/vcs/cli.mjs), así que
// funciona con GitHub, GitLab u otro host según `vcs.provider` en brain.config.json.
// Imprime markdown listo para el skill `retomar` (y cualquier otro consumidor).
// Degrada con aviso si no hay sesión de VCS autenticada o el remote no se detecta.
//
// Uso: node scripts/tracker-board.mjs   |   npm run tracker:board

import { getVcs } from './vcs/cli.mjs';
import { originIdentity } from './vcs/lib/repo.mjs';

const { host, project } = originIdentity();
if (!project) {
  console.log('⚠ No se pudo detectar el remote de origin.');
  process.exit(0);
}

let vcs;
try {
  vcs = await getVcs();
} catch (e) {
  console.log(`⚠ Provider de VCS no configurado: ${e.message}`);
  process.exit(0);
}

let authed = false;
try { authed = await vcs.authCheck({ host }); } catch { authed = false; }
if (!authed) {
  console.log(`⚠ Sin sesión de VCS autenticada para ${host} — mirá https://${host}/${project}`);
  process.exit(0);
}

let currentUser = null;
try {
  currentUser = (await vcs.whoami()).username;
} catch {
  // stderr, para no contaminar el markdown que consume `retomar`.
  console.error('⚠ No se pudo obtener el usuario — solo se muestran tickets sin asignar.');
}

const safeList = async (opts) => {
  try { return await vcs.issueList({ project, state: 'open', ...opts }); }
  catch { return []; }
};

const myIssues = currentUser ? await safeList({ assignee: 'me' }) : [];
const unassigned = await safeList({ assignee: 'none' });

const formatIssue = (i) => {
  const labels = i.labels?.length ? ` \`${i.labels.join('` `')}\`` : '';
  return `- #${i.number}${labels} ${i.title}`;
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
