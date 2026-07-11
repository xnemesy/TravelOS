import { MMKVCacheRepository } from './mmkv-cache.repository';
import { ILocalDatabase } from '../../core/storage/local-database.interface';
import { CacheEntry } from './CachedProvider';

class FakeLocalDatabase implements ILocalDatabase {
  private store: Map<string, unknown> = new Map();

  async get<T>(key: string): Promise<T | null> {
    return this.store.has(key) ? (this.store.get(key) as T) : null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
  async clearAll(): Promise<void> {
    this.store.clear();
  }
}

function buildEntry(data: string, ttlMs = 60_000): CacheEntry<string> {
  return { data, timestamp: Date.now(), ttlMs };
}

describe('MMKVCacheRepository', () => {
  let db: FakeLocalDatabase;
  let repo: MMKVCacheRepository<string>;

  beforeEach(() => {
    db = new FakeLocalDatabase();
    repo = new MMKVCacheRepository('TestCache', db);
  });

  it('returns an empty array when nothing was ever written', async () => {
    await expect(repo.getAllEntries()).resolves.toEqual([]);
  });

  it('round-trips a single entry', async () => {
    await repo.set('k1', buildEntry('v1'));
    const entries = await repo.getAllEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0][0]).toBe('k1');
    expect(entries[0][1].data).toBe('v1');
  });

  it('returns entries in LRU order — oldest write first, most recent last', async () => {
    await repo.set('a', buildEntry('A'));
    await repo.set('b', buildEntry('B'));
    await repo.set('c', buildEntry('C'));

    const entries = await repo.getAllEntries();
    expect(entries.map(([key]) => key)).toEqual(['a', 'b', 'c']);
  });

  it('re-writing an existing key moves it to the most-recent end, not a duplicate', async () => {
    await repo.set('a', buildEntry('A'));
    await repo.set('b', buildEntry('B'));
    await repo.set('a', buildEntry('A-updated')); // riscrittura di una chiave già presente

    const entries = await repo.getAllEntries();
    expect(entries.map(([key]) => key)).toEqual(['b', 'a']);
    expect(entries.find(([key]) => key === 'a')?.[1].data).toBe('A-updated');
  });

  it('delete removes both the entry and its position in the LRU index', async () => {
    await repo.set('a', buildEntry('A'));
    await repo.set('b', buildEntry('B'));
    await repo.delete('a');

    const entries = await repo.getAllEntries();
    expect(entries.map(([key]) => key)).toEqual(['b']);
  });

  it('clear empties both entries and the index', async () => {
    await repo.set('a', buildEntry('A'));
    await repo.set('b', buildEntry('B'));
    await repo.clear();

    await expect(repo.getAllEntries()).resolves.toEqual([]);
  });

  it('keeps different namespaces isolated under the same underlying storage', async () => {
    const weatherRepo = new MMKVCacheRepository<string>('Weather', db);
    const routingRepo = new MMKVCacheRepository<string>('Routing', db);

    await weatherRepo.set('k', buildEntry('weather-value'));
    await routingRepo.set('k', buildEntry('routing-value'));

    const weatherEntries = await weatherRepo.getAllEntries();
    const routingEntries = await routingRepo.getAllEntries();

    expect(weatherEntries[0][1].data).toBe('weather-value');
    expect(routingEntries[0][1].data).toBe('routing-value');
  });

  /**
   * Regressione per l'Architecture Verification Fix #2: `set`/`delete` fanno
   * un read-modify-write in due round-trip separati sull'indice LRU condiviso
   * del namespace. Senza serializzazione, scritture concorrenti per chiavi
   * DIVERSE nello stesso namespace possono leggere lo stesso indice di
   * partenza e l'ultima a scrivere azzera silenziosamente l'aggiunta
   * dell'altra — esattamente il tipo di interleaving che `Promise.all` produce
   * qui, anche con uno storage finto che risolve "subito" (i multipli `await`
   * dentro getIndex()/setIndex() bastano a creare la finestra di race).
   */
  it('does not lose an index entry when set() runs concurrently for different keys in the same namespace', async () => {
    await Promise.all([
      repo.set('a', buildEntry('A')),
      repo.set('b', buildEntry('B')),
      repo.set('c', buildEntry('C')),
    ]);

    const entries = await repo.getAllEntries();
    expect(entries.map(([key]) => key).sort()).toEqual(['a', 'b', 'c']);
  });

  it('does not lose an index entry when set() and delete() run concurrently for different keys', async () => {
    await repo.set('a', buildEntry('A'));

    await Promise.all([
      repo.set('b', buildEntry('B')),
      repo.delete('a'),
      repo.set('c', buildEntry('C')),
    ]);

    const entries = await repo.getAllEntries();
    expect(entries.map(([key]) => key).sort()).toEqual(['b', 'c']);
  });

  it('serializes many concurrent writes for distinct keys without dropping any from the index', async () => {
    const keys = Array.from({ length: 20 }, (_, i) => `key-${i}`);
    await Promise.all(keys.map((key) => repo.set(key, buildEntry(key))));

    const entries = await repo.getAllEntries();
    expect(entries.map(([key]) => key).sort()).toEqual([...keys].sort());
  });
});
