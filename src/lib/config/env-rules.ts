/**
 * Rules that compare several variables, which a single variable's schema cannot state ("required
 * once auth is enabled", "https in production"). Every domain declares them the same way, as a
 * table of `EnvRule`s next to its schema, and attaches them with `refineEnv`; they run once the
 * variables are individually valid, so a rule can rely on typed values.
 *
 * Pure: no Node built-ins, no server dependency, like the schemas themselves.
 */
export interface EnvRule<Env> {
  /** The variable the problem is reported on. */
  readonly path: keyof Env & string;
  /**
   * True when the configuration breaks the rule. A rule that only applies in some mode
   * (`AUTH_ENABLED`, production) folds that condition in, so a mode that does not apply reports
   * nothing.
   */
  readonly violated: (env: Env) => boolean;
  /** What is wrong and what to do; never the offending value, which may be a secret. */
  readonly message: string | ((env: Env) => string);
}

export interface EnvIssue<Env> {
  readonly path: keyof Env & string;
  readonly message: string;
}

/** The problems `env` has under `rules`, in the order the rules are listed. */
export function envRuleIssues<Env>(
  env: Env,
  rules: ReadonlyArray<EnvRule<Env>>,
): Array<EnvIssue<Env>> {
  return rules
    .filter((rule) => rule.violated(env))
    .map(({ path, message }) => ({
      path,
      message: typeof message === 'function' ? message(env) : message,
    }));
}

/** The minimal part of Zod's refinement context this needs, so a schema's `superRefine` accepts it. */
interface IssueSink {
  addIssue(issue: { code: 'custom'; path: string[]; message: string }): void;
}

/** For `schema.superRefine(refineEnv(rules))`: reports every violated rule on its variable. */
export function refineEnv<Env>(...ruleSets: ReadonlyArray<ReadonlyArray<EnvRule<Env>>>) {
  return (env: Env, ctx: IssueSink): void => {
    for (const issue of ruleSets.flatMap((rules) => envRuleIssues(env, rules))) {
      ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
    }
  };
}
