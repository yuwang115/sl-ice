import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUIStore } from '../../src/store/ui-store';

function stubSystemTheme(dark: boolean): void {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: dark, addEventListener: vi.fn() })));
}

beforeEach(() => {
  localStorage.clear();
  useUIStore.setState({ theme: 'light', themeChosen: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('initTheme', () => {
  it('follows the system preference while the user has not chosen a theme', () => {
    stubSystemTheme(true);
    useUIStore.getState().initTheme();
    expect(useUIStore.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('keeps a theme the user picked instead of the system preference', () => {
    stubSystemTheme(true);
    useUIStore.getState().setTheme('light');
    useUIStore.getState().initTheme();
    expect(useUIStore.getState().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('treats a theme persisted before themeChosen existed as the user choice', async () => {
    const migrate = useUIStore.persist.getOptions().migrate;
    expect(await migrate?.({ theme: 'dark', language: 'en' }, 0)).toMatchObject({
      theme: 'dark',
      themeChosen: true,
    });
  });
});
