import { AccommodationType } from '../models/trip-setup.model';
import { ValidationResult, VALID } from './validation.types';

/**
 * ============================================================================
 * ACCOMMODATION SETUP — VALIDATORE (funzione pura, dominio)
 * ============================================================================
 * Stesso principio già applicato a `transport.validator.ts`: nessun I/O,
 * chiamata dalla UI invece di regole inline nel form.
 *
 * Nota di scope — più severo dello schema di dominio (`AccommodationSchema`)
 * su un campo: qui `address` è obbligatorio, mentre lo schema Zod lo lascia
 * opzionale (ADR-018 §3.2, invariato). Stessa scelta già fatta per
 * `Transport.origin` nel modulo Transport Setup — un form di inserimento
 * manuale può essere più severo del minimo valido di dominio senza
 * riscriverlo. `bookingReference`/`confirmationUrl`/`notes` restano
 * opzionali, coerenti con lo schema: non tutti gli alloggi hanno un numero
 * di prenotazione o un link di conferma (es. un alloggio da amici/parenti).
 */

const URL_LIKE = /^https?:\/\/.+/i;

export interface AccommodationFormData {
  type: AccommodationType | '';
  name: string;
  address: string;
  checkIn: Date | null;
  checkOut: Date | null;
  bookingReference?: string;
  confirmationUrl?: string;
  notes?: string;
}

export function validateAccommodationForm(data: AccommodationFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.type) {
    errors.type = 'Seleziona una tipologia di alloggio.';
  }
  if (!data.name.trim()) {
    errors.name = "Indica il nome dell'alloggio.";
  }
  if (!data.address.trim()) {
    errors.address = "Indica l'indirizzo.";
  }
  if (!data.checkIn) {
    errors.checkIn = 'Indica data e ora di check-in.';
  }
  if (!data.checkOut) {
    errors.checkOut = 'Indica data e ora di check-out.';
  }
  if (data.checkIn && data.checkOut && data.checkOut <= data.checkIn) {
    errors.checkOut = 'Il check-out deve essere successivo al check-in.';
  }
  if (data.confirmationUrl && data.confirmationUrl.trim() && !URL_LIKE.test(data.confirmationUrl.trim())) {
    errors.confirmationUrl = 'Inserisci un link valido (es. https://...).';
  }

  return Object.keys(errors).length > 0 ? { valid: false, errors } : VALID;
}
