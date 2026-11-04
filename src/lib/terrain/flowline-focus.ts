/**
 * Camera focus point for flying toward a flowline.
 */

export type ScenePoint = readonly [number, number, number];

/**
 * World-space point the camera flies to for a flowline: the middle point of
 * its projected path. Paths are projected in the terrain group's local space,
 * and that group is scaled by [1, exaggeration, 1], so y is scaled to match
 * the rendered line (the 3D double-click path already gets world coordinates
 * from the raycast hit).
 */
export function getFlowlineFocusPoint(
  localPoints: readonly ScenePoint[],
  exaggeration: number,
): [number, number, number] | null {
  if (localPoints.length === 0) return null;
  const [x, y, z] = localPoints[Math.floor(localPoints.length / 2)];
  const scale = Number.isFinite(exaggeration) ? exaggeration : 1;
  return [x, y * scale, z];
}
