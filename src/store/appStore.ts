import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Settings } from '../types';

interface AppState extends Settings {
  setTheme: (theme: Settings['theme']) => void;
  setLanguage: (lang: Settings['language']) => void;
  setGeminiApiKey: (key: string) => void;
  setParsingMode: (mode: Settings['parsingMode']) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'en',
      geminiApiKey: '',
      parsingMode: 'auto',
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
      setParsingMode: (parsingMode) => set({ parsingMode }),
    }),
    {
      name: 'clusterroute-settings',
    }
  )
);
