# Pre-proposal state

```yaml
schema: gentle-ai.sdd-preproposal/v1
revision: 4
change: issue-978-codex-cold-review
exploration:
  outcome: done
  reference: openspec/changes/issue-978-codex-cold-review/exploration.md
research:
  selected: true
  request: research_required
  classes:
    - documentation
    - open-web
  admission:
    schema: gentle-ai.sdd-research-capability/v1
    grants:
      documentation: granted
      open-web: granted
  outcome: done
  openspec_reference: openspec/changes/issue-978-codex-cold-review/research.md
  engram_reference: sdd/issue-978-codex-cold-review/research
product_decisions: confirmed
decisions:
  inference_model: gpt-5.5
  installation: conditional_install
artifact_store:
  mode: hybrid
  research_revision: 3
  openspec: ready
  engram: ready
proposal_ready: true
```

## Confirmed proposal handoff

- Research is selected and complete at revision 3.
- The maintainer selected `gpt-5.5` as the intended configured inference model.
- The maintainer selected conditional installation: Codex setup is activated only when an
  effective stage route selects `engine: "codex"`.
- The proposal must preserve the research constraints and avoid universal entitlement or
  cross-platform sandbox claims.
- Hybrid readiness was confirmed by reading both OpenSpec and Engram artifacts back with
  identical bytes for each artifact.

## Evidence references

- Exploration: `openspec/changes/issue-978-codex-cold-review/exploration.md`
- Research: `openspec/changes/issue-978-codex-cold-review/research.md`
- Engram research: `sdd/issue-978-codex-cold-review/research`
- Engram pre-proposal: `sdd/issue-978-codex-cold-review/preproposal`