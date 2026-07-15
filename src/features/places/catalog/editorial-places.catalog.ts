/**
 * ============================================================================
 * CATALOGO EDITORIALE LOCALE - LUOGHI E COLLEZIONI CURATE
 * ============================================================================
 * Non un semplice elenco di luoghi come Google Maps, ma collezioni editoriali
 * per aiutare l'utente a CONSTRUIRE la propria esperienza di viaggio con
 * suggerimenti unici, note del curatore e durata consigliata.
 */

export interface EditorialBaseData {
  providerId?: string;
  name: string;
  category: string;
  coverImageUrl?: string;
  photoUrls?: string[];
  location: {
    address?: string;
    coordinates?: { lat: number; lng: number };
    appleMapsUrl?: string;
    googleMapsUrl?: string;
  };
  rating?: number;
  reviewsCount?: number;
}

export type EditorialCollectionTag = 
  | 'imperdibili'      // ⭐ Imperdibili
  | 'colazione'        // ☕ Dove fare colazione
  | 'ristoranti'       // 🍝 Ristoranti tipici
  | 'tramonto'         // 🌇 Tramonto perfetto
  | 'se_piove'         // 🌧 Se piove oggi
  | 'passeggiata'      // 👣 Passeggiata di 2 ore
  | 'gemme_nascoste';  // 💎 Gemme nascoste

export interface EditorialCollection {
  id: EditorialCollectionTag;
  title: string;       // es. "⭐ Imperdibili"
  description: string; // es. "I capolavori assoluti da non perdere per nulla al mondo"
  icon: string;        // es. "⭐"
}

export const EDITORIAL_COLLECTIONS: EditorialCollection[] = [
  { id: 'imperdibili', title: '⭐ Imperdibili', description: 'I capolavori assoluti da non perdere per nulla al mondo', icon: '⭐' },
  { id: 'colazione', title: '☕ Dove fare colazione', description: 'Caffetterie storiche, specialty coffee e pasticcerie artigianali', icon: '☕' },
  { id: 'ristoranti', title: '🍝 Ristoranti tipici', description: 'I veri sapori locali lontano dalle trappole per turisti', icon: '🍝' },
  { id: 'tramonto', title: '🌇 Tramonto perfetto', description: 'I punti panoramici migliori per la golden hour', icon: '🌇' },
  { id: 'se_piove', title: '🌧 Se piove oggi', description: 'Musei coperti, gallerie storiche, terme calde e luoghi al coperto', icon: '🌧' },
  { id: 'passeggiata', title: '👣 Passeggiata di 2 ore', description: 'Itinerari a piedi indimenticabili tra vicoli, parchi e lungofiumi', icon: '👣' },
  { id: 'gemme_nascoste', title: '💎 Gemme nascoste', description: 'I segreti meglio custoditi conosciuti solo dai veri locali', icon: '💎' },
];

export interface EditorialPlaceItem {
  id: string;
  destinationName: string; // es. "Budapest", "Kyoto", "Parigi", "Roma"
  baseData: EditorialBaseData;
  collections: EditorialCollectionTag[];
  editorialNote: string; // La voce del curatore di Travel OS
  recommendedDurationMinutes: number;
  averageCost?: number;
}

