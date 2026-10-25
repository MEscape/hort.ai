import { describe, expect, it } from 'vitest';

import {
  MATERIAL_POWERPOINT_CONTENT_TYPE,
  MATERIAL_WORD_CONTENT_TYPE,
} from '@modules/teacher-material/domain/models/material';
import { officeMaterialConverter } from '@modules/teacher-material/infrastructure/office/office-material-converter';
import { ZipArchive } from '@modules/teacher-material/infrastructure/office/zip-archive';

import { docxFile, pptxFile, slideShape, slideXml, wordParagraph, zipFixture } from './zip-fixture';

const word = (bytes: Uint8Array) =>
  officeMaterialConverter.toText(MATERIAL_WORD_CONTENT_TYPE, bytes);
const slides = (bytes: Uint8Array) =>
  officeMaterialConverter.toText(MATERIAL_POWERPOINT_CONTENT_TYPE, bytes);

describe('Word documents', () => {
  it('turns headings, list entries and paragraphs into curriculum text', () => {
    const text = word(
      docxFile(
        [
          wordParagraph('Zahlen &amp; Größen', '<w:pStyle w:val="Heading1"/>'),
          wordParagraph('Zahlen bis 1000 vergleichen und ordnen.'),
          wordParagraph(
            'Gerade und ungerade Zahlen erkennen.',
            '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="3"/></w:numPr>',
          ),
          wordParagraph('Überschrift auf Deutsch', '<w:pStyle w:val="berschrift2"/>'),
          '<w:p/>',
          '<w:p><w:r><w:t>Rechnen mit</w:t></w:r><w:r><w:tab/><w:t>Stellenwerten &#252;ben.</w:t></w:r></w:p>',
        ].join(''),
      ),
    );
    expect(text).toBe(
      [
        '# Zahlen & Größen',
        'Zahlen bis 1000 vergleichen und ordnen.',
        '- Gerade und ungerade Zahlen erkennen.',
        '# Überschrift auf Deutsch',
        'Rechnen mit Stellenwerten üben.',
      ].join('\n\n'),
    );
  });

  it('reads text boxes once, ignores deleted revisions and removes control characters', () => {
    const text = word(
      docxFile(
        [
          '<mc:AlternateContent><mc:Choice>',
          wordParagraph('Im Textfeld.'),
          '</mc:Choice><mc:Fallback>',
          wordParagraph('Im Textfeld.'),
          '</mc:Fallback></mc:AlternateContent>',
          '<w:p><w:r><w:t>Bleibt</w:t></w:r><w:del><w:r><w:delText>Gelöscht</w:delText></w:r></w:del><w:r><w:t>&#1;&#0;X</w:t></w:r></w:p>',
        ].join(''),
      ),
    );
    expect(text).toBe('Im Textfeld.\n\nBleibt X');
  });

  it('refuses a document without text, a non-ZIP file and a file of the other Office type', () => {
    expect(word(docxFile(wordParagraph('   ')))).toBeNull();
    expect(word(new TextEncoder().encode('Das ist nur Text, kein Dokument.'))).toBeNull();
    expect(word(new Uint8Array(0))).toBeNull();
    expect(word(pptxFile([{ number: 1, xml: slideXml(slideShape(['Folie'])) }]))).toBeNull();
  });
});

describe('PowerPoint presentations', () => {
  const titled = (title: string, ...lines: string[]) =>
    slideXml(
      slideShape([title], '<p:ph type="title"/>') +
        slideShape(lines) +
        slideShape(['7'], '<p:ph type="sldNum"/>'),
    );

  it('reads the slides in presentation order, with the page and the title as a section', () => {
    const text = slides(
      pptxFile([
        { number: 2, xml: titled('Erste gezeigte Folie', 'Brüche am Zahlenstrahl finden.') },
        { number: 1, xml: titled('Zweite gezeigte Folie', 'Brüche vergleichen &amp; ordnen.') },
      ]),
    );
    expect(text).toBe(
      [
        '[Seite 1]',
        '# Erste gezeigte Folie',
        'Brüche am Zahlenstrahl finden.',
        '[Seite 2]',
        '# Zweite gezeigte Folie',
        'Brüche vergleichen & ordnen.',
      ].join('\n\n'),
    );
  });

  it('falls back to the slide file numbers when the order is not listed', () => {
    const text = slides(
      zipFixture([
        { name: 'ppt/slides/slide10.xml', data: slideXml(slideShape(['Zehnte Folie hier.'])) },
        { name: 'ppt/slides/slide2.xml', data: slideXml(slideShape(['Zweite Folie hier.'])) },
      ]),
    );
    expect(text).toBe('[Seite 1]\n\nZweite Folie hier.\n\n[Seite 2]\n\nZehnte Folie hier.');
  });

  it('refuses a file without slides or text', () => {
    expect(slides(zipFixture([{ name: 'ppt/presentation.xml', data: '<p/>' }]))).toBeNull();
    expect(slides(docxFile(wordParagraph('Text')))).toBeNull();
  });
});

describe('hostile archives', () => {
  it('stops inflating at the declared size, however much the data really holds', () => {
    const bomb = zipFixture([
      { name: 'word/document.xml', data: 'a'.repeat(5_000_000), declaredSize: 100 },
    ]);
    expect(word(bomb)).toBeNull();
  });

  it('refuses entries above the size limit before inflating them', () => {
    const huge = zipFixture([{ name: 'word/document.xml', data: 'a', declaredSize: 17_000_000 }]);
    expect(word(huge)).toBeNull();
  });

  it('refuses encrypted, duplicated and damaged archives', () => {
    const entry = { name: 'word/document.xml', data: wordParagraph('x') };
    expect(word(zipFixture([{ ...entry, flags: 1 }]))).toBeNull();
    expect(word(zipFixture([entry, entry]))).toBeNull();
    const intact = docxFile(wordParagraph('Zahlen bis 1000'));
    expect(word(intact.slice(0, intact.length - 30))).toBeNull();
  });

  it('refuses a local header that points outside the archive', () => {
    const bytes = zipFixture([{ name: 'a.txt', data: 'hello' }]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // The only central directory entry starts right before the end record (22 bytes) and its name.
    view.setUint32(bytes.length - 22 - 5 - 46 + 42, 0xfff0, true);
    expect(ZipArchive.open(bytes)?.read('a.txt')).toBeNull();
  });

  it('reads stored and compressed entries', () => {
    const zip = ZipArchive.open(
      zipFixture([
        { name: 'plain.txt', data: 'stored', method: 'stored' },
        { name: 'packed.txt', data: 'deflated' },
        { name: 'empty.txt', data: '' },
      ]),
    );
    if (zip === null) {
      throw new Error('fixture archive must open');
    }
    expect(new TextDecoder().decode(zip.read('plain.txt') ?? new Uint8Array())).toBe('stored');
    expect(new TextDecoder().decode(zip.read('packed.txt') ?? new Uint8Array())).toBe('deflated');
    expect(zip.read('empty.txt')).toHaveLength(0);
    expect(zip.read('missing')).toBeNull();
  });
});
