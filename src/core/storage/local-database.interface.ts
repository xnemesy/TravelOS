export interface ILocalDatabase {
  /**
   * Recupera un valore dalla cache/DB locale
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Salva un valore nella cache/DB locale
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Rimuove un valore
   */
  remove(key: string): Promise<void>;

  /**
   * Svuota il database locale (utile al logout)
   */
  clearAll(): Promise<void>;
}
