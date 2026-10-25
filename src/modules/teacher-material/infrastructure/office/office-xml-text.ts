import type { ZipArchive } from './zip-archive';

/**
 * Text of a Word or PowerPoint file, in the plain-text form the curriculum extractor reads:
 * `# heading` starts a section, `- item` a list entry, `[Seite N]` sets the page, and a blank
 * line ends a statement. The OOXML parts are scanned as a flat tag stream; no XML parser, DTD
 * or entity expansion is involved, so a hostile document cannot make the server fetch or expand
 * anything. Only the main body is read (no headers, footers, notes or comments).
 */

const DOCUMENT_PART = 'word/document.xml';
const PRESENTATION_PART = 'ppt/presentation.xml';
const PRESENTATION_RELS_PART = 'ppt/_rels/presentation.xml.rels';
const MAX_SLIDES = 500;
const SLIDE_PART = /^ppt\/slides\/slide(\d+)\.xml$/;
const TOKEN = /<[^>]*>|[^<]+/g;
const ENTITY = /&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,4});/gi;
const HEADING_STYLE = /^(?:heading|berschrift|überschrift|title|titel)/i;
const SKIPPED_PLACEHOLDERS = new Set(['sldNum', 'dt', 'ftr']);
const TITLE_PLACEHOLDERS = new Set(['title', 'ctrTitle']);
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};
const CODE_POINT_MAX = 0x10ffff;
const HEX = 16;
const DECIMAL = 10;
const DEL = 127;
const SPACE = 32;

function decodeEntity(match: string, body: string): string {
  if (!body.startsWith('#')) {
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  }
  const hex = body[1] === 'x' || body[1] === 'X';
  const code = parseInt(body.slice(hex ? 2 : 1), hex ? HEX : DECIMAL);
  return code > 0 && code <= CODE_POINT_MAX ? String.fromCodePoint(code) : '';
}

function decodeEntities(text: string): string {
  return text.replace(ENTITY, decodeEntity);
}

/** Control characters are not text (the material check refuses them): they become spaces. */
function withoutControls(text: string): string {
  return Array.from(text, (char) => {
    const code = char.codePointAt(0) ?? SPACE;
    return code < SPACE || code === DEL ? ' ' : char;
  }).join('');
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return match?.[1] === undefined ? null : decodeEntities(match[1]);
}

function tagName(token: string): string {
  return /^<\/?([A-Za-z0-9_:.-]+)/.exec(token)?.[1] ?? '';
}

/** `<x>` opens, `</x>` and `<x/>` do not. */
function opens(token: string): boolean {
  return !token.startsWith('</') && !token.endsWith('/>');
}

function utf8(bytes: Uint8Array | null): string | null {
  return bytes === null ? null : new TextDecoder('utf-8').decode(bytes);
}

function renderBlock(text: string, heading: boolean, list: boolean): string {
  if (heading) {
    return `# ${text}`;
  }
  return list ? `- ${text}` : text;
}

/** Collects the paragraphs of one part as text blocks. */
class BlockWriter {
  readonly blocks: string[] = [];
  private text = '';
  private inText = false;
  private heading = false;
  private list = false;
  /** Slides: the shape being read is a title (a section) or a footer (not content). */
  private title = false;
  private skipped = false;

  /** Ends the current paragraph. */
  end(): void {
    const text = withoutControls(this.text).replace(/\s+/g, ' ').trim();
    if (text !== '' && !this.skipped) {
      this.blocks.push(renderBlock(text, this.heading || this.title, this.list));
    }
    this.text = '';
    this.heading = false;
    this.list = false;
  }

  /** Ends the current paragraph and starts a new shape. */
  endShape(): void {
    this.end();
    this.title = false;
    this.skipped = false;
  }

  /** Text characters are collected only between `<w:t>`/`<a:t>` tags. */
  collectText(on: boolean): void {
    this.inText = on;
  }

  space(): void {
    this.text += ' ';
  }

  markHeading(on: boolean): void {
    this.heading = on;
  }

  markList(on: boolean): void {
    this.list = on;
  }

  placeholder(type: string): void {
    this.title = TITLE_PLACEHOLDERS.has(type);
    this.skipped = SKIPPED_PLACEHOLDERS.has(type);
  }

