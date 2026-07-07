import { ITimelineRule, TimelineContext, RuleResult } from './rules.types';
import { PlaceRef } from '../../../core/engines/types/context.types';

export class SmartMealRule implements ITimelineRule {
  public name = 'SmartMealRule';

  public evaluate(candidate: PlaceRef, context: TimelineContext): RuleResult {
    if (candidate.category === 'lunch' || candidate.category === 'dinner' || candidate.category === 'breakfast') {
      return { scoreDelta: 200, reject: false };
    }

    const currentTime = context.currentTimeMinutes;

    const hasLunchPlaced = Array.from(context.placedIds).some(id => id.includes('lunch'));
    if (!hasLunchPlaced && currentTime >= 750 && currentTime < 840) {
      return {
        scoreDelta: -100,
        reject: false,
        insertEvent: {
          type: 'lunch',
          durationMinutes: 60,
          name: '🍝 Pausa Pranzo'
        },
        explanation: `Finestra ideale di pranzo. Inserimento pausa pranzo.`
      };
    }

    const hasDinnerPlaced = Array.from(context.placedIds).some(id => id.includes('dinner'));
    if (!hasDinnerPlaced && currentTime >= 1110 && currentTime < 1290) {
      return {
        scoreDelta: -100,
        reject: false,
        insertEvent: {
          type: 'dinner',
          durationMinutes: 90,
          name: '🍽 Cena e Serata'
        },
        explanation: `Finestra ideale di cena. Inserimento cena.`
      };
    }

    return { scoreDelta: 0, reject: false };
  }
}
