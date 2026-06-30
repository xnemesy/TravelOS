import { ITripRepository } from '../repositories/trip.repository.interface';
import { Trip } from '../models/trip.model';

export class GetUserTripsUseCase {
  constructor(private tripRepository: ITripRepository) {}

  async execute(userId: string): Promise<Trip[]> {
    try {
      // In futuro qui potremmo inserire logica di business extra,
      // ordinamento specifico, filtraggio, ecc.
      return await this.tripRepository.getUserTrips(userId);
    } catch (error) {
      console.error('Error fetching user trips:', error);
      throw new Error('Impossibile recuperare i viaggi al momento.');
    }
  }
}
