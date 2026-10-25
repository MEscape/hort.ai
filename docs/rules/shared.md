# Shared Code Rules

- Put shared code outside modules: src/lib for infrastructure/utilities, src/components for UI, src/hooks for client hooks, and src/i18n for locale plumbing.
- Shared code must be generic, have no business owner, and name no domain concept. See [architecture.md](architecture.md).
- Shared code must not import business modules. See [boundaries.md](boundaries.md).
- Extract code only when a second module needs the same concept, not merely because two implementations look alike.
- Use src/components/ui for design-system primitives, src/components/layout for layout primitives, and src/components/shared for composites such as form fields and route error/not-found panels.
- Compose shared primitives in modules; do not restyle or reimplement them. See [styling.md](styling.md).
- Implement cross-module mechanisms once in src/lib (audit logging, persistence failure mapping, action input parsing). Keep module-specific vocabulary local.
- Define universally shared ports (Clock, RateLimiter, ObjectStore, SpeechProvider) in src/lib and import them as types. Composition roots wire implementations.
- Remove shared code when its last consumer disappears.
- Reuse existing @lib/utils and @lib/pagination helpers instead of reimplementing them. Lint detects duplicate helpers, including:
  - Millisecond constants: MS_PER_MINUTE, MS_PER_DAY.
  - isDefined, unique, clamp, isBlank, trimToNull, removeAt, replaceAt, pick, omit, buildQueryString.
  - offsetOf and pageCountOf.
- Check src/lib/README.md and src/components/README.md before adding shared code; update them in the same change.
