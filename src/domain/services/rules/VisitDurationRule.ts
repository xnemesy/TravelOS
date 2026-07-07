import { ITimelineRule, TimelineContext, RuleResult } from './rules.types';
import { PlaceRef } from '../../../core/engines/types/context.types';
import { CATEGORY_RULES } from '../../config/travel-rules';

export class VisitDurationRule implements ITimelineRule {
  public name = 'VisitDurationRule';

  public evaluate(candidate: PlaceRef, context: TimelineContext): RuleResult {
    if (candidate.isBlock) {
      return { scoreDelta: 0, reject: false };
    }

    if (context.userPreferences?.customDurations?.[candidate.id]) {
      const userDuration = context.userPreferences.customDurations[candidate.id];
      return {
        scoreDelta: 50,
        reject: false,
        overrideVisitDuration: userDuration,
        explanation: `Durata definita da utente: ${userDuration} min.`
      };
    }

    if (candidate.durationMinutes && CATEGORY_RULES[candidate.category] && candidate.durationMinutes !== CATEGORY_RULES[candidate.category].defaultDurationMinutes) {
      return {
        scoreDelta: 30,
        reject: false,
        overrideVisitDuration: candidate.durationMinutes,
        explanation: `Durata da catalogo editoriale: ${candidate.durationMinutes} min.`
      };
    }

    if (candidate.durationMinutes) {
      return {
        scoreDelta: 20,
        reject: false,
        overrideVisitDuration: candidate.durationMinutes,
        explanation: `Durata stimata Google Places: ${candidate.durationMinutes} min.`
      };
    }

    const defaultRule = CATEGORY_RULES[candidate.category];
    const defaultDuration = defaultRule ? defaultRule.defaultDurationMinutes : 60;
    return {
      scoreDelta: 0,
      reject: false,
      overrideVisitDuration: defaultDuration,
      explanation: `Durata di default per categoria: ${defaultDuration} min.`
    };
  }
}
