import { inflateRawSync } from 'node:zlib';

/** Bounds on what a hostile archive may make the server read or inflate. */
const MAX_ENTRIES = 5000;
const MAX_ENTRY_BYTES = 16_777_216;
const MAX_TOTAL_BYTES = 50_331_648;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_BYTES = 22;
const EOCD_MAX_COMMENT = 65_535;
const EOCD_COUNT_AT = 10;
const EOCD_DIRECTORY_AT = 16;
const CENTRAL_FIXED_BYTES = 46;
const CENTRAL_FLAGS_AT = 8;
const CENTRAL_METHOD_AT = 10;
const CENTRAL_COMPRESSED_AT = 20;
const CENTRAL_SIZE_AT = 24;
const CENTRAL_NAME_LENGTH_AT = 28;
const CENTRAL_EXTRA_LENGTH_AT = 30;
const CENTRAL_COMMENT_LENGTH_AT = 32;
const CENTRAL_LOCAL_OFFSET_AT = 42;
const LOCAL_FIXED_BYTES = 30;
const LOCAL_NAME_LENGTH_AT = 26;
const LOCAL_EXTRA_LENGTH_AT = 28;
const STORED = 0;
const DEFLATED = 8;
const ENCRYPTED_FLAG = 1;
const ZIP64_MARKER_16 = 0xffff;
const ZIP64_MARKER_32 = 0xffffffff;

interface ZipEntry {
  readonly method: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly localOffset: number;
}

function findEndRecord(view: DataView): number | null {
  const lowest = Math.max(0, view.byteLength - EOCD_MIN_BYTES - EOCD_MAX_COMMENT);
  for (let at = view.byteLength - EOCD_MIN_BYTES; at >= lowest; at -= 1) {
    if (view.getUint32(at, true) === EOCD_SIGNATURE) {
      return at;
    }
  }
  return null;
}

function decodeName(data: Uint8Array, from: number, to: number): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(from, to));
  } catch {
    return null;
  }
}

/** One central-directory record, or `null` when it is damaged or of a kind that is not read. */
function readRecord(
  data: Uint8Array,
  view: DataView,
  at: number,
): { readonly name: string; readonly entry: ZipEntry; readonly next: number } | null {
  if (at + CENTRAL_FIXED_BYTES > data.length || view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
    return null;
  }
  const method = view.getUint16(at + CENTRAL_METHOD_AT, true);
  const compressedSize = view.getUint32(at + CENTRAL_COMPRESSED_AT, true);
  const size = view.getUint32(at + CENTRAL_SIZE_AT, true);
  const nameEnd = at + CENTRAL_FIXED_BYTES + view.getUint16(at + CENTRAL_NAME_LENGTH_AT, true);
  const encrypted = (view.getUint16(at + CENTRAL_FLAGS_AT, true) & ENCRYPTED_FLAG) !== 0;
  const zip64 = compressedSize === ZIP64_MARKER_32 || size === ZIP64_MARKER_32;
  const name = nameEnd > data.length ? null : decodeName(data, at + CENTRAL_FIXED_BYTES, nameEnd);
  if (name === null || encrypted || zip64 || (method !== STORED && method !== DEFLATED)) {
    return null;
  }
  const localOffset = view.getUint32(at + CENTRAL_LOCAL_OFFSET_AT, true);
  const trailing =
    view.getUint16(at + CENTRAL_EXTRA_LENGTH_AT, true) +
    view.getUint16(at + CENTRAL_COMMENT_LENGTH_AT, true);
  return {
    name,
    entry: { method, compressedSize, size, localOffset },
    next: nameEnd + trailing,
  };
}

function readEntries(data: Uint8Array, view: DataView): ReadonlyMap<string, ZipEntry> | null {
  const end = findEndRecord(view);
  if (end === null) {
    return null;
  }
  const count = view.getUint16(end + EOCD_COUNT_AT, true);
  const directory = view.getUint32(end + EOCD_DIRECTORY_AT, true);
  if (
    count === ZIP64_MARKER_16 ||
    directory === ZIP64_MARKER_32 ||
    count > MAX_ENTRIES ||
    directory >= data.length
  ) {
    return null;
  }
  const entries = new Map<string, ZipEntry>();
  let at = directory;
  for (let index = 0; index < count; index += 1) {
    const record = readRecord(data, view, at);
    if (record === null || entries.has(record.name)) {
      return null;
    }
    entries.set(record.name, record.entry);
    at = record.next;
  }
  return entries;
}

/**
 * Read-only view of a ZIP archive held in memory. Only the entries a caller asks for are
 * inflated, and the declared size of each is the hard output limit (Node stops inflating there),
 * so a header that lies about its size cannot make the server produce more than it declared.
 * ZIP64, encrypted or duplicate entries, unknown compression methods and damage make the archive
 * unreadable (`open` returns `null`); nothing here throws.
 */
export class ZipArchive {
  private inflatedBytes = 0;

  private constructor(
    private readonly data: Uint8Array,
    private readonly view: DataView,
    private readonly entries: ReadonlyMap<string, ZipEntry>,
  ) {}

  static open(data: Uint8Array): ZipArchive | null {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const entries = data.length < EOCD_MIN_BYTES ? null : readEntries(data, view);
    return entries === null ? null : new ZipArchive(data, view, entries);
  }

  names(): readonly string[] {
    return [...this.entries.keys()];
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  /** The inflated entry; `null` when the archive has no such entry or the entry is unreadable. */
  read(name: string): Uint8Array | null {
    const entry = this.entries.get(name);
    if (
      entry === undefined ||
      entry.size > MAX_ENTRY_BYTES ||
      this.inflatedBytes + entry.size > MAX_TOTAL_BYTES
    ) {
      return null;
    }
    this.inflatedBytes += entry.size;
    const raw = this.entryData(entry);
    if (raw === null) {
      return null;
    }
    return entry.method === STORED ? storedBytes(raw, entry.size) : inflated(raw, entry.size);
  }

  private entryData(entry: ZipEntry): Uint8Array | null {
    const header = entry.localOffset;
    if (
      header + LOCAL_FIXED_BYTES > this.data.length ||
      this.view.getUint32(header, true) !== LOCAL_SIGNATURE
    ) {
      return null;
    }
    const start =
      header +
      LOCAL_FIXED_BYTES +
      this.view.getUint16(header + LOCAL_NAME_LENGTH_AT, true) +
      this.view.getUint16(header + LOCAL_EXTRA_LENGTH_AT, true);
    const end = start + entry.compressedSize;
    return end > this.data.length ? null : this.data.subarray(start, end);
  }
}

function storedBytes(raw: Uint8Array, size: number): Uint8Array | null {
  return raw.length === size ? raw : null;
}

/** Inflates to exactly `size` bytes; Node refuses to produce more than `maxOutputLength`. */
function inflated(raw: Uint8Array, size: number): Uint8Array | null {
  if (size === 0) {
    return new Uint8Array(0);
  }
  try {
    const out = inflateRawSync(raw, { maxOutputLength: size });
    return out.length === size ? new Uint8Array(out.buffer, out.byteOffset, out.length) : null;
  } catch {
    return null;
  }
}
