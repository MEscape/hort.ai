'use client';

import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { TriangleAlert } from '@components/ui/icons';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';

import { useTeacherMaterial } from '../hooks/use-teacher-material';

import type { MaterialView } from '../../application/contracts/material-views';

interface TeacherMaterialSectionProps {
  readonly classroomId: string;
  /** Loaded by the page for the class's own teacher; refreshed after every change. */
  readonly materials: readonly MaterialView[];
}

/** Upload, list and delete the teacher's own material for one class. */
export function TeacherMaterialSection({ classroomId, materials }: TeacherMaterialSectionProps) {
  const { t, format, id, inputRef, isPending, error, setError, notice, maxSize, upload, remove } =
    useTeacherMaterial(classroomId);

  return (
    <Card aria-labelledby={`${id}-title`}>
      <CardHeader>
        <h2 id={`${id}-title`} className="font-heading text-2xl text-copy">
          {t('title')}
        </h2>
        <p className="text-copy-muted">{t('description')}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={upload} noValidate aria-busy={isPending} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`${id}-file`} className="block font-semibold text-copy">
              {t('fileLabel')}
            </Label>
            <Input
              ref={inputRef}
              id={`${id}-file`}
              name="file"
              type="file"
              accept=".txt,text/plain"
              disabled={isPending}
              aria-describedby={`${id}-hint`}
              aria-invalid={error !== null && error !== 'generic' ? true : undefined}
              onChange={() => {
                setError(null);
              }}
              className="block w-full rounded-token-md border-2 border-border-strong bg-surface p-2 text-copy file:mr-3 file:rounded-token-sm file:border-0 file:bg-highlight file:px-3 file:py-2 file:font-semibold"
            />
            <p id={`${id}-hint`} className="text-sm text-copy-muted">
              {t('fileHint', { maxSize })}
            </p>
          </div>
          {error !== null && (
            <Alert variant="nudge" role="alert">
              <TriangleAlert aria-hidden="true" />
              <AlertDescription>{t(`errors.${error}`, { maxSize })}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? t('uploading') : t('upload')}
          </Button>
        </form>
        <p role="status" className="min-h-6 font-semibold text-primary-copy">
          {notice}
        </p>
        {materials.length === 0 ? (
          <p className="text-copy-muted">{t('empty')}</p>
        ) : (
          <ul aria-label={t('listLabel')} className="divide-y divide-border">
            {materials.map((material) => (
              <li
                key={material.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold break-words text-copy">{material.title}</p>
                  <p className="text-sm text-copy-muted">
                    {material.createdAt !== null &&
                      `${t('uploadedOn', { date: format.date(material.createdAt) })} · `}
                    <span>
                      {material.status === 'PROCESSED' ||
                      material.status === 'FAILED' ||
                      material.status === 'UPLOADED'
                        ? t(`status.${material.status}`)
                        : material.status}
                    </span>
                  </p>
                  {material.status === 'FAILED' && (
                    <p className="text-sm text-copy">{t('failedReason')}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  aria-label={t('deleteLabel', { title: material.title })}
                  onClick={() => {
                    remove(material);
                  }}
                >
                  {t('delete')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
