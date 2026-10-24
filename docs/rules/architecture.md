# Architecture Rules

- Organize business capabilities into modules. See [modules.md](modules.md).
- Direct dependencies inward toward domain and application abstractions. See [boundaries.md](boundaries.md).
- Keep business logic out of framework entry points and framework-specific code at outer boundaries.
- Prefer dependency inversion over direct infrastructure dependencies.
- Inject clocks, randomness, and environment access through ports; domain and application code must not access them directly.
- Keep shared code genuinely generic. Do not extract module code prematurely. See [shared.md](shared.md).
- Wire cross-module runtime dependencies only through the owning module's composition.ts and permitted infrastructure adapters. See [boundaries.md](boundaries.md).
- Keep the module dependency graph acyclic.
- Enforce architectural boundaries in lint/build checks.
- Record deviations in a short decision note and update the owning rule.
