#!/usr/bin/env node
// brain/scripts/archive.mjs — CLI interface for E1 brain:change:archive (issue 260)

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { archiveChange } from './lib/archive-logic.mjs';
import { parseChangeId, isGrandfathered } from './lib/sdd-layout.mjs';

const arg = process.argv[2];

if (!arg) {
  console.error('\n  ✗ Error: Falta especificar el ID del cambio a archivar o --all.');
  console.error('  Uso: npm run brain:change:archive -- <changeId>');
  console.error('       npm run brain:change:archive -- --all\n');
  process.exit(1);
}

const fs = {
  exists: (p) => existsSync(join(process.cwd(), p)),
  listDir: (p) => readdirSync(join(process.cwd(), p)),
  readFile: (p) => readFileSync(join(process.cwd(), p), 'utf8'),
  writeFile: (p, content) => writeFileSync(join(process.cwd(), p), content, 'utf8'),
  mkdir: (p) => mkdirSync(join(process.cwd(), p), { recursive: true }),
  rename: (src, dest) => renameSync(join(process.cwd(), src), join(process.cwd(), dest)),
};

async function run() {
  const dateStr = new Date().toISOString().slice(0, 10);

  if (arg === '--all' || arg === '--backfill') {
    console.log('\n  Starting backfill of completed changes...');
    const changesRoot = 'openspec/changes';
    const entries = readdirSync(join(process.cwd(), changesRoot), { withFileTypes: true });

    let archivedCount = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;

      // Omit active change issue-260 and archive folders
      if (name === 'archive') continue;
      
      const parsed = parseChangeId(name);
      if (parsed && parsed.iid === '260') {
        console.log(`  - Skipping active E1 change: ${name}`);
        continue;
      }

      const isLegacy = isGrandfathered(name);
      if (!parsed && !isLegacy) {
        console.log(`  - Skipping non-change directory: ${name}`);
        continue;
      }

      try {
        await archiveChange({ changeId: name, fs, dateStr });
        console.log(`  ✓ Archived: ${name}`);
        archivedCount++;
      } catch (err) {
        console.error(`  ✗ Failed to archive ${name}: ${err.message}`);
      }
    }
    console.log(`\n  ✓ Backfill complete. Archived ${archivedCount} changes.\n`);
  } else {
    try {
      await archiveChange({ changeId: arg, fs, dateStr });
      console.log(`\n  ✓ Cambio "${arg}" archivado con éxito.`);
      console.log(`    Cuerpo de specs delta fusionado en openspec/specs/ y directorio movido a archive/.\n`);
    } catch (err) {
      console.error(`\n  ✗ Error al archivar cambio: ${err.message}\n`);
      process.exit(1);
    }
  }
}

await run();
