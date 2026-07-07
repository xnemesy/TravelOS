import { TimelineContext, RuleResult, ITimelineRule, PlanningReport } from './rules.types';
import { PlaceRef } from '../../../core/engines/types/context.types';
import { TIMELINE_RULE_WEIGHTS } from '../../config/timeline-rule-weights';
import { OpeningHoursRule } from './OpeningHoursRule';
import { TravelTimeRule } from './TravelTimeRule';
import { VisitDurationRule } from './VisitDurationRule';
import { SmartMealRule } from './SmartMealRule';
import { EndOfDayRule } from './EndOfDayRule';
import { WeatherRule } from './WeatherRule';

export class TimelineRuleEngine {
  private rules: { rule: ITimelineRule; weightKey: keyof typeof TIMELINE_RULE_WEIGHTS }[] = [
    { rule: new OpeningHoursRule(), weightKey: 'OPENING_HOURS' },
    { rule: new EndOfDayRule(), weightKey: 'END_OF_DAY' },
    { rule: new WeatherRule(), weightKey: 'WEATHER' },
    { rule: new SmartMealRule(), weightKey: 'MEALS' },
    { rule: new VisitDurationRule(), weightKey: 'VISIT_DURATION' },
    { rule: new TravelTimeRule(), weightKey: 'TRAVEL_TIME' },
  ];

  public async evaluate(candidate: PlaceRef, context: TimelineContext) {
    let totalScore = 0;
    const rejectedBy: string[] = [];
    const explanations: string[] = [];
    const insertedEvents: string[] = [];
    const warnings: string[] = [];
    let reject = false;
    let maxDelay = 0;
    let finalOverrideDuration: number | undefined;
    let finalInsertEvent: any | undefined;

    for (const entry of this.rules) {
      const weight = TIMELINE_RULE_WEIGHTS[entry.weightKey] || 0;
      try {
        const res = await entry.rule.evaluate(candidate, context);
        
        totalScore += res.scoreDelta * (weight / 100);

        if (res.reject) {
          reject = true;
          rejectedBy.push(entry.rule.name);
        }

        if (res.explanation) {
          explanations.push(`[${entry.rule.name}] ${res.explanation}`);
        }

        if (res.delayMinutes && res.delayMinutes > maxDelay) {
          maxDelay = res.delayMinutes;
        }

        if (res.overrideVisitDuration) {
          finalOverrideDuration = res.overrideVisitDuration;
        }

        if (res.insertEvent) {
          finalInsertEvent = res.insertEvent;
          insertedEvents.push(res.insertEvent.name);
        }
      } catch (error) {
        console.error(`Error executing rule ${entry.rule.name}:`, error);
        warnings.push(`Errore esecuzione ${entry.rule.name}`);
      }
    }

    const report: PlanningReport = {
      totalScore,
      rejectedBy,
      explanations,
      insertedEvents,
      warnings,
    };

    return {
      report,
      reject,
      delayMinutes: maxDelay,
      overrideVisitDuration: finalOverrideDuration,
      insertEvent: finalInsertEvent,
    };
  }
}

export const timelineRuleEngine = new TimelineRuleEngine();
