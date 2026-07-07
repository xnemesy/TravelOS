/**
 * ============================================================================
 * JOURNEY SCORE CALCULATOR (DOMAIN SERVICE)
 * ============================================================================
 * REGOLA ARCHITETTURALE:
 * Gli Engine orchestrano. I Domain Service calcolano.
 * Servizio puro, stateless: nessuna dipendenza da Store, EventBus o ContextEngine.
 * Riceve uno snapshot minimale ed esplicito dello stato del viaggio (mai il
 * TravelContext completo) e restituisce un risultato deterministico.
 *
 * Estratto da ContextEngine.recompose() (refactoring puro, nessuna modifica
 * di comportamento): la logica di calcolo è invariata, incluso un caso limite
 * preesistente — vedi il test "days=[] con savedPlacesCount>0" per i dettagli.
 */

export interface JourneyScoreDayInput {
  /** Luoghi reali assegnati al giorno, esclusi i blocchi sintetici (Alloggio, Pranzo, Cena...). */
  nonBlockPlacesCount: number;
  /** Tappe totali del giorno, inclusi i blocchi sintetici — determina se il giorno è "organizzato". */
  totalPlacesCount: number;
  conflictsCount: number;
  foodStopsCount: number;
  totalWalkDistanceMeters: number;
}

export interface JourneyScoreInput {
  savedPlacesCount: number;
  days: JourneyScoreDayInput[];
}

export interface JourneyScoreResult {
  score: number;
  statusLabel: string;
}

export class JourneyScoreCalculator {
  public static calculate(input: JourneyScoreInput): JourneyScoreResult {
    const { savedPlacesCount, days } = input;

    let planningScore = 0;
    let balanceScore = 0;
    let foodScore = 0;
    let walkingScore = 0;
    let conflictScore = 0;

    if (savedPlacesCount > 0) {
      planningScore += 20; // Viaggio creato e con luoghi

      const timelinePlacesCount = days.reduce((acc, day) => acc + day.nonBlockPlacesCount, 0);
      const ratio = Math.min(timelinePlacesCount / savedPlacesCount, 1);
      planningScore += Math.round(ratio * 20); // max 40 per planning

      const daysWithPlaces = days.filter((d) => d.totalPlacesCount > 0).length;
      const daysRatio = Math.min(daysWithPlaces / days.length, 1);
      balanceScore += Math.round(daysRatio * 20);

      let totalConflicts = 0;
      let totalMeals = 0;
      let totalWalk = 0;

      days.forEach((day) => {
        totalConflicts += day.conflictsCount;
        totalMeals += day.foodStopsCount;
        totalWalk += day.totalWalkDistanceMeters;
      });

      if (totalConflicts === 0 && timelinePlacesCount > 0) conflictScore += 20;
      else if (totalConflicts < 3) conflictScore += 10;

      if (totalMeals >= daysWithPlaces) foodScore += 10;
      if (totalMeals >= daysWithPlaces * 2) foodScore += 10; // Colazione/Pranzo o Pranzo/Cena per giorno

      if (totalWalk < daysWithPlaces * 5000) walkingScore += 20; // Sotto i 5km a giorno in media
      else if (totalWalk < daysWithPlaces * 10000) walkingScore += 10;
    }

    const totalScore = planningScore + balanceScore + foodScore + walkingScore + conflictScore;
    const score = Math.min(totalScore, 100);

    return {
      score,
      statusLabel: `Pronto al ${score}%`,
    };
  }
}
