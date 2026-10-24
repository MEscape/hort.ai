/**
 * Rules that come from ESLint core and third-party plugins (not the custom
 * architecture plugin), exercised through the repository's real config
 * modules so a rename, an upgrade or a block-ordering mistake is caught.
 */
import { describe, expect, it } from 'vitest';

import { lintFiles } from './lint-tree';

const COMPONENT = 'src/modules/shop/presentation/components/card.tsx';

describe('locale-aware wrappers and import restrictions', () => {
  it('rejects direct next-intl / next/link / next/navigation navigation imports outside src/i18n', async () => {
    const out = await lintFiles({
      [COMPONENT]: `import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect, usePathname, useRouter, notFound } from 'next/navigation';
export const x = [useTranslations, getTranslations, Link, redirect, usePathname, useRouter, notFound];
`,
    });
    const text = out[COMPONENT]!.join('\n');
    expect(text).toMatch(/'next-intl'.*@i18n\/client/);
    expect(text).toMatch(/'next-intl\/server'.*@i18n\/server/);
    expect(text).toMatch(/'next\/link'.*locale-aware `Link` from '@i18n'/);
    expect(text).toMatch(/locale-aware `redirect`, `usePathname` and `useRouter` from '@i18n'/);
    // `notFound` is not locale-dependent: only the three specified APIs are restricted
    expect(text.match(/no-restricted-imports/g)).toHaveLength(6); // next-intl, next-intl/server, next/link and the three navigation APIs
  });

  it('allows the wrappers themselves (src/i18n) to import next-intl', async () => {
    const out = await lintFiles({
      'src/i18n/client.ts': "export { useTranslations } from 'next-intl';\n",
      'src/i18n/config.ts':
        "import { createNavigation } from 'next-intl/navigation';\nexport const n = createNavigation;\n",
    });
    expect(out['src/i18n/client.ts']).toEqual([]);
    expect(out['src/i18n/config.ts']).toEqual([]);
  });

  it("requires the '@modules' alias and the result wrapper inside modules", async () => {
    const out = await lintFiles({
      'src/modules/shop/application/x.ts':
        "import type { A } from '@/modules/auth';\nimport { ok } from 'neverthrow';\nexport const v = [ok];\nexport type T = A;\n",
    });
    const text = out['src/modules/shop/application/x.ts']!.join('\n');
    expect(text).toMatch(/'@modules\/<name>' alias/);
    expect(text).toMatch(/Use '@lib\/result'/);
  });
});

describe('configuration hygiene and layer-specific syntax', () => {
  it('forbids process.env outside the two config entry points, in every layer', async () => {
    const out = await lintFiles({
      'src/modules/shop/domain/models/a.ts': 'export const a = process.env.X;\n',
      'src/modules/shop/application/commands/b.ts': 'export const b = process.env.X;\n',
      'src/lib/config/server.ts': 'export const c = process.env.X;\n',
      'src/lib/config/public-env.ts': 'export const d = process.env.X;\n',
    });
    expect(out['src/modules/shop/domain/models/a.ts']!.join('\n')).toMatch(/process\.env/);
    expect(out['src/modules/shop/application/commands/b.ts']!.join('\n')).toMatch(/process\.env/);
    expect(out['src/lib/config/server.ts']).toEqual([]);
    expect(out['src/lib/config/public-env.ts']).toEqual([]);
  });

  it('keeps the domain free of clock and randomness, and the application free of HTTP objects', async () => {
    const out = await lintFiles({
      'src/modules/shop/domain/models/a.ts':
        'export const r = Math.random();\nexport const t = Date.now();\n',
      'src/modules/shop/application/commands/b.ts':
        'export const f = () => new Response("x");\nexport const d = (x: FormData) => x;\n',
    });
    expect(out['src/modules/shop/domain/models/a.ts']!.join('\n')).toMatch(
      /randomness \(Math\.random\(\)\)[\s\S]*clock \(Date\.now\(\)\)/,
    );
    expect(out['src/modules/shop/application/commands/b.ts']!.join('\n')).toMatch(
      /HTTP responses are a presentation concern[\s\S]*raw FormData/,
    );
  });

  it('rejects `new Date()` in application code (the clock is injected) but allows it in composition and with an argument', async () => {
    const out = await lintFiles({
      'src/modules/shop/application/commands/b.ts':
        'export const now = () => new Date();\nexport const at = (s: string) => new Date(s);\n',
      'src/modules/shop/composition.ts': 'export const clock = () => new Date();\n',
    });
    const text = out['src/modules/shop/application/commands/b.ts']!.join('\n');
    expect(text).toMatch(/Do not read the clock \(new Date\(\)\)/);
    expect(text.match(/Do not read the clock/g)).toHaveLength(1);
    expect(out['src/modules/shop/composition.ts']).toEqual([]);
  });

  it('rejects focused tests anywhere', async () => {
    const out = await lintFiles({
      'src/modules/shop/domain/models/a.test.ts':
        "declare const it: { only: (n: string, f: () => void) => void };\nit.only('x', () => undefined);\n",
    });
    expect(out['src/modules/shop/domain/models/a.test.ts']!.join('\n')).toMatch(/Remove `\.only`/);
  });

  it("keeps each layer's syntax restrictions in one block (a later block must not silently drop the earlier selectors)", async () => {
    const out = await lintFiles({
      'src/modules/shop/domain/models/a.ts':
        'export const a = process.env.X;\nexport const r = Math.random();\n',
    });
    expect(
      out['src/modules/shop/domain/models/a.ts']!.filter((m) => m.includes('no-restricted-syntax')),
    ).toHaveLength(2);
  });
});

