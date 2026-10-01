# Design (#1206)

New leaf `lib/ticket-type.mjs`: `requireTypeLabel({issue})` returns `{ok, label}` or `{ok:false, refusal:{key, params}}`, mirroring `ticket-base.mjs` (ticket-start has no test file; decisions live in leaves). `ticket-start.mjs` calls it right after the issue fetch and before `resolveBase`: nothing is created and no epic is read for an issue that will be refused.

The hint names label forms rather than a command: the VCS port has no label-add verb for an existing issue and `gh` is GitHub-only. `deriveBranchType`'s `feat` fallback is unchanged; `ship` still relies on it for the title prefix. Only its use as a silent default in `ticket:start` is now unreachable.
