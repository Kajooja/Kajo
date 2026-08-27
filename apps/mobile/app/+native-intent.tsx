import { rewriteAuthSystemPath } from '../src/features/auth/authDeepLink';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return rewriteAuthSystemPath(path);
}
