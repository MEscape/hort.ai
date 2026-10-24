import { invalid, ruleTester, rules, valid } from './rule-tester';

const MODULE = 'src/modules/shop/presentation/components/order-list.tsx';
const PAGE = 'src/app/[locale]/(protected)/orders/page.tsx';
const DESIGN_SYSTEM = 'src/components/shared/some-field.tsx';

ruleTester.run('architecture/ui-composition', rules['ui-composition']!, {
  valid: [
    // the components are what a screen uses
    valid(
      MODULE,
      "import { Button } from '@components/ui/button';\nexport const A = () => <Button>x</Button>;",
    ),
    // a reason makes plain markup a choice
    valid(
      MODULE,
      "// @ui-plain button a drag handle with its own focus ring\nexport const A = () => <button type='button'>x</button>;",
    ),
    valid(
      MODULE,
      '/* @ui-plain table a two-column key/value list inside a card, not a list of records */\nexport const A = () => <table><tbody /></table>;',
    ),
    // one reason per name; several names in one file are fine
    valid(
      MODULE,
      "// @ui-plain input a radio drawn as a card\n// @ui-plain label the card is the label\nexport const A = () => <label><input type='radio' /></label>;",
    ),
    // a hidden input draws nothing
    valid(MODULE, "export const A = () => <input type='hidden' name='page' value='2' />;"),
    // a primitive with its composite
    valid(
      MODULE,
      "import { DataPanel } from '@components/shared/data-panel';\nimport { Table } from '@components/ui/table';\nexport const A = () => <DataPanel title='x'><Table /></DataPanel>;",
    ),
    valid(
      MODULE,
      "import { DataPanel } from '@components/shared/data-panel';\nimport { ListPagination } from '@components/shared/list-pagination';\nexport const A = () => <DataPanel title='x' footer={<ListPagination />}>x</DataPanel>;",
    ),
    // a primitive's reason waives its pair too
    valid(
      MODULE,
      "// @ui-plain table one row of a panel that the parent draws\nimport { Table } from '@components/ui/table';\nexport const A = () => <Table />;",
    ),
    // a type import is not a use
    valid(
      MODULE,
      "import type { TableProps } from '@components/ui/table';\nexport type A = TableProps;",
    ),
    // the design system is built from the raw elements
    valid(DESIGN_SYSTEM, 'export const A = () => <label><input /></label>;'),
    valid('src/components/ui/button.tsx', 'export const B = () => <button />;'),
    // .ts files draw nothing
    valid('src/modules/shop/presentation/hooks/use-x.ts', 'export const x = 1;'),
  ],
  invalid: [
    invalid(
      MODULE,
      "export const A = () => <button type='button'>x</button>;",
      /Use `Button` from '@components\/ui\/button' instead of a raw <button> \(consistent focus, disabled and loading behavior\)\. If plain markup is right here, say why: \/\/ @ui-plain button <reason>/,
    ),
    invalid(PAGE, 'export default function P() { return <select />; }', /Use `Select` from/),
    invalid(
      MODULE,
      "export const A = () => <a href='/x'>y</a>;",
      /locale-aware `Link` from '@i18n'/,
    ),
    invalid(
      MODULE,
      'export const A = () => <table><tbody /></table>;',
      /Use the `Table` parts from '@components\/ui\/table' instead of a raw <table>/,
    ),
    invalid(
      MODULE,
      'export const A = () => <input />;',
      /Use `Input` from '@components\/ui\/input'/,
    ),
    invalid(MODULE, 'export const A = () => <textarea />;', /Use `Textarea` from/),
    invalid(MODULE, 'export const A = () => <label>x</label>;', /Use `Label` from/),
    // a reason is part of the tag: the bare word does not waive
    invalid(
      MODULE,
      '// @ui-plain button\nexport const A = () => <button type="button">x</button>;',
      /raw <button>/,
    ),
    // a reason for one name does not waive another
    invalid(
      MODULE,
      '// @ui-plain table a key/value card\nexport const A = () => <button type="button">x</button>;',
      /raw <button>/,
    ),
    invalid(
      MODULE,
      "import { Table } from '@components/ui/table';\nexport const A = () => <Table />;",
      /A table that is the subject of a screen sits in a DataPanel .* \/\/ @ui-plain table <reason>/,
    ),
    invalid(
      MODULE,
      "import { ListPagination } from '@components/shared/list-pagination';\nexport const A = () => <ListPagination />;",
      /ListPagination goes in the footer of a DataPanel\. Use it here, or say why not: \/\/ @ui-plain list-pagination <reason>/,
    ),
  ],
});
