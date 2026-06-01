import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Settings as SettingsIcon, Info, Moon, Sun, Monitor } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Button } from './ui/button';

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, setLanguage } = useAppStore();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <header className="border-b bg-card shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-primary font-bold text-xl">
          <MapPin className="h-6 w-6" />
          <span>{t('appTitle')}</span>
        </Link>
        <div className="flex items-center gap-2 md:gap-4">
          <nav className="hidden md:flex gap-4">
            <Link to="/" className="text-muted-foreground hover:text-foreground font-medium transition-colors">
              {t('home')}
            </Link>
            <Link to="/about" className="text-muted-foreground hover:text-foreground font-medium transition-colors">
              {t('about')}
            </Link>
            <Link to="/settings" className="text-muted-foreground hover:text-foreground font-medium transition-colors">
              {t('settings')}
            </Link>
          </nav>

          <div className="flex items-center gap-2 border-s ps-4 ms-2 border-border">
            <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label={t('theme')}>
              <ThemeIcon className="h-5 w-5" />
            </Button>
            <select
              value={i18n.language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-transparent border border-input rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground"
            >
              <option value="en" className="bg-background text-foreground">EN</option>
              <option value="fr" className="bg-background text-foreground">FR</option>
              <option value="ar" className="bg-background text-foreground">AR</option>
            </select>
            <div className="md:hidden flex gap-2">
              <Link to="/settings" className="p-2 text-muted-foreground">
                <SettingsIcon className="h-5 w-5" />
              </Link>
              <Link to="/about" className="p-2 text-muted-foreground">
                <Info className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
