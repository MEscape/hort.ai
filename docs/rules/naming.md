# Naming Rules

- Use kebab-case for files and directories, including component files, except framework-reserved names such as page.tsx, layout.tsx, route.ts, and proxy.ts.
- Use camelCase for variables, parameters, functions, and methods.
- Use PascalCase for classes, React components, types, interfaces, and enums.
- Use UPPER_SNAKE_CASE for compile-time constants and environment variables.
- Name Zod schemas in camelCase with a Schema suffix; inferred types drop the suffix (createUserSchema → CreateUser).
- Name booleans as predicates: isActive, hasAccess, canEdit.
- Prefix event handler props with on and implementations with handle.
- Prefix custom hooks with use.
- Do not prefix interfaces with I or suffix types with Type.
- Add role suffixes when needed: .port.ts, .repository.ts, .schema.ts, .action.ts, .dto.ts, .test.ts.
- Keep one primary export per file and name the file after that export.
- Reserve index.ts for module public APIs. See [modules.md](modules.md).
- Name commands imperatively (CreateOrder) and queries for their result (GetOrderById).
- Name ports for capabilities (OrderRepository) and adapters for their technology (PrismaOrderRepository).
- Name errors for what happened (OrderNotFoundError). See [errors.md](errors.md).
- Use stable, semantic, dot-separated translation keys. See [i18n.md](i18n.md).
- Avoid vague names such as helpers, misc, common, manager, and data.
- Avoid abbreviations except widely understood ones such as id and url.
