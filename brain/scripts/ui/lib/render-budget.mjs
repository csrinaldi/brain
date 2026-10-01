// render-budget.mjs — render a document off the page, with a time budget (#1218).
// The tokenizer runs in a worker, never on the main thread, and a document that
// has not answered within the budget is abandoned. Pure: every effect (the
// worker, the timer) is injected, so each race is testable in node.
//
// Outcomes, as one promise that never rejects:
//   {kind:'tree', tree}   the worker answered in time
//   {kind:'timeout'}      the budget ran out
//   {kind:'failed'}       the worker errored, would not start, or sent junk
//   {kind:'unavailable'}  there is no worker to ask
//   {kind:'cancelled'}    the caller stopped waiting

export const RENDER_BUDGET_MS = 1500;
export const TIMEOUT_NOTICE = 'this document was too slow to render (over 1500 ms) and is shown as plain text';
export const FAILED_NOTICE = 'this document could not be rendered and is shown as plain text';
export const UNAVAILABLE_NOTICE = 'this browser cannot render this document off the page, so it is shown as plain text';

let nextId = 0;

const isTree = (tree) => tree !== null && typeof tree === 'object' && Array.isArray(tree.blocks) && Array.isArray(tree.notices);

/**
 * @param {string} text
 * @param {{spawn?: () => object|null|undefined, setTimer: Function, clearTimer: Function, budgetMs?: number}} effects
 * @returns {{promise: Promise<{kind:string, tree?:object}>, cancel: () => void}}
 */
export function renderOffThread(text, { spawn, setTimer, clearTimer, budgetMs = RENDER_BUDGET_MS }) {
  const id = ++nextId;
  let worker = null;
  let timer = null;
  let settled = false;
  let resolve;
  const promise = new Promise((r) => { resolve = r; });

  const settle = (outcome) => {
    if (settled) return;
    settled = true;
    clearTimer(timer);
    if (worker) worker.terminate();
    resolve(outcome);
  };

  // The timer starts first, so the budget includes the worker's startup.
  timer = setTimer(() => settle({ kind: 'timeout' }), budgetMs);
  try {
    worker = typeof spawn === 'function' ? spawn() : null;
  } catch {
    settle({ kind: 'failed' });
    return { promise, cancel: () => settle({ kind: 'cancelled' }) };
  }
  if (!worker) {
    settle({ kind: 'unavailable' });
    return { promise, cancel: () => settle({ kind: 'cancelled' }) };
  }
  worker.onmessage = (event) => {
    if (settled) return;
    const data = event?.data;
    if (data !== null && typeof data === 'object' && 'id' in data && data.id !== id) return;
    if (data !== null && typeof data === 'object' && data.ok === true && isTree(data.tree)) settle({ kind: 'tree', tree: data.tree });
    else settle({ kind: 'failed' });
  };
  worker.onerror = () => settle({ kind: 'failed' });
  try {
    worker.postMessage({ id, text });
  } catch {
    settle({ kind: 'failed' });
  }
  return { promise, cancel: () => settle({ kind: 'cancelled' }) };
}
