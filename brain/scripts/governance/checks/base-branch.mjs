// base-branch.mjs — the `base-branch` gate's pure predicate (issue #967 PR C).
//
// A slice PR belongs on its epic's tracker while that epic is in flight
// (`brain:ticket:start` already enforces this at CREATION time — PR B,
// `lib/ticket-base.mjs`). This is the BACKSTOP: a PR that reached the forge
// with the wrong base anyway must be refused, not merely warned about — a
// warning is what let #953 land on `main` (design.md D9).
//
// PURE, no IO (`issue-link.mjs`'s shape): the caller reads the linked issue's
// and the parent's BODIES and hands them here as strings. The parent → epic →
// tracker grammar is read by `parseGraphBlock` — the SAME reader
// `status/epic-graph.mjs` and `lib/ticket-base.mjs` already use (#340: never a
// second implementation of "parent"/"tracker").
//
// FAIL-CLOSED ON AN UNREADABLE DECLARATION (R967-7 scenario 5, the deny-reader
// rule, #942): a graph block this module cannot parse — two declarations, an
// unterminated fence, the pre-#709 legacy shape — is `uncomputable`, never a
// silent pass. Only a declaration that reads cleanly and simply says nothing
// (no block, no parent, no tracker, a parent that never declared `kind: epic`
// — R967-9) is the standing "pass untouched" case.

import { parseGraphBlock } from '../../status/epic-graph.mjs';

const EPIC_KIND = 'epic';

/**
 * @param {{issueBody?: string|null, epicBody?: string|null, targetBranch: string,
 *          defaultBranch: string, headBranch?: string|null}} input
 * @returns {{pass: boolean, reason?: string, uncomputable?: boolean}}
 */
export function baseBranchRule({ issueBody, epicBody, targetBranch, defaultBranch, headBranch }) {
  // D10 step 3 — a tracker's OWN integration PR must target the default
  // branch. No issue lookup, no port call: this decides on branch names
  // alone. Same oracle as `stranded.mjs:19-28` — "a branch that is a
  // tracker" is a `feature/…` head, by construction of the grammar this
  // repo declares it with (#967 D2) — unchanged, not duplicated.
  if (typeof headBranch === 'string' && headBranch.startsWith('feature/')) {
    if (targetBranch === defaultBranch) return { pass: true };
    return {
      pass: false,
      reason:
        `base-branch: a tracker PR ("${headBranch}") must target the default branch ` +
        `("${defaultBranch}"), not "${targetBranch}" — a tracker integrates into the ` +
        `default branch, it does not stack onto another tracker`,
    };
  }

  // D10 step 4/6 — no linked issue at all is the memory-lane / no-epic
  // standing case (R967-7 S4): pass untouched.
  if (typeof issueBody !== 'string') return { pass: true };

  const issueBlock = parseGraphBlock(issueBody);
  if (issueBlock?.ok === false) {
    return {
      pass: false,
      uncomputable: true,
      reason: `base-branch: the linked issue's graph block cannot be read: ${issueBlock.error}`,
    };
  }

  // An epic's own work obeys no parent tracker (D10 step 6).
  if (issueBlock?.kind === EPIC_KIND) return { pass: true };

  const parent = issueBlock?.parent ?? null;
  if (parent === null) return { pass: true };

  // D10 step 7 — the parent's own declaration. An unreadable parent body is
  // the same fact as an unreachable epic (R967-7 S5): uncomputable, never a
  // silent pass.
  if (typeof epicBody !== 'string') {
    return {
      pass: false,
      uncomputable: true,
      reason: `base-branch: parent #${parent} could not be read — failing closed (uncomputable)`,
    };
  }

  const epicBlock = parseGraphBlock(epicBody);
  if (epicBlock?.ok === false) {
    return {
      pass: false,
      uncomputable: true,
      reason: `base-branch: parent #${parent}'s graph block cannot be read: ${epicBlock.error}`,
    };
  }

  // A `parent:` naming a node that never itself declared `kind: epic` is
  // never inferred to be one (R967-9, ruling 4 — `epic-graph.mjs`'s own
  // precedent): pass untouched.
  if (epicBlock?.kind !== EPIC_KIND) return { pass: true };

  // A malformed `tracker:` on the parent is carried by parseGraphBlock as a
  // said divergence, tracker already `null` — distinguish it from "no
  // tracker declared" so it FAILS, naming the epic and the bad value.
  const malformedTracker = epicBlock.declarationDivergences?.find(
    (d) => d.key === 'tracker' && d.reason === 'tracker-grammar',
  );
  if (malformedTracker) {
    return {
      pass: false,
      reason:
        `base-branch: parent #${parent}'s declared tracker is malformed ` +
        `("${malformedTracker.value}") — cannot resolve the required base`,
    };
  }

  const tracker = epicBlock.tracker;
  if (!tracker) return { pass: true }; // the epic declares no tracker — standing case

  if (targetBranch === tracker) return { pass: true };

  return {
    pass: false,
    reason:
      `base-branch: this PR's base ("${targetBranch}") must be its tracker ` +
      `("${tracker}", declared by parent #${parent}) while the epic is in flight`,
  };
}
