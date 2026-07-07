import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { PlaceCategory } from '../../domain/models/PlaceCategory';

/**
 * JourneyPlace
 * 
 * Il modello disaccoppiato e ottimizzato per l'engine del Composer.
 * È derivato dal `Place` del dominio universale, ma contiene solo
 * le informazioni necessarie per gli algoritmi di routing, ottimizzazione 
 * ed embedding nella timeline.
 */
export interface JourneyPlace {
  id: string;
  name: string;
  category: PlaceCategory;
  coordinates: Coordinates;
  durationMinutes: number;
  
  // Campi extra per il composer
  rating?: number;
  photoUrl?: string;
  address?: string;
  priceLevel?: number;
  
  // Attributi computati o contestuali generati dall'engine
  energyLevel?: 'low' | 'medium' | 'high';
  recommendedTime?: 'morning' | 'afternoon' | 'evening' | 'any';
  weatherPreference?: 'outdoor' | 'indoor' | 'rain_friendly' | 'sunny' | 'golden_hour';
  priority?: 'must_see' | 'recommended' | 'optional';
}
