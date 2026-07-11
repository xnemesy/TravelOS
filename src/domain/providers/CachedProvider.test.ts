import { CachedProvider, CacheEntry } from './CachedProvider';
import { ICacheRepository } from './cache-repository.interface';

/**
 * Repository finto in-memory, in ordine LRU (stessa semantica di
 * MMKVCacheRepository, senza toccare MMKV) — usato per verificare che
 * CachedProvider persista/idrati correttamente attraverso qualunque
 * ICacheRepository, non solo l'implementazione MMKV concreta.
 */
class FakeCacheRepository<T> implements ICacheRepository<T> {
  private order: string[] = [];
  private entries: Map<string, CacheEntry<T>> = new Map();
  public deleteCalls: string[] = [];

  async getAllEntries(): Promise<Array<[string, CacheEntry<T>]>> {
    return this.order.map((key) => [key, this.entries.get(key)!]);
  }
  async set(key: string, entry: CacheEntry<T>): Promise<void> {
    this.entries.set(key, entry);
    this.order = this.order.filter((k) => k !== key);
    this.order.push(key);
  }
  async delete(key: string): Promise<void> {
    this.deleteCalls.push(key);
    this.entries.delete(key);
    this.order = this.order.filter((k) => k !== key);
  }
  async clear(): Promise<void> {
    this.entries.clear();
    this.order = [];
  }
}