export const EDITORIAL_PLACES_CATALOG: EditorialPlaceItem[] = [
  // ==========================================
  // BUDAPEST
  // ==========================================
  {
    id: 'edit-bud-parlamento',
    destinationName: 'Budapest',
    baseData: {
      providerId: 'ext-bud-parlamento',
      name: 'Parlamento di Budapest',
      category: 'landmark',
      coverImageUrl: 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Kossuth Lajos tér 1-3, Budapest', coordinates: { lat: 47.5071, lng: 19.0456 } },
      rating: 4.9,
    },
    collections: ['imperdibili', 'tramonto'],
    editorialNote: 'Il momento magico è al tramonto dal lato opposto del Danubio (Buda), quando le luci dorate si riflettono sull\'acqua.',
    recommendedDurationMinutes: 90,
    averageCost: 18,
  },
  {
    id: 'edit-bud-szechenyi',
    destinationName: 'Budapest',
    baseData: {
      providerId: 'ext-bud-szechenyi',
      name: 'Bagni Termali Széchenyi',
      category: 'experience',
      coverImageUrl: 'https://images.unsplash.com/photo-1584646098378-0874589d76b1?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Állatkerti krt. 9-11, Budapest', coordinates: { lat: 47.5186, lng: 19.0826 } },
      rating: 4.7,
    },
    collections: ['imperdibili', 'se_piove'],
    editorialNote: 'Immergersi nelle piscine termali esterne a 38°C mentre fuori piove o nevica è una delle esperienze più memorabili d\'Europa.',
    recommendedDurationMinutes: 180,
    averageCost: 28,
  },
  {
    id: 'edit-bud-bastione',
    destinationName: 'Budapest',
    baseData: {
      providerId: 'ext-bud-bastione',
      name: 'Bastione dei Pescatori',
      category: 'viewpoint',
      coverImageUrl: 'https://images.unsplash.com/photo-1514896856000-91cb6de818e0?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Szentháromság tér, Budapest', coordinates: { lat: 47.5022, lng: 19.0349 } },
      rating: 4.8,
    },
    collections: ['tramonto', 'passeggiata', 'imperdibili'],
    editorialNote: 'Architettura fiabesca neoromanica con 7 torri incantate. Arriva alle 7:00 del mattino per avere l\'intera terrazza panoramica tutta per te.',
    recommendedDurationMinutes: 60,
  },
  {
    id: 'edit-bud-newyorkcafe',
    destinationName: 'Budapest',
    baseData: {
      providerId: 'ext-bud-nycafe',
      name: 'New York Café Budapest',
      category: 'restaurant',
      coverImageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Erzsébet krt. 9-11, Budapest', coordinates: { lat: 47.4984, lng: 19.0705 } },
      rating: 4.6,
    },
    collections: ['colazione', 'se_piove'],
    editorialNote: 'Definito "il caffè più bello del mondo". Sorseggiare un cappuccino sotto affreschi rinascimentali, stucchi d\'oro e musica classica dal vivo.',
    recommendedDurationMinutes: 75,
    averageCost: 22,
  },
  {
    id: 'edit-bud-mazeltov',
    destinationName: 'Budapest',
    baseData: {
      providerId: 'ext-bud-mazeltov',
      name: 'Mazel Tov Ruin Bar',
      category: 'restaurant',
      coverImageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Akácfa u. 47, Budapest', coordinates: { lat: 47.5002, lng: 19.0633 } },
      rating: 4.8,
    },
    collections: ['ristoranti', 'gemme_nascoste'],
    editorialNote: 'Un ruin bar sofisticato ed elegante nel quartiere ebraico, trasformato in un giardino urbano coperto di edera e luci soffuse.',
    recommendedDurationMinutes: 120,
    averageCost: 25,
  },
  {
    id: 'edit-bud-lungodanubio',
    destinationName: 'Budapest',
    baseData: {
      providerId: 'ext-bud-danubio',
      name: 'Passeggiata sul Lungodanubio',
      category: 'nature',
      coverImageUrl: 'https://images.unsplash.com/photo-1565426873118-c98a58a74b09?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Id. Antall József rkp., Budapest', coordinates: { lat: 47.5005, lng: 19.0465 } },
      rating: 4.9,
    },
    collections: ['passeggiata', 'tramonto'],
    editorialNote: 'Un percorso toccante di 2 ore dal Ponte delle Catene fino alle Scarpe sul Danubio, osservando il passaggio delle imbarcazioni.',
    recommendedDurationMinutes: 120,
  },
  {
    id: 'edit-bud-szimpla',
    destinationName: 'Budapest',
    baseData: {
      providerId: 'ext-bud-szimpla',
      name: 'Szimpla Kert',
      category: 'bar',
      coverImageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Kazinczy u. 14, Budapest', coordinates: { lat: 47.4969, lng: 19.0634 } },
      rating: 4.7,
    },
    collections: ['gemme_nascoste', 'se_piove'],
    editorialNote: 'Il pioniere assoluto dei Ruin Pub. Un labirinto surreale di stanze artistiche, cortili all\'aperto e mercatini contadini la domenica mattina.',
    recommendedDurationMinutes: 90,
    averageCost: 10,
  },

  // ==========================================
  // KYOTO
  // ==========================================
  {
    id: 'edit-kyo-fushimi',
    destinationName: 'Kyoto',
    baseData: {
      providerId: 'ext-kyo-fushimi',
      name: 'Fushimi Inari-taisha',
      category: 'landmark',
      coverImageUrl: 'https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?q=80&w=800&auto=format&fit=crop',
      location: { address: '68 Fukakusa Yabunouchicho, Kyoto', coordinates: { lat: 34.9671, lng: 135.7727 } },
      rating: 4.9,
    },
    collections: ['imperdibili', 'passeggiata'],
    editorialNote: 'Il celebre sentiero dei 10.000 torii arancioni che si arrampica sulla montagna sacra. La sera dopo le 18:00 l\'atmosfera è mistica e silenziosa.',
    recommendedDurationMinutes: 150,
  },
  {
    id: 'edit-kyo-kinkakuji',
    destinationName: 'Kyoto',
    baseData: {
      providerId: 'ext-kyo-kinkakuji',
      name: 'Kinkaku-ji (Padiglione d\'Oro)',
      category: 'landmark',
      coverImageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop',
      location: { address: '1 Kinkakujicho, Kita Ward, Kyoto', coordinates: { lat: 35.0394, lng: 135.7292 } },
      rating: 4.8,
    },
    collections: ['imperdibili', 'tramonto'],
    editorialNote: 'I due piani superiori sono completamente ricoperti di foglie d\'oro zecchino, riflettendosi meravigliosamente nel laghetto Kyōko-chi.',
    recommendedDurationMinutes: 60,
    averageCost: 5,
  },
  {
    id: 'edit-kyo-arashiyama',
    destinationName: 'Kyoto',
    baseData: {
      providerId: 'ext-kyo-arashiyama',
      name: 'Foresta di Bambù di Arashiyama',
      category: 'nature',
      coverImageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Sagaogurayama Tabuchiyama, Kyoto', coordinates: { lat: 35.0170, lng: 135.6710 } },
      rating: 4.7,
    },
    collections: ['passeggiata', 'gemme_nascoste'],
    editorialNote: 'Ascolta il suono del vento tra i maestosi fusti di bambù gigante. Visitala all\'alba per un silenzio di pura pace zen.',
    recommendedDurationMinutes: 90,
  },
  {
    id: 'edit-kyo-nishiki',
    destinationName: 'Kyoto',
    baseData: {
      providerId: 'ext-kyo-nishiki',
      name: 'Nishiki Market',
      category: 'restaurant',
      coverImageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop',
      location: { address: '609 Nishidaimonjicho, Kyoto', coordinates: { lat: 35.0050, lng: 135.7649 } },
      rating: 4.6,
    },
    collections: ['colazione', 'ristoranti', 'se_piove'],
    editorialNote: 'La "cucina di Kyoto": cinque isolati al coperto ricchi di spiedini di polpo, matcha fresco, sashimi e specialità di strada giapponesi.',
    recommendedDurationMinutes: 90,
    averageCost: 15,
  },

  // ==========================================
  // PARIGI
  // ==========================================
  {
    id: 'edit-par-louvre',
    destinationName: 'Parigi',
    baseData: {
      providerId: 'ext-par-louvre',
      name: 'Museo del Louvre',
      category: 'museum',
      coverImageUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Rue de Rivoli, 75001 Paris', coordinates: { lat: 48.8606, lng: 2.3376 } },
      rating: 4.9,
    },
    collections: ['imperdibili', 'se_piove'],
    editorialNote: 'Il museo d\'arte più grande del mondo. Entra dall\'ingresso sotterraneo del Carrousel du Louvre per evitare la fila esterna alla piramide.',
    recommendedDurationMinutes: 240,
    averageCost: 22,
  },
  {
    id: 'edit-par-eiffel',
    destinationName: 'Parigi',
    baseData: {
      providerId: 'ext-par-eiffel',
      name: 'Torre Eiffel & Trocadéro',
      category: 'landmark',
      coverImageUrl: 'https://images.unsplash.com/photo-1543349689-9a4d426bee8e?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Champ de Mars, 5 Av. Anatole France, Paris', coordinates: { lat: 48.8584, lng: 2.2945 } },
      rating: 4.8,
    },
    collections: ['imperdibili', 'tramonto'],
    editorialNote: 'Ammira lo scintillio delle luci allo scoccare di ogni ora dopo il tramonto dalla terrazza del Trocadéro, con vista frontale impareggiabile.',
    recommendedDurationMinutes: 120,
    averageCost: 29,
  },
  {
    id: 'edit-par-cafedeflore',
    destinationName: 'Parigi',
    baseData: {
      providerId: 'ext-par-flore',
      name: 'Café de Flore',
      category: 'restaurant',
      coverImageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800&auto=format&fit=crop',
      location: { address: '172 Bd Saint-Germain, 75006 Paris', coordinates: { lat: 48.8540, lng: 2.3330 } },
      rating: 4.5,
    },
    collections: ['colazione', 'ristoranti'],
    editorialNote: 'Siediti ai tavolino all\'aperto dove discutevano Sartre, Beauvoir e Picasso. Ordina una cioccolata calda densa e un croissant al burro.',
    recommendedDurationMinutes: 60,
    averageCost: 16,
  },
  {
    id: 'edit-par-montmartre',
    destinationName: 'Parigi',
    baseData: {
      providerId: 'ext-par-montmartre',
      name: 'Passeggiata bohémien a Montmartre',
      category: 'nature',
      coverImageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Place du Tertre, 75018 Paris', coordinates: { lat: 48.8867, lng: 2.3408 } },
      rating: 4.8,
    },
    collections: ['passeggiata', 'gemme_nascoste', 'tramonto'],
    editorialNote: 'Perditi nei vicoli acciottolati dietro la Sacré-Cœur, scoprendo l\'ultima vigna di Parigi e i cabaret storici degli artisti impressionisti.',
    recommendedDurationMinutes: 120,
  },

  // ==========================================
  // ROMA
  // ==========================================
  {
    id: 'edit-rom-colosseo',
    destinationName: 'Roma',
    baseData: {
      providerId: 'ext-rom-colosseo',
      name: 'Colosseo e Fori Imperiali',
      category: 'landmark',
      coverImageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Piazza del Colosseo 1, Roma', coordinates: { lat: 41.8902, lng: 12.4922 } },
      rating: 4.9,
    },
    collections: ['imperdibili', 'passeggiata'],
    editorialNote: 'Il simbolo eterno dell\'Impero Romano. Camminare lungo via dei Fori Imperiali al tramonto fa respirare la grandezza di quasi tremila anni di storia.',
    recommendedDurationMinutes: 180,
    averageCost: 18,
  },
  {
    id: 'edit-rom-pantheon',
    destinationName: 'Roma',
    baseData: {
      providerId: 'ext-rom-pantheon',
      name: 'Pantheon',
      category: 'landmark',
      coverImageUrl: 'https://images.unsplash.com/photo-1531572753322-ad063cecc140?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Piazza della Rotonda, Roma', coordinates: { lat: 41.8986, lng: 12.4769 } },
      rating: 4.9,
    },
    collections: ['imperdibili', 'se_piove'],
    editorialNote: 'Un miracolo di ingegneria antica: la cupola in calcestruzzo non armato più grande al mondo. Entrare durante un acquazzone e vedere la pioggia cadere dall\'oculo centrale è pura poesia.',
    recommendedDurationMinutes: 45,
    averageCost: 5,
  },
  {
    id: 'edit-rom-giardinoaranci',
    destinationName: 'Roma',
    baseData: {
      providerId: 'ext-rom-aranci',
      name: 'Giardino degli Aranci all\'Aventino',
      category: 'viewpoint',
      coverImageUrl: 'https://images.unsplash.com/photo-1529154036614-a60975f5c760?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Piazza Pietro D\'Illiria, Roma', coordinates: { lat: 41.8853, lng: 12.4800 } },
      rating: 4.8,
    },
    collections: ['tramonto', 'gemme_nascoste', 'passeggiata'],
    editorialNote: 'Una terrazza romantica affacciata sul Tevere e su San Pietro. A pochi passi si trova il celebre buco della serratura dell\'Ordine di Malta.',
    recommendedDurationMinutes: 60,
  },
  {
    id: 'edit-rom-trastevere',
    destinationName: 'Roma',
    baseData: {
      providerId: 'ext-rom-trastevere',
      name: 'Trattorie storiche di Trastevere',
      category: 'restaurant',
      coverImageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=800&auto=format&fit=crop',
      location: { address: 'Via della Scala, Trastevere, Roma', coordinates: { lat: 41.8896, lng: 12.4695 } },
      rating: 4.7,
    },
    collections: ['ristoranti', 'colazione', 'passeggiata'],
    editorialNote: 'Il cuore verace della romanità. Tra panni stesi e vicoletti edera-vestiti, gusta una vera cacio e pepe cremosa o un carciofo alla giudia croccante.',
    recommendedDurationMinutes: 120,
    averageCost: 28,
  }
];

