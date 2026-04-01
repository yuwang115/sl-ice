export interface FloatingDashboardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DashboardResizeHandle =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

export const DASHBOARD_WINDOW_MARGIN = 16;
export const MIN_DASHBOARD_WIDTH = 480;
export const MIN_DASHBOARD_HEIGHT = 240;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveWidthLimits(boundsWidth: number): { min: number; max: number } {
  const max = Math.max(220, boundsWidth - DASHBOARD_WINDOW_MARGIN * 2);
  const min = Math.min(MIN_DASHBOARD_WIDTH, max);
  return { min, max };
}

function resolveHeightLimits(boundsHeight: number): { min: number; max: number } {
  const max = Math.max(180, boundsHeight - DASHBOARD_WINDOW_MARGIN * 2);
  const min = Math.min(MIN_DASHBOARD_HEIGHT, max);
  return { min, max };
}

export function clampDashboardRect(
  rect: FloatingDashboardRect,
  boundsWidth: number,
  boundsHeight: number,
): FloatingDashboardRect {
  const { min: minWidth, max: maxWidth } = resolveWidthLimits(boundsWidth);
  const { min: minHeight, max: maxHeight } = resolveHeightLimits(boundsHeight);

  const width = clamp(rect.width, minWidth, maxWidth);
  const height = clamp(rect.height, minHeight, maxHeight);

  const maxX = Math.max(DASHBOARD_WINDOW_MARGIN, boundsWidth - width - DASHBOARD_WINDOW_MARGIN);
  const maxY = Math.max(DASHBOARD_WINDOW_MARGIN, boundsHeight - height - DASHBOARD_WINDOW_MARGIN);

  return {
    x: clamp(rect.x, DASHBOARD_WINDOW_MARGIN, maxX),
    y: clamp(rect.y, DASHBOARD_WINDOW_MARGIN, maxY),
    width,
    height,
  };
}

export function createDefaultDashboardRect(
  boundsWidth: number,
  boundsHeight: number,
): FloatingDashboardRect {
  const { min: minWidth, max: maxWidth } = resolveWidthLimits(boundsWidth);
  const { min: minHeight, max: maxHeight } = resolveHeightLimits(boundsHeight);

  const width = clamp(boundsWidth * 0.58, minWidth, maxWidth);
  const height = clamp(boundsHeight * 0.34, minHeight, maxHeight);

  return clampDashboardRect(
    {
      x: boundsWidth - width - DASHBOARD_WINDOW_MARGIN,
      y: boundsHeight - height - DASHBOARD_WINDOW_MARGIN,
      width,
      height,
    },
    boundsWidth,
    boundsHeight,
  );
}

export function applyDashboardMove(
  rect: FloatingDashboardRect,
  deltaX: number,
  deltaY: number,
  boundsWidth: number,
  boundsHeight: number,
): FloatingDashboardRect {
  return clampDashboardRect(
    {
      ...rect,
      x: rect.x + deltaX,
      y: rect.y + deltaY,
    },
    boundsWidth,
    boundsHeight,
  );
}

export function applyDashboardResize(
  rect: FloatingDashboardRect,
  handle: DashboardResizeHandle,
  deltaX: number,
  deltaY: number,
  boundsWidth: number,
  boundsHeight: number,
): FloatingDashboardRect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;

  if (handle.includes('e')) right += deltaX;
  if (handle.includes('s')) bottom += deltaY;
  if (handle.includes('w')) left += deltaX;
  if (handle.includes('n')) top += deltaY;

  const { min: minWidth, max: maxWidth } = resolveWidthLimits(boundsWidth);
  const { min: minHeight, max: maxHeight } = resolveHeightLimits(boundsHeight);

  if (right - left < minWidth) {
    if (handle.includes('w') && !handle.includes('e')) {
      left = right - minWidth;
    } else {
      right = left + minWidth;
    }
  }
  if (bottom - top < minHeight) {
    if (handle.includes('n') && !handle.includes('s')) {
      top = bottom - minHeight;
    } else {
      bottom = top + minHeight;
    }
  }

  if (right - left > maxWidth) {
    if (handle.includes('w') && !handle.includes('e')) {
      left = right - maxWidth;
    } else {
      right = left + maxWidth;
    }
  }
  if (bottom - top > maxHeight) {
    if (handle.includes('n') && !handle.includes('s')) {
      top = bottom - maxHeight;
    } else {
      bottom = top + maxHeight;
    }
  }

  if (left < DASHBOARD_WINDOW_MARGIN) {
    left = DASHBOARD_WINDOW_MARGIN;
  }
  if (top < DASHBOARD_WINDOW_MARGIN) {
    top = DASHBOARD_WINDOW_MARGIN;
  }
  if (right > boundsWidth - DASHBOARD_WINDOW_MARGIN) {
    right = boundsWidth - DASHBOARD_WINDOW_MARGIN;
  }
  if (bottom > boundsHeight - DASHBOARD_WINDOW_MARGIN) {
    bottom = boundsHeight - DASHBOARD_WINDOW_MARGIN;
  }

  return clampDashboardRect(
    {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    },
    boundsWidth,
    boundsHeight,
  );
}
