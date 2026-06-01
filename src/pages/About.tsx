import { useTranslation } from 'react-i18next';

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl prose prose-slate dark:prose-invert">
      <h1>{t('about')}</h1>
      <p className="text-lg lead">{t('aboutText')}</p>
      
      <h2>How it works</h2>
      <p>
        ClusterRoute takes your free-form text input (e.g. "TD ATM, Walmart, Cafe") and uses a dual-parsing system.
        If you provide a Gemini API key, it uses Gemini Flash Lite to accurately extract the intents and brands.
        Otherwise, it falls back to a fast, local dictionary-based parser.
      </p>

      <h2>OpenStreetMap & Overpass API</h2>
      <p>
        The extracted intents are then queried against OpenStreetMap using the Overpass API within a 15km radius of your current location.
        We find the best candidates matching your criteria and brands.
      </p>

      <h2>Route Optimization</h2>
      <p>
        Once candidates are found, our local algorithm generates all possible visit combinations and permutations.
        It scores them using the Haversine distance formula to find the mathematically shortest route connecting all your desired stops.
      </p>

      <h2>Privacy</h2>
      <p>
        <strong>Everything runs client-side.</strong> No analytics, no tracking, no cookies.
        Your Gemini API Key is stored only in your browser's <code>localStorage</code> and sent directly to Google's API endpoint.
      </p>
    </div>
  );
}
