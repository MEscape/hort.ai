// The architecture tooling is plain ESM JavaScript (ESLint must load it without a build step).
// Tests import it untyped; the rule/policy behavior is what they verify.
declare module '*.mjs';
