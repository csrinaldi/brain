#!/usr/bin/env node
// Scaffolder de changes SDD en formato OpenSpec — harness-neutral.
// No depende de ningún harness (gentle-ai u otro): el repo sabe crear su
// propia estructura SDD. Ver brain/project/decisions/adr-0002-harness-reemplazable-openspec.md
//
// Uso:
//   npm run brain:project:feature -- --issue 104
//   npm run brain:project:feature -- --issue 104 --title "valuacion masiva"
// (alias deprecado: npm run project:feature)

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--issue") args.issue = argv[++i];
    else if (argv[i] === "--title") args.title = argv[++i];
  }
  return args;
}

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

const { issue, title } = parseArgs(process.argv.slice(2));

if (!issue || !/^\d+$/.test(issue)) {
  fail(
    'Falta el ID del issue. Uso: npm run project:feature -- --issue 104 [--title "nombre"]',
  );
}

const changeId = title ? `issue-${issue}-${slugify(title)}` : `issue-${issue}`;
const changeDir = join(repoRoot, "openspec", "changes", changeId);

if (existsSync(changeDir)) {
  fail(`El change "${changeId}" ya existe en openspec/changes/. No se sobrescribe.`);
}

const heading = title ? `${title} (issue ${issue})` : `Issue ${issue}`;

const proposal = `---
status: draft
issue: ${issue}
---

# Propuesta — ${heading}

## Qué
<Una frase: qué se va a cambiar.>

## Por qué
<El problema o la necesidad que motiva el cambio. Vincular al issue #${issue}.>

## Alcance
- Incluye: <...>
- No incluye: <...>
`;

const design = `---
status: draft
issue: ${issue}
---

# Diseño — ${heading}

## Decisiones técnicas
<Cómo se resuelve. Decisiones de arquitectura, módulos afectados, contrato.>

## Contract / API impact
<Does this change mutate the public contract or API? If yes, describe the impact and any generation steps needed.>

## Alternativas descartadas
<Qué se evaluó y por qué no.>
`;

const tasks = `---
status: draft
issue: ${issue}
---

# Tareas — ${heading}

- [ ] <Primera tarea aislada>
- [ ] <Segunda tarea>

## Micro-decisiones en caliente
<Acuerdos técnicos de la sesión. Se promueven al cerebro en el MR — ver
brain/core/methodology/consolidation-protocol.md>
`;

mkdirSync(changeDir, { recursive: true });
writeFileSync(join(changeDir, "proposal.md"), proposal);
writeFileSync(join(changeDir, "design.md"), design);
writeFileSync(join(changeDir, "tasks.md"), tasks);

console.log(`
  ✓ Change SDD creado: openspec/changes/${changeId}/
      proposal.md  design.md  tasks.md

  Siguiente: completá la propuesta y abrí la rama {tipo}/${changeId}.
  ({tipo}: feat | fix | chore | refactor | docs | ci | build)
`);
