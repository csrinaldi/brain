// poller.mjs — the forge poll loop: three lanes bounded by the Q1/D2 budget
// (#881 PR 2). The ONLY caller of any `gh`-backed VCS read verb this server
// makes (D1) — `buildSnapshot` never sees a live port, only the cache this
// module fills through `forge-cache.mjs`'s setters.
//
// Fast lane, every tick: `issueList` + `mrList` — their rows ARE the change
// key (Q1: no ETag, no `updated_at` anywhere in the provider). Review lane,
// every tick, capped at 10 PRs, round-robin beyond the cap (`min(P,10)`).
// Body lane: on the very first tick ever ("cold start"), every open issue,
// uncapped — the page cannot render a graph at all otherwise, and this
// happens exactly once per process. On every later tick, the body lane only
// spends its budget when the fast lane's own rows say something moved:
// brand-new issue numbers (same tick, capped at 20, so a new issue never
// sits `unreadable`) plus issues whose fast-lane row changed, rounded out to
// B = 5 total with the longest-unrefreshed issues. When NEITHER bucket has
// anything — R881-4 S1 — the body lane costs nothing that tick; the
// least-recently-refreshed fallback only rounds out an already-nonempty
// batch, it never manufactures work alone.
//
// A poll failure NEVER empties a section it once filled (R881-9): the fast
// lane's own failure aborts the whole tick before any cache setter runs, so
// every previously-cached section keeps its last known value; per-item
// review/body failures are caught individually and simply skip that one
// item's cache write.

const REVIEW_CAP = 10;
const BODY_CAP = 5;
const NEW_BODY_CAP = 20;
const ONCE_COLLAPSE_MS = 5000;

function rowsEqual(a, b) {
  return a.title === b.title
    && JSON.stringify(a.labels ?? []) === JSON.stringify(b.labels ?? [])
    && JSON.stringify(a.assignees ?? []) === JSON.stringify(b.assignees ?? []);
}

/**
 * createPoller() — the three lanes, pause/resume/once (D2, D7, #881 PR 2).
 *
 * @param {{
 *   vcs: {issueList: Function, mrList: Function, issueView: Function, prReviews: Function},
 *   cache: {setIssueList: Function, setMrList: Function, setIssueView: Function, setPrReviews: Function},
 *   project?: string|null,
 *   interval?: number, enabled?: boolean,
 *   _setTimeout?: Function, _clearTimeout?: Function, _now?: () => Date,
 *   onTick?: (state: object) => void,
 * }} opts
 */
