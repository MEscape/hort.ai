import { AuthShell, authRoutes } from '@modules/auth';

import { NotFoundPanel } from '@components/shared/not-found-panel';

export default function LocaleNotFound() {
  return (
    <AuthShell>
      <NotFoundPanel homeHref={authRoutes.welcome()} />
    </AuthShell>
  );
}
