# Dependency Rules

- Use the project's existing package manager and commit its lockfile.
- Prefer existing dependencies and platform capabilities.
- Add a dependency only for a concrete project requirement; avoid duplicate libraries for the same purpose.
- Check maintenance status before adding dependencies.
- Put development-only packages in devDependencies.
- Follow the lockfile's versioning strategy; review upgrades deliberately.
- Remove unused dependencies.
- Audit dependencies for vulnerabilities in CI and act on high-severity findings.
- New dependencies must respect architectural boundaries. See [boundaries.md](boundaries.md).
