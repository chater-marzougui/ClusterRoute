import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Settings } from '../types';

interface AppState extends Settings {
  setTheme: (theme: Settings['theme']) => void;
  setLanguage: (lang: Settings['language']) => void;
  setGeminiApiKey: (key: string) => void;
  setParsingMode: (mode: Settings['parsingMode']) => void;
  setSearchRadius: (radius: number) => void;
  setMaxCandidates: (max: number) => void;
  setDistanceUnit: (unit: Settings['distanceUnit']) => void;
  // transient UI flag — not persisted
  overlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'en',
      geminiApiKey: '',
      parsingMode: 'auto',
      searchRadius: 15,
      maxCandidates: 10,
      distanceUnit: 'km',
      overlayOpen: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
      setParsingMode: (parsingMode) => set({ parsingMode }),
      setSearchRadius: (searchRadius) => set({ searchRadius }),
      setMaxCandidates: (maxCandidates) => set({ maxCandidates }),
      setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
      setOverlayOpen: (overlayOpen) => set({ overlayOpen }),
    }),
    {
      name: 'clusterroute-settings',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        geminiApiKey: state.geminiApiKey,
        parsingMode: state.parsingMode,
        searchRadius: state.searchRadius,
        maxCandidates: state.maxCandidates,
        distanceUnit: state.distanceUnit,
      }),
    }
  )
);
