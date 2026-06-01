import { Intent } from '../types';

export async function parseQueryGemini(query: string, apiKey: string): Promise<Intent[]> {
  if (!apiKey) throw new Error("Gemini API key is required");

  const prompt = `You are an intent parser. The user wants to visit multiple places (like a cluster or route).
Parse the following free-form query and return ONLY a raw JSON array of objects.
Do not include markdown blocks, do not include \`\`\`json. Return strictly JSON.
Each object must have a 'type' (choose from: atm, cafe, bank, supermarket, restaurant, fuel, pharmacy, park, library, hospital).
Optionally include a 'brand' if a specific brand name is mentioned (e.g., 'TD', 'Walmart').

Query: "${query}"`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error("No response from Gemini");
  }

  // Sanitize Markdown
  const sanitized = textContent.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(sanitized);
    if (Array.isArray(parsed)) {
      return parsed as Intent[];
    }
    throw new Error("Invalid output structure");
  } catch (err) {
    console.error("Failed to parse Gemini JSON", sanitized);
    throw new Error("Failed to parse AI output");
  }
}
