import { unsafeAsInstantISO } from '../../domain/time';
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../core/storage/mmkv.adapter', () => ({
  MMKVAdapter: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../../features/trips/store/trip.store', () => ({
  useTripStore: jest.fn(),
}));

jest.mock('./useTravelContext', () => ({
  useTravelContext: jest.fn(),
}));

import { SetupCompletionEngine } from '../../domain/trip/engine/SetupCompletionEngine';
import * as tripStoreModule from '../../features/trips/store/trip.store';
import * as travelContextModule from './useTravelContext';

describe('useSetupProgress hook integration with SetupCompletionEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('evaluates setup as unlocked (plannerUnlocked: true) with optional warnings when transports are missing', () => {
    (tripStoreModule.useTripStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        getTripById: jest.fn().mockReturnValue({
          id: 'trip-123',
          title: 'Roma Trip',
          destination: 'Roma',
          startDate: '2026-08-01',
          endDate: '2026-08-05',
        }),
      };
      return selector(state);
    });

    (travelContextModule.useTravelContext as jest.Mock).mockReturnValue({
      transports: [],
      accommodations: [],
    });

    const setupProgress = SetupCompletionEngine.evaluateSetup({
      id: 'trip-123',
      title: 'Roma Trip',
      destination: 'Roma',
      startDate: '2026-08-01',
      endDate: '2026-08-05',
      transports: [],
      accommodations: [],
    });

    expect(setupProgress.plannerUnlocked).toBe(true);
    expect(setupProgress.missingSections).toContain('transport');
    expect(setupProgress.missingSections).toContain('accommodation');
    expect(setupProgress.warnings).toContain('Nessun volo o trasporto configurato (Opzionale)');
  });

  it('evaluates setup as unlocked (plannerUnlocked: true) when required setup prerequisites are fulfilled', () => {
    const setupProgress = SetupCompletionEngine.evaluateSetup({
      id: 'trip-123',
      title: 'Roma Trip',
      destination: 'Roma',
      startDate: '2026-08-01',
      endDate: '2026-08-05',
      transports: [
        {
          id: 't-1',
          mode: 'train',
          destination: 'Roma Termini',
          departureDate: unsafeAsInstantISO('2026-08-01T08:00:00Z'),
          confirmed: true,
        },
      ],
      accommodations: [
        {
          id: 'a-1',
          type: 'hotel',
          name: 'Hotel Colosseo',
          checkIn: unsafeAsInstantISO('2026-08-01T14:00:00Z'),
          checkOut: unsafeAsInstantISO('2026-08-05T10:00:00Z'),
          confirmed: true,
        },
      ],
    });

    expect(setupProgress.plannerUnlocked).toBe(true);
    expect(setupProgress.warnings).not.toContain('Nessun trasporto configurato (richiesto per sbloccare il Planner)');
    expect(setupProgress.warnings).not.toContain('Nessun alloggio configurato per un viaggio di più notti (richiesto per sbloccare il Planner)');
  });
});
