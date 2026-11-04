/**
 * UI state store — panels, language, theme, display preferences.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Language = 'en' | 'zh';
type Theme = 'light' | 'dark';

export type OverlayMode = 'none' | 'strain' | 'profiles' | 'isochrones' | 'tracers';

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
};

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

const systemTheme = (): Theme => (window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light');

let systemThemeListenerAttached = false;

interface UIStore {
  // Theme
  theme: Theme;
  /** True once the user picked a theme; until then the OS preference is followed. */
  themeChosen: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Apply the persisted choice, or the OS preference when the user never chose. */
  initTheme: () => void;

  // Language
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;

  // Panel visibility
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  dashboardExpanded: boolean;
  toggleDashboard: () => void;

  // Info displays
  showGlossary: boolean;
  setShowGlossary: (show: boolean) => void;
  showInfoBubble: boolean;
  setShowInfoBubble: (show: boolean) => void;
  infoBubbleContent: { en: string; zh: string } | null;
  setInfoBubble: (content: { en: string; zh: string } | null) => void;

  // Canvas
  canvasWidth: number;
  canvasHeight: number;
  setCanvasSize: (w: number, h: number) => void;

  // Viewport
  viewOffsetX: number;
  viewScale: number;
  setViewport: (offsetX: number, scale: number) => void;

  // Visualization overlays
  overlayMode: OverlayMode;
  setOverlayMode: (mode: OverlayMode) => void;

  // Canvas tooltips (pretext-powered)
  showCanvasTooltips: boolean;
  setShowCanvasTooltips: (show: boolean) => void;
  toggleCanvasTooltips: () => void;
}

type PersistedUIState = Pick<
  UIStore, 'theme' | 'themeChosen' | 'language' | 'overlayMode' | 'showCanvasTooltips'
>;

export const useUIStore = create<UIStore>()(persist(
  (set, get) => ({
  theme: 'light',
  themeChosen: false,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme, themeChosen: true });
  },
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      return { theme: next, themeChosen: true };
    }),
  initTheme: () => {
    const { theme, themeChosen } = get();
    const initial = themeChosen ? theme : systemTheme();
    applyTheme(initial);
    set({ theme: initial });

    if (systemThemeListenerAttached) return;
    systemThemeListenerAttached = true;
    window.matchMedia(DARK_SCHEME_QUERY).addEventListener('change', (e) => {
      if (get().themeChosen) return;
      const next: Theme = e.matches ? 'dark' : 'light';
      applyTheme(next);
      set({ theme: next });
    });
  },

  language: 'en',
  setLanguage: (lang) => set({ language: lang }),
  toggleLanguage: () => set((s) => ({ language: s.language === 'en' ? 'zh' : 'en' })),

  sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  dashboardExpanded: false,
  toggleDashboard: () => set((s) => ({ dashboardExpanded: !s.dashboardExpanded })),

  showGlossary: false,
  setShowGlossary: (show) => set({ showGlossary: show }),
  showInfoBubble: false,
  setShowInfoBubble: (show) => set({ showInfoBubble: show }),
  infoBubbleContent: null,
  setInfoBubble: (content) =>
    set({ infoBubbleContent: content, showInfoBubble: content !== null }),

  canvasWidth: 800,
  canvasHeight: 500,
  setCanvasSize: (w, h) => set({ canvasWidth: w, canvasHeight: h }),

  viewOffsetX: 0,
  viewScale: 1,
  setViewport: (offsetX, scale) => set({ viewOffsetX: offsetX, viewScale: scale }),

  overlayMode: 'none',
  setOverlayMode: (mode) => set({ overlayMode: mode }),

  showCanvasTooltips: true,
  setShowCanvasTooltips: (show) => set({ showCanvasTooltips: show }),
  toggleCanvasTooltips: () => set((s) => ({ showCanvasTooltips: !s.showCanvasTooltips })),
}),
  {
    name: 'sl-ice-ui',
    version: 1,
    // v0 stored the theme without recording whether the user picked it; it is
    // the last theme they saw, so keep it rather than reverting to the OS.
    migrate: (persisted, version) => {
      const state = (persisted ?? {}) as Partial<PersistedUIState>;
      return version < 1 && state.theme ? { ...state, themeChosen: true } : state;
    },
    partialize: (state): PersistedUIState => ({
      theme: state.theme,
      themeChosen: state.themeChosen,
      language: state.language,
      overlayMode: state.overlayMode,
      showCanvasTooltips: state.showCanvasTooltips,
    }),
  },
));
