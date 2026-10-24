import { CURRICULUM_TEXT_LIMITS } from '../models/curriculum-scope';

import { boundText, toCleanLine, toStatementText } from './untrusted-text';

import type { CompetencyStatement } from '../models/competency';

/** `# Heading` starts a section. */
const HEADING = /^#{1,6}\s+(.+)$/;
/** `[Seite 16]` or `[page 16]` sets the page of what follows. */
const PAGE_MARKER = /^\[(?:seite|page|s\.)\s*(\d{1,4})\]$/i;
/** List bullets as typed or as `pdftotext` emits them. */
const BULLET = /^(?:[-*•▪◦–]|\u0001)\s+(.*)$/u;

/** `// …` lines are notes of whoever prepared the text and are not ingested. */
const COMMENT = '//';

const DEFAULT_SECTION = 'Dokument';

interface ExtractionState {
  section: string;
  sectionIndex: number;
  itemIndex: number;
  page: number | null;
  /** The lines of the statement being read and the page it started on. */
  current: { lines: string[]; page: number | null } | null;
  statements: CompetencyStatement[];
}

function codeOf(sectionIndex: number, itemIndex: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `s${pad(sectionIndex)}-${pad(itemIndex)}`;
}

function flush(state: ExtractionState): void {
  const current = state.current;
  state.current = null;
  if (!current) {
    return;
  }
  const { text, truncated } = toStatementText(current.lines.join('\n'));
  if (Array.from(text).length < CURRICULUM_TEXT_LIMITS.statementMin) {
    return;
  }
  state.itemIndex += 1;
  state.statements.push({
    code: codeOf(state.sectionIndex, state.itemIndex),
    text,
    section: state.section,
    page: current.page,
    truncated,
  });
}

function startStatement(state: ExtractionState, line: string): void {
  flush(state);
  state.current = { lines: [line], page: state.page };
}

function readLine(state: ExtractionState, rawLine: string): void {
  // A form feed is a page break in `pdftotext` output.
  for (let index = 1; index < rawLine.split('\f').length; index += 1) {
    state.page = state.page === null ? null : state.page + 1;
  }
  const line = rawLine.replace(/\f/g, '').trim();
  if (line.startsWith(COMMENT)) {
    return;
  }
  const page = PAGE_MARKER.exec(line);
  const heading = HEADING.exec(line);
  const bullet = BULLET.exec(line);

  if (line.length === 0) {
    flush(state);
  } else if (page) {
    flush(state);
    state.page = Number(page[1]);
  } else if (heading) {
    flush(state);
    state.section = boundText(toCleanLine(heading[1] ?? ''), CURRICULUM_TEXT_LIMITS.sectionMax).text;
    state.sectionIndex += 1;
    state.itemIndex = 0;
  } else if (bullet) {
    startStatement(state, bullet[1] ?? '');
  } else if (state.current) {
    state.current.lines.push(line);
  } else {
    startStatement(state, line);
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
  const state: ExtractionState = {
    section: DEFAULT_SECTION,
    sectionIndex: 0,
    itemIndex: 0,
    page: null,
    current: null,
    statements: [],
  };
  for (const rawLine of body.replace(/\r\n?/g, '\n').split('\n')) {
    readLine(state, rawLine);
  }
  flush(state);
  return state.statements;
}
