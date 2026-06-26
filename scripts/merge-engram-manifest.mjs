#!/usr/bin/env node
// Merge driver for .engram/manifest.json
//
// Usage (registered via .gitattributes + git config):
//   git config merge.engram-manifest.driver \
//     "node scripts/merge-engram-manifest.mjs %O %A %B"
//
// A conflict in manifest.json is always additive: two branches each appended
// distinct chunks. The correct resolution is the union of both arrays, never
// choosing one side over the other.

import { readFileSync, writeFileSync } from 'node:fs';

const [, , , ours, theirs] = process.argv; // %O %A %B → base ours theirs

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { version: 1, chunks: [] };
  }
}

const a = readJson(ours);
const b = readJson(theirs);

const seen = new Set();
const merged = [];
for (const chunk of [...(a.chunks ?? []), ...(b.chunks ?? [])]) {
  if (!seen.has(chunk.id)) {
    seen.add(chunk.id);
    merged.push(chunk);
  }
}

const result = {
  version: Math.max(a.version ?? 1, b.version ?? 1),
  chunks: merged,
};

writeFileSync(ours, JSON.stringify(result, null, 2) + '\n', 'utf8');
process.exit(0);
