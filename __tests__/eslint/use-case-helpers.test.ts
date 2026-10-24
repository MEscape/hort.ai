import { invalid, ruleTester, rules, valid } from './rule-tester';

const COMMAND = 'src/modules/shop/application/commands/place-order.ts';
const QUERY = 'src/modules/shop/application/queries/get-order.ts';

const CLASS_WITH = (methods: number) => `
export class PlaceOrder {
  execute() { return 1; }
${Array.from({ length: methods }, (_, i) => `  private step${i}() { return ${i}; }`).join('\n')}
}`;

ruleTester.run('architecture/use-case-helpers', rules['use-case-helpers']!, {
  valid: [
    valid(COMMAND, CLASS_WITH(0)),
    valid(COMMAND, CLASS_WITH(3)),
    // functions beside the class count too, exported or not
    valid(
      QUERY,
      `export class GetOrder { execute() { return 1; } }
function one() { return 1; }
const two = () => 2;
export function three() { return 3; }`,
    ),
    // constants, types and interfaces are not helpers
    valid(
      COMMAND,
      `export class PlaceOrder { execute() { return 1; } }
const LIMIT = 5;
interface Closing { readonly a: number }
type Mode = 'a' | 'b';
const names = ['x'];`,
    ),
    // other folders are not use cases
    valid('src/modules/shop/application/services/load-order.ts', CLASS_WITH(6)),
  ],
  invalid: [
    invalid(
      COMMAND,
      CLASS_WITH(4),
      /This command has 4 local helpers \(at most 3\)\. Move them into application\/services/,
    ),
    invalid(
      QUERY,
      `export class GetOrder { execute() { return 1; } private a() { return 1; } }
function b() { return 1; }
const c = () => 2;
const d = function () { return 3; };`,
      /This query has 4 local helpers/,
    ),
    // a constructor and execute are the use case itself
    invalid(
      COMMAND,
      `export class PlaceOrder { constructor() {} execute() { return 1; } }
function a() { return 1; } function b() { return 1; } function c() { return 1; } function d() { return 1; }`,
      /has 4 local helpers/,
    ),
  ],
});
