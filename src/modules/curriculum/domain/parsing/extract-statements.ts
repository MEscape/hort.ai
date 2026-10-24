import { CURRICULUM_TEXT_LIMITS } from '../models/curriculum-scope';

import { boundText, toCleanLine, toStatementText } from './untrusted-text';

import type { CompetencyStatement } from '../models/competency';

/** `# Heading` starts a section. */
const HEADING = /^#{1,6}\s+(.+)$/;
/** `[Seite 16]` or `[page 16]` sets the page of what follows. */
const PAGE_MARKER = /^\[(?:seite|page|s\.)\s*(\d{1,4})\]$/i;
/** List bullets as typed or as `pdftotext` emits them (U+0001 is its bullet glyph). */
// eslint-disable-next-line no-control-regex -- pdftotext writes the bullet glyph as U+0001
const BULLET = /^(?:[-*•▪◦–]|\u0001)\s+(.*)$/u;
/** `// …` lines are notes of whoever prepared the text and are not ingested. */
const COMMENT = '//';
const DEFAULT_SECTION = 'Dokument';
const CODE_DIGITS = 2;

function codeOf(sectionIndex: number, itemIndex: number): string {
  const pad = (value: number) => String(value).padStart(CODE_DIGITS, '0');
  return `s${pad(sectionIndex)}-${pad(itemIndex)}`;
}

/** Reads a text line by line and collects its statements. */
class StatementReader {
  readonly statements: CompetencyStatement[] = [];
  private section = DEFAULT_SECTION;
  private sectionIndex = 0;
  private itemIndex = 0;
  private page: number | null = null;
  /** The lines of the statement being read and the page it started on. */
  private current: { lines: string[]; page: number | null } | null = null;

  read(rawLine: string): void {
    // A form feed is a page break in `pdftotext` output.
    const pageBreaks = rawLine.split('\f').length - 1;
    if (this.page !== null) {
      this.page += pageBreaks;
    }
    const line = rawLine.replace(/\f/g, '').trim();
    if (line.startsWith(COMMENT)) {
      return;
    }
    const page = PAGE_MARKER.exec(line);
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);

    if (line.length === 0) {
      this.flush();
    } else if (page) {
      this.flush();
      this.page = Number(page[1]);
    } else if (heading) {
      this.startSection(heading[1] ?? '');
    } else if (bullet) {
      this.startStatement(bullet[1] ?? '');
    } else if (this.current) {
      this.current.lines.push(line);
    } else {
      this.startStatement(line);
    }
  }

  flush(): void {
    const current = this.current;
    this.current = null;
    if (!current) {
      return;
    }
    const { text, truncated } = toStatementText(current.lines.join('\n'));
    if (Array.from(text).length < CURRICULUM_TEXT_LIMITS.statementMin) {
      return;
    }
    this.itemIndex += 1;
    this.statements.push({
      code: codeOf(this.sectionIndex, this.itemIndex),
      text,
      section: this.section,
      page: current.page,
      truncated,
    });
  }

  private startSection(title: string): void {
    this.flush();
    this.section = boundText(toCleanLine(title), CURRICULUM_TEXT_LIMITS.sectionMax).text;
    this.sectionIndex += 1;
    this.itemIndex = 0;
  }

  private startStatement(line: string): void {
    this.flush();
    this.current = { lines: [line], page: this.page };
  }
}

/**
 * Splits a source text into short statements (#28, reused by #29 for teacher material).
 *
 * The format is plain text, so a new state or document is data, not code: `# ` lines are section
 * headings, `[Seite n]` lines set the page (a form feed advances it), each bullet (`-`, `•`, …) is
 * one statement, its indented follow-up lines continue it, and a block of plain lines separated by
 * a blank line is one statement too (a paragraph of teacher material). Every statement is cleaned
 * and bounded; codes are stable for the same text, so a re-run updates instead of duplicating.
 */
export function extractStatements(body: string): CompetencyStatement[] {
  const reader = new StatementReader();
  for (const rawLine of body.replace(/\r\n?/g, '\n').split('\n')) {
    reader.read(rawLine);
  }
  reader.flush();
  return reader.statements;
}
