import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Navigation, AlertCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import Map from '../components/Map';
import { SearchResult, Intent } from '../types';
import { parseQueryGemini } from '../services/gemini';
import { parseQueryLocal } from '../utils/parser';
import { fetchOSMPlaces } from '../services/overpass';
import { optimizeRoutes } from '../utils/optimizer';

export default function Home() {
  const { t } = useTranslation();
  const { geminiApiKey, parsingMode } = useAppStore();
  
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLon(pos.coords.longitude);
        },
        (err) => {
          console.error(err);
          // Fallback to a default location (e.g. center of Paris) if denied
          setUserLat(48.8566);
          setUserLon(2.3522);
          setError(t('errorGeo'));
        }
      );
    }
  }, [t]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!userLat || !userLon) {
      setError(t('errorGeo'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setSelectedRouteIndex(0);

    try {
      // 1. Parse Intents
      let intents: Intent[] = [];
      if (parsingMode === 'gemini' || (parsingMode === 'auto' && geminiApiKey)) {
        try {
          intents = await parseQueryGemini(query, geminiApiKey);
        } catch (err) {
          if (parsingMode === 'gemini') throw new Error(t('errorGemini'));
          console.warn("Gemini failed, falling back to local");
          intents = parseQueryLocal(query);
        }
      } else {
        intents = parseQueryLocal(query);
      }

      if (intents.length === 0) {
        throw new Error(t('errorEmpty'));
      }

      // 2. Fetch OSM Data
      const places = await fetchOSMPlaces(intents, userLat, userLon);
      
      // 3. Optimize Route
      const { routes, candidates } = optimizeRoutes(intents, places, userLat, userLon);

      if (routes.length === 0) {
        throw new Error(t('errorEmpty'));
      }

      setResult({ intents, candidates, routes });
    } catch (err: any) {
      setError(err.message || t('errorEmpty'));
    } finally {
      setIsLoading(false);
    }
  };

  const activeRoute = result?.routes[selectedRouteIndex] || null;

  return (
    <div className="flex flex-col md:flex-row h-full flex-grow overflow-hidden">
      {/* Left Panel */}
      <div className="w-full md:w-1/3 lg:w-1/4 min-w-[300px] border-r border-border bg-card flex flex-col h-[50vh] md:h-auto overflow-y-auto z-10 shadow-lg">
        <div className="p-4 border-b border-border space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-2">
            <div className="relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pr-10 bg-background"
                disabled={isLoading}
              />
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full gap-2 font-semibold">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('search')}
            </Button>
          </form>

          {error && (
            <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-md text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="p-4 flex-grow overflow-y-auto">
          <h2 className="font-semibold mb-4 text-foreground">{t('results')}</h2>
          
          {!result && !isLoading && (
            <div className="text-center text-muted-foreground pt-8 flex flex-col items-center gap-2">
              <Navigation className="h-8 w-8 opacity-20" />
              <p>{t('noResults')}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Route Options Selector */}
              {result.routes.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {result.routes.map((_, idx) => (
                    <Button
                      key={idx}
                      variant={idx === selectedRouteIndex ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedRouteIndex(idx)}
                      className="whitespace-nowrap shrink-0"
                    >
                      {t('route')} {idx + 1}
                    </Button>
                  ))}
                </div>
              )}

              {activeRoute && (
                <Card className="overflow-hidden border-indigo-500/20 shadow-md">
                  <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3 border-b flex justify-between items-center">
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300">{t('total')} {t('distance')}</span>
                    <span className="font-bold text-indigo-900 dark:text-indigo-100">{activeRoute.totalDistance.toFixed(2)} {t('km')}</span>
                  </div>
                  <div className="p-0">
                    {/* User Start point */}
                    <div className="flex items-start p-3 gap-3 border-b bg-background">
                      <div className="mt-1 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20 shrink-0" />
                      <div>
                        <div className="font-medium text-sm">{t('currentLocation')}</div>
                        <div className="text-xs text-muted-foreground">{t('start')}</div>
                      </div>
                    </div>
                    {/* Stops */}
                    {activeRoute.stops.map((stop, idx) => {
                      const isLast = idx === activeRoute.stops.length - 1;
                      return (
                        <div key={stop.place.id} className="flex items-start p-3 gap-3 border-b last:border-b-0 bg-background hover:bg-muted/50 transition-colors">
                          <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${isLast ? 'bg-red-500' : 'bg-indigo-600'}`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm leading-tight">{stop.place.name}</div>
                            <div className="flex justify-between items-center mt-1">
                              <div className="text-xs text-muted-foreground uppercase">{stop.place.type}</div>
                              <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                +{stop.distanceFromPrevious.toFixed(1)} {t('km')}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="w-full md:w-2/3 lg:w-3/4 h-[50vh] md:h-auto relative z-0">
        <Map userLat={userLat} userLon={userLon} route={activeRoute} />
      </div>
    </div>
  );
}
