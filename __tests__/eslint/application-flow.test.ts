import { invalid, ruleTester, rules, valid } from './rule-tester';

const SERVICE = 'src/modules/shop/application/services/load-order.ts';
const QUERY = 'src/modules/shop/application/queries/get-order.ts';
const COMMAND = 'src/modules/shop/application/commands/place-order.ts';

ruleTester.run('architecture/application-flow', rules['application-flow']!, {
  valid: [
    valid(
      SERVICE,
      "import { parse } from './parse-order';\nimport type { Order } from '../../domain/models/order';",
    ),
    valid(SERVICE, "import type { OrderView } from '../contracts/order-views';"),
    valid(COMMAND, "import { loadOrder } from '../services/load-order';"),
    valid(
      QUERY,
      "import { loadOrder } from '../services/load-order';\nimport { other } from './get-other';",
    ),
    // a command may build on another command's types
    valid(COMMAND, "import type { PlaceOrderError } from './cancel-order';"),
    // the rule reads the folder, not the file name: other layers are not its business
    valid(
      'src/modules/shop/presentation/actions/place-order-action.ts',
      "import { x } from '../../application/commands/place-order';",
    ),
  ],
  invalid: [
    invalid(
      SERVICE,
      "import { PlaceOrder } from '../commands/place-order';",
      /application\/services must not import application\/commands\. A service helps a use case/,
    ),
    invalid(
      SERVICE,
      "import type { GetOrder } from '../queries/get-order';",
      /application\/services must not import application\/queries/,
    ),
    invalid(
      QUERY,
      "import { PlaceOrder } from '../commands/place-order';",
      /application\/queries must not import application\/commands\. A query only reads/,
    ),
    invalid(
      SERVICE,
      "export { PlaceOrder } from '../commands/place-order';",
      /application\/services must not import application\/commands/,
    ),
  ],
});
