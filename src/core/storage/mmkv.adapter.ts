import AsyncStorage from '@react-native-async-storage/async-storage';
import { ILocalDatabase } from './local-database.interface';

// Tenta di inizializzare MMKV; se fallisce (es. in Expo Go senza codice nativo), usa AsyncStorage come fallback.
let storage: any = null;
try {
  const { createMMKV } = require('react-native-mmkv');
  storage = createMMKV();
} catch (e) {
  console.warn('[Storage] MMKV non supportato in questo ambiente (es. Expo Go). Attivo AsyncStorage fallback.');
}

export class MMKVAdapter implements ILocalDatabase {
  
  async get<T>(key: string): Promise<T | null> {
    try {
      let value: string | null = null;
      if (storage) {
        value = storage.getString(key);
      } else {
        value = await AsyncStorage.getItem(key);
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
      } else {
        await AsyncStorage.setItem(key, jsonValue);
      }
    } catch (e) {
      console.error(`Error stringifying JSON for storage for key ${key}`, e);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      if (storage) {
        storage.remove(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      console.error(`Error removing key ${key} from storage`, e);
    }
  }

  async clearAll(): Promise<void> {
    try {
      if (storage) {
        storage.clearAll();
      } else {
        await AsyncStorage.clear();
      }
    } catch (e) {
      console.error('Error clearing storage', e);
    }
  }
}
