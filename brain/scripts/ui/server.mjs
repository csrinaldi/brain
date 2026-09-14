#!/usr/bin/env node
// server.mjs — `brain:ui`: the local read-model server (#881, PR 1 / A1).
//
// Serves the static SPA at `/` and the snapshot at `GET /api/snapshot`,
// built IN-PROCESS via `buildSnapshot` — never shelling out to a CLI
// (R881-1). `buildSnapshot` is composed with a cache-only `vcs` port
// (`forge-cache.mjs`, D1): before the poller lands (#881 PR 2), every forge
// read misses and the forge sections degrade to `{ok:false, reason}` in band
// (R881-9), never a crash and never a live network call from this path.
//
// Every route this PR ships accepts GET/HEAD only; the method check runs
// BEFORE routing (D7), so any other verb gets 405 on any path, known or
// unknown — the three poller-control routes (`/api/poll/*`) that accept
// POST ship in PR 2, not here.

import { createServer as createHttpServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSnapshot } from '../status/snapshot.mjs';
import { createForgeCache } from './forge-cache.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = join(__dirname, 'static');
const ALLOWED_METHODS = new Set(['GET', 'HEAD']);

/**
 * createUiServer() — the one factory every caller uses: the CLI entry below
 * for a real process, tests for an ephemeral one (`port: 0`). No
 * process-level concern (argv, signals, exit codes) lives past this
 * factory's boundary — `listen()`/`close()` are the only lifecycle surface.
 *
 * @param {{root?: string, port?: number, vcs?: object|null, project?: string|null, _now?: () => Date}} opts
 */
export function createUiServer({ root = process.cwd(), port = 3000, vcs = null, project = null, _now = () => new Date() } = {}) {
  // D1's invariant: `buildSnapshot` NEVER sees a live forge port, only the
  // cache. When no `vcs` is injected (the real CLI entry, always — the
  // poller that fills a cache ships in PR 2), the server owns its own,
  // permanently-empty one.
  const forgeVcs = vcs ?? createForgeCache().port;

  const httpServer = createHttpServer((req, res) => {
    handleRequest(req, res).catch((err) => sendInternalError(res, err));
  });

  async function handleRequest(req, res) {
    if (!ALLOWED_METHODS.has(req.method)) {
      res.writeHead(405, { allow: 'GET, HEAD' });
      res.end();
      return;
    }
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/') return serveIndex(res);
    if (pathname === '/api/snapshot') return serveSnapshot(res);
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }

  function serveIndex(res) {
    const html = readFileSync(join(STATIC_DIR, 'index.html'), 'utf8');
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(html);
  }

  async function serveSnapshot(res) {
    const snapshot = await buildSnapshot({ root, now: _now(), vcs: forgeVcs, project });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(snapshot));
  }

  function sendInternalError(res, err) {
    if (res.headersSent) { res.end(); return; }
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(`internal error: ${err?.message ?? err}`);
  }

  const api = {
    port,
    listen(overridePort = api.port) {
      return new Promise((resolve, reject) => {
        const onError = (err) => { httpServer.removeListener('listening', onListening); reject(err); };
        const onListening = () => {
          httpServer.removeListener('error', onError);
          api.port = httpServer.address().port;
          resolve(api.port);
        };
        httpServer.once('error', onError);
        httpServer.once('listening', onListening);
        httpServer.listen(overridePort, '127.0.0.1');
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
  return api;
}

// ── argv: a manual loop, the same grammar as `status/snapshot-cli.mjs:18-34` ─

/** @returns {{ok:true,port:number,root:string}|{ok:false,error:string}} */
export function parseArgs(argv = []) {
  const out = { ok: true, port: 3000, root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') {
      const v = argv[++i];
      const n = Number(v);
      if (v === undefined || !Number.isInteger(n) || n < 0) return { ok: false, error: '--port needs a non-negative integer' };
      out.port = n;
    } else if (a === '--root') {
      const v = argv[++i];
      if (!v) return { ok: false, error: '--root needs a directory' };
      out.root = v;
    } else return { ok: false, error: `unknown argument: ${a}` };
  }
  return out;
}

/**
 * main() — the CLI's own logic, deps-injected for tests. `EADDRINUSE` is
 * D15's same class of error as a bad argument (the operator gave this verb
 * something it cannot use), so it takes the same exit code, 2.
 *
 * @returns {Promise<number|object>} an exit code on failure, or the started
 *   server on success — the guard below only exits on the numeric case, so a
 *   real run keeps listening.
 */
export async function main(argv = [], deps = {}) {
  const say = deps.say ?? console.log;
  const error = deps.error ?? console.error;
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    error(`✗ ${parsed.error}\n  Usage: npm run brain:ui -- [--port <n>] [--root <dir>]`);
    return 2;
  }
  const server = createUiServer({ root: parsed.root, vcs: deps.vcs ?? null, project: deps.project ?? null });
  try {
    await server.listen(parsed.port);
  } catch (err) {
    if (err?.code === 'EADDRINUSE') {
      error(`✗ port ${parsed.port} is already in use`);
      return 2;
    }
    throw err;
  }
  say(`brain:ui listening on http://127.0.0.1:${server.port}`);
  return server;
}

// Guarded like `status/snapshot-cli.mjs:54-69`: importing this module never
// starts a server or reaches the forge. `vcs` is deliberately never resolved
// here (D1) — the real CLI entry always runs with an empty, in-process
// forge-cache until the poller (#881 PR 2) fills it.
if (import.meta.url === `file://${process.argv[1]}`) {
  let project = null;
  try {
    const { originIdentity } = await import('../vcs/lib/repo.mjs');
    project = originIdentity()?.project ?? null;
  } catch { /* degrades to uncomputable forge sections, never a crash */ }
  const result = await main(process.argv.slice(2), { project });
  if (typeof result === 'number') process.exit(result);
}