describe('translation and formatting rules', () => {
  it('rejects literal text in JSX but allows translated text and language-neutral symbols', async () => {
    const out = await lintFiles({
      [COMPONENT]: `import { useTranslations } from '@i18n/client';
export const A = () => <p>Hello</p>;
export const B = () => { const t = useTranslations('shop'); return <p>{t('title')}…</p>; };
`,
    });
    expect(out[COMPONENT]!.filter((m) => m.startsWith('[react/jsx-no-literals]'))).toHaveLength(1);
  });

  it('rejects locale formatting outside the request-bound formatters', async () => {
    const out = await lintFiles({
      [COMPONENT]:
        "import { formatDate } from '@lib/utils';\nexport const f = (d: Date) => formatDate(d, 'en', 'UTC');\n",
      'src/app/[locale]/page.tsx':
        "import { formatNumber } from '@lib/utils/number';\nexport const f = (n: number) => formatNumber(n, 'en');\n",
    });
    expect(out[COMPONENT]!.join('\n')).toMatch(/Format through getAppFormatters/);
    expect(out['src/app/[locale]/page.tsx']!.join('\n')).toMatch(/Format through getAppFormatters/);
  });

  it('keeps the error message, stack and cause out of error boundaries', async () => {
    const out = await lintFiles({
      'src/app/[locale]/error.tsx':
        "'use client';\nexport default function E({ error }: { error: Error }) { return <p>{error.message}</p>; }\n",
    });
    expect(out['src/app/[locale]/error.tsx']!.join('\n')).toMatch(/never render the error message/);
  });
});

describe('React, accessibility and Next.js rules', () => {
  it('lets the primitives themselves use raw elements', async () => {
    const out = await lintFiles({
      'src/components/ui/button.tsx':
        'export const B = ({ label }: { label: string }) => <button type="button">{label}</button>;\n',
    });
    expect(out['src/components/ui/button.tsx']).toEqual([]);
  });

  it('rejects dangerouslySetInnerHTML and unsafe external links', async () => {
    const out = await lintFiles({
      [COMPONENT]: `import { Link } from '@i18n';
export const A = ({ html }: { html: string }) => (
  <div>
    <p dangerouslySetInnerHTML={{ __html: html }} />
    <Link href="https://example.com" target="_blank">out</Link>
  </div>
);
`,
    });
    const text = out[COMPONENT]!.join('\n');
    expect(text).toMatch(/react\/no-danger/);
    expect(text).toMatch(/react\/jsx-no-target-blank/);
  });

  it('applies accessibility checks to OUR components: icon-only controls need a name, images need alt', async () => {
    const out = await lintFiles({
      [COMPONENT]: `import { Button } from '@components/ui/button';
import { Link } from '@i18n';
import Image from 'next/image';
export const A = () => (
  <div>
    <Button><svg aria-hidden="true" /></Button>
    <Link href="/x"><svg aria-hidden="true" /></Link>
    <Image src="/a.png" width={1} height={1} />
    <Button aria-label="Close"><svg aria-hidden="true" /></Button>
    <Image src="/a.png" width={1} height={1} alt="" />
  </div>
);
`,
    });
    const text = out[COMPONENT]!.join('\n');
    expect(text.match(/control-has-associated-label/g)).toHaveLength(2); // the two unnamed controls, not the labelled one
    expect(text.match(/jsx-a11y\/alt-text/g)).toHaveLength(1); // the image without alt, not the decorative alt=""
  });

  it('keeps the strict jsx-a11y rules active', async () => {
    const out = await lintFiles({
      [COMPONENT]: 'export const A = () => (<div onClick={() => undefined}>x</div>);\n',
    });
    expect(out[COMPONENT]!.join('\n')).toMatch(
      /jsx-a11y\/(?:click-events-have-key-events|no-static-element-interactions)/,
    );
  });

  it('applies the React Hooks rules', async () => {
    const out = await lintFiles({
      [COMPONENT]:
        "import { useState } from 'react';\nexport function A({ ok }: { ok: boolean }) { if (ok) { useState(0); } return null; }\n",
    });
    expect(out[COMPONENT]!.join('\n')).toMatch(/react-hooks\/rules-of-hooks/);
  });
});

