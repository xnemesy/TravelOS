import { ITimelineRule, TimelineContext, RuleResult } from './rules.types';
import { PlaceRef } from '../../../core/engines/types/context.types';
import { TravelServices } from '../../providers/TravelServices';

export class OpeningHoursRule implements ITimelineRule {
  public name = 'OpeningHoursRule';

  public async evaluate(candidate: PlaceRef, context: TimelineContext): Promise<RuleResult> {
    if (candidate.isBlock) {
      return { scoreDelta: 0, reject: false };
    }

    const formatTime = (mins: number): string => {
      const h = Math.floor(mins / 60) % 24;
      const m = Math.floor(mins % 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const timeStr = formatTime(context.currentTimeMinutes);
    
    try {
      const isOpen = await TravelServices.openingHours().isOpenAt(candidate.id, context.date, timeStr);
      if (isOpen) {
        return {
          scoreDelta: 100,
          reject: false,
          explanation: `Aperto a quest'ora (${timeStr}).`
        };
      }

      const windows = await TravelServices.openingHours().getOpeningHours(candidate.id, context.date);
      if (windows && windows.length > 0) {
        const parseTime = (tStr: string): number => {
          const [h, m] = tStr.split(':').map(Number);
          return h * 60 + m;
        };

        const futureWindow = windows
          .map(w => ({ start: parseTime(w.open), end: parseTime(w.close) }))
          .find(w => w.start > context.currentTimeMinutes);

        if (futureWindow) {
          const delay = futureWindow.start - context.currentTimeMinutes;
          if (delay <= 60) {
            return {
              scoreDelta: -10,
              reject: false,
              delayMinutes: delay,
              explanation: `Chiuso. Apre tra ${delay} min alle ${formatTime(futureWindow.start)}.`
            };
          }
        }
      }

      return {
        scoreDelta: -1000,
        reject: true,
        explanation: `Chiuso alle ${timeStr}.`
      };
    } catch (e) {
      return {
        scoreDelta: 0,
        reject: false,
        explanation: `Orari di apertura non verificabili.`
      };
    }
  }
}
