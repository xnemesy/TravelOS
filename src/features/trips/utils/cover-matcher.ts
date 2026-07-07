import { DESTINATIONS_CATALOG } from '../../places/catalog/destinations.catalog';

/**
 * Auto-Cover intelligenza per assegnare automaticamente una copertina editoriale
 * in base alla destinazione inserita dall'utente (Stile Apple Foto).
 */

interface CoverRule {
  keywords: string[];
  url: string;
}

const COVER_RULES: CoverRule[] = [
  {
    keywords: ['budapest', 'ungheria', 'hungary'],
    url: 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?q=80&w=800&auto=format&fit=crop', // Parlamento di Budapest
  },
  {
    keywords: ['kyoto', 'tokyo', 'giappone', 'japan', 'osaka'],
    url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop', // Kyoto Temple
  },
  {
    keywords: ['amalfi', 'costiera', 'italia', 'italy', 'roma', 'rome', 'venezia', 'venice', 'firenze', 'florence', 'milano', 'napoli'],
    url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=800&auto=format&fit=crop', // Amalfi Coast / Italy
  },
  {
    keywords: ['reykjavik', 'islanda', 'iceland', 'aurora'],
    url: 'https://images.unsplash.com/photo-1476610182048-b716b8518aae?q=80&w=800&auto=format&fit=crop', // Iceland Aurora
  },
  {
    keywords: ['parigi', 'paris', 'francia', 'france'],
    url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800&auto=format&fit=crop', // Parigi Torre Eiffel
  },
  {
    keywords: ['new york', 'nyc', 'usa', 'america', 'stati uniti', 'los angeles', 'san francisco', 'miami'],
    url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=800&auto=format&fit=crop', // New York
  },
  {
    keywords: ['londra', 'london', 'uk', 'inghilterra', 'england'],
    url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=800&auto=format&fit=crop', // Londra Big Ben
  },
  {
    keywords: ['barcellona', 'barcelona', 'spagna', 'spain', 'madrid', 'siviglia'],
    url: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=800&auto=format&fit=crop', // Barcellona
  },
  {
    keywords: ['amsterdam', 'olanda', 'netherlands'],
    url: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?q=80&w=800&auto=format&fit=crop', // Amsterdam Canali
  },
  {
    keywords: ['grecia', 'greece', 'atene', 'athens', 'santorini', 'mykonos'],
    url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=800&auto=format&fit=crop', // Grecia mare
  },
  {
    keywords: ['berlino', 'berlin', 'germania', 'germany', 'monaco'],
    url: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?q=80&w=800&auto=format&fit=crop', // Berlino
  }
];

const DEFAULT_COVERS = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800&auto=format&fit=crop', // Viaggio generico mare/montagna
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=800&auto=format&fit=crop', // Explorer roadtrip
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop', // Tropical beach
];

export function getAutoCoverForDestination(destination: string): string {
  const cleanDest = destination.toLowerCase().trim();
  
  // 1. Priorità al Catalogo Editoriale Locale
  const catalogMatch = DESTINATIONS_CATALOG.find(d => 
    d.name.toLowerCase() === cleanDest || 
    cleanDest.includes(d.name.toLowerCase()) ||
    d.country.toLowerCase() === cleanDest
  );
  if (catalogMatch) {
    return catalogMatch.heroImage;
  }
  
  // 2. Regole per parole chiave
  for (const rule of COVER_RULES) {
    if (rule.keywords.some(kw => cleanDest.includes(kw))) {
      return rule.url;
    }
  }

  // Fallback deterministico sul default in base alla lunghezza della stringa per mantenere la stessa cover per la stessa meta
  const index = Math.abs(cleanDest.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % DEFAULT_COVERS.length;
  return DEFAULT_COVERS[index];
}
