/**
 * ============================================================================
 * CATALOGO EDITORIALE LOCALE - DESTINAZIONI (COVER AUTOMATION)
 * ============================================================================
 * Invece di un semplice database mock, questo è un vero catalogo curato
 * di destinazioni mondiali per abilitare la "Cover Automation" magica.
 * Quando l'utente seleziona una destinazione, Travel OS imposta automaticamente:
 * foto di copertina, bandiera, paese, valuta, fuso orario e coordinate.
 */

export interface DestinationCatalogItem {
  id: string;
  name: string;        // es. "Budapest"
  country: string;     // es. "Ungheria"
  flag: string;        // es. "🇭🇺"
  currency: string;    // es. "EUR", "HUF", "JPY", "USD", "GBP"
  timezone: string;    // es. "Europe/Budapest"
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  heroImage: string;   // Foto Unsplash ad alta risoluzione curata
  dominantColor?: string;
  tagline?: string;    // Frase editoriale suggestiva
}

export const DESTINATIONS_CATALOG: DestinationCatalogItem[] = [
  {
    id: 'dest-budapest',
    name: 'Budapest',
    country: 'Ungheria',
    flag: '🇭🇺',
    currency: 'EUR', // Impostiamo EUR come comodo standard per viaggiatori europei, o HUF
    timezone: 'Europe/Budapest',
    coordinates: { latitude: 47.4979, longitude: 19.0402 },
    heroImage: 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#1E3A8A',
    tagline: 'La Perla del Danubio tra terme storiche e architettura imperiale',
  },
  {
    id: 'dest-kyoto',
    name: 'Kyoto',
    country: 'Giappone',
    flag: '🇯🇵',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    coordinates: { latitude: 35.0116, longitude: 135.7681 },
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#B91C1C',
    tagline: 'L\'anima tradizionale del Giappone tra templi d\'oro e foreste di bambù',
  },
  {
    id: 'dest-paris',
    name: 'Parigi',
    country: 'Francia',
    flag: '🇫🇷',
    currency: 'EUR',
    timezone: 'Europe/Paris',
    coordinates: { latitude: 48.8566, longitude: 2.3522 },
    heroImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#4338CA',
    tagline: 'La Ville Lumière, capitale eterna dell\'arte, della moda e della gastronomia',
  },
  {
    id: 'dest-rome',
    name: 'Roma',
    country: 'Italia',
    flag: '🇮🇹',
    currency: 'EUR',
    timezone: 'Europe/Rome',
    coordinates: { latitude: 41.9028, longitude: 12.4964 },
    heroImage: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#B45309',
    tagline: 'La Città Eterna, un museo a cielo aperto lungo quasi tre millenni di storia',
  },
  {
    id: 'dest-tokyo',
    name: 'Tokyo',
    country: 'Giappone',
    flag: '🇯🇵',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    coordinates: { latitude: 35.6762, longitude: 139.6503 },
    heroImage: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#111827',
    tagline: 'Il futuro incontra la tradizione nella metropoli più vibrante del pianeta',
  },
  {
    id: 'dest-newyork',
    name: 'New York',
    country: 'Stati Uniti',
    flag: '🇺🇸',
    currency: 'USD',
    timezone: 'America/New_York',
    coordinates: { latitude: 40.7128, longitude: -74.0060 },
    heroImage: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#1E40AF',
    tagline: 'La città che non dorme mai, icona mondiale di energia, arte e architettura',
  },
  {
    id: 'dest-barcelona',
    name: 'Barcellona',
    country: 'Spagna',
    flag: '🇪🇸',
    currency: 'EUR',
    timezone: 'Europe/Madrid',
    coordinates: { latitude: 41.3851, longitude: 2.1734 },
    heroImage: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#D97706',
    tagline: 'L\'incanto del modernismo di Gaudí affacciato sulle spiagge del Mediterraneo',
  },
  {
    id: 'dest-london',
    name: 'Londra',
    country: 'Regno Unito',
    flag: '🇬🇧',
    currency: 'GBP',
    timezone: 'Europe/London',
    coordinates: { latitude: 51.5074, longitude: -0.1278 },
    heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#374151',
    tagline: 'Il cuore pulsante britannico dove regalità storica e avanguardia culturale si fondono',
  },
  {
    id: 'dest-reykjavik',
    name: 'Reykjavík',
    country: 'Islanda',
    flag: '🇮🇸',
    currency: 'EUR',
    timezone: 'Atlantic/Reykjavik',
    coordinates: { latitude: 64.1466, longitude: -21.9426 },
    heroImage: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#0284C7',
    tagline: 'La porta d\'accesso ai ghiacciai, geyser e aurore boreali dell\'estremo Nord',
  },
  {
    id: 'dest-lisbon',
    name: 'Lisbona',
    country: 'Portogallo',
    flag: '🇵🇹',
    currency: 'EUR',
    timezone: 'Europe/Lisbon',
    coordinates: { latitude: 38.7223, longitude: -9.1393 },
    heroImage: 'https://images.unsplash.com/photo-1585208798174-6cd331d59752?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#EA580C',
    tagline: 'La città delle sette colline risplendente di luce, azulejos e nostalgia sul Tago',
  },
  {
    id: 'dest-amsterdam',
    name: 'Amsterdam',
    country: 'Paesi Bassi',
    flag: '🇳🇱',
    currency: 'EUR',
    timezone: 'Europe/Amsterdam',
    coordinates: { latitude: 52.3676, longitude: 4.9041 },
    heroImage: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#15803D',
    tagline: 'Un reticolo incantato di canali storici, biciclette e capolavori d\'arte fiamminga',
  },
  {
    id: 'dest-prague',
    name: 'Praga',
    country: 'Repubblica Ceca',
    flag: '🇨🇿',
    currency: 'EUR',
    timezone: 'Europe/Prague',
    coordinates: { latitude: 50.0755, longitude: 14.4378 },
    heroImage: 'https://images.unsplash.com/photo-1541849546-216549ae216d?q=80&w=1200&auto=format&fit=crop',
    dominantColor: '#7C2D12',
    tagline: 'La Città delle Cento Torri, avvolta da un\'atmosfera gotica e fiabesca senza tempo',
  }
];

/**
 * Cerca nel catalogo per nome città o paese.
 */
export function searchDestinations(query: string): DestinationCatalogItem[] {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim().toLowerCase();
  return DESTINATIONS_CATALOG.filter(d => 
    d.name.toLowerCase().includes(q) || 
    d.country.toLowerCase().includes(q)
  );
}

/**
 * Trova una destinazione esatta per nome.
 */
export function getDestinationByName(name: string): DestinationCatalogItem | undefined {
  return DESTINATIONS_CATALOG.find(d => d.name.toLowerCase() === name.trim().toLowerCase());
}