  scan(xml: string, onTag: (token: string, writer: BlockWriter) => void): void {
    for (const token of xml.match(TOKEN) ?? []) {
      if (!token.startsWith('<')) {
        this.text += this.inText ? decodeEntities(token) : '';
      } else {
        onTag(token, this);
      }
    }
    this.end();
  }
}

function onWordTag(token: string, writer: BlockWriter): void {
  switch (tagName(token)) {
    case 'w:p':
      writer.end();
      break;
    case 'w:t':
      writer.collectText(opens(token));
      break;
    case 'w:tab':
    case 'w:br':
    case 'w:cr':
      writer.space();
      break;
    case 'w:pStyle':
      writer.markHeading(HEADING_STYLE.test(attribute(token, 'w:val') ?? ''));
      break;
    case 'w:numId':
      writer.markList((attribute(token, 'w:val') ?? '0') !== '0');
      break;
    default:
  }
}

/** Word: `w:p` paragraphs with `w:t` runs; heading styles and numbered/bulleted lists are kept. */
export function wordText(zip: ZipArchive): string | null {
  const xml = utf8(zip.read(DOCUMENT_PART));
  if (xml === null) {
    return null;
  }
  const writer = new BlockWriter();
  // Content Word stores twice (a text box and its legacy fallback) must be read once.
  writer.scan(xml.replace(/<mc:Fallback\b[\s\S]*?<\/mc:Fallback>/g, ''), onWordTag);
  return writer.blocks.join('\n\n');
}

function onSlideTag(token: string, writer: BlockWriter): void {
  switch (tagName(token)) {
    case 'p:sp':
    case 'p:graphicFrame':
      writer.endShape();
      break;
    case 'p:ph':
      writer.placeholder(attribute(token, 'type') ?? '');
      break;
    case 'a:p':
      writer.end();
      break;
    case 'a:t':
      writer.collectText(opens(token));
      break;
    case 'a:br':
      writer.space();
      break;
    default:
  }
}

/** Relationship id → part name, from `ppt/_rels/presentation.xml.rels`. */
function slideTargets(rels: string | null): ReadonlyMap<string, string> {
  const targets = new Map<string, string>();
  for (const tag of rels?.match(/<Relationship\b[^>]*>/g) ?? []) {
    const id = attribute(tag, 'Id');
    const target = attribute(tag, 'Target');
    if (id !== null && target !== null) {
      targets.set(id, target.startsWith('/') ? target.slice(1) : `ppt/${target}`);
    }
  }
  return targets;
}

/** Slide parts in presentation order (reordered slides keep their file names), numeric as a fallback. */
function slideParts(zip: ZipArchive): readonly string[] {
  const presentation = utf8(zip.read(PRESENTATION_PART));
  const targets = slideTargets(utf8(zip.read(PRESENTATION_RELS_PART)));
  const ordered = (presentation?.match(/<p:sldId\b[^>]*>/g) ?? [])
    .map((tag) => targets.get(attribute(tag, 'r:id') ?? ''))
    .filter((part): part is string => part !== undefined && SLIDE_PART.test(part) && zip.has(part));
  if (ordered.length > 0) {
    return ordered.slice(0, MAX_SLIDES);
  }
  const number = (part: string) => Number(SLIDE_PART.exec(part)?.[1]);
  return zip
    .names()
    .filter((part) => SLIDE_PART.test(part))
    .sort((a, b) => number(a) - number(b))
    .slice(0, MAX_SLIDES);
}

/** PowerPoint: slide text in presentation order; a title is a section, `[Seite N]` the slide number. */
export function slidesText(zip: ZipArchive): string | null {
  const parts = slideParts(zip);
  if (parts.length === 0) {
    return null;
  }
  const blocks: string[] = [];
  for (const [index, part] of parts.entries()) {
    const xml = utf8(zip.read(part));
    if (xml === null) {
      return null;
    }
    const writer = new BlockWriter();
    writer.scan(xml, onSlideTag);
    blocks.push(`[Seite ${index + 1}]`, ...writer.blocks);
  }
  return blocks.join('\n\n');
}
