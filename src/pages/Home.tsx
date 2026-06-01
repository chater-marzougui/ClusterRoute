import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Navigation, AlertCircle, Loader2, Copy, Check, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import Map from '../components/Map';
import { SearchResult, Place } from '../types';
import { splitQueryGemini, splitQueryLocal } from '../services/queryParser';
import { searchPlaces } from '../services/photon';
import { optimizeRoutes } from '../utils/optimizer';

const KM_TO_MI = 0.621371;
const HISTORY_KEY = 'clusterroute-history';
const MAX_HISTORY = 8;

function RouteSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <div className="h-4 bg-muted rounded-full w-1/2" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 p-3 border border-muted rounded-lg">
          <div className="h-5 w-5 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted rounded-full" />
            <div className="h-3 bg-muted rounded-full w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { geminiApiKey, parsingMode, searchRadius, maxCandidates, distanceUnit, overlayOpen } = useAppStore();

  // --- core state ---
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  // --- UI state ---
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [openCandidateIdx, setOpenCandidateIdx] = useState<number | null>(null);
  const [stopOverrides, setStopOverrides] = useState<Record<number, string>>({});
  const [overridePlaces, setOverridePlaces] = useState<Record<number, Place>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);
  const didAutoSearch = useRef(false);

  // --- distance formatter ---
  const formatDist = useCallback(
    (km: number) =>
      distanceUnit === 'mi'
        ? `${(km * KM_TO_MI).toFixed(1)} ${t('mi')}`
        : `${km.toFixed(1)} ${t('km')}`,
    [distanceUnit, t]
  );

  // --- resize listener ---
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // --- geolocation ---
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserLat(pos.coords.latitude); setUserLon(pos.coords.longitude); },
        (err) => { console.error(err); setUserLat(48.8566); setUserLon(2.3522); setError(t('errorGeo')); }
      );
    }
  }, [t]);

  // --- read ?q= from URL on mount ---
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
  }, []);

  // --- core search logic ---
  const runSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || !userLat || !userLon) return;
      setIsLoading(true);
      setError(null);
      setResult(null);
      setSelectedRouteIndex(0);
      setOpenCandidateIdx(null);
      setStopOverrides({});
      setOverridePlaces({});

      try {
        let phrases: string[] = [];
        if (parsingMode === 'gemini' || (parsingMode === 'auto' && geminiApiKey)) {
          try { phrases = await splitQueryGemini(searchQuery, geminiApiKey); }
          catch {
            if (parsingMode === 'gemini') throw new Error(t('errorGemini'));
            phrases = splitQueryLocal(searchQuery);
          }
        } else {
          phrases = splitQueryLocal(searchQuery);
        }

        if (phrases.length === 0) throw new Error(t('errorEmpty'));

        const placesPerStop = await searchPlaces(phrases, userLat, userLon, searchRadius);

        // Plain-language feedback: name exactly which stops we couldn't find.
        const missing = phrases.filter((_, i) => placesPerStop[i].length === 0);
        if (missing.length > 0) {
          throw new Error(t('errorNotFound', { places: missing.join(', ') }));
        }

        const { routes, candidates } = optimizeRoutes(placesPerStop, userLat, userLon, maxCandidates);

        if (routes.length === 0) throw new Error(t('errorEmpty'));

        setHistory((prev) => {
          const next = [searchQuery, ...prev.filter((h) => h !== searchQuery)].slice(0, MAX_HISTORY);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
          return next;
        });

        window.history.replaceState(null, '', `?q=${encodeURIComponent(searchQuery)}`);
        setResult({ phrases, candidates, routes });
        if (isMobile) setDrawerOpen(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'RATE_LIMITED') setError(t('errorRateLimit'));
        else if (msg === 'TIMEOUT') setError(t('errorTimeout'));
        else if (msg === 'SEARCH_FAILED') setError(t('errorSearch'));
        else setError(msg || t('errorEmpty'));
        if (isMobile) setDrawerOpen(true);
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userLat, userLon, parsingMode, geminiApiKey, searchRadius, maxCandidates, isMobile, t]
  );

  // --- auto-search from URL param once location is ready ---
  useEffect(() => {
    if (didAutoSearch.current) return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (q && userLat && userLon) { didAutoSearch.current = true; runSearch(q); }
  }, [userLat, userLon, runSearch]);

  // --- keyboard shortcut: '/' focuses search ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
        if (isMobile) setDrawerOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isMobile]);

  const clearHistory = () => { setHistory([]); localStorage.removeItem(HISTORY_KEY); };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setShowHistory(false); runSearch(query); };
  const handleHistorySelect = (q: string) => { setQuery(q); setShowHistory(false); runSearch(q); };
  const handleExampleClick = (ex: string) => { setQuery(ex); runSearch(ex); };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch { /* silently fail */ }
  };

  useEffect(() => {
    setStopOverrides({});
    setOverridePlaces({});
    setOpenCandidateIdx(null);
  }, [selectedRouteIndex]);

  const baseRoute = result?.routes[selectedRouteIndex] ?? null;
  const activeRoute = baseRoute
    ? { ...baseRoute, stops: baseRoute.stops.map((stop, idx) => stopOverrides[idx] && overridePlaces[idx] ? { ...stop, place: overridePlaces[idx] } : stop) }
    : null;

  const handleUseCandidate = (stopIdx: number, place: Place) => {
    setStopOverrides((prev) => ({ ...prev, [stopIdx]: place.id }));
    setOverridePlaces((prev) => ({ ...prev, [stopIdx]: place }));
    setOpenCandidateIdx(null);
  };

  // ---------------------------------------------------------------------------
  // Shared panel content (used by both desktop side panel and mobile drawer)
  // ---------------------------------------------------------------------------
  const panelContent = (
    <div className="flex flex-col overflow-hidden flex-1 min-h-0 pb-24">
      {/* Search area */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <form onSubmit={handleSearch} className="flex flex-col gap-2">
          <div className="relative">
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (history.length > 0) setShowHistory(true); }}
              onBlur={() => setTimeout(() => setShowHistory(false), 150)}
              placeholder={t('searchPlaceholder')}
              className="pr-10 bg-background min-h-11"
              disabled={isLoading}
            />
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />

            {/* History dropdown */}
            {showHistory && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{t('searchHistory')}
                  </span>
                  <button type="button" onClick={clearHistory} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                    {t('clearHistory')}
                  </button>
                </div>
                {history.map((h) => (
                  <button key={h} type="button" onMouseDown={() => handleHistorySelect(h)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors truncate min-h-11 flex items-center">
                    {h}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" disabled={isLoading} className="w-full gap-2 font-semibold min-h-11">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('search')}
          </Button>
        </form>

        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-md text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
          </div>
        )}

        {result && result.phrases.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground">{t('detectedIntents')}:</span>
            {result.phrases.map((phrase, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                {phrase}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="font-semibold mb-4 text-foreground">{t('results')}</h2>

        {isLoading && <RouteSkeleton />}

        {!result && !isLoading && (
          <div className="text-center text-muted-foreground pt-6 flex flex-col items-center gap-3">
            <Navigation className="h-8 w-8 opacity-20" />
            <p className="text-sm">{t('noResults')}</p>
            <div className="mt-2 space-y-1 w-full">
              <p className="text-xs font-medium text-muted-foreground mb-2">{t('tryExample')}</p>
              {([t('exampleQuery1'), t('exampleQuery2'), t('exampleQuery3')] as string[]).map((ex) => (
                <button key={ex} type="button" onClick={() => handleExampleClick(ex)}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors min-h-11 flex items-center">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {result && !isLoading && (
          <div className="space-y-4">
            {result.routes.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {result.routes.map((_, idx) => (
                  <Button key={idx} variant={idx === selectedRouteIndex ? 'default' : 'outline'} size="sm"
                    onClick={() => setSelectedRouteIndex(idx)} className="whitespace-nowrap shrink-0 h-10 px-4">
                    {t('route')} {idx + 1}
                  </Button>
                ))}
              </div>
            )}

            {activeRoute && (
              <Card className="overflow-hidden border-indigo-500/20 shadow-md gap-0 p-0 m-0">
                <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3 border-b flex justify-between items-center">
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                    {t('total')} {t('distance')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-900 dark:text-indigo-100">
                      {formatDist(activeRoute.totalDistance)}
                    </span>
                    <button type="button" onClick={handleShare} title={t('shareRoute')}
                      className="p-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors min-h-9 min-w-9 flex items-center justify-center">
                      {copiedShare ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                    </button>
                  </div>
                </div>

                {copiedShare && (
                  <div className="bg-green-50 dark:bg-green-950/30 px-3 py-1.5 text-xs text-green-700 dark:text-green-300 text-center">
                    {t('copied')}
                  </div>
                )}

                <div className="flex items-start p-3 gap-3 border-b bg-background">
                  <div className="mt-1 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20 shrink-0" />
                  <div>
                    <div className="font-medium text-sm">{t('currentLocation')}</div>
                    <div className="text-xs text-muted-foreground">{t('start')}</div>
                  </div>
                </div>

                {activeRoute.stops.map((stop, idx) => {
                  const isLast = idx === activeRoute.stops.length - 1;
                  const stopKey = `stop-${idx}`;
                  const candidatesForStop = (result.candidates[stopKey] ?? [])
                    .filter((p) => p.id !== stop.place.id)
                    .slice(0, 3);
                  const isCandidateOpen = openCandidateIdx === idx;

                  return (
                    <div key={`${stop.place.id}-${idx}`} className="border-b last:border-b-0">
                      <div className="flex items-start py-3 px-3 gap-3 bg-background hover:bg-muted/50 transition-colors">
                        <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${isLast ? 'bg-red-500' : 'bg-indigo-600'}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm leading-tight truncate">{stop.place.name}</div>
                          <div className="flex justify-between items-center mt-1">
                            <div className="text-xs text-muted-foreground uppercase">{stop.place.type}</div>
                            <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                              +{formatDist(stop.distanceFromPrevious)}
                            </div>
                          </div>
                          {stop.walkMin > 0 && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {stop.walkMin} {t('walkMin')} · {stop.driveMin} {t('driveMin')}
                            </div>
                          )}
                        </div>
                        {candidatesForStop.length > 0 && (
                          <button type="button" onClick={() => setOpenCandidateIdx(isCandidateOpen ? null : idx)}
                            title={isCandidateOpen ? t('hideCandidates') : t('showCandidates')}
                            className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors min-h-9 min-w-9 flex items-center justify-center text-muted-foreground">
                            {isCandidateOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        )}
                      </div>

                      {isCandidateOpen && candidatesForStop.length > 0 && (
                        <div className="bg-muted/30 border-t border-border px-3 py-2 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">{t('nearbyOptions')}</p>
                          {candidatesForStop.map((candidate) => {
                            const distFromUser = userLat && userLon
                              ? Math.sqrt(
                                Math.pow((candidate.lat - userLat) * 111, 2) +
                                Math.pow((candidate.lon - userLon) * 111 * Math.cos((userLat * Math.PI) / 180), 2)
                              )
                              : 0;
                            return (
                              <div key={candidate.id} className="flex items-center justify-between gap-2 bg-background rounded-md px-2 py-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium truncate">{candidate.name}</div>
                                  <div className="text-xs text-muted-foreground">{formatDist(distFromUser)}</div>
                                </div>
                                <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs px-2"
                                  onClick={() => handleUseCandidate(idx, candidate)}>
                                  {t('swapStop')}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="grow overflow-hidden relative md:flex md:flex-row">
      {/* Map — full-screen on mobile, fills remaining space on desktop */}
      <div className="w-full h-[calc(100dvh-3.5rem)] md:flex-1 md:h-auto max-h-[95dvh]">
        <Map
          userLat={userLat}
          userLon={userLon}
          route={activeRoute}
          candidates={result?.candidates}
          hideControls={overlayOpen || (isMobile && drawerOpen)}
        />
      </div>

      {/* Desktop: static side panel (left) */}
      <div className="hidden md:flex md:flex-col md:w-80 md:border-r md:h-full md:order-first shrink-0">
        {panelContent}
      </div>

      {/* Mobile: floating search button + vaul Drawer */}
      <div className="md:hidden">
        {/* FAB — visible only when drawer is closed */}
        {!drawerOpen && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-999 flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-full shadow-xl font-semibold text-sm active:scale-95 transition-transform"
          >
            <Search className="h-4 w-4" />
            <span className="max-w-45 truncate">{query || t('search')}</span>
          </button>
        )}

        {/* Drawer — vaul handles drag, snap, and dismiss */}
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          modal={false}
          snapPoints={[0.5, 0.92]}
          dismissible
        >
          <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[95vh] flex flex-col">
            {panelContent}
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}
