import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Settings as SettingsIcon, Info, Moon, Sun, Monitor, X } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Button } from './ui/button';
import Settings from '../pages/Settings';
import About from '../pages/About';

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, setLanguage, setOverlayOpen } = useAppStore();
  const [openModal, setOpenModal] = useState<'settings' | 'about' | null>(null);

  const openWith = (modal: 'settings' | 'about') => { setOpenModal(modal); setOverlayOpen(true); };
  const closeModal = () => { setOpenModal(null); setOverlayOpen(false); };

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <header className="border-b bg-card shadow-sm sticky top-0 z-99999">
        <div className="container mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1.5 text-primary font-bold text-lg shrink-0">
            <MapPin className="h-5 w-5" />
            <span className="hidden xs:inline">{t('appTitle')}</span>
          </Link>

          {/* Right controls */}
          <div className="flex items-center gap-1">
            {/* Theme cycle */}
            <Button variant="ghost" size="icon" onClick={cycleTheme} className="h-9 w-9" aria-label={t('theme')}>
              <ThemeIcon className="h-4 w-4" />
            </Button>
            {/* Language select — compact */}
            <select
              value={i18n.language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-transparent border border-input rounded-md px-1.5 py-1 text-xs outline-none focus:ring-2 focus:ring-ring text-foreground h-9"
            >
              <option value="en" className="bg-background">EN</option>
              <option value="fr" className="bg-background">FR</option>
              <option value="ar" className="bg-background">AR</option>
            </select>
            {/* About */}
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openWith('about')} aria-label={t('about')}>
              <Info className="h-4 w-4" />
            </Button>
            {/* Settings */}
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openWith('settings')} aria-label={t('settings')}>
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {openModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          {/* Dialog — always centered, never a bottom sheet */}
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] bg-background rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h2 className="font-semibold text-base">
                {openModal === 'settings' ? t('settings') : t('about')}
              </h2>
              <button onClick={closeModal} className="rounded-full p-1.5 hover:bg-muted transition-colors" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1">
              {openModal === 'settings' ? <Settings /> : <About />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
