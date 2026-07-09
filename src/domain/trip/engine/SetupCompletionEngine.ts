import { TripSetup } from '../models/trip-setup.model';

/**
 * ============================================================================
 * SETUP COMPLETION ENGINE (ADR-018)
 * ============================================================================
 * Domain Service puro — nessun I/O, nessuna dipendenza da orologio o
 * generatore casuale (PRODUCT_PRINCIPLES.md §8), deterministico rispetto
 * ai soli argomenti ricevuti. Il nome "Engine" segue la convenzione
 * lessicale già in uso per calcolatori puri in questo repository
 * (`PlaceMergeEngine`, `TripCalculator`), non implica orchestrazione.
 *
 * `evaluate()` accetta `tripDurationNights` come numero esplicito (es.
 * `TripCalculator.getDuration(trip)`) invece di un `Trip` intero — resta
 * puro e senza dipendenza strutturale da altri aggregati (ADR-018 §4/§6;
 * la fusione di `TripSetup` dentro `Trip` è stata esplicitamente scartata
 * in review indipendente, romperebbe il pattern satellite già stabilito
 * da ADR-017 per `TravelPlace`).
 */

export type SetupSectionName =
  | 'transports'
  | 'accommodations'
  | 'mobility'
  | 'constraints'
  | 'documents'
  | 'preferences';

const ALL_SECTIONS: SetupSectionName[] = [
  'transports',
  'accommodations',
  'mobility',
  'constraints',
  'documents',
  'preferences',
];

// Sezioni "array" la cui presenza di ALMENO UN elemento (non solo
// "affrontata con array vuoto") è sempre richiesta per sbloccare il
// Planner — vedi ADR-018 §5. `accommodations` è condizionale alla durata
// del trip (day-trip: 0 notti → non richiesto) e va valutato a parte.
const ALWAYS_REQUIRED_SECTIONS: readonly SetupSectionName[] = ['transports'];

export interface PlannerReadiness {
  unlocked: boolean;
  missingPrerequisites: SetupSectionName[];
}

export interface SetupCompletionReport {
  percentage: number; // 0-100, arrotondato
  completedSections: SetupSectionName[];
  missingSections: SetupSectionName[];
  plannerReadiness: PlannerReadiness;
}

/**
 * Una sezione è "affrontata" (§4 ADR-018) quando il campo corrispondente
 * di TripSetup è definito — un array vuoto o un oggetto presente contano
 * come completi (l'utente ha dichiarato esplicitamente "nulla da
 * segnalare"), `undefined` significa "non ancora vista".
 */
function isSectionTouched(setup: TripSetup, section: SetupSectionName): boolean {
  return setup[section] !== undefined;
}

/**
 * Una sezione "array" soddisfa il prerequisito Planner solo se contiene
 * almeno un elemento — soglia più stretta della semplice "affrontata"
 * usata per la percentuale generale. Vedi ADR-018 §5.
 */
function hasAtLeastOneEntry(setup: TripSetup, section: SetupSectionName): boolean {
  const value = setup[section];
  return Array.isArray(value) && value.length > 0;
}

export class SetupCompletionEngine {
  /**
   * @param tripDurationNights Numero esplicito di notti del trip (es.
   *   `TripCalculator.getDuration(trip)`), non un `Trip`. `accommodations`
   *   è un prerequisito Planner solo quando `tripDurationNights >= 1` — un
   *   day-trip (0 notti) non lo richiede. Vedi ADR-018 §5.
   */
  public static evaluate(setup: TripSetup, tripDurationNights: number): SetupCompletionReport {
    const completedSections = ALL_SECTIONS.filter((section) => isSectionTouched(setup, section));
    const missingSections = ALL_SECTIONS.filter((section) => !isSectionTouched(setup, section));

    const percentage = Math.round((completedSections.length / ALL_SECTIONS.length) * 100);

    const requiredSections: SetupSectionName[] =
      tripDurationNights >= 1 ? ['accommodations', ...ALWAYS_REQUIRED_SECTIONS] : [...ALWAYS_REQUIRED_SECTIONS];

    const missingPrerequisites = requiredSections.filter(
      (section) => !hasAtLeastOneEntry(setup, section)
    );

    return {
      percentage,
      completedSections,
      missingSections,
      plannerReadiness: {
        unlocked: missingPrerequisites.length === 0,
        missingPrerequisites,
      },
    };
  }
}
