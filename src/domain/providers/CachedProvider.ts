import { ICacheRepository } from './cache-repository.interface';

/**
 * ============================================================================
 * GENERIC SMART CACHE LAYER (CachedProvider<T>)
 * ============================================================================
 * Wrapper di cache generico e riutilizzabile per qualsiasi servizio del dominio
 * (Meteo, Rotte, Orari, Luoghi, Valuta, Voli).
 * Gestisce il Time-To-Live (TTL), l'invalidazione e il fallback automatico su cache
 * scaduta in caso di errore di rete o offline (Offline-First Guarantee).
 *
 * PERSISTENZA (ADR-022): se costruito con un `repository` (ICacheRepository),
 * la cache sopravvive al riavvio dell'app — idratata in modo trasparente in
 * background, senza che i chiamanti di `get()` debbano saperlo o cambiare
 * codice. Senza repository, il comportamento resta identico a prima (solo
 * RAM) — nessuna API pubblica cambia forma, solo un terzo argomento opzionale
 * al costruttore.
 *
 * EVICTION LRU: la Map in-memory mantiene l'ordine di accesso (più recente in
 * coda); superato `maxEntries` la entry meno recentemente usata viene evitta
 * sia dalla RAM sia (se configurato) dallo storage persistente.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export interface CachedProviderOptions<T> {
  /** Repository di persistenza (MMKV). Omesso = comportamento invariato, solo RAM. */
  repository?: ICacheRepository<T>;
  /** Numero massimo di entry mantenute per questo namespace (LRU). Default 200. */
  maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 200;

export class CachedProvider<T> {
  // Ordine di iterazione della Map = ordine LRU (meno recente in testa, più
  // recente in coda) — mantenuto esplicitamente da `touch()` a ogni scrittura
  // o hit di lettura, senza bisogno di una struttura dati aggiuntiva.
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTtlMs: number;
  private name: string;
  private repository?: ICacheRepository<T>;
  private maxEntries: number;
  // Avviata subito in costruttore (se un repository è configurato) così che
  // sia già in corso — o già conclusa — quando il primo `get()` reale arriva.
  private hydrationPromise: Promise<void> | null = null;

  /**
   * @param name Nome identificativo del servizio (es. 'Weather', 'Routing', 'Places')
   * @param defaultTtlMs Tempo di vita di default del dato in millisecondi
   * @param options Persistenza (repository) e limite di entry (maxEntries) opzionali
   */
  constructor(name: string, defaultTtlMs: number, options?: CachedProviderOptions<T>) {
    this.name = name;
    this.defaultTtlMs = defaultTtlMs;
    this.repository = options?.repository;
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;

    if (this.repository) {
      this.hydrationPromise = this.hydrateFromRepository();
    }
  }

  private async hydrateFromRepository(): Promise<void> {
    try {
      const entries = await this.repository!.getAllEntries();
      // Le entry arrivano già in ordine LRU (vedi ICacheRepository): inserirle
      // nella Map in questo stesso ordine ricostruisce l'ordine di eviction
      // esattamente come era prima del riavvio.
      for (const [key, entry] of entries) {
        this.cache.set(key, entry);
      }
      this.evictIfNeeded(); // difensivo: maxEntries potrebbe essere stato abbassato da allora
    } catch (error) {
      console.error(`[CachedProvider:${this.name}] Hydration from persistent storage failed:`, error);
    }
  }

  /**
   * Attende (se configurato un repository) che l'idratazione iniziale da
   * storage persistente sia conclusa. Pubblico solo per uso esplicito nei
   * test/warm-up — `get()` la attende già internamente in modo trasparente.
   */
  public async whenHydrated(): Promise<void> {
    if (this.hydrationPromise) {
      await this.hydrationPromise;
    }
  }

  /**
   * Recupera un valore dalla cache se valido, altrimenti esegue il fetcher,
   * memorizza il risultato e lo restituisce.
   * In caso di errore del fetcher (es. assenza di rete), se esiste un dato in cache
   * (anche se scaduto), effettua il fallback su di esso garantendo la continuità!
   */
  public async get(key: string, fetcher: () => Promise<T>, customTtlMs?: number): Promise<T> {
    await this.whenHydrated();

    const cached = this.cache.get(key);
    const now = Date.now();

    // 1. Hit cache valida
    if (cached && (now - cached.timestamp < cached.ttlMs)) {
      this.touch(key, cached);
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
        this.touch(key, cached);
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * Memorizza manualmente un valore in cache. Sincrono come prima: la
   * persistenza su storage (se configurata) parte in background senza
   * bloccare il chiamante — coerente con l'idioma già in uso altrove nel
   * codebase per le scritture fire-and-forget (es. TripLifecycleWatcher).
   */
  public set(key: string, data: T, ttlMs?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttlMs: ttlMs || this.defaultTtlMs,
    };
    this.touch(key, entry);

    if (this.repository) {
      this.repository.set(key, entry).catch((error) => {
        console.error(`[CachedProvider:${this.name}] Persisting entry "${key}" failed:`, error);
      });
    }
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
      if (this.repository) {
        this.repository.delete(key).catch((error) => {
          console.error(`[CachedProvider:${this.name}] Invalidating persisted entry "${key}" failed:`, error);
        });
      }
    } else {
      this.cache.clear();
      if (this.repository) {
        this.repository.clear().catch((error) => {
          console.error(`[CachedProvider:${this.name}] Clearing persisted cache failed:`, error);
        });
      }
    }
  }

  /**
   * Restituisce il numero di elementi attivi in cache.
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Sposta una entry in coda all'ordine di iterazione della Map (= "più
   * recentemente usata") ed evince se necessario. Non persiste nulla di per
   * sé — solo `set()` scrive su storage; un hit di lettura aggiorna solo la
   * recency in-memory (semplificazione deliberata, vedi ADR-022: l'indice
   * persistito riflette l'ordine di scrittura, non ogni singola lettura, per
   * non moltiplicare gli I/O su storage a ogni cache hit).
   */
  private touch(key: string, entry: CacheEntry<T>): void {
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.evictIfNeeded();
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
      if (this.repository) {
        this.repository.delete(oldestKey).catch((error) => {
          console.error(`[CachedProvider:${this.name}] Evicting persisted entry "${oldestKey}" failed:`, error);
        });
      }
    }
  }
}
