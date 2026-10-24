import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

import { APP_IDENTITY } from '../src/lib/config/app-identity';

/** Deterministic exports of the canonical SVG artwork; Sharp is supplied by Next.js. */
const ROOT = resolve(import.meta.dirname, '..');
const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg"';
const BACKGROUND = APP_IDENTITY.colors.background;

const [owl, wordmark] = await Promise.all([
  readFile(resolve(ROOT, 'public/brand/owl.svg'), 'utf8'),
  readFile(resolve(ROOT, 'public/brand/wordmark.svg'), 'utf8'),
]);

const inner = (svg: string) => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
const owlInner = inner(owl);
const wordmarkInner = inner(wordmark);

const logo = `${SVG_OPEN} viewBox="0 0 496 160" width="496" height="160"><svg x="0" y="0" width="142" height="160" viewBox="0 0 160 180">${owlInner}</svg><svg x="144" y="15" width="352" height="132" viewBox="0 0 400 150">${wordmarkInner}</svg></svg>`;
const icon = `${SVG_OPEN} viewBox="0 0 180 180" width="180" height="180"><rect width="180" height="180" rx="40" fill="${BACKGROUND}"/><svg x="13" y="15" width="154" height="154" viewBox="17 10 132 117">${owlInner}</svg></svg>`;
// The entire owl stays inside the central 80% safe area of a maskable icon.
const maskable = `${SVG_OPEN} viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="${BACKGROUND}"/><svg x="112" y="94" width="288" height="324" viewBox="0 0 160 180">${owlInner}</svg></svg>`;
const social = `${SVG_OPEN} viewBox="0 0 1200 630" width="1200" height="630"><rect width="1200" height="630" fill="${BACKGROUND}"/><path d="M0 490C220 425 360 615 630 530S1010 440 1200 505V630H0Z" fill="#fae6d0"/><svg x="165" y="175" width="870" height="281" viewBox="0 0 496 160">${inner(logo)}</svg></svg>`;

async function save(path: string, content: string | Buffer): Promise<void> {
  const target = resolve(ROOT, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

async function png(path: string, svg: string, size: number): Promise<void> {
  await save(path, await sharp(Buffer.from(svg)).resize(size).png().toBuffer());
}

await save('public/brand/logo.svg', logo);
await save('src/app/icon.svg', icon);
await png('src/app/apple-icon.png', maskable, 180);
await png('public/brand/icon-192.png', icon, 192);
await png('public/brand/icon-512.png', icon, 512);
await png('public/brand/icon-maskable-512.png', maskable, 512);
await png('public/email/hortai.png', logo, 496);
await png('public/brand/social.png', social, 1200);

// ICO supports PNG frames: one directory entry per size, followed by the frame bytes.
const sizes = [16, 32, 48];
const frames = await Promise.all(
  sizes.map((size) => sharp(Buffer.from(icon)).resize(size).png().toBuffer()),
);
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (const [index, frame] of frames.entries()) {
  const entry = 6 + index * 16;
  header.writeUInt8(sizes[index] ?? 0, entry);
  header.writeUInt8(sizes[index] ?? 0, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}
await save('src/app/favicon.ico', Buffer.concat([header, ...frames]));
process.stdout.write('Generated SVG, favicon, Apple, manifest, email and social artwork.\n');
