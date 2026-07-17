import { OptimizationProfile, PlaceRole, JourneyConstraints, PlaceRef } from '../../core/engines/types/context.types';

export interface CategoryRule {
  energyLevel: 'low' | 'medium' | 'high';
  idealTimeWindows: { start: string; end: string }[];
  weatherPreference?: 'outdoor' | 'indoor' | 'rain_friendly' | 'sunny' | 'golden_hour';
  defaultDurationMinutes: number;
}

export const CATEGORY_RULES: Record<string, CategoryRule> = {
  breakfast: {
    energyLevel: 'low',
    idealTimeWindows: [{ start: '07:30', end: '10:30' }],
    defaultDurationMinutes: 45,
  },
  lunch: {
    energyLevel: 'low',
    idealTimeWindows: [{ start: '12:00', end: '14:30' }],
    defaultDurationMinutes: 60,
  },
  coffee: {
    energyLevel: 'low',
    idealTimeWindows: [{ start: '15:00', end: '17:30' }],
    defaultDurationMinutes: 30,
  },
  dinner: {
    energyLevel: 'low',
    idealTimeWindows: [{ start: '19:00', end: '22:30' }],
    defaultDurationMinutes: 90,
  },
  museum: {
    energyLevel: 'medium',
    idealTimeWindows: [{ start: '09:00', end: '17:00' }],
    weatherPreference: 'indoor',
    defaultDurationMinutes: 120,
  },
  landmark: {
    energyLevel: 'high',
    idealTimeWindows: [{ start: '09:00', end: '18:00' }],
    weatherPreference: 'outdoor',
    defaultDurationMinutes: 60,
  },
  viewpoint: {
    energyLevel: 'low',
    idealTimeWindows: [{ start: '07:00', end: '11:00' }, { start: '17:00', end: '19:30' }],
    weatherPreference: 'golden_hour',
    defaultDurationMinutes: 45,
  },
  park: {
    energyLevel: 'low',
    idealTimeWindows: [{ start: '08:00', end: '11:00' }, { start: '16:00', end: '19:00' }],
    weatherPreference: 'outdoor',
    defaultDurationMinutes: 90,
  },
  spa: {
    energyLevel: 'low',
    idealTimeWindows: [{ start: '15:00', end: '20:00' }],
    weatherPreference: 'indoor',
    defaultDurationMinutes: 180,
  },
  bar: {
    energyLevel: 'medium',
    idealTimeWindows: [{ start: '21:00', end: '02:00' }],
    defaultDurationMinutes: 120,
  },
  nightlife: {
    energyLevel: 'high',
    idealTimeWindows: [{ start: '22:00', end: '03:00' }],
    defaultDurationMinutes: 180,
  },
  walk: {
    energyLevel: 'medium',
    idealTimeWindows: [{ start: '08:00', end: '20:00' }],
    weatherPreference: 'outdoor',
    defaultDurationMinutes: 60,
  },
  sunset: {
    energyLevel: 'low',
    idealTimeWindows: [{ start: '17:00', end: '20:00' }],
    weatherPreference: 'golden_hour',
    defaultDurationMinutes: 45,
  }
};

export const SCORING_WEIGHTS = {
  DISTANCE_MAX: 10000,
  CATEGORY_MATCH_BONUS: 5000,
  ENERGY_MATCH_BONUS: 3000,
  TIME_WINDOW_BONUS: 4000,
  CONSECUTIVE_HIGH_ENERGY_PENALTY: -5000,
  CONSECUTIVE_SAME_CATEGORY_PENALTY: -4000,
  LONG_DURATION_PENALTY_MULTIPLIER: 10,
  MAX_WALK_METERS_PER_DAY: 10000,
  MAX_HOURS_PER_DAY: 11,
};

