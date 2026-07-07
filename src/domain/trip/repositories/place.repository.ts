import { TravelPlace } from '../models/place.model';
import { PlaceMergeEngine } from '../engine/PlaceMergeEngine';

export interface IPlaceRepository {
  getPlacesByTripId(tripId: string): Promise<TravelPlace[]>;
  getPlaceById(id: string): Promise<TravelPlace | null>;
  savePlace(place: TravelPlace): Promise<void>;
  updatePlace(placeId: string, updates: Partial<TravelPlace>): Promise<void>;
  deletePlace(id: string): Promise<void>;
  addOrMergePlace(place: TravelPlace): Promise<{ place: TravelPlace; merged: boolean }>;
}

export class InMemoryPlaceRepository implements IPlaceRepository {
  private places: Map<string, TravelPlace> = new Map();

  constructor(initialPlaces: TravelPlace[] = []) {
    initialPlaces.forEach(p => this.places.set(p.id, p));
  }

  async getPlacesByTripId(tripId: string): Promise<TravelPlace[]> {
    return Array.from(this.places.values()).filter(p => p.tripId === tripId);
  }

  async getPlaceById(id: string): Promise<TravelPlace | null> {
    return this.places.get(id) || null;
  }

  async savePlace(place: TravelPlace): Promise<void> {
    await this.addOrMergePlace(place);
  }

  async addOrMergePlace(place: TravelPlace): Promise<{ place: TravelPlace; merged: boolean }> {
    // Se il luogo non è già presente con lo stesso ID, controlliamo con la regola conservativa
    if (!this.places.has(place.id)) {
      const tripPlaces = await this.getPlacesByTripId(place.tripId);
      const existingDuplicate = tripPlaces.find(p =>
        PlaceMergeEngine.isSamePlace(p.baseData, place.baseData)
      );

      if (existingDuplicate) {
        // Regola conservativa: distanza < 30m e similarità > 90% -> MERGE!
        const merged = PlaceMergeEngine.mergePlace(existingDuplicate, place.baseData);
        this.places.set(existingDuplicate.id, merged);
        return { place: merged, merged: true };
      }
    }

    this.places.set(place.id, place);
    return { place, merged: false };
  }

  async updatePlace(id: string, updates: Partial<TravelPlace>): Promise<void> {
    const existing = this.places.get(id);
    if (existing) {
      this.places.set(id, { ...existing, ...updates } as TravelPlace);
    }
  }

  async deletePlace(id: string): Promise<void> {
    this.places.delete(id);
  }
}

