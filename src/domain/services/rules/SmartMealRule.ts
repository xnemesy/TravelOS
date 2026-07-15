import { ITimelineRule, TimelineContext, RuleResult, DEFAULT_MEAL_WINDOWS } from './rules.types';
import { PlaceRef } from '../../../core/engines/types/context.types';

export class SmartMealRule implements ITimelineRule {
  public name = 'SmartMealRule';

  public evaluate(candidate: PlaceRef, context: TimelineContext): RuleResult {
    const mealWindows = context.mealWindows || DEFAULT_MEAL_WINDOWS;
    const currentTime = context.currentTimeMinutes;
    const effectiveDayEnd = context.effectiveDayEnd ?? 24 * 60;

    if (candidate.category === 'breakfast') {
      if (currentTime < mealWindows.breakfast.startMinutes || currentTime > mealWindows.breakfast.endMinutes) {
        return {
          scoreDelta: -1000,
          reject: true,
          explanation: `Colazione fuori finestra oraria (${this.formatMin(mealWindows.breakfast.startMinutes)}-${this.formatMin(mealWindows.breakfast.endMinutes)}).`,
        };
      }
      return { scoreDelta: 200, reject: false };
    }

    if (candidate.category === 'lunch') {
      if (currentTime < mealWindows.lunch.startMinutes || currentTime > mealWindows.lunch.endMinutes || currentTime + 60 > effectiveDayEnd) {
        return {
          scoreDelta: -1000,
          reject: true,
          explanation: `Pranzo fuori finestra oraria (${this.formatMin(mealWindows.lunch.startMinutes)}-${this.formatMin(mealWindows.lunch.endMinutes)}) o oltre limite di fine giornata.`,
        };
      }
      return { scoreDelta: 200, reject: false };
    }

    if (candidate.category === 'dinner') {
      if (currentTime < mealWindows.dinner.startMinutes || currentTime > mealWindows.dinner.endMinutes || currentTime + 90 > effectiveDayEnd) {
        return {
          scoreDelta: -1000,
          reject: true,
          explanation: `Cena fuori finestra oraria (${this.formatMin(mealWindows.dinner.startMinutes)}-${this.formatMin(mealWindows.dinner.endMinutes)}) o oltre limite di fine giornata.`,
        };
      }
      return { scoreDelta: 200, reject: false };
    }

    const hasLunchPlaced = Array.from(context.placedIds).some(id => id.includes('lunch'));
    if (!hasLunchPlaced && currentTime >= mealWindows.lunch.startMinutes && currentTime <= mealWindows.lunch.endMinutes && currentTime + 60 <= effectiveDayEnd) {
      if (currentTime >= 750 && currentTime < 840) {
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
    }

    const hasDinnerPlaced = Array.from(context.placedIds).some(id => id.includes('dinner'));
    if (!hasDinnerPlaced && currentTime >= mealWindows.dinner.startMinutes && currentTime <= mealWindows.dinner.endMinutes && currentTime + 90 <= effectiveDayEnd) {
      if (currentTime >= 1110 && currentTime < 1290) {
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
    }

    return { scoreDelta: 0, reject: false };
  }

  private formatMin(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}
