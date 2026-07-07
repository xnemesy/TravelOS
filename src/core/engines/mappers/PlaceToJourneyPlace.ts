import { Place } from '../../domain/models/Place';
import { JourneyPlace } from '../models/JourneyPlace';
import { PlaceCategory } from '../../domain/models/PlaceCategory';

export function mapPlaceToJourneyPlace(place: Place): JourneyPlace {
  const primaryCategory = place.categories[0] || PlaceCategory.attraction;

  return {
    id: place.id,
    name: place.name,
    category: primaryCategory,
    coordinates: place.coordinates,
    durationMinutes: place.visitDuration?.minutes ?? 60,
    rating: place.rating?.score,
    photoUrl: place.photoUrl,
    address: place.formattedAddress,
    priceLevel: place.priceLevel,
    energyLevel: place.categories.includes(PlaceCategory.transport) ? 'low' : 'medium',
    recommendedTime: 'any',
    weatherPreference: place.outdoor ? 'outdoor' : (place.indoor ? 'indoor' : 'sunny'),
    priority: 'recommended',
  };
}
