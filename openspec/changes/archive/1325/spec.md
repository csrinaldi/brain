# Spec — delta (#1325)

- REQ-1: The workflow triggers on `push: main` and on PRs touching only `test/upgrade/**` or itself; its header states it tests published releases and not a PR's upgrader.
- REQ-2: If `npm view @logikas/brain@<v>` reports E404 for FROM or TO, in-container.sh prints `⚠ SKIP: ... not published yet` and exits 0. Any other `npm view` failure exits 2.
- REQ-3: After the upgrade, each `brain/scripts` file whose content differs between FROM's and TO's package equals TO's content in the consumer; otherwise the run fails. If none differ, `brain-upgrade.mjs` must equal TO's.
- REQ-4: A non-zero `brain:env:init` exits 2 and prints its log; a non-zero `brain:upgrade` marks the run failed.
