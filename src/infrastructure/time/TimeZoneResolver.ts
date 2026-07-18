import { IanaTimeZone, unsafeAsIanaTimeZone } from '../../domain/time/IanaTimeZone';

/**
 * ============================================================================
 * TimeZoneResolver — Fuso derivato dal LUOGO, non duplicato per evento
 * ============================================================================
 * ADR-025 §4.2: un fuso orario è una proprietà del *luogo*, non dell'evento.
 * L'unica fonte di verità geografica è `PlaceGeography` (coordinate / codice
 * IATA); il fuso si RISOLVE on-demand da lì, mai scritto due volte su entità
 * diverse (§6.8).
 *
 * Contratto di degradazione (§11, rischio "dati di fuso mancanti"): la
 * risoluzione degrada in modo ESPLICITO e osservabile (`source: 'fallback'`),
 * mai con un crash silenzioso. Il chiamante può distinguere un fuso dedotto
 * con certezza da uno di ripiego, e loggare/segnalare di conseguenza.
 */

/** Fonte geografica condivisa da cui deriva il fuso (§4.2). */
export interface PlaceGeography {
  /** Coordinate del luogo dell'evento, se note. */
  readonly coordinates?: { readonly lat: number; readonly lng: number };
  /** Codice IATA di aeroporto/stazione, se applicabile. */
  readonly iataCode?: string;
  /**
   * Override manuale ESPLICITO: unico caso in cui il fuso è un input primario
   * (§4.2), ammesso solo quando la geografia è incompleta. Marcato come tale
   * per audit/UX ("fuso confermato manualmente" vs "dedotto").
   */
  readonly manualTimeZone?: IanaTimeZone;
}

/** Come è stato determinato il fuso — per audit e degradazione esplicita. */
export type TimeZoneSource = 'override' | 'iata' | 'coordinates' | 'fallback';

export interface TimeZoneResolution {
  readonly timeZone: IanaTimeZone;
  readonly source: TimeZoneSource;
}

export interface TimeZoneResolver {
  /**
   * Risolve il fuso dal luogo. Restituisce sempre un `IanaTimeZone` valido
   * (mai `undefined`): se la geografia non basta, ripiega sul fuso di default
   * configurato con `source: 'fallback'` — degradazione esplicita, mai crash.
   */
  resolve(geo: PlaceGeography): TimeZoneResolution;
}

/**
 * Tabella IATA → fuso IANA per gli aeroporti/città di riferimento dell'ADR
 * (§13) più alcuni hub comuni. Estendibile via costruttore senza modificare
 * questa costante. Chiavi in maiuscolo (i codici IATA sono case-insensitive).
 */
export const DEFAULT_IATA_TIMEZONES: Readonly<Record<string, string>> = {
  // Roma
  FCO: 'Europe/Rome',
  CIA: 'Europe/Rome',
  // New York
  JFK: 'America/New_York',
  LGA: 'America/New_York',
  EWR: 'America/New_York',
  // Los Angeles
  LAX: 'America/Los_Angeles',
  // Tokyo
  HND: 'Asia/Tokyo',
  NRT: 'Asia/Tokyo',
  // Altri hub frequenti
  LHR: 'Europe/London',
  CDG: 'Europe/Paris',
  MAD: 'Europe/Madrid',
  BER: 'Europe/Berlin',
  SFO: 'America/Los_Angeles',
  ORD: 'America/Chicago',
  MIA: 'America/New_York',
  SIN: 'Asia/Singapore',
  DXB: 'Asia/Dubai',
  SYD: 'Australia/Sydney',
};

/** Ancora città (lat, lng → fuso) per la risoluzione da coordinate. */
interface CityAnchor {
  readonly lat: number;
  readonly lng: number;
  readonly timeZone: string;
}

/**
 * Ancore geografiche per i luoghi di riferimento dell'ADR più alcune città.
 * La risoluzione da coordinate usa il nearest-anchor entro un raggio massimo
 * (`maxCoordinateDistanceDeg`): una tabella statica volutamente conservativa,
 * non un sostituto di una libreria tz completa. Oltre il raggio → fallback
 * esplicito, mai un fuso indovinato a caso.
 */
