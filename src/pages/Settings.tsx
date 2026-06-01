import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertCircle, Sun, Moon, Monitor, Globe } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export default function Settings() {
  const { t } = useTranslation();
  const {
    geminiApiKey, setGeminiApiKey,
    parsingMode, setParsingMode,
    theme, setTheme,
    language, setLanguage,
    searchRadius, setSearchRadius,
    maxCandidates, setMaxCandidates,
    distanceUnit, setDistanceUnit,
  } = useAppStore();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTestKey = async () => {
    if (!geminiApiKey) {
      setTestStatus('error');
      setTestMessage(t('testKeyEmpty', 'Please enter an API key first.'));
      return;
    }
    setTestStatus('testing');
    setTestMessage('');
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello" }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      });
      if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        setTestStatus('success');
        setTestMessage(t('testKeySuccess', 'API Key is valid!'));
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || t('testKeyError', 'Failed to verify API key.'));
    }
  };

  return (
    <div className="my-auto mx-0 px-4 py-4 max-w-2xl space-y-4 sm:space-y-6 sm:mx-auto">

      {/* Appearance Section */}
      <Card>
        <CardHeader className="px-4 py-0 sm:px-6">
          <CardTitle className="text-base">{t('theme')}</CardTitle>
          <CardDescription className="text-sm">
            <Globe className="inline h-4 w-4 mr-1 -mt-0.5" />
            {t('language')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-1 sm:px-6 sm:pb-6 space-y-4 sm:space-y-6">

          {/* Theme Toggle */}
          <div className="space-y-2">
            <Label className="text-sm">{t('theme')}</Label>
            <div className="flex w-full gap-1">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                className="flex-1 text-base"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-4 w-4 mr-1.5" />
                {t('light')}
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                className="flex-1 text-base"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-4 w-4 mr-1.5" />
                {t('dark')}
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                className="flex-1 text-base"
                onClick={() => setTheme('system')}
              >
                <Monitor className="h-4 w-4 mr-1.5" />
                {t('system')}
              </Button>
            </div>
          </div>

          {/* Language Toggle */}
          <div className="space-y-2">
            <Label className="text-sm">{t('language')}</Label>
            <div className="flex w-full gap-1">
              <Button
                variant={language === 'en' ? 'default' : 'outline'}
                className="flex-1 text-base"
                onClick={() => setLanguage('en')}
              >
                EN
              </Button>
              <Button
                variant={language === 'fr' ? 'default' : 'outline'}
                className="flex-1 text-base"
                onClick={() => setLanguage('fr')}
              >
                FR
              </Button>
              <Button
                variant={language === 'ar' ? 'default' : 'outline'}
                className="flex-1 text-base"
                onClick={() => setLanguage('ar')}
              >
                AR
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Search Section */}
      <Card>
        <CardHeader className="px-4 py-1 sm:px-4">
          <CardTitle className="text-base">{t('parsingMode')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-5 sm:px-6 sm:pb-6 space-y-4 sm:space-y-6">

          {/* Parsing Mode */}
          <div className="space-y-2">
            <Label className="text-sm">{t('parsingMode')}</Label>
            <select
              value={parsingMode}
              onChange={(e) => setParsingMode(e.target.value as any)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="auto" className="bg-background text-foreground">{t('auto')}</option>
              <option value="gemini" className="bg-background text-foreground">{t('geminiOnly')}</option>
              <option value="local" className="bg-background text-foreground">{t('localOnly')}</option>
            </select>
          </div>

          {/* Search Radius Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t('searchRadius')}</Label>
              <span className="text-sm font-medium tabular-nums">{searchRadius} {t('km')}</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={searchRadius}
              onChange={(e) => setSearchRadius(Number(e.target.value))}
              className="w-full h-6 accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 {t('km')}</span>
              <span>50 {t('km')}</span>
            </div>
          </div>

          {/* Max Candidates Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t('maxCandidates')}</Label>
              <span className="text-sm font-medium tabular-nums">{maxCandidates}</span>
            </div>
            <input
              type="range"
              min={3}
              max={20}
              step={1}
              value={maxCandidates}
              onChange={(e) => setMaxCandidates(Number(e.target.value))}
              className="w-full h-6 accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>3</span>
              <span>20</span>
            </div>
          </div>

          {/* Distance Unit Toggle */}
          <div className="space-y-2">
            <Label className="text-sm">{t('distanceUnit')}</Label>
            <div className="flex w-full gap-1">
              <Button
                variant={distanceUnit === 'km' ? 'default' : 'outline'}
                className="flex-1 text-base"
                onClick={() => setDistanceUnit('km')}
              >
                {t('km')}
              </Button>
              <Button
                variant={distanceUnit === 'mi' ? 'default' : 'outline'}
                className="flex-1 text-base"
                onClick={() => setDistanceUnit('mi')}
              >
                {t('miles')}
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* AI / API Section */}
      <Card>
        <CardHeader className="px-4 py-1 sm:px-4">
          <CardTitle className="text-base">{t('geminiApiKey')}</CardTitle>
          <CardDescription className="text-sm">
            {t('settings')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-5 sm:px-6 sm:pb-6 space-y-4 sm:space-y-6">

          <div className="space-y-2">
            <Label className="text-sm">{t('geminiApiKey')}</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="AIza..."
                value={geminiApiKey}
                className="text-base"
                onChange={(e) => {
                  setGeminiApiKey(e.target.value);
                  setTestStatus('idle');
                  setTestMessage('');
                }}
              />
              <Button
                variant="outline"
                onClick={handleTestKey}
                disabled={testStatus === 'testing' || !geminiApiKey}
              >
                {testStatus === 'testing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('testKey', 'Test')}
              </Button>
            </div>
            {testStatus === 'success' && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500 mt-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{testMessage}</span>
              </div>
            )}
            {testStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive mt-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{testMessage}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {t('getApiKey')}
              </a>
              {' - stored locally only.'}
            </p>
          </div>

        </CardContent>
      </Card>

    </div>
  );
}
