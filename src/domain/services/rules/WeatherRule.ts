import { ITimelineRule, TimelineContext, RuleResult } from './rules.types';
import { PlaceRef } from '../../../core/engines/types/context.types';

export class WeatherRule implements ITimelineRule {
  public name = 'WeatherRule';

  public evaluate(candidate: PlaceRef, context: TimelineContext): RuleResult {
    // Placeholder futuro per connettersi al meteo (es. penalizzare all'aperto se piove)
    return {
      scoreDelta: 0,
      reject: false,
      explanation: 'Meteo ottimale o non configurato.'
    };
  }
}
