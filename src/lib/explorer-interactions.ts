import { AUTO_ROTATE_IDLE_RESUME_MS } from './terrain/constants';

export const FLOWLINE_SELECTION_AUTO_ROTATE_RESUME_MS = 3200;

export type AutoRotateResumeInteraction = 'idle' | 'flowline-selection';

export interface FlowlineLineAppearanceInput {
  readonly color: string;
  readonly isHovered: boolean;
  readonly isSelected: boolean;
  readonly isActivating: boolean;
  readonly isFading: boolean;
}

export interface FlowlineLineAppearance {
  readonly lineColor: string;
  readonly lineWidth: number;
}

function brightenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const br = Math.min(255, Math.round(r + (255 - r) * factor));
  const bg = Math.min(255, Math.round(g + (255 - g) * factor));
  const bb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `#${br.toString(16).padStart(2, '0')}${bg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`;
}

export function getAutoRotateResumeDelay(interaction: AutoRotateResumeInteraction): number {
  switch (interaction) {
    case 'flowline-selection':
      return FLOWLINE_SELECTION_AUTO_ROTATE_RESUME_MS;
    case 'idle':
    default:
      return AUTO_ROTATE_IDLE_RESUME_MS;
  }
}

export function getFlowlineLineAppearance({
  color,
  isHovered,
  isSelected,
  isActivating,
  isFading,
}: FlowlineLineAppearanceInput): FlowlineLineAppearance {
  if (isActivating) {
    return { lineWidth: 6, lineColor: '#ffffff' };
  }

  if (isFading) {
    return { lineWidth: 0.5, lineColor: '#1e293b' };
  }

  if (isSelected) {
    return { lineWidth: 4.5, lineColor: '#ffffff' };
  }

  if (isHovered) {
    return { lineWidth: 3, lineColor: brightenHex(color, 0.5) };
  }

  return { lineWidth: 1.5, lineColor: color };
}
