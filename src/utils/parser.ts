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
  hospital: 'hospital', clinic: 'hospital',
  bakery: 'bakery', boulangerie: 'bakery', pastry: 'bakery',
  gym: 'gym', fitness: 'gym', sport: 'gym',
  post: 'post_office', mail: 'post_office', postoffice: 'post_office',
  school: 'school', college: 'school', university: 'school',
  dentist: 'dentist', dental: 'dentist',
  vet: 'veterinary', veterinary: 'veterinary', veterinarian: 'veterinary',
  hotel: 'hotel', motel: 'hotel', inn: 'hotel',
  cinema: 'cinema', movie: 'cinema', theatre: 'cinema', theater: 'cinema',
  museum: 'museum',
  hairdresser: 'hairdresser', barber: 'hairdresser', haircut: 'hairdresser', salon: 'hairdresser',
  laundry: 'laundry', laundromat: 'laundry'
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
  target: 'Target',
  cvs: 'CVS',
  walgreens: 'Walgreens',
  'rite aid': 'Rite Aid', riteaid: 'Rite Aid',
  'burger king': 'Burger King', burgerking: 'Burger King',
  kfc: 'KFC',
  'pizza hut': 'Pizza Hut', pizzahut: 'Pizza Hut',
  dominos: 'Domino\'s', "domino's": 'Domino\'s', domino: 'Domino\'s',
  bp: 'BP',
  chevron: 'Chevron',
  exxon: 'Exxon',
  '7-eleven': '7-Eleven', '7eleven': '7-Eleven', 'seven eleven': '7-Eleven',
  ikea: 'IKEA',
  'home depot': 'Home Depot', homedepot: 'Home Depot',
  'canadian tire': 'Canadian Tire', canadiantire: 'Canadian Tire'
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
    if (brand === 'Walmart' || brand === 'Costco' || brand === 'Target' || brand === 'IKEA' || brand === 'Home Depot' || brand === 'Canadian Tire') currentIntent.type = 'supermarket';
    if (brand === 'Starbucks' || brand === 'Tim Hortons') currentIntent.type = 'cafe';
    if (brand === 'McDonald\'s' || brand === 'Subway' || brand === 'Burger King' || brand === 'KFC' || brand === 'Pizza Hut' || brand === 'Domino\'s') currentIntent.type = 'restaurant';
    if (brand === 'Shell' || brand === 'BP' || brand === 'Chevron' || brand === 'Exxon') currentIntent.type = 'fuel';
    if (brand === 'CVS' || brand === 'Walgreens' || brand === 'Rite Aid') currentIntent.type = 'pharmacy';
    if (brand === '7-Eleven') currentIntent.type = 'supermarket';

    if (currentIntent.type) intents.push(currentIntent as Intent);
  }

  return intents;
}
