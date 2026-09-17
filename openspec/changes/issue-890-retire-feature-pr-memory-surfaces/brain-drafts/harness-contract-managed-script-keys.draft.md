# Draft: harness and managed-script doctrine after issue #890

**Targets**: `brain/core/methodology/harness-contract.md`, `brain/core/managed-paths.mjs`  
**Issue**: #890  
**Promotion**: Tier-2 maintainer review is required; agents do not edit `brain/core/**`.

## Proposed amendment

Remove `brain:save` from the harness's golden-path command inventory and from
`MANAGED_SCRIPT_KEYS`; remove its implementation and package alias in the implementation
change. The supported capture surface is `brain:memory:save --issue N`; `brain:memory:share`
remains a backend materialization verb where the contract still documents it. The managed-key
list must continue to contain only real `brain:`-namespaced package scripts, and the doctrine
must not imply that feature pushes carry memory records. Promotion should update any generated
`AGENTS.md` output through the normal canonical promotion path.
