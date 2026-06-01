export interface Intent {
  type: string;
  brand?: string;
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
  brand?: string;
  tags: Record<string, string>;
}

export interface RouteStop {
  place: Place;
  distanceFromPrevious: number; // in km
}

export interface Route {
  stops: RouteStop[];
  totalDistance: number; // in km
}

export interface SearchResult {
  intents: Intent[];
  candidates: Record<string, Place[]>;
  routes: Route[];
  error?: string;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'fr' | 'ar';
  geminiApiKey: string;
  parsingMode: 'auto' | 'gemini' | 'local';
}
