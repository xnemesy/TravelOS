import { TripSetup, Transport, Accommodation } from '../models/trip-setup.model';

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

// Sezioni "array" la cui presenza è richiesta per sbloccare il Planner.
// Poiché la configurazione di trasporti (voli) e alloggi è integrata come opzionale nel Wizard
// prima di accedere al Planner, l'ingresso al Planner non deve mai bloccare né rimbalzare l'utente.
const ALWAYS_REQUIRED_SECTIONS: readonly SetupSectionName[] = [];

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

// ----------------------------------------------------------------------------
// SETUP EVALUATION ENGINE TYPES (Sprint / Trip Setup Completeness)
// ----------------------------------------------------------------------------

export type SetupProgressSection =
  | 'basic_info'
  | 'transport'
  | 'accommodation'
  | 'travellers'
  | 'budget';

export interface SetupProgress {
  percentage: number;
  completedSections: SetupProgressSection[];
  missingSections: SetupProgressSection[];
  plannerUnlocked: boolean;
  warnings: string[];
}

export interface TripSetupEvaluationInput {
  id?: string;
  title?: string;
  destination?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  travelers?: {
    adults?: number;
    children?: number;
    pets?: number;
  };
  travellers?: {
    adults?: number;
    children?: number;
    pets?: number;
  };
  budgetAmount?: number;
  budget?: number;
  transports?: readonly Transport[];
  accommodations?: readonly Accommodation[];
  setup?: TripSetup;
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
   * Valuta la completezza globale del setup di un viaggio secondo pesi specifici:
   * - Basic Info: 30%
   * - Transport: 20%
   * - Accommodation: 20%
   * - Travellers: 15%
   * - Budget: 15%
   */
  public static evaluateSetup(trip: TripSetupEvaluationInput): SetupProgress {
    const completedSections: SetupProgressSection[] = [];
    const missingSections: SetupProgressSection[] = [];
    const warnings: string[] = [];

    // 1. Basic Info (30%)
    let basicInfoValid = true;
    const hasTitle = typeof trip.title === 'string' && trip.title.trim().length > 0;
    const hasDestination = typeof trip.destination === 'string' && trip.destination.trim().length > 0;
    const startDate = typeof trip.startDate === 'string' ? new Date(trip.startDate) : trip.startDate;
    const endDate = typeof trip.endDate === 'string' ? new Date(trip.endDate) : trip.endDate;
    const hasValidStart = startDate instanceof Date && !isNaN(startDate.getTime());
    const hasValidEnd = endDate instanceof Date && !isNaN(endDate.getTime());

    if (!hasTitle) {
      basicInfoValid = false;
      warnings.push('Titolo del viaggio mancante o vuoto');
    }
    if (!hasDestination) {
      basicInfoValid = false;
      warnings.push('Destinazione del viaggio mancante o vuota');
    }
    if (!hasValidStart || !hasValidEnd) {
      basicInfoValid = false;
      warnings.push('Date del viaggio mancanti o non valide');
    } else if (endDate < startDate) {
      basicInfoValid = false;
      warnings.push('La data di fine viaggio precede la data di inizio');
    }

    if (basicInfoValid) {
      completedSections.push('basic_info');
    } else {
      missingSections.push('basic_info');
    }

    // 2. Transport (20%)
    const transports = trip.transports ?? trip.setup?.transports;
    const hasAtLeastOneTransport = Array.isArray(transports) && transports.length > 0;
    if (hasAtLeastOneTransport) {
      completedSections.push('transport');
    } else {
      missingSections.push('transport');
    }

    let tripDurationNights = 0;
    let startOfDay: Date | null = null;
    let endOfDay: Date | null = null;

    if (hasValidStart && hasValidEnd && endDate >= startDate) {
      startOfDay = new Date(startDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      if (startDate.toDateString() === endDate.toDateString()) {
        tripDurationNights = 0;
      } else {
        const diffMs = endDate.getTime() - startDate.getTime();
        tripDurationNights = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }
    }

    if (!hasAtLeastOneTransport) {
      warnings.push('Nessun volo o trasporto configurato (Opzionale)');
    } else {
      for (const t of transports) {
        if (t.arrivalDate && t.arrivalDate < t.departureDate) {
          warnings.push(`Il trasporto verso ${t.destination || 'destinazione'} ha data di arrivo precedente alla partenza`);
        }
        if (startOfDay && endOfDay) {
          if (t.departureDate < startOfDay || t.departureDate > endOfDay) {
            warnings.push(`Il trasporto verso ${t.destination || 'destinazione'} (partenza) è fuori dalle date del viaggio`);
          }
          if (t.arrivalDate && (t.arrivalDate < startOfDay || t.arrivalDate > endOfDay)) {
            warnings.push(`Il trasporto verso ${t.destination || 'destinazione'} (arrivo) è fuori dalle date del viaggio`);
          }
        }
      }
    }

    // 3. Accommodation (20%)
    const accommodations = trip.accommodations ?? trip.setup?.accommodations;
    const hasAtLeastOneAccommodation = Array.isArray(accommodations) && accommodations.length > 0;
    if (hasAtLeastOneAccommodation || (tripDurationNights < 1 && accommodations !== undefined)) {
      completedSections.push('accommodation');
    } else {
      missingSections.push('accommodation');
    }
    if (tripDurationNights >= 1 && !hasAtLeastOneAccommodation) {
      warnings.push('Nessun alloggio configurato per un viaggio di più notti (Opzionale)');
    } else if (Array.isArray(accommodations)) {
      for (const a of accommodations) {
        if (a.checkOut <= a.checkIn) {
          warnings.push(`L'alloggio ${a.name || 'selezionato'} ha data di check-out non successiva al check-in`);
        }
        if (startOfDay && endOfDay) {
          if (a.checkIn < startOfDay || a.checkOut > endOfDay) {
            warnings.push(`L'alloggio ${a.name || 'selezionato'} è fuori dalle date del viaggio`);
          }
        }
      }
    }

    // 4. Travellers (15%)
    const travelers = trip.travelers ?? trip.travellers;
    if (travelers !== undefined && travelers !== null && typeof travelers === 'object') {
      completedSections.push('travellers');
      const adults = travelers.adults ?? 0;
      const children = travelers.children ?? 0;
      const pets = travelers.pets ?? 0;
      if (adults < 1) {
        warnings.push('Il viaggio deve includere almeno un adulto tra i viaggiatori');
      }
      if (children < 0 || pets < 0) {
        warnings.push('Il numero di bambini o animali non può essere negativo');
      }
    } else {
      missingSections.push('travellers');
    }

    // 5. Budget (15%)
    const budgetAmount = trip.budgetAmount ?? trip.budget;
    const budgetLevel = trip.setup?.preferences?.budgetLevel;
    if (
      (budgetAmount !== undefined && budgetAmount !== null && typeof budgetAmount === 'number') ||
      budgetLevel !== undefined
    ) {
      completedSections.push('budget');
      if (typeof budgetAmount === 'number') {
        if (budgetAmount < 0) {
          warnings.push('Il budget del viaggio non può essere negativo');
        } else if (budgetAmount === 0) {
          warnings.push('Il budget del viaggio è impostato a zero');
        }
      }
    } else {
      missingSections.push('budget');
    }

    // Calcolo percentuale pesata
    let percentage = 0;
    for (const section of completedSections) {
      switch (section) {
        case 'basic_info':
          percentage += 30;
          break;
        case 'transport':
          percentage += 20;
          break;
        case 'accommodation':
          percentage += 20;
          break;
        case 'travellers':
          percentage += 15;
          break;
        case 'budget':
          percentage += 15;
          break;
      }
    }
    percentage = Math.min(100, Math.max(0, Math.round(percentage)));

    // Planner unlocked: richiede basic_info valido.
    // I voli e gli alloggi sono ora inclusi nel Wizard iniziale (come passaggi facoltativi),
    // quindi l'accesso al Planner non deve MAI forzare l'utente a un bounce (SetupIncompleteGate).
    const plannerUnlocked = basicInfoValid;

    return {
      percentage,
      completedSections,
      missingSections,
      plannerUnlocked,
      warnings,
    };
  }

  public evaluateSetup(trip: TripSetupEvaluationInput): SetupProgress {
    return SetupCompletionEngine.evaluateSetup(trip);
  }

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

    // Poiché trasporti e alloggio sono valutati nel Wizard (e opzionali),
    // i prerequisiti bloccanti per l'accesso al Planner sono assenti: nessuna barriera (bounce) viene imposta.
    const requiredSections: SetupSectionName[] = [];

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

  public evaluate(setup: TripSetup, tripDurationNights: number): SetupCompletionReport {
    return SetupCompletionEngine.evaluate(setup, tripDurationNights);
  }
}
