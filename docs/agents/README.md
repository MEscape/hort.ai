# Engineering Agent System

A specialized multi-agent system for validating software features throughout the development lifecycle.

The system uses dedicated agents for requirements validation, design, architecture, security, adversarial analysis, testing, and production readiness. Each agent has a clearly defined responsibility, scope, and review methodology.

The objective is to provide a consistent, evidence-based process for determining whether a feature is:

- Complete
- Correct
- Tested
- Secure
- Usable and accessible
- Architecturally sound
- Maintainable
- Ready for production

The system prioritizes meaningful verification over superficial checklists, test counts, and the number of findings produced.

---

## Table of Contents

- [Overview](#overview)
- [Agents](#agents)
  - [Goal Checker Agent](#goal-checker-agent)
  - [Designer Agent](#designer-agent)
  - [Architecture Agent](#architecture-agent)
  - [Security Agent](#security-agent)
  - [Bug Bounty Agent](#bug-bounty-agent)
  - [Test / Regression Agent](#test--regression-agent)
  - [Production Blocker Agent](#production-blocker-agent)
- [Agent Responsibility Matrix](#agent-responsibility-matrix)
- [Agent Lifecycle](#agent-lifecycle)
- [Execution Matrix](#execution-matrix)
- [Finding Classification](#finding-classification)
- [Agent Output Contract](#agent-output-contract)
- [Blocking Model](#blocking-model)
- [Repository Structure](#repository-structure)
- [Development Principles](#development-principles)
- [Target Outcome](#target-outcome)

---

# Overview

A single general-purpose review agent can mix unrelated concerns, overlook specialized risks, and produce inconsistent findings.

This system separates engineering review into specialized agents. Each agent answers a distinct question and provides evidence within its area of responsibility.

| Agent | Primary Question |
|---|---|
| Goal Checker | Did we implement everything that was requested? |
| Designer | Is the user experience correct, consistent, accessible, and usable? |
| Architecture | Does the implementation fit the system's architecture and maintainability requirements? |
| Security | Can the implementation be exploited through technical vulnerabilities? |
| Bug Bounty | How could an authorized external researcher abuse or break the feature? |
| Test / Regression | Do the tests provide convincing evidence of correctness and protection against regressions? |
| Production Blocker | Is there any known issue that should prevent production deployment? |

The agents complement one another rather than duplicate each other's work.

## Core operating model

Every review should distinguish between:

- **Verified:** Supported by inspected code, test results, configuration, or other direct evidence.
- **Inferred:** A conclusion supported by available evidence but not directly verified.
- **Unverified:** Behavior or assumptions that could not be adequately checked.
- **Finding:** A substantiated defect or risk requiring attention.
- **Recommendation:** An improvement that may be useful without necessarily indicating a defect.

Agents must not invent repository facts, test results, requirements, or verification claims.

---

# Agents

## Goal Checker Agent

**Specification:** [`docs/agents/goal-checker-agent.md`](docs/agents/goal-checker-agent.md)

### Purpose

Validates that the implementation satisfies the original feature requirements and acceptance criteria.

### Responsibilities

- Identify requirements and acceptance criteria.
- Map requirements to implementation evidence.
- Detect missing or partially implemented functionality.
- Validate expected workflows and important edge cases.
- Check required error, loading, empty, and success states.
- Identify scope gaps and unmet requirements.
- Distinguish implemented behavior from verified behavior.
- Identify requirements that lack sufficient verification.

### Primary question

> Did we build everything that was requested?

### Typical use

Run for every feature or significant change where completion must be verified against a defined specification.

---

## Designer Agent

**Specification:** [`docs/agents/designer-agent.md`](docs/agents/designer-agent.md)

### Purpose

Evaluates the user-facing experience against product requirements, design specifications, and usability expectations.

### Responsibilities

- Layout, spacing, typography, and visual hierarchy.
- Design-system compliance and component consistency.
- Responsive behavior across supported screen sizes.
- Accessibility and keyboard interaction.
- Loading, empty, error, and success states.
- Hover, focus, active, and disabled states.
- Forms, validation feedback, and interaction flows.
- Navigation, copy, and microcopy.
- Unnecessary visual or interaction complexity.
- Compliance with supplied design specifications.

### Primary question

> Is the feature clear, consistent, accessible, and usable from the user's perspective?

### Typical use

Run for user-facing changes, frontend features, workflows, and changes that affect visual or interaction design.

---

## Architecture Agent

**Specification:** [`docs/agents/architecture-agent.md`](docs/agents/architecture-agent.md)

### Purpose

Evaluates whether the implementation follows the project's architectural principles and preserves long-term codebase quality.

### Responsibilities

- Layer violations and dependency direction.
- Circular dependencies and module boundaries.
- Coupling, cohesion, and responsibility boundaries.
- Abstraction quality and excessive complexity.
- God classes, oversized functions, and duplicated business logic.
- Incorrect ownership of functionality.
- Business logic placed in inappropriate layers.
- Violations of established architectural conventions.
- Scalability, maintainability, and technical debt.

### Primary question

> Does this implementation fit the architecture of the system?

### Typical use

Run for major features, backend changes, new modules, shared components, architectural changes, and refactors.

---

## Security Agent

**Specification:** [`docs/agents/security-agent.md`](docs/agents/security-agent.md)

### Purpose

Performs a security-focused analysis of the implementation, configuration, data flows, and access-control model.

### Responsibilities

- Authentication and authorization.
- Access control and IDOR/BOLA vulnerabilities.
- Input validation and injection vulnerabilities.
- Cross-site scripting (XSS) and cross-site request forgery (CSRF).
- Server-side request forgery (SSRF).
- Session management and token handling.
- Secrets and sensitive-data exposure.
- Rate limiting and resource protection.
- File handling and tenant isolation.
- Security configuration and dependency vulnerabilities.
- Trust-boundary violations.

### Primary question

> Can the implementation be exploited through a technical security vulnerability?

### Typical use

Run for security-sensitive features, externally accessible functionality, authentication and authorization changes, data handling, APIs, and before production deployment.

---

## Bug Bounty Agent

**Specification:** [`docs/agents/bug-bounty-agent.md`](docs/agents/bug-bounty-agent.md)

### Purpose

Performs adversarial analysis from the perspective of an authorized external security researcher.

The Bug Bounty Agent focuses on attack paths, abuse cases, and business-logic vulnerabilities that may be overlooked during conventional implementation review.

### Responsibilities

- Business-logic abuse and workflow bypasses.
- Privilege escalation and account takeover paths.
- Enumeration and unexpected API parameters.
- Race conditions and resource exhaustion.
- Quota, limit, and state manipulation.
- Trust-boundary violations.
- Chained and feature-interaction vulnerabilities.
- Abuse of legitimate application functionality.

### Primary question

> How could an authorized external researcher break or abuse this feature?

### Typical use

Run before production for security-sensitive, externally exposed, financially relevant, or high-impact functionality.

Testing must be limited to systems and environments where the operator has authorization.

---

## Test / Regression Agent

**Specification:** [`docs/agents/test-agent.md`](docs/agents/test-agent.md)

### Purpose

Evaluates whether the implementation has sufficient, meaningful, and maintainable tests to provide credible confidence in correctness and protect existing behavior against regressions.

The agent does not judge quality by test count or line coverage alone. It examines whether tests verify the intended behavior and would detect consequential failures.

### Responsibilities

- Map requirements and changed behavior to verification evidence.
- Evaluate unit, integration, and end-to-end test coverage.
- Identify meaningful behavioral and regression gaps.
- Review assertions and determine whether tests can pass while behavior is broken.
- Assess error paths, negative cases, boundaries, and business invariants.
- Evaluate state transitions, retries, idempotency, and concurrency where relevant.
- Analyze the regression impact of changes to shared code and interfaces.
- Review mocks and integration boundaries for false confidence.
- Identify substantiated issues with test isolation, determinism, and flakiness.
- Inspect test execution results when execution is available.
- Distinguish verified behavior from inferred or unverified behavior.
- Recommend the smallest effective set of tests needed to address consequential gaps.

### Primary question

> Do the tests provide convincing evidence that this implementation works correctly and that existing behavior has not been unintentionally broken?

### Typical use

Run for every feature, bug fix, refactor, and significant code change. Apply additional scrutiny to shared utilities, public interfaces, business logic, persistence, permissions, and critical workflows.

### Review standard

A test is valuable when it verifies meaningful behavior and would detect the relevant regression.

The agent must distinguish between:
- Adequate coverage.
- Non-blocking test improvements.
- Meaningful regression risk.
- A release-blocking confidence gap.

A missing test is not automatically a release blocker, and passing tests do not prove that every important behavior is correct.

---

## Production Blocker Agent

**Specification:** [`docs/agents/production-blocker-agent.md`](docs/agents/production-blocker-agent.md)

### Purpose

Acts as the final production-readiness gate.

The Production Blocker Agent consumes findings from other agents together with build, deployment, configuration, migration, and operational evidence.

It determines whether known issues and unresolved risks make production deployment unacceptable.

### Responsibilities

- Critical security and functional findings.
- Failed tests and build failures.
- Deployment and configuration failures.
- Database migration and data-loss risks.
- Breaking changes and backward compatibility.
- Severe performance and reliability issues.
- Rollback and recovery capability.
- Monitoring, logging, and observability.
- Operational failure modes and production environment risks.
- Unresolved findings from other agents.
- Verification gaps that materially affect release confidence.

### Primary question

> Is there anything that should prevent us from safely deploying this feature?

### Typical use

Run as the final gate before production deployment and after consequential fixes to previously identified release blockers.

### Decision principle

The Production Blocker Agent evaluates the actual risk and available evidence. It must not blindly convert every finding from another agent into a blocker, nor dismiss a serious issue simply because the other agents reported passing statuses.

---

# Agent Responsibility Matrix

The agents have separate primary responsibilities, with supporting roles where concerns overlap.

| Concern | Goal | Design | Architecture | Security | Bug Bounty | Test / Regression | Production |
|---|---|---|---|---|---|---|---|
| Requirements completeness | Primary | | | | | Supporting | Gate |
| Acceptance criteria | Primary | Supporting | | | | Supporting | Gate |
| UI/UX | | Primary | | | | Supporting | |
| Accessibility | | Primary | | | | Supporting | |
| Code structure | | | Primary | | | Supporting | |
| Complexity and maintainability | | | Primary | | | | Supporting |
| Authentication | | | | Primary | Supporting | Supporting | Gate |
| Authorization | | | | Primary | Primary | Supporting | Gate |
| Technical vulnerabilities | | | | Primary | Supporting | | Gate |
| Business-logic abuse | | | Supporting | Supporting | Primary | Supporting | Gate |
| Functional correctness | Supporting | Supporting | | | | Primary | Gate |
| Behavioral test quality | | | | | | Primary | Gate |
| Regression detection | Supporting | Supporting | Supporting | Supporting | Supporting | Primary | Gate |
| Integration verification | | | Supporting | Supporting | Supporting | Primary | Gate |
| Deployment readiness | | | | Supporting | | Supporting | Primary |
| Release-blocking decision | | | | | | | Primary |

**Primary** means the agent owns the analysis. **Supporting** means it may identify relevant concerns within its scope. **Gate** means its findings can inform the final deployment decision.

The Production Blocker Agent is the final decision layer, not a duplicate implementation reviewer.

---

# Agent Lifecycle

A typical feature passes through the following lifecycle:

```text
Feature Specification
        |
        v
   Goal Checker
        |
        v
   Implementation
        |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
     Designer           Architecture      Test / Regression
        |                   |                   |
        +-------------------+-------------------+
                            |
                            v
                  Security Review
                            |
                            v
                    Bug Bounty Review
                            |
                            v
                  Production Blocker
                            |
                  +---------+---------+
                  |                   |
                BLOCK                PASS
                  |                   |
              Fix Issues           Deploy
                  |
                  v
           Re-run Relevant Agents
```

The sequence is a default workflow, not an inflexible requirement. Agents may run in parallel when their inputs are available.

## Selective re-review

After a fix, rerun the agents whose areas of responsibility are affected.

Examples:

- A visual spacing fix may require Designer and Test / Regression reviews.
- A business-rule fix may require Goal Checker and Test / Regression reviews.
- An authorization fix should trigger Security, Bug Bounty where relevant, and Test / Regression reviews.
- A shared API or utility change may require Architecture and Test / Regression reviews, plus other agents based on its impact.
- A database migration change may require Architecture, Test / Regression, Security where relevant, and Production Blocker reviews.

The Production Blocker Agent should reassess any release decision affected by the fix.

---

# Execution Matrix

The execution strategy should reflect the type and risk of the change.

| Agent | Pull Request | Feature Completion | Pre-Release | Major Refactor | Security-Sensitive Change |
|---|---|---|---|---|---|
| Goal Checker | Recommended | Required | As needed | Recommended | Required |
| Designer | Conditional | Required for UI | As needed | Conditional | Conditional |
| Architecture | Conditional | Recommended | As needed | Required | Recommended |
| Security | Conditional | Recommended | Required | Conditional | Required |
| Bug Bounty | Not normally | Conditional | Required where relevant | Conditional | Required where relevant |
| Test / Regression | Required | Required | Required | Required | Required |
| Production Blocker | Not normally | Not normally | Required | Not normally | Required |

**Execution guidance:**

- Run Test / Regression for every meaningful code change.
- Run Designer when user-facing behavior or visual design changes.
- Run Architecture when structural decisions, shared abstractions, or dependencies change.
- Run Security for security-sensitive functionality and before production release.
- Run Bug Bounty when adversarial abuse analysis provides meaningful additional value.
- Run Production Blocker when making a release decision.

A conditional agent should be selected when the change's scope or risk makes its expertise relevant.

---

# Finding Classification

Every agent should use a consistent system for communicating severity.

| Severity | Meaning |
|---|---|
| BLOCKER | An issue that must be resolved before the relevant workflow or deployment can proceed. |
| CRITICAL | A severe issue with potentially major security, functional, data-integrity, or operational consequences. |
| HIGH | A significant issue that should normally be resolved before release. |
| MEDIUM | A meaningful issue that should be addressed but does not automatically block release. |
| LOW | A minor defect or improvement with limited impact. |
| INFO | An observation or recommendation without an established direct defect. |

Severity describes the impact of a finding. It does not independently determine whether deployment must be blocked.

The Production Blocker Agent makes that decision using:
- Actual and potential impact.
- Likelihood and exposure.
- Affected functionality and users.
- Available mitigations.
- Verification evidence.
- Remaining uncertainty.
- The release context.

Agents should not inflate severity because a test is missing, an architectural improvement is possible, or a theoretical failure can be imagined.

---

# Agent Output Contract

All agents should provide a consistent, evidence-based summary.

## Human-readable output

```text
Agent:
<agent name>

Status:
PASS | WARN | FAIL

Finding:
<description, if applicable>

Severity:
BLOCKER | CRITICAL | HIGH | MEDIUM | LOW | INFO

Evidence:
<relevant files, code, tests, requirements, or observed behavior>

Impact:
<why the finding matters>

Recommendation:
<recommended remediation or verification>

Confidence:
HIGH | MEDIUM | LOW

Verification Limitations:
<what could not be inspected, executed, or confirmed>
```

Fields should be populated according to relevance. If there are no findings, explicitly state that no material findings were identified within the scope reviewed.

## Machine-readable output

For automated orchestration, agents should additionally support a machine-readable representation.

Example:

```json
{
  "agent": "security",
  "status": "fail",
  "severity": "critical",
  "blocking": true,
  "finding": "Authorization bypass",
  "evidence": "The resource is accessed without verifying ownership.",
  "impact": "A user may access another user's protected resource.",
  "recommendation": "Enforce resource authorization before returning data.",
  "confidence": "high",
  "verification_limitations": []
}
```

### Output rules

- Use consistent field names and enum values.
- Use lowercase status and severity values in JSON.
- Set `blocking` based on the agent's authorized blocking criteria, not severity alone.
- Do not mark an unverified claim as confirmed.
- Include evidence references when available.
- Represent verification limitations explicitly.
- Do not fabricate test results, file paths, or evidence.
- Treat agent-specific verdicts as inputs to the shared status contract.

For example, the Test / Regression Agent's `NEEDS TESTS` verdict should normally map to `WARN` or `FAIL` according to the significance of the gap and the agent's blocking criteria. It should not automatically become a production blocker.

---

# Blocking Model

A finding and a production blocker are not necessarily the same thing.

| Example finding | Typical interpretation | Automatically blocks release? |
|---|---|---|
| Designer: inconsistent spacing | Minor UX inconsistency | No |
| Architecture: excessive coupling | Potential technical debt | No |
| Security: confirmed authorization bypass | Serious security vulnerability | Normally yes |
| Goal Checker: required critical functionality missing | Incomplete implementation | Depends on the requirement and release scope |
| Test / Regression: missing test for a critical business invariant | Potentially unacceptable verification gap | Depends on risk and available evidence |
| Test / Regression: missing test for a low-risk helper | Non-blocking test improvement | No |
| Production: failed deployment or unsafe migration | Operational release risk | Normally yes |

The final decision must account for the actual consequences of the issue, its exposure, the intended release scope, and available evidence.

This prevents the system from becoming overly conservative while preserving strong safeguards against serious release risks.

---

# Repository Structure

Agent specifications are maintained independently under `docs/agents/`.

```text
docs/
└── agents/
    ├── goal-checker-agent.md
    ├── designer-agent.md
    ├── architecture-agent.md
    ├── security-agent.md
    ├── bug-bounty-agent.md
    ├── test-agent.md
    ├── production-blocker-agent.md
    └── commit-agent.md
```

`commit-agent.md` describes the procedure for grouping changes into commits. It is an operational workflow, not one of the seven feature-review agents.

Each review-agent specification should define, where relevant:

1. Purpose and scope.
2. Responsibilities and non-responsibilities.
3. Inputs and prerequisites.
4. Execution conditions.
5. Analysis methodology.
6. Evidence requirements.
7. Finding and severity classification.
8. Output contract.
9. Blocking criteria.
10. Examples and failure handling.

The README provides the system-level overview. Individual specifications contain the detailed instructions required to execute each agent.

---

# Development Principles

## Single Responsibility

Each agent has one primary responsibility.

Agents may identify supporting concerns outside their primary domain, but should avoid duplicating another agent's analysis.

## Evidence-Based Findings

Findings should reference concrete evidence whenever possible, including:

- Files, functions, and components.
- Tests and execution results.
- Requirements and acceptance criteria.
- Configuration and architecture rules.
- Observed or reproducible behavior.

A finding should explain both what is wrong and why it matters.

## Behavioral Verification

Testing should protect meaningful behavior rather than optimize test counts or numerical coverage.

The Test / Regression Agent should identify what the current tests would fail to detect, evaluate the consequences, and recommend the smallest effective set of additional tests.

## No False Confidence

Agents must distinguish between:

- Verified behavior.
- Inferred behavior.
- Missing information.
- Unverified assumptions.

A passing test suite is evidence, not proof of correctness. An absence of observed defects is not proof that no defects exist.

## Proportionality

The depth of review should match the change's risk.

A small, isolated change should not automatically produce the same review burden as a change to authentication, persistence, shared interfaces, or critical business logic.

Recommendations and findings should be proportionate to their likely impact.

## Deterministic Output

Agent output should follow a predictable structure so that findings can be consumed by engineers, automation, CI/CD systems, or an orchestration agent.

## Separation of Concerns

```text
Goal Checker
    -> Requirements completeness

Designer
    -> User experience and usability

Architecture
    -> System structure and maintainability

Security
    -> Technical security vulnerabilities

Bug Bounty
    -> Adversarial analysis and abuse cases

Test / Regression
    -> Behavioral verification and regression protection

Production Blocker
    -> Release readiness and deployment decision
```

## Final Release Decision

The Production Blocker Agent consumes findings from the other agents and relevant operational evidence.

Its purpose is to determine whether the known state of the feature is acceptable for production deployment, not to reproduce every specialized review.

A release decision should reflect both identified issues and important verification gaps.

---

# Target Outcome

A completed feature review should provide a concise, evidence-based assessment across all relevant engineering dimensions.

Example:

```text
FEATURE REVIEW
==============

Goal Checker
  PASS
  Required functionality verified.

Designer
  PASS
  No material UX issues identified.

Architecture
  WARN
  One medium-priority maintainability concern.

Security
  PASS
  No material security findings identified
  within the scope reviewed.

Bug Bounty
  WARN
  Two low-risk abuse scenarios identified.

Test / Regression
  PASS
  Relevant tests inspected and executed.
  Important behavioral and regression risks
  have adequate verification.

Production Blocker
  PASS
  No unresolved production blockers identified.

--------------------------------
FINAL STATUS: READY FOR RELEASE
--------------------------------
```

This example is illustrative. Actual statuses must reflect the evidence collected, the scope reviewed, and any unresolved risks or limitations.

The objective is not to maximize the number of findings or to claim certainty that cannot be established.

The objective is to provide a reliable engineering process for answering:

> **Is this feature complete, correct, usable, secure, maintainable, adequately tested, and safe to release?**
