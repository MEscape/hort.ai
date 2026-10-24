import { invalid, ruleTester, rules, valid } from './rule-tester';

const ACTION = 'src/modules/shop/presentation/actions/create-shop-action.ts';
const DTO = 'src/modules/shop/presentation/dto/shop-dto.ts';
const FORM = 'src/modules/shop/presentation/components/create-shop-form.tsx';
const KEYS = 'src/modules/shop/presentation/messages/message-keys.ts';

const GOOD_ACTION = `'use server';
import { revalidatePath } from 'next/cache';
import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';
import { shopCommands } from '../../composition';
import { toShopDto } from '../dto/shop-dto';
import { shopRoutes } from '../routes';
import { parseShopInput } from '../schemas/parse-shop-input';
import { newShopSchema } from '../schemas/new-shop-schema';
export async function createShopAction(input: unknown): Promise<ActionResult<ShopDto>> {
  const result = await parseShopInput(newShopSchema, input).asyncAndThen((command) => shopCommands.createShop.execute(command));
  if (result.isOk()) revalidatePath(shopRoutes.list());
  return toActionResult(result.map(toShopDto));
}`;

ruleTester.run('architecture/action-contract', rules['action-contract']!, {
  valid: [
    valid(ACTION, GOOD_ACTION),
    // void result: no DTO conversion required; callback-style invalidation after success
    valid(
      'src/modules/shop/presentation/actions/delete-shop-action.ts',
      GOOD_ACTION.replace('Promise<ActionResult<ShopDto>>', 'Promise<ActionResult<void>>')
        .replace('toActionResult(result.map(toShopDto))', 'toActionResult(result)')
        .replace("import { toShopDto } from '../dto/shop-dto';\n", ''),
    ),
    valid(
      ACTION,
      GOOD_ACTION.replace('  if (result.isOk()) revalidatePath(shopRoutes.list());\n', '')
        .replace(
          'execute(command))',
          'execute(command)).then((r) => r.map((v) => { revalidatePath(shopRoutes.list()); return v; }))',
        )
        .replace('.then((r) => r.map((v) =>', '.then((r) => r.map((v) =>'),
    ),
    valid('src/modules/shop/presentation/components/x.tsx', "import { z } from 'zod';"), // not an action file
  ],
  invalid: [
    invalid(
      ACTION,
      GOOD_ACTION.replace("'use server';\n", ''),
      /starts with the 'use server' directive/,
    ),
    invalid(
      ACTION,
      `${GOOD_ACTION}\nexport const LIMIT = 3;`,
      /may only export `async function` actions/,
    ),
    invalid(
      ACTION,
      GOOD_ACTION.replace('input: unknown', 'input: NewShopInput'),
      /must accept untrusted input as `unknown`/,
    ),
    invalid(
      ACTION,
      GOOD_ACTION.replace('Promise<ActionResult<ShopDto>>', 'Promise<ShopDto>'),
      /returns `Promise<ActionResult<T>>`/,
    ),
    invalid(
      ACTION,
      GOOD_ACTION.replace(
        'import { revalidatePath }',
        "import { z } from 'zod';\nimport { revalidatePath }",
      ),
      /Do not use Zod directly in an action/,
    ),
    invalid(
      ACTION,
      GOOD_ACTION.replace(
        'await parseShopInput(newShopSchema, input).asyncAndThen',
        'await newShopSchema.safeParse(input) && await ok(input).asyncAndThen',
      ),
      /never calls the module's `parse<Module>Input/,
      /Do not call `\.safeParse\(\)` in an action/,
    ),
    invalid(
      ACTION,
      GOOD_ACTION.replace(
        "import { parseShopInput } from '../schemas/parse-shop-input';",
        "import { parseShopInput } from '../util';",
      ),
      /Import `parseShopInput` from the module's presentation\/schemas\/parse-<module>-input/,
    ),
    invalid(
      ACTION,
      GOOD_ACTION.replace('shopCommands.createShop.execute(command)', 'save(command)'),
      /must call a use case through the module's composition root/,
    ),
    invalid(
      ACTION,
      GOOD_ACTION.replace(
        'if (result.isOk()) revalidatePath(shopRoutes.list());',
        'revalidatePath(shopRoutes.list());',
      ),
      /only after a successful mutation/,
    ),
    // handing back the raw result, or hand-building the envelope, bypasses the one serializer
    invalid(
      ACTION,
      GOOD_ACTION.replace('toActionResult(result.map(toShopDto))', 'result'),
      /must return `toActionResult\(result…\)`/,
    ),
    invalid(
      ACTION,
      GOOD_ACTION.replace(
        'toActionResult(result.map(toShopDto))',
        '({ ok: result.isOk(), data: null })',
      ),
      /Do not hand-build `\{ ok, error \}` objects/,
    ),
    // an application view must be converted to its DTO before it crosses the action boundary
    invalid(
      ACTION,
      GOOD_ACTION.replace(
        'Promise<ActionResult<ShopDto>>',
        'Promise<ActionResult<ShopView>>',
      ).replace('toActionResult(result.map(toShopDto))', 'toActionResult(result)'),
      /returns the application view `ShopView`.*Map it to a `…Dto`/,
    ),
    invalid(
      ACTION,
      GOOD_ACTION.replace('export async function', 'export default async function'),
      /Use a named export|may only export `async function`/,
    ),
  ],
});