describe('CachedProvider — RAM-only behavior preserved (no repository option)', () => {
  it('returns a fresh fetch on cache miss and caches it', async () => {
    const cache = new CachedProvider<string>('Test', 60_000);
    const fetcher = jest.fn().mockResolvedValue('fresh-data');

    const result = await cache.get('k1', fetcher);

    expect(result).toBe('fresh-data');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns the cached value without calling the fetcher again while valid', async () => {
    const cache = new CachedProvider<string>('Test', 60_000);
    const fetcher = jest.fn().mockResolvedValue('fresh-data');

    await cache.get('k1', fetcher);
    const second = await cache.get('k1', fetcher);

    expect(second).toBe('fresh-data');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('re-fetches once the TTL has expired', async () => {
    const cache = new CachedProvider<string>('Test', 10);
    const fetcher = jest.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');

    await cache.get('k1', fetcher);
    await new Promise((r) => setTimeout(r, 20));
    const second = await cache.get('k1', fetcher);

    expect(second).toBe('v2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('falls back to stale cache when the fetcher fails (offline-first guarantee)', async () => {
    const cache = new CachedProvider<string>('Test', 10);
    const fetcher = jest.fn().mockResolvedValueOnce('v1').mockRejectedValueOnce(new Error('network down'));

    await cache.get('k1', fetcher);
    await new Promise((r) => setTimeout(r, 20));
    const second = await cache.get('k1', fetcher);

    expect(second).toBe('v1'); // stale ma disponibile, nessuna eccezione propagata
  });

  it('throws when the fetcher fails and there is no cached fallback', async () => {
    const cache = new CachedProvider<string>('Test', 60_000);
    const fetcher = jest.fn().mockRejectedValue(new Error('network down'));

    await expect(cache.get('k1', fetcher)).rejects.toThrow('network down');
  });

  it('hasValid/getPeek/size/invalidate behave exactly as before', async () => {
    const cache = new CachedProvider<string>('Test', 60_000);
    await cache.get('k1', async () => 'v1');

    expect(cache.hasValid('k1')).toBe(true);
    expect(cache.getPeek('k1')).toBe('v1');
    expect(cache.size()).toBe(1);

    cache.invalidate('k1');
    expect(cache.hasValid('k1')).toBe(false);
    expect(cache.getPeek('k1')).toBeUndefined();
    expect(cache.size()).toBe(0);
  });
});

describe('CachedProvider — transparent persistence (ADR-022)', () => {
  it('writes through to the repository on set() without changing the synchronous call shape', async () => {
    const repository = new FakeCacheRepository<string>();
    const cache = new CachedProvider<string>('Test', 60_000, { repository });

    cache.set('k1', 'v1'); // set() resta sincrono: nessun cambio di firma

    // La persistenza è fire-and-forget: attendiamo un tick perché la Promise interna si risolva.
    await new Promise((r) => setTimeout(r, 0));
    const persisted = await repository.getAllEntries();
    expect(persisted).toHaveLength(1);
    expect(persisted[0][1].data).toBe('v1');
  });

  it('hydrates from the repository on construction — a fresh instance sees data from a "previous session"', async () => {
    const repository = new FakeCacheRepository<string>();
    await repository.set('k1', { data: 'from-disk', timestamp: Date.now(), ttlMs: 60_000 });

    const cache = new CachedProvider<string>('Test', 60_000, { repository });
    const fetcher = jest.fn().mockResolvedValue('should-not-be-called');

    const result = await cache.get('k1', fetcher);

    expect(result).toBe('from-disk');
    expect(fetcher).not.toHaveBeenCalled(); // idratazione trasparente: nessun re-fetch necessario
  });

  it('whenHydrated() resolves once hydration completes, for explicit test/warm-up use', async () => {
    const repository = new FakeCacheRepository<string>();
    await repository.set('k1', { data: 'from-disk', timestamp: Date.now(), ttlMs: 60_000 });

    const cache = new CachedProvider<string>('Test', 60_000, { repository });
    await cache.whenHydrated();

    // Dopo whenHydrated(), anche i metodi sincroni vedono già il dato idratato.
    expect(cache.getPeek('k1')).toBe('from-disk');
  });

  it('respects a persisted TTL across restart — an expired entry from disk triggers a re-fetch', async () => {
    const repository = new FakeCacheRepository<string>();
    await repository.set('k1', { data: 'stale-from-disk', timestamp: Date.now() - 100_000, ttlMs: 1_000 });

    const cache = new CachedProvider<string>('Test', 60_000, { repository });
    const fetcher = jest.fn().mockResolvedValue('fresh-after-restart');

    const result = await cache.get('k1', fetcher);

    expect(result).toBe('fresh-after-restart');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('invalidate() removes the persisted entry, not just the in-memory one', async () => {
    const repository = new FakeCacheRepository<string>();
    const cache = new CachedProvider<string>('Test', 60_000, { repository });
    cache.set('k1', 'v1');
    await new Promise((r) => setTimeout(r, 0));

    cache.invalidate('k1');
    await new Promise((r) => setTimeout(r, 0));

    expect(repository.deleteCalls).toContain('k1');
    await expect(repository.getAllEntries()).resolves.toEqual([]);
  });
});

describe('CachedProvider — LRU eviction (ADR-022)', () => {
  it('evicts the least-recently-written entry once maxEntries is exceeded', () => {
    const cache = new CachedProvider<string>('Test', 60_000, { maxEntries: 2 });

    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C'); // supera il limite: 'a' è la meno recente, va evitta

    expect(cache.size()).toBe(2);
    expect(cache.getPeek('a')).toBeUndefined();
    expect(cache.getPeek('b')).toBe('B');
    expect(cache.getPeek('c')).toBe('C');
  });

  it('a cache hit read bumps recency, protecting the entry from eviction', async () => {
    const cache = new CachedProvider<string>('Test', 60_000, { maxEntries: 2 });

    cache.set('a', 'A');
    cache.set('b', 'B');
    await cache.get('a', async () => 'A'); // rilegge 'a': ora è la più recente, 'b' diventa la meno recente
    cache.set('c', 'C'); // supera il limite: 'b' va evitta, non 'a'

    expect(cache.getPeek('a')).toBe('A');
    expect(cache.getPeek('b')).toBeUndefined();
    expect(cache.getPeek('c')).toBe('C');
  });

  it('also evicts the persisted entry when the in-memory cap is exceeded', async () => {
    const repository = new FakeCacheRepository<string>();
    const cache = new CachedProvider<string>('Test', 60_000, { repository, maxEntries: 2 });

    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');
    await new Promise((r) => setTimeout(r, 0));

    expect(repository.deleteCalls).toContain('a');
    const persisted = await repository.getAllEntries();
    expect(persisted.map(([key]) => key)).toEqual(['b', 'c']);
  });

  it('enforces maxEntries against hydrated data too (cap lowered since the last session)', async () => {
    const repository = new FakeCacheRepository<string>();
    await repository.set('a', { data: 'A', timestamp: Date.now(), ttlMs: 60_000 });
    await repository.set('b', { data: 'B', timestamp: Date.now(), ttlMs: 60_000 });
    await repository.set('c', { data: 'C', timestamp: Date.now(), ttlMs: 60_000 });

    const cache = new CachedProvider<string>('Test', 60_000, { repository, maxEntries: 2 });
    await cache.whenHydrated();

    expect(cache.size()).toBe(2);
    expect(cache.getPeek('a')).toBeUndefined(); // meno recente, evitta subito dopo l'idratazione
  });
});
