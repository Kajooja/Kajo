export type AuthEntryMode = 'sign-in' | 'sign-up';

export interface EmailSignUpCredentials {
  email: string;
  password: string;
  options: {
    data: {
      kajo_nickname: string;
    };
    emailRedirectTo: string;
  };
}

interface AuthErrorLike {
  code?: string | undefined;
  message: string;
}

interface AuthSessionLike {
  user: {
    id: string;
    email?: string | null;
  };
}

interface AuthOperationResponse {
  data: {
    session: AuthSessionLike | null;
  };
  error: AuthErrorLike | null;
}

export interface EmailPasswordAuthApi {
  signUp(credentials: EmailSignUpCredentials): PromiseLike<AuthOperationResponse>;
  signOut(): PromiseLike<{ error: AuthErrorLike | null }>;
}

export type AuthEmailLink =
  | {
      tokenHash: string;
      type: 'signup' | 'recovery';
    }
  | {
      accessToken: string;
      refreshToken: string;
      type: 'signup' | 'recovery';
    };

export interface AuthEmailLinkApi {
  verifyOtp(credentials: {
    token_hash: string;
    type: 'signup' | 'recovery';
  }): PromiseLike<AuthOperationResponse>;
  setSession(credentials: {
    access_token: string;
    refresh_token: string;
  }): PromiseLike<AuthOperationResponse>;
}

export type AuthEmailLinkResult =
  | { status: 'verified'; userId: string }
  | { status: 'error'; message: string };

export type PasswordAuthAction =
  | 'account-exists'
  | 'request-password-reset'
  | 'sign-in';

export interface PasswordAuthRequest {
  action: PasswordAuthAction;
  identifier: string;
  password?: string;
}

export interface PasswordAuthBridge {
  invoke(
    request: PasswordAuthRequest,
  ): PromiseLike<{ data: unknown; error: AuthErrorLike | null }>;
}

export type CredentialValidationResult =
  | { status: 'valid'; email: string; password: string }
  | { status: 'invalid'; message: string };

export type AuthSubmissionResult =
  | { status: 'authenticated'; userId: string; email?: string }
  | { status: 'confirmation-required'; email: string }
  | { status: 'error'; message: string };

export type IdentifierSignInResult =
  | {
      status: 'session';
      accessToken: string;
      refreshToken: string;
      userId: string;
    }
  | { status: 'error'; message: string };

export type AccountAvailabilityResult =
  | { status: 'available' }
  | { status: 'exists' }
  | { status: 'error'; message: string };

export type PasswordRecoveryRequestResult =
  | { status: 'sent' }
  | { status: 'error'; message: string };

export type SignOutResult =
  | { status: 'signed-out' }
  | { status: 'error'; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MINIMUM_PASSWORD_LENGTH = 6;
const GENERIC_AUTH_ERROR = 'Kirjautuminen epäonnistui. Yritä uudelleen.';
const ACCOUNT_EXISTS_MESSAGE = 'Sinulla on jo tili. Unohditko salasanasi?';

export function validateEmailPassword(
  email: string,
  password: string,
): CredentialValidationResult {
  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return {
      status: 'invalid',
      message: 'Anna kelvollinen sähköpostiosoite.',
    };
  }

  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return {
      status: 'invalid',
      message: `Salasanassa pitää olla vähintään ${MINIMUM_PASSWORD_LENGTH} merkkiä.`,
    };
  }

  return {
    status: 'valid',
    email: normalizedEmail,
    password,
  };
}

export function normalizeLoginIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

export async function checkAccountAvailability(
  bridge: PasswordAuthBridge,
  identifierInput: string,
): Promise<AccountAvailabilityResult> {
  const identifier = normalizeLoginIdentifier(identifierInput);

  if (!identifier) {
    return { status: 'available' };
  }

  try {
    const response = await bridge.invoke({
      action: 'account-exists',
      identifier,
    });

    if (response.error) {
      return { status: 'error', message: GENERIC_AUTH_ERROR };
    }

    if (isRecord(response.data) && response.data.status === 'exists') {
      return { status: 'exists' };
    }

    if (isRecord(response.data) && response.data.status === 'available') {
      return { status: 'available' };
    }

    return { status: 'error', message: GENERIC_AUTH_ERROR };
  } catch {
    return { status: 'error', message: GENERIC_AUTH_ERROR };
  }
}