ruleTester.run('architecture/dto-serialization', rules['dto-serialization']!, {
  valid: [
    valid(DTO, 'export interface ShopDto { readonly id: string; readonly name: string; }'),
    valid(
      DTO,
      `export interface ShopDto { readonly id: string; readonly createdAt: string; }
export function toShopDto(view: ShopView): ShopDto {
  return { id: view.id, createdAt: view.createdAt.toISOString() };
}`,
    ),
    valid(DTO, 'export function helper(view: V) { return { ...view, at: new Date() }; }'), // not a to…Dto mapper
  ],
  invalid: [
    invalid(
      DTO,
      'export interface ShopDto { readonly createdAt: Date; }\nexport function toShopDto(v: V): ShopDto { return v; }',
      /contains a `Date`\. Serialised DTOs carry dates as ISO-8601 strings/,
    ),
    // a DTO derived from an application view needs its mapper; one an action assembles inline does not
    invalid(
      DTO,
      "import type { ShopView } from '../../application/contracts/shop-views';\nexport interface ShopDto { readonly id: string; }",
      /needs an exported mapper `toShopDto\(view\): ShopDto`/,
    ),
    invalid(
      DTO,
      'export interface ShopDto { id: string }\nexport function toShopDto(v: V) { return { id: v.id }; }',
      /Annotate the return type of `toShopDto`/,
    ),
    invalid(
      DTO,
      'export interface ShopDto { id: string }\nexport function toShopDto(v: V): ShopDto { return { ...v }; }',
      /Do not spread a view\/record into a DTO/,
    ),
    invalid(
      DTO,
      'export interface ShopDto { at: string }\nexport function toShopDto(v: V): ShopDto { return { at: v.at.toLocaleString() }; }',
      /Serialise dates with `toISOString\(\)`.*toLocaleString/,
    ),
    invalid(
      DTO,
      'export interface ShopDto { at: string }\nexport function toShopDto(v: V): ShopDto { return { at: new Date(v.at).toISOString() }; }',
      /does not create them/,
    ),
  ],
});

const GOOD_FORM = `'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { applyActionError } from '@lib/actions';
import { fieldPath, ROOT_FIELD } from '@lib/errors';
import { createShopAction } from '../actions/create-shop-action';
export function CreateShopForm() {
  const form = useForm({ resolver: zodResolver(newShopSchema) });
  const onSubmit = async (values) => {
    const result = await createShopAction(values);
    if (!result.ok) {
      const code = applyActionError(result.error, form.setError);
      if (code !== null) form.setError(ROOT_FIELD, { message: code });
    }
  };
  return <input {...form.register('name')} />;
}`;

