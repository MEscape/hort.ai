# Code Style Rules

- Let the formatter own formatting; do not hand-format or debate style in review.
- Prefer small, single-purpose functions and early returns over deep nesting.
- Keep files under 300 code lines, excluding blank lines and comments; application files and component files must stay under 200.
- Split files by responsibility and name them accordingly. Keep cohesive structures, such as flat tables and state machines, together; wrap justified exceptions in:
  /* eslint-disable max-lines -- <why splitting would hurt> _/
  ...
  /_ eslint-enable max-lines */
- Any lint warning is an error. npm run lint must fail on warnings.
- Prefer const; never use var.
- Prefer immutable data and non-mutating operations.
- Replace magic numbers and strings with named constants. See [naming.md](naming.md).
- Prefer named exports; use default exports only when required by the framework.
- Do not use barrel files except for module public APIs. See [modules.md](modules.md).
- Prefer async/await over promise chains.
- Remove dead code, unused exports, and unused parameters.
- npm run dead-code fails on unreferenced exports, including exports unused outside their own file. Add /** @keep <reason> */ only for exports required through mechanisms the checker cannot detect, such as name-based lookup or framework conventions.
- Clean up exports used only by tests or their own file when touching those files; npm run dead-code -- --all lists them.
- Replace behavior-changing boolean parameters with separate functions or an options object.
- Use an options object for functions with more than three parameters.
- Let lint enforce import order and unused-import rules.
