// markdown-worker.mjs — the page's markdown tokenizer, run off the main thread
// (#1218). One worker per document: the page posts {id, text} and gets back
// {id, ok:true, tree} or {id, ok:false, error}, plain data only.

import { markdownTree } from './markdown.mjs';

export function reply({ id, text }, build = markdownTree) {
  try {
    return { id, ok: true, tree: build(text) };
  } catch (error) {
    return { id, ok: false, error: String(error?.message ?? error) };
  }
}

// Bound only inside a worker: there is a postMessage and no document.
if (typeof globalThis.postMessage === 'function' && typeof globalThis.document === 'undefined') {
  globalThis.onmessage = (event) => globalThis.postMessage(reply(event.data));
}
