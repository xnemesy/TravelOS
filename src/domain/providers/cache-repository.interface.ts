import { CacheEntry } from './CachedProvider';

/**
 * Persistenza per un singolo namespace di CachedProvider (ADR-022 — Persistent
 * Cache). `CachedProvider` dipende solo da questo contratto: non conosce MMKV,
 * chiavi di storage né formato di cache — stessa disciplina di ADR-021 per gli
 * Engine di dominio.
 *
 * Le entry sono restituite/gestite in ordine LRU (meno recentemente scritta →
 * più recentemente scritta), così `CachedProvider` può ricostruire l'ordine di
 * eviction dopo un riavvio semplicemente inserendole nella Map in-memory
 * nell'ordine ricevuto.
 */
export interface ICacheRepository<T> {
  /** Tutte le entry persistite per questo namespace, in ordine LRU. */
  getAllEntries(): Promise<Array<[string, CacheEntry<T>]>>;

  /** Scrive/aggiorna una entry e la marca come la più recentemente scritta. */
  set(key: string, entry: CacheEntry<T>): Promise<void>;

  /** Rimuove una entry persistita (eviction LRU o invalidate() esplicito). */
  delete(key: string): Promise<void>;

  /** Svuota tutte le entry persistite di questo namespace. */
  clear(): Promise<void>;
}
