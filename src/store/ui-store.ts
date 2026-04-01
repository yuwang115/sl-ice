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

interface UIStore {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
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
}

export const useUIStore = create<UIStore>()(persist(
  (set) => ({
  theme: 'light',
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      return { theme: next };
    }),
  initTheme: () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: Theme = prefersDark ? 'dark' : 'light';
    applyTheme(initial);
    set({ theme: initial });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
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
}),
  {
    name: 'sl-ice-ui',
    partialize: (state) => ({
      theme: state.theme,
      language: state.language,
      overlayMode: state.overlayMode,
    }),
  },
));
