import { ICacheRepository } from './cache-repository.interface';
import { ILocalDatabase } from '../../core/storage/local-database.interface';
import { CacheEntry } from './CachedProvider';

/**
 * Bump manuale quando la FORMA di CacheEntry<T> cambia in modo incompatibile
 * (es. nuovo campo obbligatorio). Le entry persistite sotto la vecchia chiave
 * restano semplicemente invisibili (mai lette, mai causa di crash) — nessuna
 * migrazione in-place: i dati di questa cache sono per definizione derivati e
 * sempre ri-fetchabili dal servizio reale/mock, non serve preservarli.
 */
const CACHE_SCHEMA_VERSION = 1;

/**
 * Implementazione MMKV/AsyncStorage (via ILocalDatabase) di ICacheRepository —
 * una istanza per namespace (Weather/Routing/Places/Currency/...), stesso
 * pattern "un repository per aggregato" di ADR-021.
 *
 * MMKV non espone un'enumerazione nativa delle chiavi tramite ILocalDatabase
 * (contratto condiviso con Trip/Places/Timeline, non esteso qui per non
 * allargarne il raggio d'azione): l'ordine LRU viene quindi mantenuto in un
 * indice esplicito persistito separatamente (`cache_v{N}_index_{namespace}`,
 * un array di chiavi in ordine dalla meno alla più recentemente scritta).
 */
export class MMKVCacheRepository<T> implements ICacheRepository<T> {
  // Serializza le mutazioni dell'indice LRU di QUESTO namespace: `set`/`delete`/
  // `clear` fanno tutte un read-modify-write in due round-trip separati
  // (getIndex poi setIndex) su una singola chiave condivisa — senza questa
  // coda, due scritture concorrenti per chiavi DIVERSE nello stesso namespace
  // (es. `getCurrentWeather`/`getDailyForecast` per la stessa località quasi
  // in contemporanea) potrebbero entrambe leggere l'indice prima che l'altra
  // scriva, e l'ultima a scrivere azzererebbe silenziosamente l'aggiunta
  // dell'altra. Ogni istanza di questa classe corrisponde a un solo namespace
  // (stesso pattern "un repository per aggregato" di ADR-021), quindi questa
  // coda in-process è sufficiente: non serve un lock distribuito.
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(private namespace: string, private localDb: ILocalDatabase) {}

  private indexKey(): string {
    return `cache_v${CACHE_SCHEMA_VERSION}_index_${this.namespace}`;
  }

  private entryKey(key: string): string {
    return `cache_v${CACHE_SCHEMA_VERSION}_entry_${this.namespace}_${key}`;
  }

  private async getIndex(): Promise<string[]> {
    return (await this.localDb.get<string[]>(this.indexKey())) || [];
  }

  private async setIndex(order: string[]): Promise<void> {
    await this.localDb.set(this.indexKey(), order);
  }

  /**
   * Accoda `mutation` dopo qualunque mutazione già in corso su questo
   * namespace, cosicché il suo read-modify-write sull'indice veda sempre
   * l'esito dell'ultima mutazione completata, mai uno stato letto a metà da
   * un'altra scrittura ancora in volo.
   */
  private enqueueMutation<R>(mutation: () => Promise<R>): Promise<R> {
    const result = this.mutationQueue.then(mutation, mutation);
    // Non propaga il rigetto nella coda condivisa: un fallimento di una
    // mutazione non deve bloccare per sempre quelle successive.
    this.mutationQueue = result.catch(() => {});
    return result;
  }

  async getAllEntries(): Promise<Array<[string, CacheEntry<T>]>> {
    const order = await this.getIndex();
    const results: Array<[string, CacheEntry<T>]> = [];
    for (const key of order) {
      const entry = await this.localDb.get<CacheEntry<T>>(this.entryKey(key));
      // Un'entry mancante (rimossa manualmente, corrotta, o mai scritta per un
      // motivo transitorio) viene semplicemente saltata — l'indice potrebbe
      // restare temporaneamente disallineato, auto-correggendosi al prossimo
      // set()/delete() che riscrive l'indice per intero.
      if (entry) results.push([key, entry]);
    }
    return results;
  }

  async set(key: string, entry: CacheEntry<T>): Promise<void> {
    await this.localDb.set(this.entryKey(key), entry);
    await this.enqueueMutation(async () => {
      const order = await this.getIndex();
      const withoutKey = order.filter((k) => k !== key);
      withoutKey.push(key); // più recente in coda
      await this.setIndex(withoutKey);
    });
  }

  async delete(key: string): Promise<void> {
    await this.localDb.remove(this.entryKey(key));
    await this.enqueueMutation(async () => {
      const order = await this.getIndex();
      await this.setIndex(order.filter((k) => k !== key));
    });
  }

  async clear(): Promise<void> {
    await this.enqueueMutation(async () => {
      const order = await this.getIndex();
      for (const key of order) {
        await this.localDb.remove(this.entryKey(key));
      }
      await this.setIndex([]);
    });
  }
}