describe('ESLint core correctness rules', () => {
  it('reports eval, new Function, loose equality, debugger and missing braces', async () => {
    const out = await lintFiles({
      'src/lib/utils/x.ts':
        'export function f(a: unknown) {\n  debugger;\n  if (a == null) return 1;\n  eval("1");\n  return new Function("return 1");\n}\n',
    });
    const text = out['src/lib/utils/x.ts']!.join('\n');
    for (const rule of ['no-debugger', 'eqeqeq', 'curly', 'no-eval', 'no-new-func']) {
      expect(text).toContain(`[${rule}]`);
    }
  });

  it('keeps `curly` enabled AFTER eslint-config-prettier (which would otherwise switch it off)', async () => {
    const config = (await import('../../eslint.config.mjs')).default as Array<{
      rules?: Record<string, unknown>;
    }>;
    const lastCurly = [...config].reverse().find((block) => block.rules && 'curly' in block.rules);
    expect(lastCurly?.rules?.['curly']).toEqual(['error', 'all']);
  });
});

describe('locale formatting in presentation code', () => {
  const HOOK = 'src/modules/shop/presentation/hooks/use-price.ts';
  const COMPONENT_FILE = 'src/modules/shop/presentation/components/price.tsx';

  it('rejects hand-built Intl formatters and toLocale*String in presentation code', async () => {
    const out = await lintFiles({
      [HOOK]: "export const a = new Intl.NumberFormat('de').format(1);\n",
      [COMPONENT_FILE]:
        'export const Price = ({ date }: { date: Date }) => <p>{date.toLocaleDateString()}</p>;\n',
    });
    expect(out[HOOK]!.join('\n')).toMatch(/useAppFormatters/);
    expect(out[COMPONENT_FILE]!.join('\n')).toMatch(/toLocale\*String/);
  });

  it('allows non-formatting Intl use such as reading the browser time zone', async () => {
    const out = await lintFiles({
      [HOOK]: 'export const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;\n',
    });
    expect(out[HOOK]!.join('\n')).not.toMatch(/useAppFormatters/);
  });
});

describe('zod stays in the presentation layer', () => {
  const ZOD_IMPORT = "import { z } from 'zod';\nexport const schema = z.string();\n";

  it.each(['domain', 'application', 'infrastructure'])(
    'rejects zod in a module %s file',
    async (layer) => {
      const file = `src/modules/shop/${layer}/thing.ts`;
      const out = await lintFiles({ [file]: ZOD_IMPORT });
      expect(out[file]!.join('\n')).toMatch(/Zod belongs to the presentation layer/);
    },
  );

  it('allows zod in presentation schemas', async () => {
    const file = 'src/modules/shop/presentation/schemas/thing-schema.ts';
    const out = await lintFiles({ [file]: ZOD_IMPORT });
    expect(out[file]!.join('\n')).not.toMatch(/Zod belongs/);
  });
});

describe('raw HTML', () => {
  it('forbids dangerouslySetInnerHTML in every source folder', async () => {
    const html = 'export const A = () => <div dangerouslySetInnerHTML={{ __html: "x" }} />;\n';
    const out = await lintFiles({
      'src/components/shared/a.tsx': html,
      'src/modules/shop/presentation/components/b.tsx': html,
      'src/app/error.tsx': html,
    });
    for (const file of Object.keys(out)) {
      expect(out[file]!.join('\n')).toMatch(/Do not render raw HTML/);
    }
  });
});
