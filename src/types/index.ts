export type Language = 'en' | 'fr' | 'ar';

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
  walkMin: number;
  driveMin: number;
}

export interface Route {
  stops: RouteStop[];
  totalDistance: number; // in km
}

export interface SearchResult {
  phrases: string[];
  foundPhrases: string[]; // phrases that resolved, in route order
  missing: string[]; // phrases we couldn't find anywhere
  candidates: Record<string, Place[]>;
  routes: Route[];
  error?: string;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  language: Language;
  geminiApiKey: string;
  parsingMode: 'auto' | 'gemini' | 'local';
  searchRadius: number;
  maxCandidates: number;
  distanceUnit: 'km' | 'mi';
}
