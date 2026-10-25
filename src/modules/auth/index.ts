/**
 * Server-side public API of the auth module. Other modules and framework
 * entry points import from here and nowhere deeper. Browser consumers use client.ts.
 *
 * Responsibilities: who is signed in (a parent or a teacher), and whether they may do what a use
 * case asks. Account details, child profiles and classes belong to other modules; they only receive
 * the authorization service and the ids and scopes below.
 */

export type { ActorId, TenantId } from './domain/models/ids';
/** Trusted brand constructors for record mappers of other modules (ids read back from storage). */
export { toActorId, toTenantId } from './domain/models/ids';
export { PERMISSIONS } from './domain/models/permission';
export type { Permission } from './domain/models/permission';
export type { ResourceScope } from './domain/models/authorize';
export type { Actor, AuditedActor } from './domain/models/actor';
export { auditedActor } from './domain/models/actor';
export { actorHasPermission } from './domain/models/authorize';

/** Authorization: every protected use case of every module receives this. */
export type { AuthorizationError, AuthorizationService } from './application/authorization-service';
export { getAccessControl, getAuthQueries, isAuthEnabled } from './composition';
export { getParentAreaServices } from './composition';
export { ParentAccessForm } from './presentation/components/parent-access-form';
export { ReturnToChildButton } from './presentation/components/return-to-child-button';
/** The Alexa demo coupling: a server-verified channel acting for one configured child only. */
export { runAsChildChannel } from './composition';

/**
 * The use cases a sign-in, sign-up, sign-out or password-reset screen calls, with the inputs and
 * error codes it needs. Server Actions in `presentation/actions` call them.
 *
 * @keep Public integration contract for server-side consumers.
 */
export { getAuthCommands } from './composition';
export type { RequestPasswordResetError } from './application/commands/request-password-reset';
export type { ResetPasswordError } from './application/commands/reset-password';
export type { SignInError } from './application/commands/sign-in';
export type { SignUpError } from './application/commands/sign-up';
export {
  AUTH_ERROR_CODES,
  AUTH_LINK_LIFETIME_SECONDS,
  AUTH_VALIDATION_CODES,
  CREDENTIAL_LIMITS,
  EMAIL_PATTERN,
  TEACHER_ROLE,
} from './application/contracts/auth-constraints';
export type { AuthCode } from './application/contracts/auth-constraints';
export type {
  PasswordResetInput,
  PasswordResetRequestInput,
  SignInInput,
  SignUpInput,
} from './application/contracts/auth-inputs';
export type { ActorView, Role } from './application/contracts/auth-views';

/** Framework entry points: the auth Route Handler (emailed links) and the addresses the interface serves. */
export { authRouteHandlers } from './composition';
export { authRoutes } from './presentation/routes';
export { AuthShell } from './presentation/components/auth-shell';
export { AuthFormSkeleton } from './presentation/components/auth-form-skeleton';
export { WelcomePanel } from './presentation/components/welcome-panel';
export { SignInForm } from './presentation/components/sign-in-form';
export { SignUpForm } from './presentation/components/sign-up-form';
export { ForgotPasswordForm } from './presentation/components/forgot-password-form';
export { ResetPasswordForm } from './presentation/components/reset-password-form';
export { ResetPasswordLinkMissing } from './presentation/components/reset-password-link-missing';
export { EmailVerificationResult } from './presentation/components/email-verification-result';
/** The signed-in areas: the header with the account menu, and the account settings page. */
export { AccountControl, AccountHeader } from './presentation/components/account-header';
export { AccountSettings } from './presentation/components/account-settings';
export { default as enAuth } from './presentation/i18n/en.json';
export { default as deAuth } from './presentation/i18n/de.json';
export { requireSignedIn } from './presentation/guards/require-signed-in';
export { redirectIfSignedIn } from './presentation/guards/redirect-if-signed-in';
export {
  parseSignInPageParams,
  parseSettingsPageParams,
  parseResetPasswordPageParams,
  parseEmailVerifiedPageParams,
} from './presentation/schemas/page-params-schema';
