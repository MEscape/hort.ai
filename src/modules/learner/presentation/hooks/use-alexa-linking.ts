'use client';

/** Where the parent's Alexa account stands. Only `unavailable` exists until linking is built. */
export type AlexaLinkStatus = 'unavailable' | 'not_linked' | 'linked';

export interface AlexaLinking {
  readonly status: AlexaLinkStatus;
  /** Starts the account linking. Does nothing while the status is `unavailable`. */
  readonly connect: () => void;
  /** Removes the link. Does nothing while the status is `unavailable`. */
  readonly disconnect: () => void;
}

/**
 * PLACEHOLDER for the Alexa account linking. There is no linking yet: the `alexa` module is a
 * signed connection-test endpoint without any link between an Alexa account and a parent or child,
 * and its README says such a coupling needs its own privacy review. So this hook always says
 * `unavailable`, `AlexaStep` shows an honest "not available yet", and nothing is stored or faked.
 *
 * To build the real thing, replace the body of this hook and leave `AlexaStep` as it is, it already
 * draws the three states:
 * 1. `status`: read the link state of the signed-in parent from a query of the (future) linking
 *    use case, `not_linked` or `linked`.
 * 2. `connect`: call a Server Action that starts the account linking and returns where to go
 *    (the Amazon authorization address), then navigate there.
 * 3. `disconnect`: call a Server Action that removes the link; show the answer, never assume it.
 * See `docs/architecture/learner.md` ("Alexa step") for the checklist.
 */
export function useAlexaLinking(): AlexaLinking {
  return {
    status: 'unavailable',
    connect: () => undefined,
    disconnect: () => undefined,
  };
}
