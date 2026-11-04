import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import InfoBubble from '../../src/components/education/InfoBubble';
import { useGameStore } from '../../src/store/game-store';
import { usePhysicsStore } from '../../src/store/physics-store';
import { useUIStore } from '../../src/store/ui-store';
import { gameEvent, physicsState } from '../store/fixtures';

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  usePhysicsStore.setState({ state: physicsState(), events: [] });
  useUIStore.setState({ language: 'en' });
});

afterEach(() => {
  cleanup();
});

describe('InfoBubble', () => {
  it('queues each event once and localizes it at render time', () => {
    render(<InfoBubble />);
    act(() => {
      usePhysicsStore.setState({ events: [gameEvent('gl_retreat_accelerating')] });
    });
    expect(screen.getByText('gl_retreat_accelerating en')).toBeTruthy();

    act(() => {
      useUIStore.setState({ language: 'zh' });
      usePhysicsStore.setState({ state: physicsState({ year: 1 }) });
    });
    expect(screen.getByText('gl_retreat_accelerating zh')).toBeTruthy();
    expect(useGameStore.getState().pendingEvents).toHaveLength(1);
  });
});
