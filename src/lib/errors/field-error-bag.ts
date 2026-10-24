import type { ValidationAppError } from './app-error';

/**
 * Collects every field problem in one pass so the caller gets all of them
 * at once instead of fixing one field per round trip. Local to a single
 * validation call; never shared.
 *
 * `path` is a dotted field path (`colors.primary`), `code` a stable error
 * code. The owning module supplies the factory, so the error carries that
 * module's own `code` and `message`.
 */
export class FieldErrorBag {
  // A `Map`: a path may be named after a prototype member (`constructor`) when it comes from data.
  private readonly errors = new Map<string, string[]>();

  constructor(
    private readonly fail: (fieldErrors: Record<string, string[]>) => ValidationAppError,
  ) {}

  add(path: string, code: string): void {
    this.errors.set(path, [...(this.errors.get(path) ?? []), code]);
  }

  /** Records `code` at `path` unless `isOk`; returns `isOk`, so several checks can run without short-circuiting. */
  expect(isOk: boolean, path: string, code: string): boolean {
    if (!isOk) {
      this.add(path, code);
    }
    return isOk;
  }

  get hasErrors(): boolean {
    return this.errors.size > 0;
  }

  toError(): ValidationAppError {
    // Copy the arrays too, so the returned error cannot alias the bag.
    return this.fail(
      Object.fromEntries([...this.errors].map(([path, codes]) => [path, [...codes]])),
    );
  }
}
