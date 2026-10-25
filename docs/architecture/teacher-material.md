# Private teacher material (#29)

Depends on #8 (TeacherMaterial/MaterialSection), #32 (classroom ownership and membership) and #28 (curriculum extraction/retrieval). No schema change or dependency installation.

## Public integration

- Server API: `materialCommands.beginMaterialUpload.execute({ classroomId, title, contentType: 'text/plain', sizeBytes })` returns `{ materialId, upload }`. A teacher must own the active class. The material row exists **before** the private upload is signed. The key is `classes/<stored-class-id>/materials/<generated-material-id>`, never a filename.
- PUT the UTF-8 file to `upload.url` with precisely `upload.headers`. URLs are bearer credentials, returned once, never persisted/logged, expire after 60 seconds.
- `materialCommands.completeMaterialUpload.execute(materialId)` confirms size and MIME with ObjectStore.head, sniffs ObjectStore.readStart, and reads private bytes through a signed, timed, streaming-capped GET. Both the sniff and the final bytes reject binary signatures/controls and invalid UTF-8. The full read must match the declared size. The 10 MiB maximum bounds storage and extraction work; extraction also caps statements to 1,000. Empty/no-statement documents fail.
- `materialQueries.listMaterials.execute(classroomId)` returns the newest 100 nondeleted metadata rows. `getMaterialReadUrl.execute(materialId)` gives the owner a 60-second private read capability for processed files only.
- `materialCommands.deleteMaterial.execute(materialId)` transactionally tombstones the material and deletes all its sections, then removes its object. Cleanup failure is retryable using the same ID; retrieval is already disabled. No separate official Competency rows are created for teacher material.
- Browser integration uses `@modules/teacher-material/client`: beginMaterialUploadAction, completeMaterialUploadAction and deleteMaterialAction. The existing UI team's screens can call these; this backend change does not duplicate their teacher UI. Lists are not cached, so no cache invalidation is required.

## Ingest and child grounding

`CurriculumMaterialIngest` reuses `curriculumText.extractStatements`, the **same** cleaner, length bounds, section/page parsing and untrusted-data contract as official curriculum ingest. Statements live in MaterialSection, never in global official curriculum tables. They remain untrusted data for the AI; they must not be interpolated into prompt instructions (see curriculum.md).

Retrieval through `curriculumQueries.findRelevantCompetencies` additionally accepts `childProfileId`. Private material is fail-closed without it. `ClassroomTeacherMaterialSource` calls #32's authorized getChildClassroom and compares the actual membership against the requested classroom. Its SQL projection rechecks the child owner/tenant and current membership, active classroom and PROCESSED materials in one nested query snapshot. A guessed class, a different child/class, a missing membership or deleted/failed/pending material provides no private grounding. Official curriculum retrieval remains compatible without child context.

The read-only curriculum projection intentionally reads MaterialSection and classroom membership through relations; it starts from an owner/tenant-scoped child profile. Mutations remain in the owning teacher-material module. This avoids a circular runtime dependency between curriculum and teacher-material.

## Lifecycle and concurrency

UPLOADED is also the pending upload state because #8 has no separate PENDING status. PROCESSED is published using atomic `updateAndCount WHERE status=UPLOADED` in the same transaction as section creation. Deletion cannot be undone by a late completion. Failed extraction marks FAILED and attempts object cleanup. Deleted metadata is retained for cleanup retries and audit traceability; file bytes and derived sections are removed.

An already issued SAS cannot be revoked individually: it can be replayed until its short expiry, even after deletion. This never re-enables grounding, which reads immutable processed sections and the DB status, not blob bytes. Retry delete after the capability expires if physical cleanup races an outstanding PUT. Previously issued read URLs likewise expire within 60 seconds.

## Explicit limitations / verification

- **PDF extraction is not implemented.** No PDF parser is present in the existing node_modules; dependencies must not be added for this task. PDF is rejected before upload rather than silently treated as text. Only UTF-8 TXT is supported in this PR.
- No real Azurite/Postgres upload was possible on this host: `docker` is not installed. Storage and repository integration need a configured local/CI environment; unit tests use port fakes and the real curriculum extraction/ranking pipeline.
- Vercel-Prüfung und Integration des gesamten Stapels in main übernimmt der Lead. Frühere `BUILD_FAILED: Resource provisioning failed`-Meldungen traten vor dem Build auf und sind kein Beleg für einen Codefehler oder einen erfolgreichen Build.
