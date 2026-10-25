/** Teacher-facing metadata: no object key, tenant, owner, or upload credential. */
export interface MaterialView {
  readonly id: string;
  readonly classroomId: string;
  readonly title: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly status: string;
}
