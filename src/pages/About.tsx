import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl pb-24 md:pb-8">
      <h1 className="text-3xl font-bold mb-4">{t('about')}</h1>
      <p className="text-lg mb-6 text-muted-foreground">{t('aboutText')}</p>

      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              ClusterRoute takes your free-form text input (e.g. "TD ATM, Walmart, Cafe") and uses a dual-parsing system.
              If you provide a Gemini API key, it uses Gemini Flash Lite to accurately extract the intents and brands.
              Otherwise, it falls back to a fast, local dictionary-based parser.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>OpenStreetMap &amp; Overpass API</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              The extracted intents are then queried against OpenStreetMap using the Overpass API within a 15km radius of your current location.
              We find the best candidates matching your criteria and brands.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Route Optimization</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Once candidates are found, our local algorithm generates all possible visit combinations and permutations.
              It scores them using the Haversine distance formula to find the mathematically shortest route connecting all your desired stops.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              <strong>Everything runs client-side.</strong> No analytics, no tracking, no cookies.
              Your Gemini API Key is stored only in your browser's <code>localStorage</code> and sent directly to Google's API endpoint.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
