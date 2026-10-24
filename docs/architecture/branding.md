# Brand identity and assets

The identity follows the supplied owl reference: Hort.ai in chestnut brown, an amber smile, a brown owl with a cream face, a blue book and an amber backpack. The application artwork is an SVG adaptation of that reference. Its editable sources live in `public/brand/`. The background uses warm paper and layered peach hills; it contains no buildings.

## Sources of truth

- `src/app/globals.css` owns interface colors, typography, surfaces, shadows, focus and motion. Status colors retain their established meaning. Background worlds change atmosphere only.
- `src/lib/config/app-identity.ts` owns the displayed brand name and asset URLs. Its literal colors are pinned to CSS by tests and feed email, metadata and the manifest.
- `public/brand/owl.svg` owns the owl geometry and the `hello`, `think`, `happy`, `oops` and `mail` expressions. `Lumi` composes the referenced SVG groups; mail replaces the book with an envelope. Decorative poses stay hidden from assistive technology. A meaningful use can supply a label. Ambient motion uses the existing reduced-motion and calm-mode rules.
- `public/brand/wordmark.svg` contains outlined lettering and the amber smile. It requires no installed fonts to render.

## Asset generation

Run `npm run brand:generate` after changing either SVG source. The script uses Sharp already installed by Next.js and generates:

| Asset                                       | Purpose                                                    |
| ------------------------------------------- | ---------------------------------------------------------- |
| `public/brand/logo.svg`                     | Owl and wordmark used by the shared logo component         |
| `src/app/icon.svg`                          | Scalable browser icon                                      |
| `src/app/favicon.ico`                       | 16, 32 and 48 pixel PNG frames for browser compatibility   |
| `src/app/apple-icon.png`                    | Opaque 180 pixel Apple home-screen artwork                 |
| `public/brand/icon-192.png`, `icon-512.png` | Standard installation icons                                |
| `public/brand/icon-maskable-512.png`        | Full-bleed icon with the owl inside the mask-safe area     |
| `public/email/hortai.png`                   | Transparent 496 × 160 logo, displayed at 248 × 80 in email |
| `public/brand/social.png`                   | 1200 × 630 image for Open Graph and Twitter previews       |

The Next.js metadata file conventions attach the browser and Apple icons. `src/app/manifest.ts` supplies application identity and installation icons; it adds no offline cache or service worker. The locale layout and shared metadata builder supply social images. The shared email renderer uses an absolute image URL from the configured application origin, with alt text and a text-only email alternative.

## Fonts and verification

Fredoka supplies headings, Nunito supplies body text, and Atkinson Hyperlegible supplies readable mode. Only their four loaded WOFF2 files ship. Geist and Inter are unused and were removed.

Brand tests verify asset existence and dimensions, all five owl expressions, font inventory, the CSS/config identity contract, and WCAG contrast for text, controls and focus. Shared library changes retain their required coverage. Playwright checks rendered artwork, responsive authentication pages, metadata links, image delivery and reduced-motion behavior.
