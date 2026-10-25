import type { MouthAlignment } from '@components/brand/character';
import type { CharacterFace } from '@components/brand/character-face';

/** A companion the parent can choose, as the page prepared it from the tutor catalog. */
export interface TutorOption {
  readonly id: string;
  readonly name: string;
  readonly animal: string;
  readonly description: string;
  readonly traits: readonly string[];
  readonly topics: readonly string[];
  readonly greeting: string;
  readonly voice: string;
  /** Absolute URL of the closed-mouth picture; the picture may be missing, the card still works. */
  readonly imageUrl: string;
  /** Absolute URL of the open-mouth picture, shown while the introduction plays. */
  readonly imageOpenUrl: string;
  /** Lays the open-mouth picture over the closed one; see `MouthAlignment`. */
  readonly openAlignment?: MouthAlignment | undefined;
  /** Where the eyes are, so the face can be animated; absent = the plain picture. */
  readonly face?: CharacterFace | undefined;
  /** Absolute URL of the spoken introduction (MP3), empty when no storage address is configured. */
  readonly introUrl: string;
}
