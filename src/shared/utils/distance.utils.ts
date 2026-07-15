/**
 * Calcola la distanza in km tra due punti usando la formula di Haversine.
 */
export function calculateHaversineDistance(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return 0;
  }
  const R = 6371; // Raggio della Terra in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distanza in km
  
  return distance;
}

/**
 * Formatta la distanza per la UI (es. "350 m" o "1.2 km").
 * Gestisce sia input in metri (> 50) che in chilometri (<= 50).
 */
export function formatDistance(metersOrKm: number): string {
  if (metersOrKm <= 0 || isNaN(metersOrKm)) return '0 m';
  // Se il valore è maggiore di 50, assumiamo che sia già espresso in metri
  const meters = metersOrKm > 50 ? metersOrKm : metersOrKm * 1000;
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
