import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './store/appStore';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Settings from './pages/Settings';
import About from './pages/About';

function App() {
  const { i18n } = useTranslation();
  const { theme } = useAppStore();

  // Sync language with i18n if user changed it in store
  useEffect(() => {
    const unsub = useAppStore.subscribe((state, prevState) => {
      if (state.language !== prevState.language) {
        i18n.changeLanguage(state.language);
      }
    });
    // Set initial
    i18n.changeLanguage(useAppStore.getState().language);
    return unsub;
  }, [i18n]);

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
    useAppStore.getState().setLanguage(i18n.language as any);
  }, [i18n.language]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow flex flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
