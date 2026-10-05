# Design (#1325)

- FROM's `brain/scripts` is copied to `/tmp/from-scripts` after init; after upgrade, files differing FROM-pkg vs TO-pkg are compared (`cmp`) against the consumer's copy. Proof of reality: with `brain:upgrade` replaced by a bare `npm i` of TO, 39+ files report stale and the run fails.
- Registry check: `npm view` stderr matched for `E404` to distinguish not-found from network errors (limit: depends on npm's message text).
- `set -u -o pipefail`; `${PIPESTATUS[0]}` for `brain:upgrade | tail -3`.
