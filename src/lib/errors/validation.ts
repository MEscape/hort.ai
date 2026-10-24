/** Key in `ValidationAppError.fieldErrors` for problems that belong to no single field. */
export const ROOT_FIELD = '_form';

const FIELD_PATH_SEPARATOR = '.';

export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

type JoinPath<T extends ReadonlyArray<string | number>> = T extends readonly []
  ? ''
  : T extends readonly [infer F extends string | number]
    ? `${F}`
    : T extends readonly [
          infer F extends string | number,
          ...infer R extends ReadonlyArray<string | number>,
        ]
      ? `${F}.${JoinPath<R>}`
      : string;

/** Builds a dotted field path (`children.0.props`). The format react-hook-form's `setError` expects. */
export function fieldPath<T extends ReadonlyArray<string | number>>(...segments: T): JoinPath<T> {
  return segments.join(FIELD_PATH_SEPARATOR) as JoinPath<T>;
}
