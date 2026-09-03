export const ROUTE_TRANSITION_ANIMATION = 'none' as const;

export function isRoomPathname(pathname: string): boolean {
  return pathname === '/';
}
