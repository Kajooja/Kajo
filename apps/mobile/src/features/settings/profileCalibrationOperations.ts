import type { Item } from '@/domain/contracts';

export type ProfileCalibrationRpc = (
  functionName: string,
  arguments_: Record<string, unknown>,
) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

export type ProfileBootstrapStatus = {
  profileId: string;
  minimumStrongEvidence: number;
  initialCandidateCount: number;
  maximumCandidateCount: number;
  strongEvidenceCount: number;
  importedStrongCount: number;
  calibrationRatingCount: number;
  nativeStrongCount: number;
  needsCalibration: boolean;
  realMovieCount: number;
  realBookCount: number;
  calibrationAvailable: boolean;
  priorVersion: string;
  version: string;
};

export type ProfileCalibrationResponse = {
  itemId: string;
  rating: number;
};

export type ProfileCalibrationResult =
  | { status: 'success'; ratingCount: number; version: string }
  | { status: 'error'; message: string };

export function shouldOfferProfileCalibration(
  status: ProfileBootstrapStatus,
): boolean {
  return status.needsCalibration && status.calibrationAvailable;
}

export async function loadProfileBootstrapStatus(
  rpc: ProfileCalibrationRpc,
  profileId: string,
): Promise<
  | { status: 'success'; value: ProfileBootstrapStatus }
  | { status: 'error'; message: string }
> {
  const result = await rpc('get_profile_bootstrap_status_v1', {
    target_profile_id: profileId,
  });

  if (result.error) return { status: 'error', message: result.error.message };
  const mapped = mapProfileBootstrapStatus(result.data);
  return mapped
    ? { status: 'success', value: mapped }
    : { status: 'error', message: 'Kajon lähtötilaa ei voitu tulkita.' };
}

export async function loadProfileCalibrationCandidates(
  rpc: ProfileCalibrationRpc,
  profileId: string,
  limit: number,
): Promise<
  | { status: 'success'; items: readonly Item[] }
  | { status: 'error'; message: string }
> {
  const result = await rpc('get_profile_calibration_candidates_v1', {
    target_profile_id: profileId,
    input_limit: limit,
  });

  if (result.error) return { status: 'error', message: result.error.message };
  const mapped = mapProfileCalibrationCandidates(result.data);
  return mapped
    ? { status: 'success', items: mapped }
    : { status: 'error', message: 'Kalibrointikortteja ei voitu tulkita.' };
}

export async function commitProfileCalibration(
  rpc: ProfileCalibrationRpc,
  profileId: string,
  responses: readonly ProfileCalibrationResponse[],
  minimumStrongEvidence: number,
): Promise<ProfileCalibrationResult> {
  if (responses.length < minimumStrongEvidence) {
    return {
      status: 'error',
      message: `Arvioi vähintään ${minimumStrongEvidence} tuntemaasi teosta ennen tallennusta.`,
    };
  }

  const result = await rpc('commit_profile_calibration_v1', {
    target_profile_id: profileId,
    input_responses: responses,
  });

  if (result.error) return { status: 'error', message: result.error.message };
  if (!isRecord(result.data)) {
    return { status: 'error', message: 'Kalibroinnin tulosta ei voitu tulkita.' };
  }

  const ratingCount = toInteger(result.data.ratingCount);
  const version = toString(result.data.version);
  if (ratingCount === null || !version) {
    return { status: 'error', message: 'Kalibroinnin tulosta ei voitu tulkita.' };
  }

  return { status: 'success', ratingCount, version };
}

export function mapProfileBootstrapStatus(
  value: unknown,
): ProfileBootstrapStatus | null {
  if (!isRecord(value)) return null;

  const profileId = toString(value.profileId);
  const minimumStrongEvidence = toInteger(value.minimumStrongEvidence);
  const initialCandidateCount = toInteger(value.initialCandidateCount);
  const maximumCandidateCount = toInteger(value.maximumCandidateCount);
  const strongEvidenceCount = toInteger(value.strongEvidenceCount);
  const importedStrongCount = toInteger(value.importedStrongCount);
  const calibrationRatingCount = toInteger(value.calibrationRatingCount);
  const nativeStrongCount = toInteger(value.nativeStrongCount);
  const needsCalibration = toBoolean(value.needsCalibration);
  const realMovieCount = toInteger(value.realMovieCount);
  const realBookCount = toInteger(value.realBookCount);
  const calibrationAvailable = toBoolean(value.calibrationAvailable);
  const priorVersion = toString(value.priorVersion);
  const version = toString(value.version);

  if (
    !profileId ||
    minimumStrongEvidence === null ||
    initialCandidateCount === null ||
    maximumCandidateCount === null ||
    strongEvidenceCount === null ||
    importedStrongCount === null ||
    calibrationRatingCount === null ||
    nativeStrongCount === null ||
    needsCalibration === null ||
    realMovieCount === null ||
    realBookCount === null ||
    calibrationAvailable === null ||
    !priorVersion ||
    !version
  ) {
    return null;
  }

  return {
    profileId,
    minimumStrongEvidence,
    initialCandidateCount,
    maximumCandidateCount,
    strongEvidenceCount,
    importedStrongCount,
    calibrationRatingCount,
    nativeStrongCount,
    needsCalibration,
    realMovieCount,
    realBookCount,
    calibrationAvailable,
    priorVersion,
    version,
  };
}

export function mapProfileCalibrationCandidates(value: unknown): Item[] | null {
  if (!Array.isArray(value)) return null;

  const items: Item[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) return null;

    const id = toString(candidate.itemId);
    const itemType = toString(candidate.itemType);
    const title = toString(candidate.title);
    const tags = toStringArray(candidate.tags);
    const creators = toStringArray(candidate.creators);
    const description = toNullableString(candidate.description);
    const imageUrl = toNullableString(candidate.imageUrl);
    const originalLanguage = toNullableString(candidate.originalLanguage);
    const releaseYear = toNullableInteger(candidate.releaseYear);

    if (
      !id ||
      (itemType !== 'BOOK' && itemType !== 'MOVIE') ||
      !title ||
      !tags ||
      !creators
    ) {
      return null;
    }

    items.push({
      id,
      itemType,
      title,
      tags,
      creators,
      ...(description ? { description } : {}),
      ...(releaseYear !== null ? { releaseYear } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(originalLanguage ? { originalLanguage } : {}),
    });
  }

  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toString(value);
}

function toInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function toNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return toInteger(value);
}

function toBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    result.push(entry);
  }
  return result;
}