/**
 * Ottiene i luoghi editoriali per una destinazione.
 * Se la destinazione non è presente nel catalogo curato, genera un set
 * dinamico editoriale affinché l'esperienza dell'utente sia sempre ispirazionale!
 */
export function getEditorialPlacesForDestination(
  destination: string, 
  collectionFilter?: EditorialCollectionTag
): EditorialPlaceItem[] {
  if (!destination) return [];
  const cleanDest = destination.toLowerCase().trim();
  
  // Cerchiamo match diretti
  const matches = EDITORIAL_PLACES_CATALOG.filter(p => 
    p.destinationName.toLowerCase() === cleanDest || 
    cleanDest.includes(p.destinationName.toLowerCase())
  );
  
  let results: EditorialPlaceItem[] = matches;

  // Se non ci sono match specifici, generiamo schede editoriali di default ad-hoc per la meta!
  if (results.length === 0) {
    const capitalizedDest = destination.charAt(0).toUpperCase() + destination.slice(1);
    results = [
      {
        id: `edit-gen-${cleanDest}-centro`,
        destinationName: capitalizedDest,
        baseData: {
          providerId: `ext-gen-${cleanDest}-1`,
          name: `Centro Storico di ${capitalizedDest}`,
          category: 'landmark',
          coverImageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800&auto=format&fit=crop',
          location: { address: `Piazza Centrale, ${capitalizedDest}` },
          rating: 4.8,
        },
        collections: ['imperdibili', 'passeggiata'],
        editorialNote: `Esplora il cuore pulsante di ${capitalizedDest}, camminando tra le architetture storiche e i caffè locali più caratteristici.`,
        recommendedDurationMinutes: 120,
      },
      {
        id: `edit-gen-${cleanDest}-gastronomia`,
        destinationName: capitalizedDest,
        baseData: {
          providerId: `ext-gen-${cleanDest}-2`,
          name: `Mercato Centrale e Sapori di ${capitalizedDest}`,
          category: 'restaurant',
          coverImageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop',
          location: { address: `Mercato Coperto, ${capitalizedDest}` },
          rating: 4.7,
        },
        collections: ['colazione', 'ristoranti', 'se_piove'],
        editorialNote: `Il luogo perfetto per assaggiare le specialità autentiche del territorio e scoprire ingredienti artigianali a chilometro zero.`,
        recommendedDurationMinutes: 90,
        averageCost: 20,
      },
      {
        id: `edit-gen-${cleanDest}-panorama`,
        destinationName: capitalizedDest,
        baseData: {
          providerId: `ext-gen-${cleanDest}-3`,
          name: `Terrazza Panoramica su ${capitalizedDest}`,
          category: 'viewpoint',
          coverImageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
          location: { address: `Belvedere Alto, ${capitalizedDest}` },
          rating: 4.9,
        },
        collections: ['tramonto', 'gemme_nascoste'],
        editorialNote: `Il punto panoramico prediletto dai fotografi per osservare la città accendersi al calare del sole.`,
        recommendedDurationMinutes: 60,
      }
    ];
  }

  if (collectionFilter) {
    return results.filter(p => p.collections.includes(collectionFilter));
  }

  return results;
}
