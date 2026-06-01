import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Plus, Minus, Locate, Map as MapIcon, Globe, Moon } from 'lucide-react';
import { Place, Route } from '../types';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Tile layer config
// ---------------------------------------------------------------------------
type MapStyle = 'street' | 'satellite' | 'dark';

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
};

// ---------------------------------------------------------------------------
// Icon creators (unchanged)
// ---------------------------------------------------------------------------
const createUserIcon = () => new L.DivIcon({
  className: 'bg-transparent border-0',
  html: `<div class="relative flex h-5 w-5 items-center justify-center">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-blue-600 border-2 border-white"></span>
        </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const createStopIcon = (index: number, isLast: boolean) => new L.DivIcon({
  className: 'bg-transparent border-0',
  html: `<div class="flex h-8 w-8 items-center justify-center rounded-full ${isLast ? 'bg-red-500' : 'bg-indigo-600'} text-white shadow-lg border-2 border-white font-bold text-sm">
          ${index + 1}
        </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Candidate (swappable option) marker, labelled with the stop number it belongs
// to. Icons are cached per number so their identity stays stable — that stops
// react-leaflet from re-creating existing markers (which would replay the pop
// animation); newly added markers still animate once when they mount.
const candidateIconCache: Record<number, L.DivIcon> = {};
const candidateIcon = (stopNumber: number): L.DivIcon => {
  const cached = candidateIconCache[stopNumber];
  if (cached) return cached;
  const icon = new L.DivIcon({
    className: 'bg-transparent border-0',
    html: `<div class="cr-candidate-pop flex items-center justify-center" style="width:24px;height:24px;border-radius:50%;background:#0009af;border:2px solid #fff;opacity:0.85;color:#fff;font-size:12px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,0.35);">${stopNumber}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
  candidateIconCache[stopNumber] = icon;
  return icon;
};

// Render at most this many gray option markers, for performance.
const MAX_CANDIDATE_MARKERS = 300;

// ---------------------------------------------------------------------------
// FitBounds (unchanged)
// ---------------------------------------------------------------------------
function FitBounds({ route, userLat, userLon }: { route: Route | null; userLat: number | null; userLon: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.stops.length > 0 && userLat && userLon) {
      const points: L.LatLngExpression[] = [
        [userLat, userLon],
        ...route.stops.map(s => [s.place.lat, s.place.lon] as L.LatLngExpression),
      ];
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    } else if (userLat && userLon) {
      map.setView([userLat, userLon], 13);
    }
  }, [route, userLat, userLon, map]);
  return null;
}

// ---------------------------------------------------------------------------
// Remove the default Leaflet zoom control
// ---------------------------------------------------------------------------
function HideDefaultZoom() {
  const map = useMap();
  useEffect(() => {
    if (map.zoomControl) map.zoomControl.remove();
  }, [map]);
  return null;
}

// ---------------------------------------------------------------------------
// Expose the Leaflet map instance to the parent component
// ---------------------------------------------------------------------------
function MapController({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

// ---------------------------------------------------------------------------
// Map component
// ---------------------------------------------------------------------------
export default function Map({
  userLat,
  userLon,
  route,
  candidates,
  hideControls = false,
  onSwapCandidate,
}: {
  userLat: number | null;
  userLon: number | null;
  route: Route | null;
  candidates?: Record<string, Place[]>;
  hideControls?: boolean;
  onSwapCandidate?: (stopIndex: number, place: Place) => void;
}) {
  const [mapStyle, setMapStyle] = useState<MapStyle>('street');
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);
  const { t } = useTranslation();

  const handleMapReady = useCallback((map: L.Map) => {
    setLeafletMap(map);
  }, []);

  const isRtl = document.documentElement.dir === 'rtl';

  const defaultCenter: L.LatLngExpression = [48.8566, 2.3522];

  // Polyline positions
  const polylinePositions: L.LatLngExpression[] = [];
  if (route && userLat && userLon) {
    polylinePositions.push([userLat, userLon]);
    route.stops.forEach(stop => polylinePositions.push([stop.place.lat, stop.place.lon]));
  }

  // Candidate places not already in route, tagged with the stop index they
  // belong to (parsed from the "stop-0" / "live-0" key) so the marker can show
  // the stop number and the popup can swap that specific stop.
  const routeIds = new Set(route?.stops.map(s => s.place.id) ?? []);
  const flatCandidates: { place: Place; stopIndex: number }[] = [];
  if (candidates) {
    for (const [key, places] of Object.entries(candidates)) {
      const stopIndex = parseInt(key.split('-')[1] ?? '0', 10) || 0;
      for (const p of places) {
        if (!routeIds.has(p.id)) flatCandidates.push({ place: p, stopIndex });
      }
    }
  }
  const showCandidates = flatCandidates.length > 0;

  // Google Maps full-route URL
  const buildGoogleMapsRouteUrl = () => {
    if (!route || !userLat || !userLon) return '#';
    const waypoints = route.stops.map(s => `${s.place.lat},${s.place.lon}`).join('/');
    return `https://www.google.com/maps/dir/${userLat},${userLon}/${waypoints}`;
  };

  const tileConfig = TILE_LAYERS[mapStyle];

  // Panel and "Open in Maps" positions based on RTL
  const panelPosition = isRtl ? 'left-2' : 'right-2';
  const mapsLinkPosition = isRtl ? 'left-4' : 'right-4';

  // Shared button classes
  const btnBase = 'h-10 w-10 flex items-center justify-center text-xs font-semibold transition-colors';
  const btnInactive = 'bg-card text-foreground hover:bg-muted';

  return (
    <div className="relative w-full h-full min-h-100">

      {/* ------------------------------------------------------------------ */}
      {/* Unified Google Maps-style control panel — bottom-right (or left RTL) */}
      {/* Hidden on mobile when the bottom sheet is open                      */}
      {/* ------------------------------------------------------------------ */}
      {!hideControls && <div
        className={`absolute bottom-6 ${panelPosition} z-1000 flex flex-col rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700`}
      >
        {/* Zoom In */}
        <button
          className={`${btnBase} ${btnInactive}`}
          onClick={() => leafletMap?.zoomIn()}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>

        {/* Zoom Out */}
        <button
          className={`${btnBase} ${btnInactive} border-t border-gray-200 dark:border-gray-600`}
          onClick={() => leafletMap?.zoomOut()}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>

        {/* Center on my location */}
        <button
          className={`${btnBase} ${btnInactive} border-t border-gray-200 dark:border-gray-600`}
          onClick={() => {
            if (leafletMap && userLat && userLon) {
              leafletMap.setView([userLat, userLon], 15);
            }
          }}
          title="Center on my location"
          aria-label="Center on my location"
        >
          <Locate size={16} />
        </button>

        {/* Cycle map style — single button, icon shows next style */}
        {(() => {
          const CYCLE: MapStyle[] = ['street', 'satellite', 'dark'];
          const ICONS = { street: MapIcon, satellite: Globe, dark: Moon };
          const TITLES = { street: 'Street', satellite: 'Satellite', dark: 'Dark' };
          const NextIcon = ICONS[mapStyle];
          return (
            <button
              className={`${btnBase} border-t border-gray-200 dark:border-gray-600 ${btnInactive}`}
              onClick={() => setMapStyle(CYCLE[(CYCLE.indexOf(mapStyle) + 1) % CYCLE.length])}
              title={`Map: ${TITLES[mapStyle]}`}
              aria-label={`Map style: ${TITLES[mapStyle]}`}
            >
              <NextIcon size={16} />
            </button>
          );
        })()}
      </div>}

      {/* ------------------------------------------------------------------ */}
      {/* Open full route in Google Maps — top-right (or top-left in RTL)      */}
      {/* ------------------------------------------------------------------ */}
      {!hideControls && route && userLat && userLon && (
        <div
          className={`absolute top-4 ${mapsLinkPosition} z-1000`}
        >
          <a
            href={buildGoogleMapsRouteUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-lg hover:bg-indigo-700 transition-colors min-h-9"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            {t('openFullRoute')}
          </a>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* The actual Leaflet map                                              */}
      {/* ------------------------------------------------------------------ */}
      <MapContainer
        center={userLat && userLon ? [userLat, userLon] : defaultCenter}
        zoom={13}
        className="w-full h-full min-h-100 z-0"
        style={{ height: '100%', minHeight: '400px' }}
        zoomControl={false}
      >
        {/* Conditionally rendered TileLayer based on mapStyle state */}
        <TileLayer
          key={mapStyle}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
        />

        {/* User location marker */}
        {userLat && userLon && (
          <Marker position={[userLat, userLon]} icon={createUserIcon()}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {/* Candidate markers (swappable options not in the active route) */}
        {showCandidates && flatCandidates.slice(0, MAX_CANDIDATE_MARKERS).map(({ place, stopIndex }) => (
          <Marker
            key={`cand-${place.id}`}
            position={[place.lat, place.lon]}
            icon={candidateIcon(stopIndex + 1)}
            opacity={0.85}
          >
            <Popup className="font-sans">
              <div className="text-[10px] font-semibold uppercase text-indigo-600">
                {t('stop')} {stopIndex + 1}
              </div>
              <div className="font-semibold text-sm">{place.name}</div>
              <div className="text-xs text-gray-500 uppercase">{place.type}</div>
              {place.brand && <div className="text-xs text-gray-500">{place.brand}</div>}
              {onSwapCandidate && route && (
                <button
                  type="button"
                  onClick={() => onSwapCandidate(stopIndex, place)}
                  className="mt-2 block w-full text-center rounded bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  {t('swapStop')}
                </button>
              )}
            </Popup>
          </Marker>
        ))}

        {/* Route stop markers */}
        {route && route.stops.map((stop, index) => {
          const isLast = index === route.stops.length - 1;
          const googleNavUrl = `https://maps.google.com/?q=${stop.place.lat},${stop.place.lon}`;
          return (
            <Marker
              key={stop.place.id}
              position={[stop.place.lat, stop.place.lon]}
              icon={createStopIcon(index, isLast)}
            >
              <Popup className="font-sans">
                <div className="font-bold">{stop.place.name}</div>
                <div className="text-xs text-gray-500 uppercase">{stop.place.type}</div>
                {stop.place.brand && <div className="text-xs">{stop.place.brand}</div>}
                <div className="text-xs mt-1">From previous: {stop.distanceFromPrevious.toFixed(1)} km</div>
                {stop.walkMin > 0 && (
                  <div className="text-xs">Walk: {stop.walkMin} min · Drive: {stop.driveMin} min</div>
                )}
                <a
                  href={googleNavUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block w-full text-center rounded bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  Navigate
                </a>
              </Popup>
            </Marker>
          );
        })}

        {/* Route polyline */}
        {route && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{ color: '#4f46e5', weight: 4, opacity: 0.8, dashArray: '10, 10' }}
          />
        )}

        <FitBounds route={route} userLat={userLat} userLon={userLon} />
        <HideDefaultZoom />
        <MapController onReady={handleMapReady} />
      </MapContainer>
    </div>
  );
}
