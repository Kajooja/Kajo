export type BottomProfileControlAction = 'HOME' | 'SWITCHER';

export function getBottomProfileControlAction(
  pathname: string,
): BottomProfileControlAction {
  return pathname === '/' ? 'SWITCHER' : 'HOME';
}
