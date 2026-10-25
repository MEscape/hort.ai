'use client';

import { useId, useRef, useState, useTransition } from 'react';

import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { TriangleAlert } from '@components/ui/icons';

import { useRouter } from '@i18n';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { deleteMaterialAction } from '../actions/delete-material-action';
import { uploadMaterialAction } from '../actions/upload-material-action';
import { MATERIAL_FORM_MAX_BYTES } from '../schemas/material-upload-schema';

import type { MaterialView } from '../../application/contracts/material-views';

const MAX_BYTES = MATERIAL_FORM_MAX_BYTES;
type ErrorKey =
  'noFile' | 'wrongType' | 'tooLarge' | 'invalidFile' | 'archived' | 'rateLimited' | 'generic';

function errorKeyFor(code: string, rateLimited: boolean): ErrorKey {
  if (code === 'teacher_material.validation_failed') {
    return 'invalidFile';
  }
  if (code === 'teacher_material.class_archived') {
    return 'archived';
  }
  return rateLimited ? 'rateLimited' : 'generic';
}

function isTextFile(file: File): boolean {
  return file.type === 'text/plain' || (file.type === '' && /\.txt$/i.test(file.name));
}

interface TeacherMaterialSectionProps {
  readonly classroomId: string;
  /** Loaded by the page for the class's own teacher; refreshed after every change. */
  readonly materials: readonly MaterialView[];
}

/** Upload, list and delete the teacher's own material for one class. */
export function TeacherMaterialSection({ classroomId, materials }: TeacherMaterialSectionProps) {
  const t = useTranslations('teacherMaterial.section');
  const format = useAppFormatters();
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState('');
  const maxSize = format.bytes(MAX_BYTES, 0);

  const upload = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    setNotice('');
    if (file === undefined) {
      setError('noFile');
      return;
    }
    if (!isTextFile(file)) {
      setError('wrongType');
      return;
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      setError(file.size === 0 ? 'invalidFile' : 'tooLarge');
      return;
    }
    const data = new FormData();
    data.set('classroomId', classroomId);
    data.set('file', file);
    startTransition(async () => {
      const result = await uploadMaterialAction(data);
      if (!result.ok) {
        setError(errorKeyFor(result.error.code, result.error.retryAfterSeconds !== undefined));
        router.refresh();
        return;
      }
      setError(null);
      setNotice(t('uploaded', { title: file.name.replace(/\.[^.]+$/, '') }));
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      router.refresh();
    });
  };

  const remove = (material: MaterialView) => {
    setNotice('');
    startTransition(async () => {
      const result = await deleteMaterialAction({ id: material.id });
      if (!result.ok) {
        setError('generic');
        return;
      }
      setError(null);
      setNotice(t('deleted', { title: material.title }));
      router.refresh();
    });
  };

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
            <label htmlFor={`${id}-file`} className="block font-semibold text-copy">
              {t('fileLabel')}
            </label>
            <input
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