export async function submitIdentifierPassword(
  bridge: PasswordAuthBridge,
  identifierInput: string,
  password: string,
): Promise<IdentifierSignInResult> {
  const identifier = normalizeLoginIdentifier(identifierInput);

  if (!identifier) {
    return { status: 'error', message: 'Anna sähköposti tai nimimerkki.' };
  }

  if (!password) {
    return { status: 'error', message: 'Anna salasana.' };
  }

  try {
    const response = await bridge.invoke({
      action: 'sign-in',
      identifier,
      password,
    });

    if (response.error || !isRecord(response.data)) {
      return { status: 'error', message: GENERIC_AUTH_ERROR };
    }

    switch (response.data.status) {
      case 'user-not-found':
        return { status: 'error', message: 'Käyttäjätunnusta ei löydy.' };
      case 'wrong-password':
        return { status: 'error', message: 'Salasana on väärin.' };
      case 'email-not-confirmed':
        return {
          status: 'error',
          message: 'Sähköpostiosoitetta ei ole vielä vahvistettu. Tarkista sähköpostisi.',
        };
      case 'authenticated':
        if (
          isNonEmptyString(response.data.accessToken) &&
          isNonEmptyString(response.data.refreshToken) &&
          isNonEmptyString(response.data.userId)
        ) {
          return {
            status: 'session',
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            userId: response.data.userId,
          };
        }
        break;
      default:
        break;
    }

    return { status: 'error', message: GENERIC_AUTH_ERROR };
  } catch {
    return { status: 'error', message: GENERIC_AUTH_ERROR };
  }
}

export async function submitEmailSignUp(
  auth: EmailPasswordAuthApi,
  emailInput: string,
  password: string,
  nickname: string,
  emailRedirectTo: string,
): Promise<AuthSubmissionResult> {
  const validation = validateEmailPassword(emailInput, password);

  if (validation.status === 'invalid') {
    return { status: 'error', message: validation.message };
  }

  try {
    const response = await auth.signUp({
      email: validation.email,
      password: validation.password,
      options: {
        data: { kajo_nickname: nickname },
        emailRedirectTo,
      },
    });

    if (response.error) {
      return { status: 'error', message: getSignUpErrorMessage(response.error) };
    }

    if (!response.data.session) {
      return {
        status: 'confirmation-required',
        email: validation.email,
      };
    }

    return {
      status: 'authenticated',
      userId: response.data.session.user.id,
      email: response.data.session.user.email ?? validation.email,
    };
  } catch {
    return { status: 'error', message: GENERIC_AUTH_ERROR };
  }
}

export async function requestPasswordRecovery(
  bridge: PasswordAuthBridge,
  identifierInput: string,
): Promise<PasswordRecoveryRequestResult> {
  const identifier = normalizeLoginIdentifier(identifierInput);

  if (!identifier) {
    return { status: 'error', message: 'Anna sähköposti tai nimimerkki.' };
  }

  try {
    const response = await bridge.invoke({
      action: 'request-password-reset',
      identifier,
    });

    if (response.error || !isRecord(response.data)) {
      return {
        status: 'error',
        message: 'Salasanan palautusviestin lähettäminen epäonnistui. Yritä uudelleen.',
      };
    }

    if (response.data.status === 'user-not-found') {
      return { status: 'error', message: 'Käyttäjätunnusta ei löydy.' };
    }

    if (response.data.status === 'recovery-sent') {
      return { status: 'sent' };
    }

    return {
      status: 'error',
      message: 'Salasanan palautusviestin lähettäminen epäonnistui. Yritä uudelleen.',
    };
  } catch {
    return {
      status: 'error',
      message: 'Salasanan palautusviestin lähettäminen epäonnistui. Yritä uudelleen.',
    };
  }
}

export async function verifyAuthEmailLink(
  auth: AuthEmailLinkApi,
  link: AuthEmailLink,
): Promise<AuthEmailLinkResult> {
  try {
    const { data, error } =
      'tokenHash' in link
        ? await auth.verifyOtp({
            token_hash: link.tokenHash,
            type: link.type,
          })
        : await auth.setSession({
            access_token: link.accessToken,
            refresh_token: link.refreshToken,
          });

    if (error || !data.session) {
      return {
        status: 'error',
        message:
          link.type === 'recovery'
            ? 'Palautuslinkki on vanhentunut tai jo käytetty. Pyydä uusi linkki.'
            : 'Vahvistuslinkki on vanhentunut tai jo käytetty. Palaa kirjautumiseen.',
      };
    }

    return { status: 'verified', userId: data.session.user.id };
  } catch {
    return {
      status: 'error',
      message: 'Kirjautumislinkkiä ei voitu vahvistaa. Yritä uudelleen.',
    };
  }
}

export async function signOut(
  auth: EmailPasswordAuthApi,
): Promise<SignOutResult> {
  try {
    const { error } = await auth.signOut();

    if (error) {
      return {
        status: 'error',
        message: 'Uloskirjautuminen epäonnistui. Yritä uudelleen.',
      };
    }

    return { status: 'signed-out' };
  } catch {
    return {
      status: 'error',
      message: 'Uloskirjautuminen epäonnistui. Yritä uudelleen.',
    };
  }
}

export function accountExistsMessage(): string {
  return ACCOUNT_EXISTS_MESSAGE;
}

function getSignUpErrorMessage(error: AuthErrorLike): string {
  if (
    error.code === 'user_already_exists' ||
    error.message.toLowerCase().includes('already registered')
  ) {
    return ACCOUNT_EXISTS_MESSAGE;
  }

  return GENERIC_AUTH_ERROR;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
