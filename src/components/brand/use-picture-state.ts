import { useCallback, useState } from 'react';

/** `pending` while the picture is still loading, `failed` if it could not be. */
export type PictureState = 'ready' | 'pending' | 'failed';

export interface PictureStateView {
  readonly state: PictureState;
  /** Callback ref for the `<img>`: watches it from the moment React attaches to the server-rendered one. */
  readonly attach: (picture: HTMLImageElement | null) => (() => void) | undefined;
  /** For `onError`. */
  readonly markFailed: () => void;
  readonly markReady: () => void;
}

/**
 * Whether one picture can be drawn yet. The server renders the pictures, so the browser fetches them
 * before React runs and React's `onLoad`/`onError` miss what already happened; `decode()` settles
 * for a loading, a finished and a broken picture alike. A picture still loading is `pending`, so
 * the closed picture is not swapped for an open one that is not there yet (a blank frame); a finished
 * one is decoded right away, in the background, so its first swap in is not slow either.
 */
export function usePictureState(url: string | undefined): PictureStateView {
  const [snapshot, setSnapshot] = useState<{ url: string | undefined; state: PictureState }>({
    url,
    state: url === undefined ? 'ready' : 'pending',
  });
  const setState = useCallback(
    (state: PictureState) => {
      setSnapshot({ url, state });
    },
    [url],
  );
  const attach = useCallback(
    (picture: HTMLImageElement | null) => {
      if (picture === null || url === undefined || !('decode' in picture)) {
        return undefined;
      }
      let isCurrent = true;
      const isFinished = picture.complete;
      if (!isFinished) {
        setState('pending');
      }
      picture.decode().then(
        () => {
          if (isCurrent) {
            setState('ready');
          }
        },
        () => {
          // A finished picture with no size that cannot be decoded is broken.
          if (isCurrent && (!isFinished || picture.naturalWidth === 0)) {
            setState('failed');
          }
        },
      );
      return () => {
        isCurrent = false;
      };
    },
    [url, setState],
  );

  return {
    state: snapshot.url === url ? snapshot.state : 'pending',
    attach,
    markFailed: () => {
      setState('failed');
    },
    markReady: () => {
      setState('ready');
    },
  };
}