ruleTester.run('architecture/form-conventions', rules['form-conventions']!, {
  valid: [
    valid(FORM, GOOD_FORM),
    // static field names stay plain; dynamic nesting goes through fieldPath()
    valid(FORM, GOOD_FORM.replace("form.register('name')", "form.register('theme.primary')")),
    valid(
      FORM,
      GOOD_FORM.replace(
        "form.register('name')",
        'form.register(fieldPath(section, index, "title"))',
      ),
    ),
    valid(
      'src/modules/shop/presentation/components/plain.tsx',
      'export const A = () => <p>no form</p>;',
    ),
  ],
  invalid: [
    invalid(
      FORM,
      GOOD_FORM.replace('useForm({ resolver: zodResolver(newShopSchema) })', 'useForm()'),
      /useForm\(\{ resolver: zodResolver\(<schema>\) \}\)/,
    ),
    invalid(
      FORM,
      GOOD_FORM.replace(
        "import { useForm } from 'react-hook-form';",
        "import { useForm } from './my-form';",
      ),
      /Import `useForm` from 'react-hook-form'/,
    ),
    invalid(
      FORM,
      GOOD_FORM.replace("'@hookform/resolvers/zod'", "'./resolver'"),
      /`zodResolver` comes from '@hookform\/resolvers\/zod'/,
    ),
    invalid(
      FORM,
      GOOD_FORM.replace(
        'const code = applyActionError(result.error, form.setError);\n      if (code !== null) form.setError(ROOT_FIELD, { message: code });',
        'form.setError("name", { message: "x" });',
      ),
      /must route failures through `applyActionError/,
    ),
    invalid(
      FORM,
      GOOD_FORM.replace(
        'applyActionError(result.error, form.setError);',
        'Object.entries(result.error.fieldErrors ?? {});',
      ),
      /must route failures through `applyActionError/,
      /Do not re-implement server-error routing/,
    ),
    invalid(
      FORM,
      GOOD_FORM.replace('form.setError(ROOT_FIELD,', "form.setError('_form',"),
      /Use `ROOT_FIELD`/,
    ),
    invalid(
      FORM,
      GOOD_FORM.replace("form.register('name')", 'form.register(`${section}.${index}.title`)'),
      /Build nested dotted field names with `fieldPath/,
    ),
    invalid(
      FORM,
      GOOD_FORM.replace("form.register('name')", "form.register(parts.join('.'))"),
      /Build nested dotted field names with `fieldPath/,
    ),
    invalid(
      FORM,
      GOOD_FORM.replace(
        "<input {...form.register('name')} />",
        '<Field name={`items.${index}.name`} />',
      ),
      /Use `fieldPath\(\.\.\.\)`/,
    ),
  ],
});

ruleTester.run('architecture/message-key-coverage', rules['message-key-coverage']!, {
  valid: [
    valid(
      KEYS,
      `export const MESSAGE_KEY_BY_CODE = { [ERRORS.notFound]: 'errors.notFound', [VALIDATION.nameTooShort]: 'validation.nameTooShort' } as const satisfies Record<ShopCode, string>;
export const GENERIC_ERROR_MESSAGE_KEY = 'errors.generic';
export function messageKeyForCode(code: string) { return Object.hasOwn(MESSAGE_KEY_BY_CODE, code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY; }
export const TEMPLATE_MESSAGE_KEYS = { a: { label: 'templates.a.label' } } as const satisfies Record<K, { label: string }>;`,
    ),
    valid('src/modules/shop/presentation/messages/other.ts', 'export const X = { a: "b c" };'), // only message-keys.ts is policed
  ],
  invalid: [
    invalid(
      KEYS,
      "export const GENERIC_ERROR_MESSAGE_KEY = 'errors.generic';\nexport function messageKeyForCode(code: string) { return GENERIC_ERROR_MESSAGE_KEY; }",
      /Export `MESSAGE_KEY_BY_CODE`/,
    ),
    invalid(
      KEYS,
      `export const MESSAGE_KEY_BY_CODE = { a: 'errors.a' } as const;
export const GENERIC_ERROR_MESSAGE_KEY = 'errors.generic';
export function messageKeyForCode(code: string) { return GENERIC_ERROR_MESSAGE_KEY; }`,
      /must end with `as const satisfies Record/,
    ),
    invalid(
      KEYS,
      `export const MESSAGE_KEY_BY_CODE = { a: 'The shop was not found.' } as const satisfies Record<C, string>;
export const GENERIC_ERROR_MESSAGE_KEY = 'errors.generic';
export function messageKeyForCode(code: string) { return GENERIC_ERROR_MESSAGE_KEY; }`,
      /'The shop was not found\.' is not a translation key/,
    ),
    invalid(
      KEYS,
      `export const MESSAGE_KEY_BY_CODE = { a: 'errors.a' } as const satisfies Record<C, string>;
export function messageKeyForCode(code: string) { return 'x.y'; }`,
      /Export `GENERIC_ERROR_MESSAGE_KEY`/,
      /must fall back to `GENERIC_ERROR_MESSAGE_KEY`/,
    ),
    invalid(
      KEYS,
      `export const MESSAGE_KEY_BY_CODE = { a: 'errors.a' } as const satisfies Record<C, string>;
export const GENERIC_ERROR_MESSAGE_KEY = 'errors.generic';`,
      /Export `messageKeyForCode/,
    ),
  ],
});