export function createPoller({
  vcs,
  cache,
  project = null,
  interval = 60000,
  enabled = true,
  _setTimeout = setTimeout,
  _clearTimeout = clearTimeout,
  _now = () => new Date(),
  onTick = () => {},
} = {}) {
  let paused = !enabled;
  let timer = null;
  let inFlight = null;
  let lastOnceAt = -Infinity;
  let previousIssues = null; // Map<number, row> | null — null means "no tick has completed yet"
  const lastBodyRefreshTick = new Map();
  let tickCount = 0;
  let reviewOffset = 0;

  let lastPolledAt = null;
  let lastOkAt = null;
  let lastError = null;
  let forgeAsOf = { issues: null, bodies: null, reviews: null };

  function state() {
    return { paused, lastPolledAt, lastOkAt, lastError, forgeAsOf: { ...forgeAsOf } };
  }

  function pickReviewTargets(prNumbers) {
    if (prNumbers.length <= REVIEW_CAP) return prNumbers;
    const picked = [];
    for (let i = 0; i < REVIEW_CAP; i++) picked.push(prNumbers[(reviewOffset + i) % prNumbers.length]);
    reviewOffset = (reviewOffset + REVIEW_CAP) % prNumbers.length;
    return picked;
  }

  function pickBodyTargets(issueRows) {
    const numbers = issueRows.map((r) => r.number);
    if (previousIssues === null) return numbers; // cold start: every open issue, uncapped

    const newNumbers = numbers.filter((n) => !previousIssues.has(n)).slice(0, NEW_BODY_CAP);
    const newSet = new Set(newNumbers);
    const changed = numbers.filter((n) => {
      if (newSet.has(n)) return false;
      const prev = previousIssues.get(n);
      const row = issueRows.find((r) => r.number === n);
      return prev !== undefined && !rowsEqual(prev, row);
    });
    if (newNumbers.length === 0 && changed.length === 0) return []; // R881-4 S1: nothing moved, nothing fetched

    const changedSet = new Set(changed);
    const remaining = Math.max(BODY_CAP - newNumbers.length - changed.length, 0);
    const rest = numbers
      .filter((n) => !newSet.has(n) && !changedSet.has(n))
      .sort((a, b) => (lastBodyRefreshTick.get(a) ?? -1) - (lastBodyRefreshTick.get(b) ?? -1))
      .slice(0, remaining);
    return [...newNumbers, ...changed, ...rest];
  }

  async function tick() {
    tickCount += 1;
    const attemptAt = _now();
    try {
      const [issueRows, mrRows] = await Promise.all([
        vcs.issueList({ project, state: 'open' }),
        vcs.mrList({ project, state: 'open' }),
      ]);
      cache.setIssueList(issueRows);
      cache.setMrList(mrRows);
      forgeAsOf = { ...forgeAsOf, issues: attemptAt.toISOString() };

      const prNumbers = mrRows.map((p) => p.number);
      // No cold-start exception here (unlike the body lane below): the
      // header comment promises "every tick, capped at 10 PRs" with no
      // carve-out, and `pickReviewTargets` already returns every PR
      // untouched when `prNumbers.length <= REVIEW_CAP`, so a small forge
      // still gets every PR reviewed on the first tick — only a forge with
      // more than REVIEW_CAP open PRs is actually capped, cold or not.
      const reviewTargets = pickReviewTargets(prNumbers);
      await Promise.all(reviewTargets.map(async (number) => {
        try { cache.setPrReviews(number, await vcs.prReviews({ project, number })); } catch { /* previous value stays cached (R881-9) */ }
      }));
      if (reviewTargets.length > 0) forgeAsOf = { ...forgeAsOf, reviews: attemptAt.toISOString() };

      const bodyTargets = pickBodyTargets(issueRows);
      await Promise.all(bodyTargets.map(async (number) => {
        try {
          cache.setIssueView(number, await vcs.issueView({ project, number }));
          lastBodyRefreshTick.set(number, tickCount);
        } catch { /* previous value stays cached (R881-9) */ }
      }));
      if (bodyTargets.length > 0) forgeAsOf = { ...forgeAsOf, bodies: attemptAt.toISOString() };

      previousIssues = new Map(issueRows.map((r) => [r.number, r]));
      lastOkAt = attemptAt.toISOString();
      lastError = null;
    } catch (err) {
      // The fast lane itself failed: nothing this tick is trustworthy, so no
      // cache setter ran above and every previously-cached section is
      // untouched (R881-9).
      lastError = err?.message ?? String(err);
    } finally {
      lastPolledAt = attemptAt.toISOString();
    }
  }

  let closed = false;

  function scheduleNext() {
    // `closed` matters here, not just in `close()` itself: a tick already
    // in flight when `close()` runs keeps resolving in the background, and
    // its own `.finally()` calls `scheduleNext()` — without this guard that
    // would arm a brand-new real timer AFTER the server believes it has shut
    // down, leaking a handle that keeps the process alive (measured: a
    // `node --test` run that passes every assertion but never exits).
    if (closed || paused || interval <= 0) return;
    timer = _setTimeout(runTick, interval);
  }

  function runTick() {
    timer = null;
    inFlight = tick().finally(() => {
      inFlight = null;
      onTick(state());
      scheduleNext();
    });
    return inFlight;
  }

  return {
    start() { return paused ? undefined : runTick(); },
    close() { closed = true; if (timer) { _clearTimeout(timer); timer = null; } },
    pause() {
      paused = true;
      if (timer) { _clearTimeout(timer); timer = null; }
      return state();
    },
    resume() {
      // Resuming re-arms the regular interval; it does not itself poll —
      // that is what `once()` ("poll now") is for (R881-4 S2 treats the two
      // as distinct controls). `start()` polls immediately because a
      // process that has NEVER polled needs data as soon as possible; a
      // paused-then-resumed poller already has whatever it last held.
      if (paused) { paused = false; scheduleNext(); }
      return state();
    },
    async once() {
      if (inFlight) return inFlight.then(state);
      const nowMs = _now().getTime();
      if (nowMs - lastOnceAt < ONCE_COLLAPSE_MS) return state();
      lastOnceAt = nowMs;
      if (timer) { _clearTimeout(timer); timer = null; }
      await runTick();
      return state();
    },
    state,
  };
}
