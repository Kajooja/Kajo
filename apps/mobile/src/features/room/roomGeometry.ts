export interface RoomSize {
  width: number;
  height: number;
}

export interface RoomRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedRoomRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const ROOM_ART_SIZE: Readonly<RoomSize> = {
  width: 941,
  height: 1672,
};

export const ROOM_ART_RECTS = {
  tv: { x: 388, y: 748, width: 238, height: 173 },
  bookshelf: { x: 665, y: 557, width: 188, height: 566 },
  windowTopLeft: { x: 84, y: 367, width: 111, height: 134 },
  windowTopRight: { x: 207, y: 367, width: 106, height: 134 },
  windowBottomLeft: { x: 84, y: 514, width: 111, height: 163 },
  windowBottomRight: { x: 207, y: 514, width: 106, height: 163 },
  flame: { x: 151, y: 875, width: 91, height: 181 },
  windowLight: { x: -70, y: 275, width: 560, height: 620 },
  fireplaceLight: { x: -105, y: 720, width: 610, height: 610 },
} as const satisfies Record<string, RoomRect>;

export function mapRoomRectForCover(
  viewport: RoomSize,
  rect: RoomRect,
): PositionedRoomRect {
  const scale = Math.max(
    viewport.width / ROOM_ART_SIZE.width,
    viewport.height / ROOM_ART_SIZE.height,
  );
  const renderedWidth = ROOM_ART_SIZE.width * scale;
  const renderedHeight = ROOM_ART_SIZE.height * scale;
  const offsetX = (viewport.width - renderedWidth) / 2;
  const offsetY = (viewport.height - renderedHeight) / 2;

  return {
    left: offsetX + rect.x * scale,
    top: offsetY + rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}
