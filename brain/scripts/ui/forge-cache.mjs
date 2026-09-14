// forge-cache.mjs — the cache-only port `buildSnapshot` composes as `vcs`
// (D1, #881). It never calls the forge: the poller (#881 PR 2) is the only
// writer, through the setters below. A cache miss THROWS rather than
// fetching, so `buildSnapshot` provably makes zero network calls on any
// path, ever — the invariant D1 is built on.
//
// `port` exposes EXACTLY the four read verbs `readForge`
// (`status/snapshot.mjs:184-255`) calls — pinned by `forge-cache.test.mjs` —
// so a stray fifth verb can never slip in as "the vcs port" and go untested
// by A5's read-only-port proof. The setters live outside `port` on purpose:
// they are the poller's write surface into this cache, never a verb
// `buildSnapshot` itself could reach.

const MISS_REASON = 'the first forge poll has not completed';

function miss() {
  throw new Error(MISS_REASON);
}

/**
 * @returns {{
 *   port: {issueList: Function, mrList: Function, issueView: Function, prReviews: Function},
 *   setIssueList: (value: unknown) => void,
 *   setMrList: (value: unknown) => void,
 *   setIssueView: (number: number, value: unknown) => void,
 *   setPrReviews: (number: number, value: unknown) => void,
 * }}
 */
export function createForgeCache() {
  const store = { issueList: undefined, mrList: undefined, issueView: new Map(), prReviews: new Map() };

  const port = {
    issueList: async () => (store.issueList !== undefined ? store.issueList : miss()),
    mrList: async () => (store.mrList !== undefined ? store.mrList : miss()),
    issueView: async ({ number } = {}) => (store.issueView.has(number) ? store.issueView.get(number) : miss()),
    prReviews: async ({ number } = {}) => (store.prReviews.has(number) ? store.prReviews.get(number) : miss()),
  };

  return {
    port,
    setIssueList: (value) => { store.issueList = value; },
    setMrList: (value) => { store.mrList = value; },
    setIssueView: (number, value) => { store.issueView.set(number, value); },
    setPrReviews: (number, value) => { store.prReviews.set(number, value); },
  };
}
