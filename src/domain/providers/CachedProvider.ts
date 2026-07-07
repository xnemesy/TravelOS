/**
 * ============================================================================
 * GENERIC SMART CACHE LAYER (CachedProvider<T>)
 * ============================================================================
 * Wrapper di cache generico e riutilizzabile per qualsiasi servizio del dominio
 * (Meteo, Rotte, Orari, Luoghi, Valuta, Voli).
 * Gestisce il Time-To-Live (TTL), l'invalidazione e il fallback automatico su cache
 * scaduta in caso di errore di rete o offline (Offline-First Guarantee).
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export class CachedProvider<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTtlMs: number;
  private name: string;

  /**
   * @param name Nome identificativo del servizio (es. 'Weather', 'Routing', 'Places')
   * @param defaultTtlMs Tempo di vita di default del dato in millisecondi
   */
  constructor(name: string, defaultTtlMs: number) {
    this.name = name;
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Recupera un valore dalla cache se valido, altrimenti esegue il fetcher,
   * memorizza il risultato e lo restituisce.
   * In caso di errore del fetcher (es. assenza di rete), se esiste un dato in cache
   * (anche se scaduto), effettua il fallback su di esso garantendo la continuità!
   */
  public async get(key: string, fetcher: () => Promise<T>, customTtlMs?: number): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // 1. Hit cache valida
    if (cached && (now - cached.timestamp < cached.ttlMs)) {
      return cached.data;
    }

    // 2. Cache miss o scaduta -> Tentativo di fetch
    try {
      const freshData = await fetcher();
      this.set(key, freshData, customTtlMs || this.defaultTtlMs);
      return freshData;
    } catch (error) {
      // 3. Fallback su cache scaduta se il fetch fallisce (Offline-First)
      if (cached) {
        console.warn(`[CachedProvider:${this.name}] Fetch failed for key "${key}". Falling back to stale cache.`);
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * Memorizza manualmente un valore in cache.
   */
  public set(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs: ttlMs || this.defaultTtlMs,
    });
  }

  /**
   * Verifica se una chiave è presente e valida in cache.
   */
  public hasValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < cached.ttlMs;
  }

  /**
   * Restituisce direttamente il dato in cache se presente (valido o scaduto), senza fetch.
   */
  public getPeek(key: string): T | undefined {
    return this.cache.get(key)?.data;
  }

  /**
   * Invalida una specifica chiave o svuota l'intera cache del servizio.
   */
  public invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Restituisce il numero di elementi attivi in cache.
   */
  public size(): number {
    return this.cache.size;
  }
}
