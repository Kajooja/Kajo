import type { AmbientPhase } from '../domain/contracts';

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

export interface RoomTheme {
  base: RoomBaseTheme;
  ambient: RoomAmbientTheme;
}

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

export function getRoomTheme(ambientPhase: AmbientPhase): RoomTheme {
  return {
    base: PERSONAL_ROOM_BASE_THEME,
    ambient: ROOM_AMBIENT_BY_PHASE[ambientPhase],
  };
}
