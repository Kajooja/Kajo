import type { AmbientPhase, Profile } from '../domain/contracts';

export interface RoomBaseTheme {
  appBackground: string;
  sceneBackground: string;
  wall: string;
  floor: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  structure: string;
  structureLight: string;
  screen: string;
  book: string;
  ember: string;
  flame: string;
}

export interface RoomAmbientTheme {
  wash: string;
  washOpacity: number;
  windowLight: string;
  curtain: string;
  curtainHighlight: string;
}

export interface RoomSurfaceTheme {
  appChrome: string;
  panel: string;
  raised: string;
  floor: string;
}

export interface RoomTheme {
  base: RoomBaseTheme;
  ambient: RoomAmbientTheme;
  surface: RoomSurfaceTheme;
}

const ATMOSPHERIC_SURFACE_OPACITY = 0.72;

export const PERSONAL_ROOM_BASE_THEME: Readonly<RoomBaseTheme> = {
  appBackground: '#171716',
  sceneBackground: '#262421',
  wall: '#262421',
  floor: '#211E1B',
  border: '#38342F',
  textPrimary: '#F1EDE5',
  textMuted: '#9E988F',
  structure: '#4A443D',
  structureLight: '#62564A',
  screen: '#111210',
  book: '#766D62',
  ember: '#8A5A34',
  flame: '#C68A4A',
};

export const SHARED_ROOM_BASE_THEMES: readonly Readonly<RoomBaseTheme>[] = [
  {
    appBackground: '#151817',
    sceneBackground: '#222826',
    wall: '#222826',
    floor: '#1C2220',
    border: '#343E3A',
    textPrimary: '#EEF2ED',
    textMuted: '#96A29C',
    structure: '#43534D',
    structureLight: '#5C7068',
    screen: '#101412',
    book: '#697A72',
    ember: '#815C3F',
    flame: '#B98555',
  },
  {
    appBackground: '#181617',
    sceneBackground: '#292327',
    wall: '#292327',
    floor: '#221D20',
    border: '#40353C',
    textPrimary: '#F2ECEF',
    textMuted: '#A2949D',
    structure: '#56454F',
    structureLight: '#705A67',
    screen: '#131013',
    book: '#7B6873',
    ember: '#86523F',
    flame: '#BC7655',
  },
  {
    appBackground: '#161719',
    sceneBackground: '#24272C',
    wall: '#24272C',
    floor: '#1E2025',
    border: '#373C45',
    textPrimary: '#EDF0F4',
    textMuted: '#969DA8',
    structure: '#48515D',
    structureLight: '#606C7A',
    screen: '#101216',
    book: '#6C7481',
    ember: '#80563E',
    flame: '#B77D55',
  },
] as const;

export const ROOM_AMBIENT_BY_PHASE: Readonly<Record<AmbientPhase, RoomAmbientTheme>> = {
  DAWN: {
    wash: '#E6D5B5',
    washOpacity: 0.08,
    windowLight: '#C9D0C4',
    curtain: '#9A8B78',
    curtainHighlight: '#C0AD92',
  },
  EVENING: {
    wash: '#C47E5D',
    washOpacity: 0.11,
    windowLight: '#C89D87',
    curtain: '#75606A',
    curtainHighlight: '#9A7780',
  },
  NIGHT: {
    wash: '#52627C',
    washOpacity: 0.16,
    windowLight: '#718197',
    curtain: '#454A59',
    curtainHighlight: '#626A7B',
  },
};

export function getRoomTheme(
  ambientPhase: AmbientPhase,
  profile?: Profile | null,
): RoomTheme {
  const base = getRoomBaseTheme(profile);

  return {
    base,
    ambient: ROOM_AMBIENT_BY_PHASE[ambientPhase],
    surface: {
      appChrome: withColorAlpha(base.appBackground, ATMOSPHERIC_SURFACE_OPACITY),
      panel: withColorAlpha(base.sceneBackground, ATMOSPHERIC_SURFACE_OPACITY),
      raised: withColorAlpha(base.structure, 0.76),
      floor: withColorAlpha(base.floor, ATMOSPHERIC_SURFACE_OPACITY),
    },
  };
}

export function withColorAlpha(hexColor: string, opacity: number): string {
  const normalized = hexColor.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const alpha = Math.min(1, Math.max(0, opacity));

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getRoomBaseTheme(
  profile?: Profile | null,
): Readonly<RoomBaseTheme> {
  if (!profile || profile.type === 'PERSONAL') {
    return PERSONAL_ROOM_BASE_THEME;
  }

  const sharedTheme = SHARED_ROOM_BASE_THEMES[getStableThemeIndex(profile.id)];
  return sharedTheme ?? PERSONAL_ROOM_BASE_THEME;
}

function getStableThemeIndex(profileId: string): number {
  let hash = 0;

  for (let index = 0; index < profileId.length; index += 1) {
    hash = (hash * 31 + profileId.charCodeAt(index)) >>> 0;
  }

  return hash % SHARED_ROOM_BASE_THEMES.length;
}
