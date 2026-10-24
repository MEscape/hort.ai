import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { APP_IDENTITY } from '@lib/config';

import manifest from '@/app/manifest';

const ROOT = process.cwd();
const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
const owl = readFileSync(join(ROOT, 'public', APP_IDENTITY.assets.owl), 'utf8');

function color(name: string): string {
  const match = new RegExp(`--hortai-color-${name}: (#[a-f0-9]{6})`).exec(css);
  if (match?.[1] === undefined) {
    throw new Error(`Missing color ${name}`);
  }
  return match[1];
}

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (rgb[0] ?? 0) * 0.2126 + (rgb[1] ?? 0) * 0.7152 + (rgb[2] ?? 0) * 0.0722;
}

function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}

describe('owl identity assets', () => {
  it('ships every image referenced by the brand and web manifest', () => {
    for (const path of [
      ...Object.values(APP_IDENTITY.assets),
      ...(manifest().icons ?? []).map((icon) => icon.src),
    ]) {
      const file = path === '/icon.svg' ? 'src/app/icon.svg' : join('public', path);
      expect(readFileSync(join(ROOT, file)).length, path).toBeGreaterThan(0);
    }
    expect(readFileSync(join(ROOT, 'src/app/favicon.ico')).readUInt16LE(4)).toBe(3);
  });

  it('exports correctly sized email, Apple, install and social PNGs', () => {
    for (const [file, width, height] of [
      ['public/email/hortai.png', 496, 160],
      ['src/app/apple-icon.png', 180, 180],
      ['public/brand/icon-192.png', 192, 192],
      ['public/brand/icon-512.png', 512, 512],
      ['public/brand/icon-maskable-512.png', 512, 512],
      ['public/brand/social.png', 1200, 630],
    ] as const) {
      const data = readFileSync(join(ROOT, file));
      expect(data.subarray(1, 4).toString()).toBe('PNG');
      expect([data.readUInt32BE(16), data.readUInt32BE(20)]).toEqual([width, height]);
    }
  });

  it('keeps the installed-app identity and colors aligned with application configuration', () => {
    expect(manifest()).toMatchObject({
      name: APP_IDENTITY.name,
      theme_color: color('primary'),
      background_color: color('background'),
      start_url: '/',
    });
    expect(manifest().icons).toContainEqual(expect.objectContaining({ purpose: 'maskable' }));
    expect(owl).toContain(APP_IDENTITY.colors.primary);
  });
});

describe('brown palette contrast', () => {
  it.each([
    'surface',
    'background',
    'highlight',
    'sunken',
    'landscape-far',
    'landscape-near',
    'landscape-front',
  ])('keeps body and muted copy readable on %s', (surface) => {
    expect(contrast(color('text'), color(surface))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('text-muted'), color(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['primary', 'secondary', 'accent', 'bloom'])(
    'keeps text readable on the %s fill',
    (name) => {
      expect(contrast(color(name), color(`${name}-foreground`))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color(`${name}-copy`), color('surface'))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('preserves visible field boundaries and focus against every control surface', () => {
    for (const surface of ['surface', 'background', 'highlight']) {
      expect(contrast(color('border-strong'), color(surface))).toBeGreaterThanOrEqual(3);
      expect(contrast(color('focus'), color(surface))).toBeGreaterThanOrEqual(3);
    }
  });
});
