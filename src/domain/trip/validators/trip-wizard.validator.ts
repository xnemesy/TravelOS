/**
 * ============================================================================
 * TRIP SETUP WIZARD — VALIDATORS (Sprint 16.1)
 * ============================================================================
 * Funzioni pure, stateless — nessun I/O, nessuna dipendenza da orologio o
 * generatore casuale (PRODUCT_PRINCIPLES.md §8), stesso principio già
 * applicato a `SetupCompletionEngine.evaluate`. Estratte qui invece che
 * inline negli step del wizard per rispettare PRODUCT_PRINCIPLES.md §7
 * ("la UI legge e scrive solo attraverso gli hook") e il vincolo esplicito
 * di questo sprint ("no business logic inside UI") — a differenza del vecchio
 * `app/trip/create.tsx`, dove le stesse regole vivevano inline in `handleSave`.
 */

import { ValidationResult, VALID } from './validation.types';

/** Alias storico — vedi `ValidationResult` in `validation.types.ts`. */
export type WizardStepValidation = ValidationResult;

const OK = VALID;

export interface BasicInfoStepData {
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
}

export function validateBasicInfoStep(data: BasicInfoStepData): WizardStepValidation {
  const errors: Record<string, string> = {};

  if (!data.title.trim()) {
    errors.title = 'Inserisci un nome per il tuo viaggio.';
  }
  if (!data.destination.trim()) {
    errors.destination = 'Specifica la destinazione.';
  }
  if (data.startDate > data.endDate) {
    errors.endDate = 'La data di ritorno deve essere successiva alla partenza.';
  }

  return Object.keys(errors).length > 0 ? { valid: false, errors } : OK;
}

export interface TravelersStepData {
  adults: number;
  children: number;
  pets: number;
}

export function validateTravelersStep(data: TravelersStepData): WizardStepValidation {
  const errors: Record<string, string> = {};

  if (!Number.isInteger(data.adults) || data.adults < 1) {
    errors.adults = 'Deve viaggiare almeno un adulto.';
  }
  if (!Number.isInteger(data.children) || data.children < 0) {
    errors.children = 'Il numero di bambini non può essere negativo.';
  }
  if (!Number.isInteger(data.pets) || data.pets < 0) {
    errors.pets = 'Il numero di animali non può essere negativo.';
  }

  return Object.keys(errors).length > 0 ? { valid: false, errors } : OK;
}

export interface BudgetStepData {
  budgetAmount?: number;
}

// Il budget è esplicitamente opzionale (requisito Sprint 16.1) — l'unica
// regola è che, se dichiarato, non sia negativo. Nessun valore forza
// l'utente a impegnarsi su una cifra per proseguire.
export function validateBudgetStep(data: BudgetStepData): WizardStepValidation {
  if (data.budgetAmount !== undefined && (!Number.isFinite(data.budgetAmount) || data.budgetAmount < 0)) {
    return { valid: false, errors: { budgetAmount: 'Il budget non può essere negativo.' } };
  }
  return OK;
}

export interface FlightsStepData {
  transports?: import('../models/trip-setup.model').Transport[];
}

/**
 * Step Flights è facoltativo (ADR-018 & Sprint 20 update):
 * Se l'utente non inserisce alcun volo/trasporto, la validazione ha successo (VALID).
 * Se l'utente ne inserisce, validiamo che le date di arrivo non precedano le partenze.
 */
export function validateFlightsStep(data: FlightsStepData): WizardStepValidation {
  if (!data.transports || data.transports.length === 0) return OK;
  const errors: Record<string, string> = {};
  data.transports.forEach((t, i) => {
    if (t.arrivalDate && t.arrivalDate < t.departureDate) {
      errors[`transport_${i}`] = `Il trasporto verso ${t.destination} ha arrivo prima della partenza.`;
    }
  });
  return Object.keys(errors).length > 0 ? { valid: false, errors } : OK;
}

export interface AccommodationStepData {
  accommodations?: import('../models/trip-setup.model').Accommodation[];
}

/**
 * Step Accommodation è facoltativo (ADR-018 & Sprint 20 update):
 * Se l'utente non inserisce alcun alloggio, la validazione ha successo (VALID).
 * Se l'utente ne inserisce, validiamo che il check-out non sia prima o uguale al check-in.
 */
export function validateAccommodationStep(data: AccommodationStepData): WizardStepValidation {
  if (!data.accommodations || data.accommodations.length === 0) return OK;
  const errors: Record<string, string> = {};
  data.accommodations.forEach((a, i) => {
    if (a.checkOut <= a.checkIn) {
      errors[`accommodation_${i}`] = `L'alloggio ${a.name || 'selezionato'} ha check-out non successivo al check-in.`;
    }
  });
  return Object.keys(errors).length > 0 ? { valid: false, errors } : OK;
}

