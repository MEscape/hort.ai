import type { LumiMood } from '@components/brand/lumi';

export interface LumiMoodState {
  /** A request is running. */
  readonly isPending: boolean;
  /** The form was refused as a whole (wrong credentials, too many attempts, a service failure). */
  readonly hasError: boolean;
  /** Something good to cheer for: a strong password. */
  readonly isCheering?: boolean;
}

/**
 * How Lumi feels while a form is in front of the person. The order is the story: working beats
 * everything, a refusal is met gently, a good choice is cheered, otherwise Lumi simply waits.
 * Every mood is also said in words on the screen, so the picture is never the only message.
 */
export function lumiMoodOf({ isPending, hasError, isCheering = false }: LumiMoodState): LumiMood {
  if (isPending) {
    return 'think';
  }
  if (hasError) {
    return 'oops';
  }
  return isCheering ? 'happy' : 'hello';
}
