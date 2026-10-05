// poller.mjs — the forge poll loop: the open lane, the remotes lane and the closed
// lane (#881 PR 2, #1201, #1257). The ONLY caller of any `gh`-backed VCS read verb
// this server makes (D1) — `buildSnapshot` never sees a live port, only the cache this
// module fills through `forge-cache.mjs`'s setters.
//
// Open lane, every tick: `issueList` + `mrList`. The issue rows carry `state` and
// `body` (#1257 R10), so a row IS the change key and the body; there is no body
// refresh to schedule. The review lane runs every tick, capped at 10 PRs,
// round-robin beyond the cap (`min(P,10)`). The only per-issue read left is the
// null-body fallback: rows whose `body` is not a string and that are not yet cached,
// ascending, at most BODY_CAP per tick (R1257-11), on the cold start too.
//
// The open list's FIRST landing recomputes at once (D66), before the review lane, so
// the graph fills in before the reviews. `forgeLoad` says what is still loading
// (D64): the page never reads a pending lane as a failure or as an empty list.
//
// Closed lane (#1257 D56): the closed issues are read on their own single flight,
// never awaited by a tick and never awaiting one: full first, then incremental
// (`updatedSince`), with a periodic full re-list. Its failure never touches the open
// lane's `lastError`.
//
// Remotes lane (#1201 D40): beside the forge lane, each tick also runs the
// injected `fetchRemotes` (one `git fetch origin …`, asynchronous, killed at its
// timeout). The two lanes settle independently — one failing never skips the
// other — and `onTick` fires after both, so the recompute sees the new refs.
// Fetch has exactly two callers: this timer and the explicit `refreshRemotes()`
// (the POST route); a recompute or a watch event never fetches.
//
// A poll failure NEVER empties a section it once filled (R881-9): the fast
// lane's own failure aborts the whole tick before any cache setter runs, so
// every previously-cached section keeps its last known value; per-item
// review/body failures are caught individually and simply skip that one
// item's cache write.

const REVIEW_CAP = 10;
const BODY_CAP = 5;
const ONCE_COLLAPSE_MS = 5000;
// #1257 D56: every 60th closed run re-lists in full, which drops issues a delta never reports
// (transferred, deleted); the 10 minutes absorb clock skew between this host and the forge.
const CLOSED_FULL_EVERY_RUNS = 60;
const CLOSED_SINCE_OVERLAP_MS = 600000;

/**
 * createPoller() — the three lanes, pause/resume/once (D2, D7, #881 PR 2).
 *
 * @param {{
 *   vcs: {issueList: Function, mrList: Function, issueView: Function, prReviews: Function},
 *   closedVcs?: {issueList: Function}|null,  // the closed lane's own port (own thread in production)
 *   cache: {setIssueList: Function, setMrList: Function, setIssueView: Function, setPrReviews: Function},
 *   project?: string|null,
 *   interval?: number, enabled?: boolean,
 *   _setTimeout?: Function, _clearTimeout?: Function, _now?: () => Date,
 *   onTick?: (state: object) => void,
 *   fetchRemotes?: () => Promise<void>,  // throws an Error whose message is the one-line cause
 *   initialError?: string|null,
 * }} opts
 */
