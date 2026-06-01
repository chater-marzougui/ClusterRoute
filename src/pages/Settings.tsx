import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export default function Settings() {
  const { t } = useTranslation();
  const { geminiApiKey, parsingMode, setGeminiApiKey, setParsingMode } = useAppStore();
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
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
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
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings')}</CardTitle>
          <CardDescription>Manage your preferences and API keys.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t('parsingMode')}</Label>
            <select
              value={parsingMode}
              onChange={(e) => setParsingMode(e.target.value as any)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="auto" className="bg-background text-foreground">{t('auto')}</option>
              <option value="gemini" className="bg-background text-foreground">{t('geminiOnly')}</option>
              <option value="local" className="bg-background text-foreground">{t('localOnly')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t('geminiApiKey')}</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="AIza..."
                value={geminiApiKey}
                onChange={(e) => {
                  setGeminiApiKey(e.target.value);
                  setTestStatus('idle');
                  setTestMessage('');
                }}
              />
              <Button variant="outline" onClick={handleTestKey} disabled={testStatus === 'testing' || !geminiApiKey}>
                {testStatus === 'testing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('testKey', 'Test')}
              </Button>
            </div>
            {testStatus === 'success' && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500 mt-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>{testMessage}</span>
              </div>
            )}
            {testStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive mt-2">
                <AlertCircle className="h-4 w-4" />
                <span>{testMessage}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
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
