// The dock and floating panels share the same clearance above system navigation.
export const BOTTOM_DOCK_HEIGHT = 46;
export const DOCK_PANEL_GAP = 8;

export function getDockPanelBottomInset(safeAreaBottom: number) {
  return safeAreaBottom + BOTTOM_DOCK_HEIGHT + DOCK_PANEL_GAP;
}
