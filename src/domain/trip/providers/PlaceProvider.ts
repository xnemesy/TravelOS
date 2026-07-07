import { ExternalPlace } from '../models/place.model';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface IPlaceProvider {
  /**
   * Cerca luoghi tramite query testuale (es. "Ristoranti a Budapest")
   */
  searchPlaces(query: string, location?: Coordinates): Promise<ExternalPlace[]>;
  
  /**
   * Ottiene i dettagli completi di un luogo partendo dal suo ID provider
   */
  getPlaceDetails(providerId: string): Promise<ExternalPlace | null>;
}

export class MockPlaceProvider implements IPlaceProvider {
  private mockDatabase: ExternalPlace[] = [
    {
      providerId: 'mock-ext-1',
      name: 'Gelateria Rosa',
      category: 'restaurant',
      coverImageUrl: 'https://images.unsplash.com/photo-1557142046-c704a3adf364?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Piazza del Gelato 1, Centro',
        coordinates: { lat: 47.5, lng: 19.05 }
      },
      rating: 4.7
    },
    {
      providerId: 'mock-ext-2',
      name: 'Museo di Storia',
      category: 'museum',
      coverImageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Viale dei Musei 10',
        coordinates: { lat: 47.51, lng: 19.06 }
      },
      rating: 4.9
    }
  ];

  async searchPlaces(query: string, location?: Coordinates): Promise<ExternalPlace[]> {
    // Simuliamo un ritardo di rete
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const lowerQuery = query.toLowerCase();
    return this.mockDatabase.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      p.category.toLowerCase().includes(lowerQuery)
    );
  }

  async getPlaceDetails(providerId: string): Promise<ExternalPlace | null> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.mockDatabase.find(p => p.providerId === providerId) || null;
  }
}
