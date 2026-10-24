declare const brand: unique symbol;

/**
 * A nominal type: `Brand<string, 'ProfileId'>` is a string the compiler will not mix up with
 * another kind of string. Zero runtime cost; the value is created only by a parser or factory that
 * checks it, never by a cast at a call site (typescript.md: branded identifiers).
 *
 * @example type ProfileId = Brand<string, 'ProfileId'>;
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };
