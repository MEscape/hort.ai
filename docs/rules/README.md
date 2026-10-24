# Project Rules

This directory contains the canonical engineering rules. Each file owns one concern. Avoid duplication; reference the owning rule.

## Authority and product requirements

- Product requirements are defined in `docs/product/vision.md`; concept proposals in `docs/product/flows.md` are not binding architecture.
- Engineering rules govern how agreed product requirements are implemented. If a task or document contradicts either source, surface the conflict instead of treating an example, mockup or gallery as a new requirement.
- The split rule files in `docs/rules/` are the canonical engineering sources and take precedence over `AI_RULES.md` if they differ.
- Within the engineering rules, apply the rule for the more specific responsibility. Rules take precedence over conventions; architectural boundaries remain mandatory. Record an approved deviation as a short decision note and update the owning rule and consolidated copy together.

## Rule hierarchy

```mermaid
graph TD
  ARCH["architecture.md"]
  ARCH --> STRUCT["Structure"]
  ARCH --> FW["Framework"]
  ARCH --> APPD["Application"]
  ARCH --> PRES["Presentation"]
  ARCH --> CROSS["Cross-cutting"]
  ARCH --> CODE["Code"]
  STRUCT --> BOUND["boundaries.md"]
  STRUCT --> MOD["modules.md"]
  STRUCT --> DEP["dependencies.md"]
  STRUCT --> SHARED["shared.md"]
  FW --> NEXT["nextjs.md"]
  FW --> REACT["react.md"]
  FW --> API["api.md"]
  FW --> CACHE["caching.md"]
  APPD --> VALID["validation.md"]
  APPD --> ERR["errors.md"]
  APPD --> PERSIST["persistence.md"]
  PRES --> STY["styling.md"]
  PRES --> I18N["i18n.md"]
  PRES --> A11Y["accessibility.md"]
  CROSS --> SEC["security.md"]
  CROSS --> CONF["configuration.md"]
  CROSS --> OBS["observability.md"]
  CROSS --> PERF["performance.md"]
  CROSS --> TEST["testing.md"]
  CODE --> TS["typescript.md"]
  CODE --> NAME["naming.md"]
  CODE --> STYLE["code-style.md"]
  CODE --> COM["comments.md"]

```
