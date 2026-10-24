# Fonts

Self-hosted, loaded once in `src/lib/fonts/fonts.ts` with `next/font/local` and exposed as the CSS variables the design tokens in `src/app/globals.css` use.

| Folder                | Family                | Used for                                  | Files                          | License |
| --------------------- | --------------------- | ----------------------------------------- | ------------------------------ | ------- |
| `fredoka/`            | Fredoka               | Headings (`--font-fredoka`)               | variable, weights 300-700      | OFL-1.1 |
| `nunito/`             | Nunito                | Body text (`--font-nunito`)               | variable, weights 200-1000     | OFL-1.1 |
| `atkinson-hyperlegible/` | Atkinson Hyperlegible | Readable mode (`--font-atkinson`)      | Regular 400, Bold 700          | OFL-1.1 |

The files are the Latin subset (enough for English and German) taken from the Fontsource packages `@fontsource-variable/fredoka`, `@fontsource-variable/nunito` and `@fontsource/atkinson-hyperlegible`. To add a language that needs more glyphs, add the matching `latin-ext` file and a second `src` entry.

Only these four font files ship. The unused Geist and Inter families were removed. Atkinson remains an active dependency of the readable accessibility mode, even when the default theme uses Fredoka and Nunito.
