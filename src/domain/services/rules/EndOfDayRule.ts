import { ITimelineRule, TimelineContext, RuleResult } from './rules.types';
import { PlaceRef } from '../../../core/engines/types/context.types';

export class EndOfDayRule implements ITimelineRule {
  public name = 'EndOfDayRule';

  public evaluate(candidate: PlaceRef, context: TimelineContext): RuleResult {
    if (candidate.id === 'hotel-end') {
      return { scoreDelta: 0, reject: false };
    }

    const preferredEndTimeStr = context.userPreferences?.preferredEndTime || '22:00';
    const [h, m] = preferredEndTimeStr.split(':').map(Number);
    const limitMinutes = h * 60 + m;

    if (context.currentTimeMinutes >= limitMinutes) {
      return {
        scoreDelta: -1000,
        reject: true,
        explanation: `Orario corrente ha superato il limite di fine giornata (${preferredEndTimeStr}).`
      };
    }

    const estimatedDuration = candidate.durationMinutes || 60;
    if (context.currentTimeMinutes + estimatedDuration > limitMinutes + 30) {
      return {
        scoreDelta: -800,
        reject: true,
        explanation: `La visita a ${candidate.name} finirebbe oltre il limite di fine giornata.`
      };
    }

    return { scoreDelta: 0, reject: false };
  }
}
