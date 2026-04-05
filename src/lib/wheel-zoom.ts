export interface WheelZoomEventLike {
  readonly deltaMode: number;
  readonly deltaY: number;
  readonly ctrlKey: boolean;
}

/**
 * Match the original 3D-ICE OrbitControls wheel normalization so trackpads
 * produce proportional zoom steps instead of fixed jumps.
 */
export function normalizeWheelDeltaY(
  event: WheelZoomEventLike,
  controlKeyActive = false,
): number {
  let deltaY = event.deltaY;

  switch (event.deltaMode) {
    case 1: // DOM_DELTA_LINE
      deltaY *= 16;
      break;
    case 2: // DOM_DELTA_PAGE
      deltaY *= 100;
      break;
  }

  // Browsers report ctrlKey=true for trackpad pinch gestures.
  if (event.ctrlKey && !controlKeyActive) {
    deltaY *= 10;
  }

  return deltaY;
}

export function getWheelDollyScale(deltaY: number, zoomSpeed = 1): number {
  const normalizedDelta = Math.abs(deltaY * 0.01);
  return Math.pow(0.95, zoomSpeed * normalizedDelta);
}
