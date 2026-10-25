# Assignment UI foundation — issue #33

Development preview: `/de/dev/teacher-assignments` and `/en/dev/teacher-assignments`. The page and its metadata return `notFound()` outside development. No navigation, authentication grants, network operations or persistence are added.

This module currently needs only presentation code. The full module generator creates CRUD use cases, repositories and migrations, so those layers are intentionally deferred. Existing component and translation generators scaffold the UI and catalogs.

A single draft stays in React memory. Cancel/back requires confirmation when dirty; reload/document navigation is guarded. Preview/edit retains the draft. Explicit discard or leaving the page clears it. UI-only limits: title 120, task text 4,000, solution key 4,000 characters; due date is optional and validated as an ISO calendar date, then formatted in the current locale and time zone. These bounds must align with the future server contract.

`toChildAssignmentView` explicitly copies title, task text and due date. `ChildAssignmentPreview` accepts only this child-safe DTO. A solution key remains in the teacher editor and is never passed to child UI, browser storage, URLs, logs or network calls. Use dummy text in this unauthenticated development preview.

Backend handoff: add teacher identity/permissions and class ownership (#32) before create/list/edit/delete operations; authorize each operation server-side. Child selection (#12) must return only a separate child DTO, never the solution key. Keep due dates as calendar dates until their backend semantics are agreed. The registered task-text field can receive future transcript updates through React Hook Form's `setValue('taskText', text, { shouldDirty: true })`; no voice controls or APIs are added (#34).
