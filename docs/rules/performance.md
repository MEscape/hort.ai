# Performance Rules

- Measure before optimizing, except for the defaults below.
- Keep client bundles small: prefer Server Components and avoid heavy client-only libraries. See [react.md](react.md).
- Dynamically import large, rarely used client code.
- Use framework image and font primitives.
- Set explicit media dimensions to prevent layout shift.
- Stream independent slow UI with Suspense. See [nextjs.md](nextjs.md).
- Fetch independent data in parallel.
- Paginate or bound every list-returning query. See [persistence.md](persistence.md).
- Avoid unbounded in-memory processing of large datasets.
- Do not add dependencies merely to save a few lines when they increase bundle size. See [dependencies.md](dependencies.md).
