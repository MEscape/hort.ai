# Architecture notes

How the larger subsystems work, one document per subsystem. The rules in [`../rules/`](../rules/README.md) say what is allowed; these notes explain the decisions behind a subsystem so it can be changed safely.

The [product vision](../product/vision.md) defines the agreed behavior. The [concept overview](../product/flows.md) illustrates it separately from implementation notes; its proposed data and interaction models are not architecture decisions. The concrete AI processing chain remains undecided; help-session persistence is described in [`help-sessions.md`](help-sessions.md).

| Subsystem                                   | Document                                               |
| ------------------------------------------- | ------------------------------------------------------ |
| Rate limiting                               | [`rate-limiting.md`](rate-limiting.md)                 |
| Authentication and access control           | [`authentication.md`](authentication.md)               |
| Child profiles and onboarding               | [`learner.md`](learner.md)                             |
| Progress, XP and the daily reward           | [`progression.md`](progression.md)                     |
| Brand identity and assets                   | [`branding.md`](branding.md)                           |
| AI output contract                          | [`ai-output-contract.md`](ai-output-contract.md)       |
| Help session contract (learner UI)          | [`help-session-contract.md`](help-session-contract.md) |
| Help session storage                        | [`help-sessions.md`](help-sessions.md)                 |
| Topic classification of the child's message | [`topic-classification.md`](topic-classification.md)   |

The shared libraries are documented in [`src/lib/README.md`](../../src/lib/README.md). Add a document here when a subsystem spans several modules or parts of `src/lib`, and link it from the rule or convention that depends on it.