ruleTester.run('architecture/route-usage', rules['route-usage']!, {
  valid: [
    valid(ACTION, 'revalidatePath(shopRoutes.list());'),
    valid(FORM, 'router.push(shopRoutes.builder(id));'),
    valid(FORM, "router.push('/');"), // the root is not a module-owned template
    valid(FORM, 'const a = <a href="https://example.com/x">ext</a>;'),
    valid(
      'src/modules/shop/presentation/routes.ts',
      "export const shopRoutes = { list: () => '/shops' } as const;",
    ), // routes.ts is where templates live
  ],
  invalid: [
    invalid(
      ACTION,
      "revalidatePath('/shops');",
      /Do not hard-code an internal path\. Use the canonical route helper from presentation\/routes\.ts \(e\.g\. `shopRoutes\.detail\(id\)`\)/,
    ),
    invalid(ACTION, 'revalidatePath(`/shops/${id}`);', /Do not hard-code an internal path/),
    invalid(FORM, "router.push('/shops/new');", /Do not hard-code an internal path/),
    invalid(FORM, 'redirect(`/shops/${id}/builder`);', /Do not hard-code an internal path/),
    invalid(
      FORM,
      'const l = <Link href="/shops">list</Link>;',
      /Do not hard-code an internal path/,
    ),
    invalid(
      FORM,
      'const l = <Link href={`/shops/${id}`}>x</Link>;',
      /Do not hard-code an internal path/,
    ),
  ],
});

const FORM_FILE = 'src/modules/shops/presentation/components/shop-form.tsx';

ruleTester.run('architecture/unsaved-work-guard', rules['unsaved-work-guard']!, {
  valid: [
    valid(
      FORM_FILE,
      "import { useForm } from 'react-hook-form';\nexport function ShopForm() { useForm(); useReportUnsavedChanges('shop', true); return null; }",
    ),
    valid(
      FORM_FILE,
      'export function ShopForm() { useForm(); useUnsavedNavigationGuard(true); useBeforeUnloadGuard(true); return null; }',
    ),
    valid(
      FORM_FILE,
      '// @unsaved-work none one field, nothing to lose\nexport function ShopForm() { useForm(); return null; }',
    ),
    // no form, no guard needed
    valid(FORM_FILE, 'export function ShopButton() { return null; }'),
    // only module components are checked
    valid('src/components/shared/thing.tsx', 'export function Thing() { useForm(); return null; }'),
  ],
  invalid: [
    invalid(
      FORM_FILE,
      'export function ShopForm() { useForm(); return null; }',
      /can lose unsaved work/,
    ),
    // the opt-out needs a reason
    invalid(
      FORM_FILE,
      '// @unsaved-work none\nexport function ShopForm() { useForm(); return null; }',
      /can lose unsaved work/,
    ),
  ],
});
