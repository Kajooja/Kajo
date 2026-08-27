export type AuthEntryMode = 'sign-in' | 'sign-up';

export interface EmailPasswordCredentials {
  email: string;
  password: string;
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
  signInWithPassword(
    credentials: EmailPasswordCredentials,
  ): PromiseLike<AuthOperationResponse>;
  signUp(credentials: EmailPasswordCredentials): PromiseLike<AuthOperationResponse>;
  signOut(): PromiseLike<{ error: AuthErrorLike | null }>;
}

export type CredentialValidationResult =
  | { status: 'valid'; credentials: EmailPasswordCredentials }
  | { status: 'invalid'; message: string };

export type AuthSubmissionResult =
  | { status: 'authenticated'; userId: string; email: string }
  | { status: 'confirmation-required'; email: string }
  | { status: 'error'; message: string };

export type SignOutResult =
  | { status: 'signed-out' }
  | { status: 'error'; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMUM_PASSWORD_LENGTH = 6;
const GENERIC_AUTH_ERROR = 'Kirjautuminen epäonnistui. Yritä uudelleen.';

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
    credentials: {
      email: normalizedEmail,
      password,
    },
  };
}

export async function submitEmailPassword(
  auth: EmailPasswordAuthApi,
  mode: AuthEntryMode,
  email: string,
  password: string,
): Promise<AuthSubmissionResult> {
  const validation = validateEmailPassword(email, password);

  if (validation.status === 'invalid') {
    return { status: 'error', message: validation.message };
  }

  try {
    const response =
      mode === 'sign-in'
        ? await auth.signInWithPassword(validation.credentials)
        : await auth.signUp(validation.credentials);

    if (response.error) {
      return { status: 'error', message: getAuthErrorMessage(response.error) };
    }

    if (!response.data.session) {
      if (mode === 'sign-up') {
        return {
          status: 'confirmation-required',
          email: validation.credentials.email,
        };
      }

      return { status: 'error', message: GENERIC_AUTH_ERROR };
    }

    return {
      status: 'authenticated',
      userId: response.data.session.user.id,
      email:
        response.data.session.user.email ?? validation.credentials.email,
    };
  } catch {
    return { status: 'error', message: GENERIC_AUTH_ERROR };
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

function getAuthErrorMessage(error: AuthErrorLike): string {
  if (
    error.code === 'invalid_credentials' ||
    error.message.toLowerCase().includes('invalid login credentials')
  ) {
    return 'Sähköposti tai salasana ei täsmää.';
  }

  if (
    error.code === 'user_already_exists' ||
    error.message.toLowerCase().includes('already registered')
  ) {
    return 'Tällä sähköpostiosoitteella on jo tili.';
  }

  return GENERIC_AUTH_ERROR;
}
