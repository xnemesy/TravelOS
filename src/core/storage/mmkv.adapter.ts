import { ILocalDatabase } from './local-database.interface';

// Tenta di inizializzare MMKV; se fallisce (es. in Expo Go senza codice nativo), usa AsyncStorage come fallback.
let storage: any = null;
try {
  const { createMMKV } = require('react-native-mmkv');
  storage = createMMKV();
} catch (e) {
  console.warn('[Storage] MMKV non supportato in questo ambiente (es. Expo Go). Attivo AsyncStorage fallback.');
}

// AsyncStorage richiesto pigramente e in modo protetto, solo se MMKV non è
// disponibile: il modulo nativo può non essere linkato in alcuni ambienti
// (es. Jest puro, senza un preset React Native) — senza questa guardia anche
// solo IMPORTARE questo file (transitivamente, es. tramite TravelServices)
// farebbe crashare qualunque test che non mocka il modulo nativo.
let asyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;
if (!storage) {
  try {
    asyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch (e) {
    console.warn('[Storage] AsyncStorage non disponibile in questo ambiente. Uso una cache in-memory volatile.');
  }
}

// Ultimo fallback, non persistente: usato solo se né MMKV né AsyncStorage sono
// disponibili (tipicamente Jest puro senza mock nativi). Mai il percorso reale
// in produzione — garantisce solo che importare questo modulo non crashi mai.
const memoryFallback: Map<string, string> = new Map();

export class MMKVAdapter implements ILocalDatabase {

  async get<T>(key: string): Promise<T | null> {
    try {
      let value: string | null = null;
      if (storage) {
        value = storage.getString(key);
      } else if (asyncStorage) {
        value = await asyncStorage.getItem(key);
      } else {
        value = memoryFallback.get(key) ?? null;
      }

      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (e) {
      console.error(`Error parsing JSON from storage for key ${key}`, e);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      if (storage) {
        storage.set(key, jsonValue);
      } else if (asyncStorage) {
        await asyncStorage.setItem(key, jsonValue);
      } else {
        memoryFallback.set(key, jsonValue);
      }
    } catch (e) {
      console.error(`Error stringifying JSON for storage for key ${key}`, e);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      if (storage) {
        storage.remove(key);
      } else if (asyncStorage) {
        await asyncStorage.removeItem(key);
      } else {
        memoryFallback.delete(key);
      }
    } catch (e) {
      console.error(`Error removing key ${key} from storage`, e);
    }
  }

  async clearAll(): Promise<void> {
    try {
      if (storage) {
        storage.clearAll();
      } else if (asyncStorage) {
        await asyncStorage.clear();
      } else {
        memoryFallback.clear();
      }
    } catch (e) {
      console.error('Error clearing storage', e);
    }
  }
}
