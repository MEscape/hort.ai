# Adding a Translation

Owning rules: [`i18n.md`](../rules/i18n.md), [`naming.md`](../rules/naming.md), [`errors.md`](../rules/errors.md), [`accessibility.md`](../rules/accessibility.md).

Generator: `npm run gen -- translation <key> "<text>" [-m <module>] [--de "<text>"]` ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Add a key with a stable, semantic, dot-separated name in the owning namespace: the module's `presentation/i18n/<locale>.json`, or `src/i18n/<locale>.json` for framework entry points. See [`naming.md`](../rules/naming.md).
2. Add the key for every supported locale in the same change. A missing translation is a defect, not a follow-up task.
3. Use interpolation variables instead of string concatenation. Give translators the complete sentence and its placeholders so the sentence can be adapted to each language.
4. Use locale-aware APIs for dates, times, numbers, and currencies. Do not pre-format these values into translated strings.
5. For domain errors, keep stable error codes in the domain and map them to translation keys in presentation. See [`errors.md`](../rules/errors.md).
6. Reference keys statically wherever possible. Avoid constructing translation keys dynamically.
7. Pass only the messages needed by Client Components through `I18nProvider` namespaces.
8. Translate accessible names, including labels, alt text, and `aria-label` values. See [`accessibility.md`](../rules/accessibility.md).
9. Run `npm run i18n:check`.

## Scaffolding

`npm run gen -- translation <key> "<text>" [-m <module>] [--de "<text>"]` adds the key to every locale in one change.

Locales without an explicit `--<locale>` value receive a marked placeholder. Replace every placeholder with a proper translation before finishing.

See [`scripts/README.md`](../../scripts/README.md).

## Done when

- [ ] Every supported locale has the key and `npm run i18n:check` passes.
- [ ] Complete sentences use interpolation rather than concatenation.
- [ ] No hard-coded user-facing strings remain where translations are required.
- [ ] Accessible names and other user-facing accessibility text are translated.
- [ ] Date, time, number, and currency formatting is locale-aware.
