# Dependency Boundary Rules

- Domain imports only domain code.
- Application may import domain, but not React, Next.js, infrastructure implementations, or presentation.
- Infrastructure may depend on domain and application contracts.
- Presentation may depend on application contracts and presentation types, never infrastructure.
- Shared UI must not import business modules.
- Modules must not import another module's infrastructure or internal implementation.
- Framework entry points may import application and presentation APIs.
- Access other modules only through their public API: index.ts on the server, client.ts in browser code. Deep imports are forbidden. See [modules.md](modules.md).
- Runtime calls into another module are allowed only through composition.ts or infrastructure adapters implementing the current module's domain ports.
- Domain and application may import types from another module's public API. Cross-module runtime calls are otherwise limited to pure functions listed in CROSS_MODULE_RUNTIME_ALLOW.
- Presentation may import another module's browser-safe client.ts API (routes, vocabulary, Server Actions) and types. composition.ts supplies server-side parts such as queries and Server Components.
- Repositories and record mappers may import only trusted cross-module brand constructors (to<Name>Id).
- Any layer may import shared ports (Clock, RateLimiter, ObjectStore) as types. Composition roots wire their implementations.
- src/app is the application composition boundary and may import any module's public API.
- Enforce dependency direction with lint.
