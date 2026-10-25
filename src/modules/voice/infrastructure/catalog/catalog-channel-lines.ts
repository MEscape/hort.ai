import channelLinesJson from './channel-lines.json';

import type { ChannelLines } from '../../domain/ports/channel-lines.port';

/**
 * The reviewed, fixed channel sentences of `channel-lines.json`. Adding a line is a reviewed edit of
 * that file; it must hold no name or detail of a real child, because clips are served by URL.
 */
export function catalogChannelLines(
  lines: Readonly<Record<string, string>> = channelLinesJson,
): ChannelLines {
  const allowed: ReadonlySet<string> = new Set(Object.values(lines).map((line) => line.trim()));
  return { isChannelLine: (text) => allowed.has(text.trim()) };
}
