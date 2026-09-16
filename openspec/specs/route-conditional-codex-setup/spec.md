# Route-Conditional Codex Setup Specification

## Purpose

Make Codex installation and readiness a conditional dependency of the effective `cold-review` route, while leaving consumers routed to Claude unchanged.

## Requirements

### Requirement: Resolve an explicit Codex route

The route configuration MUST support `cold-review` selecting `{ "engine": "codex", "model": "gpt-5.5" }`. The resolver MUST reject an incomplete or unsupported Codex route before execution and MUST preserve the existing Claude route semantics.

#### Scenario: Codex route is selected

- GIVEN a valid effective Codex route with model `gpt-5.5`
- WHEN setup and review are invoked
- THEN Codex readiness checks and the Codex transport are selected
- AND the route identity is available to diagnostics and tests

#### Scenario: Route is invalid or remains Claude

- GIVEN an unsupported Codex model, missing engine, or effective Claude route
- WHEN configuration is resolved
- THEN an unsupported Codex route fails before inference
- AND a Claude route does not require Codex

### Requirement: Install and probe only when routed

Installation, detection, authentication probes, sandbox probes, and readiness diagnostics for Codex MUST run only when the effective route selects Codex. A non-Codex consumer MUST neither download nor require Codex, Codex state, OpenAI authentication, or Linux sandbox support.

#### Scenario: Unrouted installation stays unchanged

- GIVEN an effective Claude (or other non-Codex) route and no Codex executable
- WHEN bootstrap or fresh-install setup runs
- THEN setup succeeds without installing or probing Codex
- AND diagnostics contain no Codex prerequisite failure

#### Scenario: Routed installation is ready

- GIVEN an effective Codex route and a supported CLI, writable state directory, authentication, model access, and sandbox
- WHEN setup runs
- THEN setup reports Codex ready and permits the review transport to run

### Requirement: Fail closed with actionable readiness diagnostics

For an effective Codex route, absent or old CLI, unwritable state, missing authentication, unavailable model or network, unsupported sandbox, timeout, or failed probe MUST stop the route before publication. Guidance MAY identify an operator action, but MUST NOT print credentials or claim readiness without a successful probe.

#### Scenario: Routed readiness fails

- GIVEN any Codex prerequisite is unavailable
- WHEN setup or preflight runs
- THEN it reports the specific bounded remediation and refuses review execution
- AND route-negative behavior remains unaffected

### Requirement: Prove both route branches

Automated setup coverage MUST include at least one route-positive case that reaches Codex readiness and one route-negative case proving Codex absence does not block an unrouted consumer.

#### Scenario: Fresh-install coverage runs

- GIVEN the positive and negative route fixtures
- WHEN the fresh-install/bootstrap test suite runs
- THEN both branches assert dependency and diagnostic behavior
