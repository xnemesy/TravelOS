/**
 * ============================================================================
 * PLACE MERGE ENGINE (Sprint 9 — Conservative Deduplication & Fusion)
 * ============================================================================
 * Motore deterministico di unificazione luoghi per evitare duplicati tra
 * catalogo editoriale e risultati di ricerca dei provider esterni.
 *
 * REGOLA CONSERVATIVA DI SPRINT 9:
 * Meglio avere un duplicato innocuo che fondere per errore due posti diversi!
 * Distanza geodetica < 30 metri E Similarità del nome > 90% = MERGE.
 * Se anche un solo criterio non è soddisfatto -> NON FARE MERGE.
 */

export class PlaceMergeEngine {
  /**
   * Calcola la distanza geodetica in metri tra due coordinate GPS (Formula di Haversine).
   */
  public static calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Raggio della Terra in metri
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Normalizza una stringa rimuovendo accenti, punteggiatura e spazi multipli.
   * Es. "New York Café Budapest!" -> "new york cafe budapest"
   */
  private static normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Rimuove diacritici/accenti
      .replace(/[^a-z0-9\s]/g, ' ')   // Sostituisce caratteri speciali con spazi
      .replace(/\s+/g, ' ')           // Riduce spazi multipli
      .trim();
  }

  /**
   * Calcola la distanza di Levenshtein tra due stringhe.
   */
  private static levenshteinDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // Cancellazione
          matrix[i][j - 1] + 1,      // Inserimento
          matrix[i - 1][j - 1] + cost // Sostituzione
        );
      }
    }
    return matrix[len1][len2];
  }

  /**
   * Calcola la similarità percentuale da 0 a 100 tra due nomi di luogo.
   */
  public static calculateNameSimilarity(name1: string, name2: string): number {
    const norm1 = this.normalizeString(name1);
    const norm2 = this.normalizeString(name2);

    if (norm1 === norm2) return 100;
    if (norm1.length === 0 || norm2.length === 0) return 0;

    // Se un nome contiene interamente l'altro ed entrambi hanno almeno 5 caratteri (es. "New York Cafe" e "New York Cafe Budapest")
    if (norm1.length >= 5 && norm2.length >= 5) {
      if (norm1.includes(norm2) || norm2.includes(norm1)) {
        const minLen = Math.min(norm1.length, norm2.length);
        const maxLen = Math.max(norm1.length, norm2.length);
        const ratio = (minLen / maxLen) * 100;
        return Math.max(ratio, 92); // Garantisce superamento soglia 90% in caso di inclusione diretta
      }
    }

    const dist = this.levenshteinDistance(norm1, norm2);
    const maxLen = Math.max(norm1.length, norm2.length);
    return ((maxLen - dist) / maxLen) * 100;
  }

  /**
   * Valuta se due luoghi corrispondono alla stessa entità fisica secondo la regola conservativa:
   * Distanza < 30 metri E Similarità Nome > 90%.
   */
  public static isSamePlace(
    a: { name: string; lat?: number; lon?: number; coordinates?: { lat: number; lng: number } },
    b: { name: string; lat?: number; lon?: number; coordinates?: { lat: number; lng: number } }
  ): boolean {
    const latA = a.lat ?? a.coordinates?.lat;
    const lonA = a.lon ?? a.coordinates?.lng;
    const latB = b.lat ?? b.coordinates?.lat;
    const lonB = b.lon ?? b.coordinates?.lng;

    // Se le coordinate non sono disponibili per entrambi, approccio conservativo: NON MERGE
    if (latA === undefined || lonA === undefined || latB === undefined || lonB === undefined) {
      return false;
    }

    const distance = this.calculateDistanceMeters(latA, lonA, latB, lonB);
    if (distance >= 30) {
      return false;
    }

    const similarity = this.calculateNameSimilarity(a.name, b.name);
    return similarity > 90;
  }
}