export const OPTIMIZATION_PROFILES: Record<string, OptimizationProfile> = {
  culture: {
    travelStyle: 'culture',
    weights: {
      museum: 5000,
      landmark: 5000,
      viewpoint: 2000,
    },
    preferredStartTime: '09:00',
    mealStrategy: 'standard', // 1 lunch, 1 dinner
    walkingTolerance: 8000,
  },
  food: {
    travelStyle: 'food',
    weights: {
      restaurant: 5000,
      dinner: 5000,
      lunch: 5000,
      coffee: 3000,
    },
    preferredStartTime: '10:00',
    mealStrategy: 'extended', // longer meals
    walkingTolerance: 5000,
  },
  relax: {
    travelStyle: 'relax',
    weights: {
      spa: 5000,
      park: 4000,
      viewpoint: 3000,
    },
    preferredStartTime: '10:30',
    mealStrategy: 'relaxed',
    walkingTolerance: 3000,
  },
  photography: {
    travelStyle: 'photography',
    weights: {
      sunset: 6000,
      viewpoint: 6000,
      landmark: 3000,
    },
    preferredStartTime: '07:30', // early start for morning light
    mealStrategy: 'flexible',
    walkingTolerance: 10000,
  },
  family: {
    travelStyle: 'family',
    weights: {
      park: 5000,
      museum: 2000,
    },
    preferredStartTime: '09:30',
    mealStrategy: 'standard',
    walkingTolerance: 4000, // less walking
  },
  express: {
    travelStyle: 'express',
    weights: {
      landmark: 5000,
      viewpoint: 4000,
    },
    preferredStartTime: '08:00',
    mealStrategy: 'quick', // short meals
    walkingTolerance: 12000,
  }
};

export const JOURNEY_CONSTRAINTS: Record<string, JourneyConstraints> = {
  culture: {
    maxWalkingKm: 10,
    maxExperiences: 5,
    targetOccupancy: 0.75,
    lunchRequired: true,
    dinnerRequired: true,
    freeTimeRequired: true,
  },
  food: {
    maxWalkingKm: 6,
    maxExperiences: 4,
    targetOccupancy: 0.80,
    lunchRequired: true,
    dinnerRequired: true,
    freeTimeRequired: true,
  },
  relax: {
    maxWalkingKm: 5,
    maxExperiences: 3,
    targetOccupancy: 0.60,
    lunchRequired: true,
    dinnerRequired: true,
    freeTimeRequired: true,
  },
  photography: {
    maxWalkingKm: 12,
    maxExperiences: 6,
    targetOccupancy: 0.80,
    lunchRequired: false,
    dinnerRequired: true,
    freeTimeRequired: true,
  },
  family: {
    maxWalkingKm: 5,
    maxExperiences: 4,
    targetOccupancy: 0.65,
    lunchRequired: true,
    dinnerRequired: true,
    freeTimeRequired: true,
  },
  express: {
    maxWalkingKm: 14,
    maxExperiences: 7,
    targetOccupancy: 0.85,
    lunchRequired: false,
    dinnerRequired: true,
    freeTimeRequired: false,
  },
};

export const PENALTY_RULES = {
  CONSECUTIVE_MUSEUMS: -20,
  LATE_LUNCH_AFTER_15: -15,
  MISSED_GOLDEN_HOUR: -30,
  EXCESSIVE_WALKING_15KM: -12,
  ZERO_BREAKS: -8,
  SHOPPING_AFTER_DINNER: -18,
  EXCESSIVE_HEROES: -25, // Più di 2 Hero in una giornata
};

export function inferPlaceRole(place: PlaceRef): PlaceRole {
  if (place.role) return place.role;
  if (place.scheduledTime || place.isLocked) return 'anchor';

  const cat = place.category?.toLowerCase() || '';
  const dur = place.durationMinutes || CATEGORY_RULES[cat]?.defaultDurationMinutes || 60;

  if (cat === 'lunch' || cat === 'dinner' || cat === 'restaurant' || cat === 'meal_break') return 'food';
  if (cat === 'breakfast' || cat === 'coffee' || cat === 'bar' || cat === 'drinks') return 'coffee';
  if (cat === 'sunset' || cat === 'viewpoint') return 'viewpoint';
  if (cat === 'park' || cat === 'spa' || cat === 'nature' || cat === 'relax') return 'relax';
  if (cat === 'shopping') return 'shopping';
  if (cat === 'transfer') return 'transfer';
  if (cat === 'free_time') return 'free_time';

  if (place.priority === 'must_see' || dur >= 120 || cat === 'museum') {
    return 'hero_experience';
  }

  if (dur <= 30) {
    return 'quick_stop';
  }

  return 'secondary';
}

