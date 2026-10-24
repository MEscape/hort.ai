# Styling Rules

- Use the project's design system as the source of visual truth.
- Prefer shared design tokens and UI primitives over hard-coded values or new primitives.
- Compose shared UI in module components; do not redefine shared primitives.
- Use the design system where it fits: Button, Select, Link, Table, Input, Textarea, and Label instead of raw elements; use required composites such as DataPanel around Table or ListPagination.
- Use plain markup only when justified in the file with // @ui-plain <name> <reason>. Use the element name, or table/list-pagination for a missing frame. Lint enforces architecture/ui-composition; src/components is exempt.
- Avoid global styles except application-wide foundations.
- Keep styles colocated with their components.
- Do not use inline styles for static styling.
- Prefer existing design tokens over arbitrary values.
- Keep responsive and theme behavior within design-system conventions.
- Type component variants explicitly.
- Do not duplicate CSS for visually identical components.
- Meet contrast and motion requirements. See [accessibility.md](accessibility.md).
