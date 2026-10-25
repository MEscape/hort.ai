'use client';

import { useId, useRef, useState, useTransition } from 'react';
import type { SubmitEvent } from 'react';

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

/** File lifecycle and feedback for one class; signed storage URLs stay on the server. */
export function useTeacherMaterial(classroomId: string) {
  const t = useTranslations('teacherMaterial.section');
  const format = useAppFormatters();
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState('');
  const maxSize = format.bytes(MAX_BYTES, 0);

  const upload = (event: SubmitEvent<HTMLFormElement>) => {
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
      try {
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
      } catch {
        setError('generic');
      }
    });
  };

  const remove = (material: MaterialView) => {
    setNotice('');
    startTransition(async () => {
      try {
        const result = await deleteMaterialAction({ id: material.id });
        if (!result.ok) {
          setError('generic');
          return;
        }
        setError(null);
        setNotice(t('deleted', { title: material.title }));
        router.refresh();
      } catch {
        setError('generic');
      }
    });
  };

  return { t, format, id, inputRef, isPending, error, setError, notice, maxSize, upload, remove };
}
