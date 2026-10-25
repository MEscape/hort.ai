'use client';

import { useId } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { FormAlert } from '@components/shared/form-alert';
import { HortPanel } from '@components/shared/hort-panel';
import { SubmitButton } from '@components/shared/submit-button';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';
import { ShieldCheck } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { PARENT_ROLE, TEACHER_ROLE } from '../../application/contracts/auth-constraints';
import { useSignUpForm } from '../hooks/use-sign-up-form';
import { authRoutes } from '../routes';

import { AuthEmailField } from './auth-email-field';
import { AuthLink } from './auth-link';
import { NewPasswordFields } from './new-password-fields';
import { NextSteps } from './next-steps';

/** The roles one can register as; chosen once, here (#8). */
const ROLE_OPTIONS = [
  { role: PARENT_ROLE, label: 'signUp.roleParent', hint: 'signUp.roleParentHint' },
  { role: TEACHER_ROLE, label: 'signUp.roleTeacher', hint: 'signUp.roleTeacherHint' },
] as const;

/**
 * A parent or a teacher sets up an account (the role is chosen once, here): a name to greet them by, an address, a password Hort cheers for,
 * and helpful password guidance. The answer is the same whether or not the address already had an account, so the
 * form cannot be used to find out who is registered; it says "check your inbox" either way.
 */
export function SignUpForm() {
  const t = useTranslations('auth');
  const id = useId();
  const state = useSignUpForm();
  const { form, errorText, formError, watched, assessment, sentTo, isPending, mood } = state;
  const { errors, touchedFields } = form.formState;

  if (sentTo !== null) {
    return (
      <HortPanel
        mood="mail"
        shouldTakeFocus
        title={t('signUp.successTitle')}
        description={t('signUp.success', { email: sentTo })}
      >
        <NextSteps
          label={t('signUp.steps.label')}
          steps={[
            {
              title: t('signUp.steps.confirm.title'),
              description: t('signUp.steps.confirm.description'),
            },
            {
              title: t('signUp.steps.signIn.title'),
              description: t('signUp.steps.signIn.description'),
            },
          ]}
        />
        <p className="text-center text-copy-muted">{t('signUp.checkSpam')}</p>
        <Button asChild size="lg">
          <Link href={authRoutes.signIn()}>{t('signUp.toSignIn')}</Link>
        </Button>
      </HortPanel>
    );
  }

  return (
    <HortPanel
      mood={mood}
      title={t('signUp.title')}
      description={t('signUp.description')}
      footer={
        <>
          {t('signUp.haveAccount')}
          <AuthLink href={authRoutes.signIn()}>{t('signUp.signInLink')}</AuthLink>
        </>
      }
    >
      <form
        method="post"
        onSubmit={state.onSubmit}
        noValidate
        aria-busy={isPending}
        className="flex flex-col gap-5"
      >
        <fieldset disabled={isPending} className="flex min-w-0 flex-col gap-5">
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-2 text-base leading-snug font-semibold text-copy">
              {t('signUp.role')}
            </legend>
            {ROLE_OPTIONS.map((option) => (
              // @ui-plain label A radio choice: the design system has no radio group yet.
              <label
                key={option.role}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-[:checked]:border-primary"
              >
                {/* @ui-plain input A radio button; `Input` is a text field. */}
                <input
                  type="radio"
                  value={option.role}
                  className="mt-1 size-4 accent-primary"
                  aria-describedby={`${id}-role-${option.role}-hint`}
                  {...form.register('role')}
                />
                <span className="flex flex-col">
                  <span className="font-semibold text-copy">{t(option.label)}</span>
                  <span id={`${id}-role-${option.role}-hint`} className="text-copy-muted">
                    {t(option.hint)}
                  </span>
                </span>
              </label>
            ))}
            <FieldMessage id={`${id}-role-error`}>{errorText(errors.role?.message)}</FieldMessage>
          </fieldset>
          <TextField
            id={`${id}-name`}
            label={t('signUp.name')}
            hint={t('signUp.nameHint')}
            autoComplete="given-name"
            isValid={
              touchedFields.name === true && errors.name === undefined && watched.name.trim() !== ''
            }
            error={errorText(errors.name?.message)}
            {...form.register('name')}
          />
          <AuthEmailField
            id={`${id}-email`}
            label={t('signUp.email')}
            registration={form.register('email')}
            value={watched.email}
            error={errorText(errors.email?.message)}
            isTouched={touchedFields.email === true}
            onAccept={(accepted) => {
              form.setValue('email', accepted, { shouldDirty: true, shouldValidate: true });
            }}
          />
          <NewPasswordFields
            id={id}
            passwordLabel={t('signUp.password')}
            confirmLabel={t('signUp.confirmPassword')}
            passwordRegistration={form.register('password', {
              // The repeat is judged again when the password changes, once the person has been there.
              onChange: () => {
                if (touchedFields.confirmPassword === true) {
                  void form.trigger('confirmPassword');
                }
              },
            })}
            confirmRegistration={form.register('confirmPassword')}
            password={watched.password}
            confirmation={watched.confirmPassword}
            assessment={assessment}
            passwordError={errorText(errors.password?.message)}
            confirmError={errorText(errors.confirmPassword?.message)}
          />
          <FormAlert id={`${id}-form-error`} message={formError} />
          <SubmitButton
            isPending={isPending}
            label={t('signUp.submit')}
            pendingLabel={t('signUp.submitting')}
          />
          <p className="flex items-center justify-center gap-2 text-center text-copy-muted">
            <ShieldCheck className="size-5 shrink-0 text-secondary-copy" aria-hidden="true" />
            {t('signUp.safety')}
          </p>
        </fieldset>
      </form>
    </HortPanel>
  );
}
