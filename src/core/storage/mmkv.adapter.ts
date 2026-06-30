import { MMKV } from 'react-native-mmkv';
import { ILocalDatabase } from './local-database.interface';

// Istanza singola di MMKV per tutta l'app
export const storage = new MMKV();

export class MMKVAdapter implements ILocalDatabase {
  
  async get<T>(key: string): Promise<T | null> {
    const value = storage.getString(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch (e) {
      console.error(`Error parsing JSON from MMKV for key ${key}`, e);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      storage.set(key, jsonValue);
    } catch (e) {
      console.error(`Error stringifying JSON for MMKV for key ${key}`, e);
    }
  }

  async remove(key: string): Promise<void> {
    storage.delete(key);
  }

  async clearAll(): Promise<void> {
    storage.clearAll();
  }
}
