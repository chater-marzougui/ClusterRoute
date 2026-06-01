// Splits a free-text errand query into one search phrase per stop.

// Connectors that separate stops: comma, semicolon, ampersand, and the words
// "and" / "then" (as whole words). Note: this will mis-split phrases like
// "fish and chips" — that's the case the Gemini fallback is meant to handle.
const CONNECTORS = /\s*(?:,|;|&|\bthen\b|\band\b)\s*/i;

export function splitQueryLocal(query: string): string[] {
  return query
    .split(CONNECTORS)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function splitQueryGemini(query: string, apiKey: string): Promise<string[]> {
  if (!apiKey) throw new Error('Gemini API key is required');

  const prompt = `You turn an errand description into a list of place-search phrases.
Return ONLY a raw JSON array of short strings — one per place the user wants to visit.
Each string should be something you could type into a maps search box (a place name,
brand, or category), e.g. ["TD bank", "coffee shop", "pharmacy"].
Do not include markdown or code fences. Return strictly JSON.

Query: "${query}"`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) throw new Error('No response from Gemini');

  const sanitized = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(sanitized);
  if (!Array.isArray(parsed)) throw new Error('Invalid output structure');

  return parsed
    .map((item: unknown) => (typeof item === 'string' ? item.trim() : String(item).trim()))
    .filter(Boolean);
}
