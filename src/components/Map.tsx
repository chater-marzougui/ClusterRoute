import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Place, Route } from '../types';

// Custom DivIcons using Lucide HTML logic via tailwind classes
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
  popupAnchor: [0, -16]
});

// Component to auto-fit bounds
function FitBounds({ route, userLat, userLon }: { route: Route | null; userLat: number | null; userLon: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.stops.length > 0 && userLat && userLon) {
      const points: L.LatLngExpression[] = [
        [userLat, userLon],
        ...route.stops.map(s => [s.place.lat, s.place.lon] as L.LatLngExpression)
      ];
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    } else if (userLat && userLon) {
      map.setView([userLat, userLon], 13);
    }
  }, [route, userLat, userLon, map]);
  return null;
}

export default function Map({
  userLat,
  userLon,
  route
}: {
  userLat: number | null;
  userLon: number | null;
  route: Route | null;
  candidates?: Record<string, Place[]>;
}) {
  const defaultCenter: L.LatLngExpression = [48.8566, 2.3522]; // Paris default

  // Compute polyline positions
  const polylinePositions: L.LatLngExpression[] = [];
  if (route && userLat && userLon) {
    polylinePositions.push([userLat, userLon]);
    route.stops.forEach(stop => polylinePositions.push([stop.place.lat, stop.place.lon]));
  }

  return (
    <MapContainer 
      center={userLat && userLon ? [userLat, userLon] : defaultCenter} 
      zoom={13} 
      className="w-full h-full min-h-[400px] z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {userLat && userLon && (
        <Marker position={[userLat, userLon]} icon={createUserIcon()}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {route && route.stops.map((stop, index) => {
        const isLast = index === route.stops.length - 1;
        return (
          <Marker 
            key={stop.place.id} 
            position={[stop.place.lat, stop.place.lon]}
            icon={createStopIcon(index, isLast)}
          >
            <Popup className="font-sans">
              <div className="font-bold">{stop.place.name}</div>
              <div className="text-xs text-muted-foreground uppercase">{stop.place.type}</div>
              {stop.place.brand && <div className="text-xs">{stop.place.brand}</div>}
              <div className="text-xs mt-1">From previous: {stop.distanceFromPrevious.toFixed(1)} km</div>
            </Popup>
          </Marker>
        );
      })}

      {route && (
        <Polyline 
          positions={polylinePositions} 
          pathOptions={{ color: '#4f46e5', weight: 4, opacity: 0.8, dashArray: '10, 10' }} 
        />
      )}

      <FitBounds route={route} userLat={userLat} userLon={userLon} />
    </MapContainer>
  );
}
