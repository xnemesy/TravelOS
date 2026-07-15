import { TransportMode } from '../models/trip-setup.model';
import { ValidationResult, VALID } from './validation.types';

/**
 * ============================================================================
 * TRANSPORT SETUP — VALIDATORE (funzione pura, dominio)
 * ============================================================================
 * Stesso principio già applicato a `trip-wizard.validator.ts`: nessun I/O,
 * nessuna dipendenza da orologio/random, chiamato dalla UI invece di avere
 * le regole inline nel form (PRODUCT_PRINCIPLES.md §7/§8).
 *
 * Nota di scope — più severo dello schema di dominio (`TransportSchema`,
 * ADR-018 §3.1) su due campi: qui `origin` e `arrivalDate` sono obbligatori,
 * mentre lo schema Zod li lascia opzionali. Questa è una scelta del modulo
 * Transport Setup (form di inserimento manuale, dove sia la partenza che
 * l'arrivo sono sempre noti all'utente), non una riscrittura dell'invariante
 * di dominio deciso in ADR-018 — un `Transport` che arrivasse da un'altra
 * fonte (es. un futuro import da booking/provider) potrebbe ancora avere
 * `origin`/`arrivalDate` assenti e restare valido secondo lo schema.
 * `bookingReference` e `notes` restano opzionali, coerenti con lo schema:
 * non tutti i trasporti (es. auto propria) hanno un riferimento di
 * prenotazione.
 */

export interface TransportFormData {
  mode: TransportMode | '';
  origin: string;
  destination: string;
  departureDate: Date | null;
  arrivalDate: Date | null;
  bookingReference?: string;
  notes?: string;
}

export function validateTransportForm(data: TransportFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.mode) {
    errors.mode = 'Seleziona un mezzo di trasporto.';
  }
  if (!data.origin.trim()) {
    errors.origin = 'Indica il luogo di partenza.';
  }
  if (!data.destination.trim()) {
    errors.destination = 'Indica il luogo di arrivo.';
  }
  if (!data.departureDate) {
    errors.departureDate = 'Indica data e ora di partenza.';
  }
  if (!data.arrivalDate) {
    errors.arrivalDate = 'Indica data e ora di arrivo.';
  }
  if (data.departureDate && data.arrivalDate && data.arrivalDate < data.departureDate) {
    errors.arrivalDate = "L'arrivo non può precedere la partenza.";
  }

  return Object.keys(errors).length > 0 ? { valid: false, errors } : VALID;
}
