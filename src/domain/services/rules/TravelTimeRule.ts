import { ITimelineRule, TimelineContext, RuleResult } from './rules.types';
import { PlaceRef } from '../../../core/engines/types/context.types';
import { DistanceCalculator } from '../DistanceCalculator';

export class TravelTimeRule implements ITimelineRule {
  public name = 'TravelTimeRule';

  public evaluate(candidate: PlaceRef, context: TimelineContext): RuleResult {
    if (!context.currentPlace || candidate.isBlock || !context.currentPlace.coordinates || !candidate.coordinates) {
      return { scoreDelta: 0, reject: false };
    }

    const distanceMeters = DistanceCalculator.calculateHaversineDistance(
      context.currentPlace.coordinates,
      candidate.coordinates
    );

    let travelTimeMinutes = 0;
    if (distanceMeters > 3000) {
      const speedKmh = distanceMeters > 30000 ? 80 : 40;
      travelTimeMinutes = DistanceCalculator.estimateDrivingDurationMinutes(distanceMeters, speedKmh);
    } else {
      travelTimeMinutes = DistanceCalculator.estimateWalkingDurationMinutes(distanceMeters);
    }

    let overheadMinutes = 0;
    if (candidate.category === 'museum') {
      overheadMinutes = 20;
    } else if (candidate.category === 'landmark' || candidate.category === 'park') {
      overheadMinutes = 10;
    } else if (candidate.category === 'lunch' || candidate.category === 'dinner') {
      overheadMinutes = 5;
    }

    let scoreDelta = 0;
    let reject = false;
    let explanation = `Tempo viaggio: ${travelTimeMinutes} min (${Math.round(distanceMeters / 100) / 10} km) + overhead: ${overheadMinutes} min.`;

    if (distanceMeters > 50000) {
      scoreDelta = -500;
      explanation += ` ⚠️ Distanza eccessiva (${Math.round(distanceMeters / 1000)} km).`;
    } else if (distanceMeters > 15000) {
      scoreDelta = -100;
    }

    return {
      scoreDelta: scoreDelta - (travelTimeMinutes + overheadMinutes),
      reject,
      delayMinutes: travelTimeMinutes + overheadMinutes,
      explanation
    };
  }
}