export function createPoller({
  vcs,
  closedVcs = null,
  cache,
  project = null,
  interval = 60000,
  enabled = true,
  _setTimeout = setTimeout,
  _clearTimeout = clearTimeout,
  _now = () => new Date(),
  onTick = () => {},
  fetchRemotes = null,
  initialError = null,
} = {}) {
  // `initialError` (#881, judgment:cold-6): the CALLER already knows, before
  // any tick, that `vcs` cannot be polled (forge resolution failed), so the
  // forge lane never runs and the reason is on `state()` immediately, the same
  // shape a real failed tick would leave.
  //
  // #1243 R1/R2: that halt is NOT a pause. `userPaused` is the operator's own
  // pause (`--no-poll`, the Pause button) and the only thing `paused` reports
  // and `resume()` lifts; `forgeHalted` is the forge being unusable, set once
  // at startup because only a restart can re-resolve the forge. The timer, and
  // with it the remotes lane, stops only for `userPaused`: a forge-less server
  // still fetches on its timer; its forge lane just never runs (#1201 W3/D40).
  let userPaused = !enabled;
  const forgeHalted = Boolean(initialError);
  const forgeHaltReason = initialError;
  let timer = null;
  let inFlight = null;
  let lastOnceAt = -Infinity;
  const bodyCached = new Set(); // open numbers whose null body was already read through `issueView`
  let reviewOffset = 0;

  let lastPolledAt = initialError ? _now().toISOString() : null;
  let lastOkAt = null;
  let lastError = initialError;
  let forgeAsOf = { issues: null, bodies: null, reviews: null };
  // #1257 D64: the open lane's load state. `completeAt` is the last successful landing.
  let openLoad = { state: 'pending', at: null };
  let openCompleteAt = null;
  // The closed lane (D56). `closedHeld` is the merged set by number; a delta only ever
  // upserts, so it is `complete` only once a FULL list has landed in this process.
  let closedLoad = { state: 'pending', at: null };
  let closedCompleteAt = null;
  let closedFlight = null;
  let closedHeld = null; // Map<number, row> | null — null until a full list lands
  let closedRunNumber = 0;
  let closedAnchorMs = null; // start of the last SUCCESSFUL closed run
  let fullOverdue = false; // a scheduled periodic full failed: the next run is full again
  let lastOpenNumbers = new Set();
  // #998 R998-6: the status bar's countdown. Armed by `scheduleNext()` from
  // the SAME injected `_now()` this whole module already uses, never the
  // wall clock (D9: no clock in `lib/`, the caller passes it). A manual
  // `once()` clears any pending timer first, then re-arms the countdown
  // anyway: `runTick()`'s own `.finally()` calls `scheduleNext()` on every
  // completed tick, scheduled or manual alike — cold review of #1008/PR6
  // measured this after an earlier revision of this comment claimed the
  // opposite.
  let nextAttemptAt = null;

  // #1201 D30/D40: fetch state lives HERE, never in the snapshot — it reaches the
  // page through `meta.poller.remotes`, so the section changes only when refs do.
  let remotes = { lastAttemptAt: null, lastOkAt: null, lastError: null, inFlight: false };
  let remotesFlight = null;
  let lastRefreshAt = -Infinity;

  /** One lane entry in the spec's shapes. A halted forge fails both lanes with no data; a pause before any landing says so. */
  function forgeLoad() {
    if (forgeHalted) {
      const halted = { state: 'failed', at: lastPolledAt, reason: forgeHaltReason, lastCompleteAt: null };
      return { open: { ...halted }, closed: { ...halted } };
    }
    const paused = (entry, flying) => (entry.state === 'pending' && userPaused && !flying ? { ...entry, reason: 'polling is paused' } : { ...entry });
    const closedEntry = closedVcs === null
      ? { state: 'disabled', at: null, reason: 'no closed-issue lane is configured' }
      : paused(closedLoad, closedFlight !== null);
    return { open: paused(openLoad, tickRunning), closed: closedEntry };
  }

  function state() {
    return { paused: userPaused, forgeHalted, forgeHaltReason, remotesLane: fetchRemotes !== null, lastPolledAt, lastOkAt, lastError, forgeAsOf: { ...forgeAsOf }, forgeLoad: forgeLoad(), intervalMs: interval, nextAttemptAt, remotes: { ...remotes } };
  }

  /** One fetch at a time: a caller that arrives while one runs joins it. Absent `fetchRemotes` is a no-op. */
  function runRemotes() {
    if (!fetchRemotes) return Promise.resolve();
    if (remotesFlight) return remotesFlight;
    const attemptAt = _now().toISOString();
    remotes = { ...remotes, lastAttemptAt: attemptAt, inFlight: true };
    remotesFlight = (async () => {
      try {
        await fetchRemotes();
        remotes = { ...remotes, lastOkAt: attemptAt, lastError: null };
      } catch (err) {
        remotes = { ...remotes, lastError: err?.message ?? String(err) };
      } finally {
        remotes = { ...remotes, inFlight: false };
        remotesFlight = null;
      }
    })();
    return remotesFlight;
  }

  function pickReviewTargets(prNumbers) {
    if (prNumbers.length <= REVIEW_CAP) return prNumbers;
    const picked = [];
    for (let i = 0; i < REVIEW_CAP; i++) picked.push(prNumbers[(reviewOffset + i) % prNumbers.length]);
    reviewOffset = (reviewOffset + REVIEW_CAP) % prNumbers.length;
    return picked;
  }

  /** The null-body fallback: rows with no string body, not yet read, ascending, capped (R1257-11). */
  function pickBodyTargets(issueRows) {
    const byNumber = new Map(issueRows.map((r) => [r.number, r]));
    for (const n of bodyCached) {
      const row = byNumber.get(n);
      if (row === undefined || typeof row.body === 'string') bodyCached.delete(n); // gone, or the list carries it now
    }
    return issueRows
      .filter((r) => typeof r.body !== 'string' && !bodyCached.has(r.number))
      .map((r) => r.number)
      .sort((a, b) => a - b)
      .slice(0, BODY_CAP);
  }

  /** The merged closed set, descending by number, minus anything the latest open list holds (a reopened issue). */
  function publishClosed() {
    if (closedHeld === null) return;
    for (const n of lastOpenNumbers) closedHeld.delete(n);
    cache.setIssueList([...closedHeld.values()].sort((a, b) => b.number - a.number), 'closed');
  }

  /** One closed run: full first and every CLOSED_FULL_EVERY_RUNS-th, a delta otherwise. Never rejects. */
  function runClosed() {
    if (!closedVcs || forgeHalted) return Promise.resolve();
    if (closedFlight) return closedFlight;
    closedRunNumber += 1;
    const startAt = _now();
    const periodic = closedRunNumber % CLOSED_FULL_EVERY_RUNS === 0;
    const full = closedHeld === null || periodic || fullOverdue;
    const args = { project, state: 'closed' };
    if (!full) args.updatedSince = new Date(closedAnchorMs - CLOSED_SINCE_OVERLAP_MS).toISOString();
    closedFlight = (async () => {
      try {
        const list = await closedVcs.issueList(args);
        if (closed) return;
        if (full) closedHeld = new Map(list.map((r) => [r.number, r]));
        else for (const r of list) closedHeld.set(r.number, r);
        fullOverdue = false;
        closedAnchorMs = startAt.getTime();
        closedCompleteAt = startAt.toISOString();
        closedLoad = { state: 'complete', at: closedCompleteAt };
        publishClosed();
      } catch (err) {
        if (full && closedHeld !== null) fullOverdue = true;
        closedLoad = { state: 'failed', at: startAt.toISOString(), reason: err?.message ?? String(err), lastCompleteAt: closedCompleteAt };
      } finally {
        closedFlight = null;
      }
    })();
    return closedFlight;
  }

  async function forgeLane() {
    const attemptAt = _now();
    try {
      const [issueRows, mrRows] = await Promise.all([
        vcs.issueList({ project, state: 'open' }),
        vcs.mrList({ project, state: 'open' }),
      ]);
      cache.setIssueList(issueRows);
      cache.setMrList(mrRows);
      forgeAsOf = { ...forgeAsOf, issues: attemptAt.toISOString() };
      const firstLanding = openCompleteAt === null;
      openCompleteAt = attemptAt.toISOString();
      openLoad = { state: 'complete', at: openCompleteAt };
      lastOpenNumbers = new Set(issueRows.map((r) => r.number));
      publishClosed(); // an issue reopened since the last closed read leaves the closed set at once
      // D66: the graph does not wait for the reviews. Only the first landing recomputes early.
      if (firstLanding && !closed) onTick(state());

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
          bodyCached.add(number); // a failed fetch is not cached and is retried next tick
        } catch { /* previous value stays cached (R881-9) */ }
      }));
      if (bodyTargets.length > 0) forgeAsOf = { ...forgeAsOf, bodies: attemptAt.toISOString() };

      lastOkAt = attemptAt.toISOString();
      lastError = null;
    } catch (err) {
      // The fast lane itself failed: nothing this tick is trustworthy, so no
      // cache setter ran above and every previously-cached section is
      // untouched (R881-9).
      lastError = err?.message ?? String(err);
      openLoad = { state: 'failed', at: attemptAt.toISOString(), reason: lastError, lastCompleteAt: openCompleteAt };
    } finally {
      lastPolledAt = attemptAt.toISOString();
    }
  }

  // True from `runTick()` until its forge lane settles. The remotes lane's
  // completion hook reads it: a fetch that ends INSIDE the tick is covered by the
  // tick's own `onTick`; one that ends after it must notify on its own.
  let tickRunning = false;

  /**
   * The lanes are independent in time as well as in failure (D40). Only the forge
   * lane is awaited: the fetch can take up to its 20 s timeout and must never hold
   * back the reschedule. It runs fire-and-forget under its own single flight, and
   * `runRemotes()` never rejects, so no promise is left unhandled.
   */
  async function tick() {
    if (fetchRemotes && !remotesFlight) {
      runRemotes().then(() => { if (!tickRunning && !closed) onTick(state()); });
    } else {
      runRemotes(); // joins the flight in progress (or is the no-op); starts nothing
    }
    // D56: the closed lane has its own single flight. A tick starts it and never awaits it.
    if (closedVcs && !closedFlight && !forgeHalted) {
      runClosed().then(() => { if (!tickRunning && !closed) onTick(state()); });
    }
    if (!forgeHalted) await forgeLane();
  }

  let closed = false;

  // #1243 D44: the ONLY writer of a live handle. Clearing before setting makes
  // "at most one armed handle" a property of this function, whatever order
  // start/pause/resume/once and an in-flight tick's re-arm happen in.
  function disarm() { if (timer !== null) { _clearTimeout(timer); timer = null; } }
  function arm(fn, ms) {
    disarm();
    if (closed) return false;
    timer = _setTimeout(() => { timer = null; return fn(); }, ms);
    return true;
  }

  /** The timer runs unless the USER paused; a halted forge alone keeps it only when there is a remotes lane to feed. */
  function tickWanted() { return !userPaused && (!forgeHalted || fetchRemotes !== null); }

  function scheduleNext() {
    // `closed` matters here, not just in `close()` itself: a tick already
    // in flight when `close()` runs keeps resolving in the background, and
    // its own `.finally()` calls `scheduleNext()` — without this guard that
    // would arm a brand-new real timer AFTER the server believes it has shut
    // down, leaking a handle that keeps the process alive (measured: a
    // `node --test` run that passes every assertion but never exits).
    if (closed || !tickWanted() || interval <= 0) { nextAttemptAt = null; return; }
    if (arm(runTick, interval)) nextAttemptAt = new Date(_now().getTime() + interval).toISOString();
  }

  function runTick() {
    tickRunning = true;
    inFlight = tick().finally(() => {
      tickRunning = false;
      inFlight = null;
      onTick(state());
      scheduleNext();
    });
    return inFlight;
  }

  return {
    start() { return tickWanted() ? runTick() : undefined; },
    // The countdown goes with the timer, as it does in `pause()`: after
    // `close()` no tick will ever fire, so a surviving `nextAttemptAt` would
    // report a poll that is never coming (#1015 cold review).
    close() { closed = true; disarm(); nextAttemptAt = null; },
    pause() {
      userPaused = true;
      disarm();
      nextAttemptAt = null;
      return state();
    },
    resume() {
      // Resuming re-arms the regular interval; it does not itself poll —
      // that is what `once()` ("poll now") is for (R881-4 S2 treats the two
      // as distinct controls). `start()` polls immediately because a
      // process that has NEVER polled needs data as soon as possible; a
      // paused-then-resumed poller already has whatever it last held.
      if (userPaused) { userPaused = false; scheduleNext(); }
      return state();
    },
    async once() {
      if (inFlight) return inFlight.then(state);
      const nowMs = _now().getTime();
      if (nowMs - lastOnceAt < ONCE_COLLAPSE_MS) return state();
      lastOnceAt = nowMs;
      disarm();
      await runTick();
      return state();
    },
    /** The explicit fetch (POST /api/remotes/refresh): allowed while paused, collapsed like `once`, single flight. */
    async refreshRemotes() {
      if (remotesFlight) { await remotesFlight; return state(); }
      const nowMs = _now().getTime();
      if (nowMs - lastRefreshAt < ONCE_COLLAPSE_MS) return state();
      lastRefreshAt = nowMs;
      await runRemotes();
      onTick(state());
      return state();
    },
    state,
  };
}
