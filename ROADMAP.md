# ClusterRoute — Roadmap

Quality-of-life improvements, roughly ordered by impact vs. effort.

---

## Search & Parsing

- [ ] **Search history** — persist the last N queries in localStorage and show them as a dropdown, so users don't retype the same errand lists
- [ ] **Inline suggestions while typing** — show recognized intents as chips below the input (e.g. `[ATM] [Café] [Pharmacy]`) before the user hits Search, so they can verify parsing before waiting on the API
- [ ] **Expand the local keyword list** — `bakery`, `gym`, `post office`, `school`, `dentist`, `vet` are missing; adding them reduces the need for a Gemini key
- [ ] **Reorder stops via drag-and-drop** — the optimizer respects intent order, so letting users drag the parsed chips re-runs with a custom order instead of forcing them to retype

## Results & Map

- [ ] **"Open in Google Maps / Apple Maps" button per stop** — one tap to navigate to a single stop using the native maps app; useful on mobile
- [ ] **"Open full route in Google Maps"** — build a `https://www.google.com/maps/dir/...` URL from all stops and open it in a new tab
- [ ] **Show candidate places for each stop** — the optimizer already returns `candidates` but the UI discards them; a small expandable list per stop lets users swap a stop for a different nearby option without re-running the search
- [ ] **Estimated travel time** — add a rough walking/driving time alongside the distance (can be calculated from distance with a fixed speed constant without any API)
- [ ] **Map tile style toggle** — allow switching between OSM standard, satellite (e.g. Esri WorldImagery), and dark tiles to match user preference
- [ ] **Cluster view for candidates** — dim markers for candidates not in the selected route, highlight the active route; helps users see what alternatives exist at a glance

## Settings & Configuration

- [ ] **Theme and language controls moved to Settings page** — they currently exist in the store but there is no UI on the Settings page to change them; add the dropdowns
- [ ] **Search radius setting** — Overpass radius is hardcoded to 15 km; expose it as a slider (1–50 km) in Settings
- [ ] **Max results per stop** — the candidate cap (5 or 10) is hardcoded in the optimizer; surface it as a setting for power users

## Performance & Reliability

- [ ] **React Query caching for Overpass requests** — `@tanstack/react-query` is already installed but unused; wrapping `fetchOSMPlaces` in a query would deduplicate identical requests and cache results across re-renders
- [ ] **Debounce or cache identical queries** — running the same query twice hits Overpass twice; a simple cache keyed on `query+lat+lon` would avoid redundant network calls
- [ ] **Overpass error handling** — the current error is a generic string; surface rate-limit (HTTP 429) and timeout (HTTP 504) distinctly with a "try again in X seconds" message

## UX / Polish

- [ ] **Loading skeleton for route list** — the current state shows nothing until results arrive; a skeleton that matches the final card layout would reduce perceived wait
- [ ] **Empty state with example queries** — show 2–3 clickable example queries (e.g. "ATM, coffee, pharmacy") when no search has been run yet
- [ ] **Share route via URL** — encode the active route as a query param so users can share a link that restores the result
- [ ] **PWA / installable** — add a `manifest.json` and service worker so the app can be installed on mobile; the GitHub Pages deploy already makes it a viable candidate
- [ ] **Keyboard shortcut** — `Ctrl+Enter` or `/` to focus the search input without reaching for the mouse

## Internationalization

- [ ] **Complete FR and AR translations** — `fr.json` and `ar.json` likely have gaps; audit against `en.json` and fill missing keys
- [ ] **Localize distance unit** — show miles instead of km when the browser locale suggests US/UK
- [ ] **RTL map controls** — Leaflet zoom controls appear top-left by default; move them to top-right when `dir="rtl"` is active
