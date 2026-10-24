import { authRoutes } from '@modules/auth';

import { NotFoundPanel } from '@components/shared/not-found-panel';

export default function AuthNotFound() {
  return <NotFoundPanel homeHref={authRoutes.welcome()} />;
}