export const DEFAULT_CITY_ANCHORS: readonly CityAnchor[] = [
  { lat: 41.9028, lng: 12.4964, timeZone: 'Europe/Rome' },
  { lat: 40.7128, lng: -74.006, timeZone: 'America/New_York' },
  { lat: 34.0522, lng: -118.2437, timeZone: 'America/Los_Angeles' },
  { lat: 35.6762, lng: 139.6503, timeZone: 'Asia/Tokyo' },
  { lat: 51.5074, lng: -0.1278, timeZone: 'Europe/London' },
  { lat: 48.8566, lng: 2.3522, timeZone: 'Europe/Paris' },
  { lat: 40.4168, lng: -3.7038, timeZone: 'Europe/Madrid' },
  { lat: 52.52, lng: 13.405, timeZone: 'Europe/Berlin' },
  { lat: 37.7749, lng: -122.4194, timeZone: 'America/Los_Angeles' },
  { lat: 41.8781, lng: -87.6298, timeZone: 'America/Chicago' },
];

export interface StaticTimeZoneResolverOptions {
  /** Fuso di ripiego quando nulla è risolvibile (default `UTC`, §8). */
  readonly fallback?: IanaTimeZone;
  /** Override/estensione della tabella IATA. */
  readonly iataTimeZones?: Readonly<Record<string, string>>;
  /** Override/estensione delle ancore città. */
  readonly cityAnchors?: readonly CityAnchor[];
  /**
   * Raggio massimo (in gradi, distanza euclidea approssimata) entro cui una
   * coordinata è considerata "vicina" a un'ancora. Default 3° (~330 km).
   */
  readonly maxCoordinateDistanceDeg?: number;
}

/**
 * Implementazione a tabella statica. Puro lookup: nessun `Date`/`Intl`, nessun
 * accesso di rete o storage — deterministico e testabile. La priorità di
 * risoluzione riflette l'affidabilità della fonte (§4.2):
 *   override manuale > codice IATA > coordinate > fallback.
 */
export class StaticTimeZoneResolver implements TimeZoneResolver {
  private readonly fallback: IanaTimeZone;
  private readonly iata: Readonly<Record<string, string>>;
  private readonly anchors: readonly CityAnchor[];
  private readonly maxDistanceDeg: number;

  constructor(options: StaticTimeZoneResolverOptions = {}) {
    this.fallback = options.fallback ?? unsafeAsIanaTimeZone('UTC');
    this.iata = options.iataTimeZones ?? DEFAULT_IATA_TIMEZONES;
    this.anchors = options.cityAnchors ?? DEFAULT_CITY_ANCHORS;
    this.maxDistanceDeg = options.maxCoordinateDistanceDeg ?? 3;
  }

  resolve(geo: PlaceGeography): TimeZoneResolution {
    // 1. Override manuale esplicito (§4.2): input primario legittimo.
    if (geo.manualTimeZone) {
      return { timeZone: geo.manualTimeZone, source: 'override' };
    }

    // 2. Codice IATA: fonte più affidabile e priva di ambiguità geografica.
    if (geo.iataCode) {
      const tz = this.iata[geo.iataCode.toUpperCase()];
      if (tz) {
        return { timeZone: unsafeAsIanaTimeZone(tz), source: 'iata' };
      }
    }

    // 3. Coordinate: nearest-anchor entro il raggio massimo.
    if (geo.coordinates) {
      const nearest = this.nearestAnchor(geo.coordinates.lat, geo.coordinates.lng);
      if (nearest) {
        return { timeZone: unsafeAsIanaTimeZone(nearest.timeZone), source: 'coordinates' };
      }
    }

    // 4. Degradazione esplicita (§11): fallback osservabile, mai crash.
    return { timeZone: this.fallback, source: 'fallback' };
  }

  private nearestAnchor(lat: number, lng: number): CityAnchor | null {
    let best: CityAnchor | null = null;
    let bestDist = Infinity;
    for (const a of this.anchors) {
      const dLat = a.lat - lat;
      // Correzione grossolana della longitudine con il coseno della latitudine,
      // per non sovrastimare la distanza vicino ai poli.
      const dLng = (a.lng - lng) * Math.cos((lat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      if (dist < bestDist) {
        bestDist = dist;
        best = a;
      }
    }
    return best && bestDist <= this.maxDistanceDeg ? best : null;
  }
}
