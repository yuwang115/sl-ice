import { describe, expect, it } from 'vitest';

import {
  FLOWLINE_SELECTION_AUTO_ROTATE_RESUME_MS,
  getAutoRotateResumeDelay,
  getFlowlineLineAppearance,
} from '../../src/lib/explorer-interactions';

describe('getAutoRotateResumeDelay', () => {
  it('keeps flowline selection resume delay longer than the default idle delay', () => {
    expect(getAutoRotateResumeDelay('flowline-selection')).toBe(FLOWLINE_SELECTION_AUTO_ROTATE_RESUME_MS);
    expect(getAutoRotateResumeDelay('flowline-selection')).toBeGreaterThan(getAutoRotateResumeDelay('idle'));
  });
});

describe('getFlowlineLineAppearance', () => {
  it('highlights the selected flowline in white', () => {
    expect(getFlowlineLineAppearance({
      color: '#3b82f6',
      isHovered: false,
      isSelected: true,
      isActivating: false,
      isFading: false,
    })).toEqual({
      lineColor: '#ffffff',
      lineWidth: 4.5,
    });
  });

  it('keeps transition emphasis stronger than selection', () => {
    expect(getFlowlineLineAppearance({
      color: '#3b82f6',
      isHovered: false,
      isSelected: true,
      isActivating: true,
      isFading: false,
    })).toEqual({
      lineColor: '#ffffff',
      lineWidth: 6,
    });
  });
});
