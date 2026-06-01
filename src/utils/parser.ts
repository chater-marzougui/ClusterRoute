import { Intent } from '../types';

const CATEGORY_MAP: Record<string, string> = {
  atm: 'atm', cash: 'atm',
  cafe: 'cafe', coffee: 'cafe',
  grocery: 'supermarket', groceries: 'supermarket', supermarket: 'supermarket',
  bank: 'bank',
  restaurant: 'restaurant', food: 'restaurant', diner: 'restaurant',
  gas: 'fuel', fuel: 'fuel', petrol: 'fuel',
  pharmacy: 'pharmacy', drugstore: 'pharmacy',
  park: 'park', playground: 'park',
  library: 'library',
  hospital: 'hospital', clinic: 'hospital'
};

const BRAND_MAP: Record<string, string> = {
  td: 'TD',
  walmart: 'Walmart',
  starbucks: 'Starbucks',
  'tim hortons': 'Tim Hortons', tims: 'Tim Hortons',
  mcdonalds: 'McDonald\'s', "mcdonald's": 'McDonald\'s',
  subway: 'Subway',
  shell: 'Shell',
  costco: 'Costco',
  target: 'Target'
};

export function parseQueryLocal(query: string): Intent[] {
  const words = query.toLowerCase().replace(/[,;\.]/g, ' ').split(/\s+|and|then|to|next/);
  const intents: Intent[] = [];
  
  let currentIntent: Partial<Intent> | null = null;

  for (const word of words) {
    if (!word) continue;
    
    // Check brand
    if (BRAND_MAP[word] || (word === 'tim' || word === 'hortons' ? 'Tim Hortons' : false)) {
      if (!currentIntent) currentIntent = {};
      currentIntent.brand = BRAND_MAP[word] || 'Tim Hortons';
    }

    // Check category
    for (const key in CATEGORY_MAP) {
      if (word.includes(key)) {
        if (!currentIntent) currentIntent = {};
        currentIntent.type = CATEGORY_MAP[key];
        intents.push(currentIntent as Intent);
        currentIntent = null;
        break;
      }
    }
  }

  // If a brand was found but no category, default it based on typical brand behavior
  if (currentIntent && currentIntent.brand && !currentIntent.type) {
    const brand = currentIntent.brand;
    if (brand === 'TD') currentIntent.type = 'bank';
    if (brand === 'Walmart' || brand === 'Costco' || brand === 'Target') currentIntent.type = 'supermarket';
    if (brand === 'Starbucks' || brand === 'Tim Hortons') currentIntent.type = 'cafe';
    if (brand === 'McDonald\'s' || brand === 'Subway') currentIntent.type = 'restaurant';
    if (brand === 'Shell') currentIntent.type = 'fuel';
    
    if (currentIntent.type) intents.push(currentIntent as Intent);
  }

  return intents;
}
