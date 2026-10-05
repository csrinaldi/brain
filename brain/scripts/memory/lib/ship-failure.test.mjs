import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugRefusalText } from './ship-failure.mjs';
import { ProjectSlugError } from '../../lib/project-slug.mjs';

test('#1273 memory ship: an unresolvable slug is refused in the operator\'s language, naming the fix', async () => {
  const es = await slugRefusalText(new ProjectSlugError(), { locale: 'es' });
  const en = await slugRefusalText(new ProjectSlugError(), { locale: 'en' });
  assert.match(es, /no se puede saber de qué repositorio/);
  assert.match(en, /cannot tell which repository/);
  for (const m of [es, en]) assert.match(m, /brain:config -- set project\.slug <owner\/repo>/);
});

test('#1273 memory ship: any other failure is not a slug refusal', async () => {
  assert.equal(await slugRefusalText(Object.assign(new Error('boom'), { raced: true }), { locale: 'en' }), null);
});
