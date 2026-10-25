import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipFixtureEntry {
  readonly name: string;
  readonly data: string | Uint8Array;
  /** `stored` keeps the bytes as they are; the default compresses them. */
  readonly method?: 'stored' | 'deflate';
  /** Overrides the size the headers declare, to build archives that lie. */
  readonly declaredSize?: number;
  readonly flags?: number;
}

/** A minimal, spec-conforming ZIP archive for tests; no ZIP library is installed. */
export function zipFixture(entries: readonly ZipFixtureEntry[]): Uint8Array {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const raw = Buffer.from(typeof entry.data === 'string' ? entry.data : entry.data);
    const stored = entry.method === 'stored';
    const body = stored ? raw : deflateRawSync(raw);
    const name = Buffer.from(entry.name);
    const size = entry.declaredSize ?? raw.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.flags ?? 0, 6);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(entry.flags ?? 0, 8);
    header.writeUInt16LE(stored ? 0 : 8, 10);
    header.writeUInt32LE(crc32(raw), 16);
    header.writeUInt32LE(body.length, 20);
    header.writeUInt32LE(size, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    parts.push(local, name, body);
    central.push(header, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, directory, end]));
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

export const docxXml = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}</w:body></w:document>`;

export const wordParagraph = (text: string, properties = '') =>
  `<w:p>${properties === '' ? '' : `<w:pPr>${properties}</w:pPr>`}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

export const docxFile = (body: string) =>
  zipFixture([
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: 'word/document.xml', data: docxXml(body) },
  ]);

export const slideXml = (shapes: string) =>
  `<?xml version="1.0"?><p:sld ${P} ${A}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`;

export const slideShape = (paragraphs: readonly string[], placeholder = '') =>
  `<p:sp><p:nvSpPr><p:nvPr>${placeholder}</p:nvPr></p:nvSpPr><p:txBody>${paragraphs
    .map((text) => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`)
    .join('')}</p:txBody></p:sp>`;

/** `slides` are listed in presentation order but stored under the given file numbers. */
export const pptxFile = (
  slides: ReadonlyArray<{ readonly number: number; readonly xml: string }>,
) =>
  zipFixture([
    {
      name: 'ppt/presentation.xml',
      data: `<p:presentation ${P} ${R}><p:sldIdLst>${slides
        .map((slide, index) => `<p:sldId id="${256 + index}" r:id="rId${slide.number}"/>`)
        .join('')}</p:sldIdLst></p:presentation>`,
    },
    {
      name: 'ppt/_rels/presentation.xml.rels',
      data: `<Relationships>${slides
        .map(
          (slide) =>
            `<Relationship Id="rId${slide.number}" Type="x/slide" Target="slides/slide${slide.number}.xml"/>`,
        )
        .join('')}</Relationships>`,
    },
    ...slides.map((slide) => ({ name: `ppt/slides/slide${slide.number}.xml`, data: slide.xml })),
  ]);
