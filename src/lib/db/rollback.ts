/**
 * Why a transaction was ended on purpose. It carries the refusal the caller answers with, so a write
 * that finds out half way that it must not go on can undo what it already wrote and still return an
 * ordinary value instead of an exception.
 */
class Rollback<R> extends Error {
  constructor(readonly refusal: R) {
    super('The transaction was rolled back on purpose.');
  }
}

/**
 * Ends the transaction it is called in and undoes its writes: the database client rolls a
 * transaction back when its body throws. The refusal comes back from `rollbackable`, never as an
 * exception. Use it only for a refusal discovered after something was written; a refusal that can be
 * known before the first write is a plain return.
 */
export function rollbackWith(refusal: unknown): never {
  throw new Rollback(refusal);
}

/** How a transaction that may roll back ended. */
export type Rollbackable<T, R> =
  | { readonly kind: 'done'; readonly value: T }
  | { readonly kind: 'rolled-back'; readonly refusal: R };

/**
 * Runs a transaction (or anything that opens one) and turns a `rollbackWith` inside it into
 * `rolled-back` with its refusal. Every other failure, a driver error included, passes through
 * unchanged.
 */
export async function rollbackable<T, R>(run: () => Promise<T>): Promise<Rollbackable<T, R>> {
  try {
    return { kind: 'done', value: await run() };
  } catch (thrown) {
    if (thrown instanceof Rollback) {
      // The class is private, so only `rollbackWith` makes one and its refusal is what was passed in.
      return { kind: 'rolled-back', refusal: thrown.refusal as R };
    }
    throw thrown;
  }
}
